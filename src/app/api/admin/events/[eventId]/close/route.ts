import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/firebase/helpers";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const db = getAdminDb();
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    // Firestore exige que todas as leituras da transação aconteçam antes de qualquer escrita.
    const eventRef = db.doc(`events/${eventId}`);
    const eventDoc = await tx.get(eventRef);
    if (!eventDoc.exists) {
      return { ok: false as const, status: 404, error: "Evento não encontrado." };
    }
    if (eventDoc.data()!.status !== "open") {
      return {
        ok: false as const,
        status: 409,
        error: "Somente um evento em andamento pode ser finalizado.",
      };
    }

    const openRoundsSnap = await tx.get(
      db.collection(`events/${eventId}/rounds`).where("status", "==", "open")
    );
    if (!openRoundsSnap.empty) {
      return {
        ok: false as const,
        status: 409,
        error: "Existe uma rodada em andamento. Encerre a rodada antes de finalizar o evento.",
      };
    }

    tx.update(eventRef, {
      status: "closed",
      closedAt: now,
      currentOpenRoundId: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      db.doc(`publicEvents/${eventId}`),
      {
        status: "closed",
        currentOpenRoundId: null,
        currentRoundStatus: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true as const };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    eventId,
    action: "event_closed",
    actorType: "admin",
    actorId: admin.uid,
  });

  return NextResponse.json({ success: true });
}
