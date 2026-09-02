import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/firebase/helpers";
import { rotateAccessCode } from "@/lib/security/access-code";
import { NUM_SHARDS } from "@/types/index";

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

  const roundDoc = await db.doc(`events/${eventId}/rounds/${roundId}`).get();
  if (!roundDoc.exists) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  await db.runTransaction(async (tx) => {
    tx.update(db.doc(`events/${eventId}/rounds/${roundId}`), {
      status: "open",
      openedAt: now,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(db.doc(`events/${eventId}`), {
      status: "open",
      currentOpenRoundId: roundId,
      openedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      db.doc(`publicEvents/${eventId}`),
      {
        status: "open",
        currentOpenRoundId: roundId,
        currentRoundTitle: roundDoc.data()!.title,
        currentRoundStatus: "open",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    for (let i = 0; i < NUM_SHARDS; i++) {
      const shardRef = db.doc(`publicStats/${eventId}/rounds/${roundId}/shards/${i}`);
      tx.set(
        shardRef,
        {
          shardId: i,
          registered: 0,
          answering: 0,
          completed: 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  const eventDoc = await db.doc(`events/${eventId}`).get();
  if (eventDoc.data()?.requireLiveCode) {
    await rotateAccessCode(eventId);
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
