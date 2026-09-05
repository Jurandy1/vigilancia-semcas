import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { updateEventSettingsSchema } from "@/lib/validation/event";
import { rotateAccessChallenge } from "@/lib/security/access-code";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const supabase = getSupabaseAdmin();
  const { data: d } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!d) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    event: {
      id: d.id,
      title: d.title,
      slug: d.slug,
      description: d.description ?? null,
      projectorTitle: d.projector_title ?? null,
      status: d.status,
      isTest: d.is_test ?? false,
      requireLiveCode: d.require_live_code ?? false,
      participantCount: d.participant_count ?? 0,
      createdAt: d.created_at,
      openedAt: d.opened_at ?? null,
      closedAt: d.closed_at ?? null,
      sequenceId: d.sequence_id ?? null,
      sequenceOrder: d.sequence_order ?? null,
      sequenceSize: d.sequence_size ?? null,
      sequenceRootEventId: d.sequence_root_event_id ?? null,
      sequenceRootSlug: d.sequence_root_slug ?? null,
      nextEventId: d.next_event_id ?? null,
      nextEventTitle: d.next_event_title ?? null,
      nextEventSlug: d.next_event_slug ?? null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("events")
    .select("id, status, require_live_code, access_code_expires_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateEventSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const eventUpdates: Record<string, unknown> = { updated_at: now };
  const publicUpdates: Record<string, unknown> = { updated_at: now };

  if (parsed.data.title !== undefined) {
    eventUpdates.title = parsed.data.title;
    publicUpdates.title = parsed.data.title;
  }
  if (parsed.data.description !== undefined) {
    eventUpdates.description = parsed.data.description;
    publicUpdates.description = parsed.data.description;
  }
  if (parsed.data.projectorTitle !== undefined) {
    eventUpdates.projector_title = parsed.data.projectorTitle;
    publicUpdates.projector_title = parsed.data.projectorTitle;
  }
  if (parsed.data.requireLiveCode !== undefined) {
    eventUpdates.require_live_code = parsed.data.requireLiveCode;
    publicUpdates.require_live_code = parsed.data.requireLiveCode;
  }
  if (parsed.data.isTest !== undefined) {
    eventUpdates.is_test = parsed.data.isTest;
  }

  await supabase.from("events").update(eventUpdates).eq("id", eventId);
  await supabase.from("public_events").update(publicUpdates).eq("event_id", eventId);

  // Ligar "Exigir código temporário" não gerava código nenhum — o campo só
  // era populado ao abrir uma rodada ou pelo telão se autorrenovando. Se o
  // admin ligasse o switch fora desses momentos, todo mundo ficava sem
  // conseguir entrar até alguém clicar "Gerar novo código agora" manualmente.
  // Gera na hora se está ligando o requisito num evento já em andamento e não
  // existe um código ainda válido.
  const turningOn = parsed.data.requireLiveCode === true && !existing.require_live_code;
  const codeStillValid =
    existing.access_code_expires_at && new Date(existing.access_code_expires_at) > new Date();
  if (turningOn && existing.status === "open" && !codeStillValid) {
    await rotateAccessChallenge(eventId);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  if (event.status === "open") {
    return NextResponse.json(
      { error: "Um evento em andamento não pode ser excluído. Encerre-o primeiro." },
      { status: 409 }
    );
  }

  if (event.sequence_id) {
    const { data: sequenceRows } = await supabase
      .from("events")
      .select("*")
      .eq("sequence_id", event.sequence_id);

    const remaining = (sequenceRows ?? [])
      .filter((row) => row.id !== eventId)
      .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

    if (remaining.length >= 2) {
      const root = remaining[0]!;
      for (const [index, row] of remaining.entries()) {
        const next = remaining[index + 1] ?? null;
        const sequence = {
          sequence_id: event.sequence_id,
          sequence_order: index,
          sequence_size: remaining.length,
          sequence_root_event_id: root.id,
          sequence_root_slug: root.slug,
          next_event_id: next?.id ?? null,
          next_event_title: next?.title ?? null,
          next_event_slug: next?.slug ?? null,
          updated_at: new Date().toISOString(),
        };
        await supabase.from("events").update(sequence).eq("id", row.id);
        await supabase
          .from("public_events")
          .update({
            sequence_id: sequence.sequence_id,
            sequence_order: sequence.sequence_order,
            sequence_size: sequence.sequence_size,
            sequence_root_event_id: sequence.sequence_root_event_id,
            sequence_root_slug: sequence.sequence_root_slug,
            next_event_id: sequence.next_event_id,
            next_event_title: sequence.next_event_title,
            next_event_slug: sequence.next_event_slug,
            updated_at: sequence.updated_at,
          })
          .eq("event_id", row.id);
      }
    } else {
      const cleared = {
        sequence_id: null,
        sequence_order: null,
        sequence_size: null,
        sequence_root_event_id: null,
        sequence_root_slug: null,
        next_event_id: null,
        next_event_title: null,
        next_event_slug: null,
        updated_at: new Date().toISOString(),
      };
      for (const row of remaining) {
        await supabase.from("events").update(cleared).eq("id", row.id);
        await supabase.from("public_events").update(cleared).eq("event_id", row.id);
      }
    }

    // O QR/link fixo (/e/atual, /projector/atual) segue quem estiver marcado
    // como is_daily_active. Isso ficava preso na linha do evento raiz — se
    // essa linha for excluída, a marca sumia com ela e o link fixo parava
    // de encontrar qualquer evento. Transfere para o novo primeiro evento
    // da sequência (ou para o único que sobrar, se a sequência acabou).
    if (event.is_daily_active && remaining.length > 0) {
      await supabase.rpc("set_daily_active_event", { p_event_id: remaining[0]!.id });
    }
  }

  // Zera a referência circular (events.current_open_round_id -> rounds.id) antes de excluir,
  // já que essa FK não tem ON DELETE CASCADE e bloquearia a exclusão das rodadas.
  if (event.current_open_round_id) {
    await supabase.from("events").update({ current_open_round_id: null }).eq("id", eventId);
  }

  // Precisa ser gravado ANTES do delete: audit_log.event_id referencia
  // events.id, então logar depois da exclusão falharia a FK. A ação fica
  // registrada mesmo depois (a FK usa "on delete set null", não cascade).
  await writeAuditLog({
    eventId,
    action: "event_deleted",
    actorType: "admin",
    actorId: admin.uid,
    metadata: {
      eventId,
      title: event.title,
      slug: event.slug,
      status: event.status,
      participantCount: event.participant_count ?? 0,
    },
  });

  // ON DELETE CASCADE cuida de rounds/questions/participants/participantRounds/submissions/public_round_stats.
  const { error: deleteError } = await supabase.from("events").delete().eq("id", eventId);
  if (deleteError) {
    return NextResponse.json(
      { error: "Não foi possível excluir o evento. Tente novamente." },
      { status: 500 }
    );
  }
  await supabase.from("public_events").delete().eq("event_id", eventId);

  return NextResponse.json({ success: true });
}
