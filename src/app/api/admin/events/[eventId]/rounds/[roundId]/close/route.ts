import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

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
  const { error } = await supabase.rpc("close_round", { p_round_id: roundId });

  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? { status: 500, message: "Não foi possível encerrar a rodada." };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  await writeAuditLog({
    eventId,
    action: "round_closed",
    actorType: "admin",
    actorId: admin.uid,
    roundId,
    metadata: {},
  });

  return NextResponse.json({ success: true });
}
