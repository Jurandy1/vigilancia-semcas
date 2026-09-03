import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/supabase/helpers";

export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  ROUND_NOT_FOUND: { status: 404, message: "Rodada não encontrada." },
  ANOTHER_EVENT_OPEN: {
    status: 409,
    message: "Existe outro evento em andamento. Encerre-o antes de resetar esta rodada.",
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

  const { data: round } = await supabase
    .from("rounds")
    .select("id,completed_count")
    .eq("id", roundId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!round) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  const { error } = await supabase.rpc("reset_round", { p_round_id: roundId });
  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? { status: 500, message: "Não foi possível resetar a rodada." };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  await writeAuditLog({
    eventId,
    action: "round_reset",
    actorType: "admin",
    actorId: admin.uid,
    roundId,
    metadata: { submissionsErased: round.completed_count ?? 0 },
  });

  return NextResponse.json({ success: true });
}
