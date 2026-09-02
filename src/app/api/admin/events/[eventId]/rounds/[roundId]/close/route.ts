import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/firebase/helpers";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const db = getAdminDb();
  const now = Timestamp.now();

  await db.runTransaction(async (tx) => {
    // Firestore exige que todas as leituras da transação aconteçam antes de qualquer escrita.
    const eventRef = db.doc(`events/${eventId}`);
    const eventDoc = await tx.get(eventRef);

    tx.update(db.doc(`events/${eventId}/rounds/${roundId}`), {
      status: "closed",
      closedAt: now,
    });

    if (eventDoc.data()?.currentOpenRoundId === roundId) {
      tx.update(eventRef, {
        currentOpenRoundId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        db.doc(`publicEvents/${eventId}`),
        {
          currentOpenRoundId: null,
          currentRoundStatus: "closed",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  await writeAuditLog({
    eventId,
    action: "round_closed",
    actorType: "admin",
    actorId: admin.uid,
    roundId,
  });

  return NextResponse.json({ success: true });
}
