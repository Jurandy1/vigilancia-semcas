import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { rotateAccessCode } from "@/lib/security/access-code";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const code = await rotateAccessCode(eventId);

  return NextResponse.json({ success: true, code });
}
