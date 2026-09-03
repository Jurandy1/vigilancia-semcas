import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  EVENT_NOT_FOUND: { status: 404, message: "Evento não encontrado." },
  EVENT_NOT_STARTABLE: { status: 409, message: "Este evento não pode ser iniciado a partir do estado atual." },
  SEQUENCE_PENDING_PREVIOUS: {
    status: 409,
    message: "Este evento faz parte de uma sequência. Inicie e finalize os eventos anteriores primeiro.",
  },
  ANOTHER_EVENT_OPEN: {
    status: 409,
    message: "Já existe um evento em andamento. Finalize o evento atual antes de iniciar outro.",
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("open_event", { p_event_id: eventId });

  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? { status: 500, message: "Não foi possível iniciar o evento." };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  await writeAuditLog({ eventId, action: "event_opened", actorType: "admin", actorId: admin.uid });

  return NextResponse.json({ success: true });
}
