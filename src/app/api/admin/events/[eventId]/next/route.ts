import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  EVENT_NOT_FOUND: { status: 404, message: "Evento não encontrado." },
  NO_NEXT_EVENT: { status: 409, message: "Este é o último evento da sequência." },
  ROUND_STILL_OPEN: {
    status: 409,
    message: "Encerre a rodada em andamento antes de avançar para o próximo evento.",
  },
  ANOTHER_EVENT_OPEN: {
    status: 409,
    message: "Existe outro evento em andamento. Encerre-o antes de continuar.",
  },
  EVENT_NOT_STARTABLE: { status: 409, message: "O próximo evento não está disponível para início." },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: currentRound } = await supabase
    .from("rounds")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "open")
    .maybeSingle();
  if (currentRound) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.ROUND_STILL_OPEN!.message },
      { status: ERROR_MESSAGES.ROUND_STILL_OPEN!.status }
    );
  }

  const { data: nextEventId, error } = await supabase.rpc("advance_sequence", { p_event_id: eventId });

  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? { status: 500, message: "Não foi possível avançar para o próximo evento." };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const { data: nextEvent } = await supabase
    .from("events")
    .select("slug, title")
    .eq("id", nextEventId as string)
    .maybeSingle();

  await Promise.all([
    writeAuditLog({ eventId, action: "event_closed", actorType: "admin", actorId: admin.uid }),
    writeAuditLog({
      eventId: nextEventId as string,
      action: "event_opened",
      actorType: "admin",
      actorId: admin.uid,
      metadata: { previousEventId: eventId },
    }),
  ]);

  return NextResponse.json({
    success: true,
    nextEventId,
    nextEventSlug: nextEvent?.slug ?? null,
    nextEventTitle: nextEvent?.title ?? null,
  });
}
