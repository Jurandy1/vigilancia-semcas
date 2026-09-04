import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, { status: number; message: string; code?: string }> = {
  EVENT_NOT_FOUND: { status: 404, message: "Evento não encontrado." },
  PARTICIPANTS_ANSWERING: {
    status: 409,
    code: "PARTICIPANTS_ANSWERING",
    message:
      "Há participantes respondendo agora. Encerre o evento ou reset com &quot;force&quot; para apagar mesmo assim.",
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const body = await request.json().catch(() => ({}));
  const force = Boolean((body as { force?: unknown }).force);

  const supabase = getSupabaseAdmin();

  const { data: before } = await supabase
    .from("events")
    .select("participant_count")
    .eq("id", eventId)
    .maybeSingle();

  const { error } = await supabase.rpc("reset_event", { p_event_id: eventId, p_force: force });
  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? { status: 500, message: "Não foi possível resetar o evento." };
    return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
  }

  await writeAuditLog({
    eventId,
    action: "event_reset",
    actorType: "admin",
    actorId: admin.uid,
    metadata: { participantsErased: before?.participant_count ?? 0, forced: force },
  });

  return NextResponse.json({ success: true });
}
