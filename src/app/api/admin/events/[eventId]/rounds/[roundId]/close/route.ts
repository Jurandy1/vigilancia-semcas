import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

const STALE_ANSWERING_SECONDS = 120;

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  ROUND_NOT_FOUND: { status: 404, message: "Rodada não encontrada." },
  ROUND_NOT_OPEN: { status: 409, message: "Esta rodada não está aberta." },
  PARTICIPANTS_STILL_ANSWERING: {
    status: 409,
    message: "Há participantes ainda respondendo. Confirme o encerramento forçado.",
  },
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
    .select("id, answering_count, status")
    .eq("id", roundId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!snapshot) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  // Pré-checagem só para UX (mensagem com contagem). A decisão autoritativa
  // e o abandon+close ficam na RPC atômica — sem janela para /submit.
  if (!force) {
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
      return now - at < STALE_ANSWERING_SECONDS * 1000;
    });

    if (active.length > 0) {
      return NextResponse.json(
        {
          error: `${active.length} participante(s) ainda estão respondendo. Confirme o encerramento forçado.`,
          code: "PARTICIPANTS_STILL_ANSWERING",
          answering: active.length,
        },
        { status: 409 }
      );
    }
  }

  const { data: result, error } = await supabase.rpc("close_round_atomic", {
    p_round_id: roundId,
    p_force: force,
    p_stale_seconds: STALE_ANSWERING_SECONDS,
  });

  if (error) {
    const code = error.message;
    if (code === "PARTICIPANTS_STILL_ANSWERING") {
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.PARTICIPANTS_STILL_ANSWERING.message,
          code: "PARTICIPANTS_STILL_ANSWERING",
          answering: snapshot.answering_count ?? 1,
        },
        { status: 409 }
      );
    }
    const mapped = ERROR_MESSAGES[code] ?? {
      status: 500,
      message: "Não foi possível encerrar a rodada.",
    };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const payload = (result ?? {}) as { abandoned?: number; forced?: boolean; activeAtClose?: number };

  await writeAuditLog({
    eventId,
    action: "round_closed",
    actorType: "admin",
    actorId: admin.uid,
    roundId,
    metadata: {
      forced: force,
      answeringAtClose: payload.activeAtClose ?? 0,
      abandonedTotal: payload.abandoned ?? 0,
      atomic: true,
    },
  });

  return NextResponse.json({
    success: true,
    forced: force,
    abandoned: payload.abandoned ?? 0,
  });
}
