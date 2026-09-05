import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

/** Sem atividade recente = abandonou a tela (Wi‑Fi caiu, saiu do app, desistiu). */
const STALE_ANSWERING_MS = 2 * 60 * 1000;

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  ROUND_NOT_FOUND: { status: 404, message: "Rodada não encontrada." },
  ROUND_NOT_OPEN: { status: 409, message: "Esta rodada não está aberta." },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const supabase = getSupabaseAdmin();
  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const force = Boolean(body.force);

  const { data: snapshot } = await supabase
    .from("rounds")
    .select("answering_count, status")
    .eq("id", roundId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!snapshot) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  // PK de participant_rounds é (round_id, participant_id) — NÃO existe coluna id.
  const { data: answeringRows, error: answeringError } = await supabase
    .from("participant_rounds")
    .select("participant_id, last_activity_at")
    .eq("round_id", roundId)
    .eq("status", "answering");

  if (answeringError) {
    return NextResponse.json(
      { error: "Não foi possível verificar quem ainda está respondendo." },
      { status: 500 }
    );
  }

  const now = Date.now();
  const active = (answeringRows ?? []).filter((row) => {
    const at = Date.parse(row.last_activity_at ?? "");
    if (!Number.isFinite(at)) return true;
    return now - at < STALE_ANSWERING_MS;
  });
  const stale = (answeringRows ?? []).filter(
    (row) => !active.some((a) => a.participant_id === row.participant_id)
  );

  // Quem parou há 2+ min não bloqueia o encerramento — trata como abandono.
  // Contador fantasma (answering_count > 0 sem linhas) também não bloqueia.
  if (active.length > 0 && !force) {
    return NextResponse.json(
      {
        error: `${active.length} participante(s) ainda estão respondendo. Confirme o encerramento forçado.`,
        code: "PARTICIPANTS_STILL_ANSWERING",
        answering: active.length,
        staleAbandoned: stale.length,
      },
      { status: 409 }
    );
  }

  const abandonParticipantIds = (force ? answeringRows ?? [] : stale).map((r) => r.participant_id);

  if (abandonParticipantIds.length > 0) {
    // Não marca como completed (não enviou). Volta a waiting para o
    // contador de "respondendo" zerar sem inventar voto.
    await supabase
      .from("participant_rounds")
      .update({ status: "waiting", last_activity_at: new Date().toISOString() })
      .eq("round_id", roundId)
      .in("participant_id", abandonParticipantIds);
  }

  const { error } = await supabase.rpc("close_round", { p_round_id: roundId });

  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? {
      status: 500,
      message: "Não foi possível encerrar a rodada.",
    };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  // Garante contador zerado após o close (tela/projetor não ficam com "respondendo").
  await supabase.from("rounds").update({ answering_count: 0 }).eq("id", roundId);
  await supabase
    .from("public_round_stats")
    .update({ answering_count: 0, updated_at: new Date().toISOString() })
    .eq("round_id", roundId);

  await writeAuditLog({
    eventId,
    action: "round_closed",
    actorType: "admin",
    actorId: admin.uid,
    roundId,
    metadata: {
      forced: force,
      answeringAtClose: active.length,
      staleAbandoned: stale.length,
      abandonedTotal: abandonParticipantIds.length,
      ghostCounter: Math.max(0, (snapshot.answering_count ?? 0) - (answeringRows?.length ?? 0)),
    },
  });

  return NextResponse.json({
    success: true,
    forced: force,
    abandoned: abandonParticipantIds.length,
  });
}
