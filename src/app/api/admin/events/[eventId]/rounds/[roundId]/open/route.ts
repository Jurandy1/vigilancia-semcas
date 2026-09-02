import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/firebase/helpers";
import { openRoundTransaction } from "@/lib/rounds/open-round";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const result = await openRoundTransaction(eventId, roundId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    eventId,
    action: "round_opened",
    actorType: "admin",
    actorId: admin.uid,
    roundId,
  });

  return NextResponse.json({ success: true });
}
