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
    const status = eventDoc.data()!.status;
    if (status !== "draft" && status !== "waiting") {
      return {
        ok: false as const,
        status: 409,
        error: "Este evento não pode ser iniciado a partir do estado atual.",
      };
    }

    const eventData = eventDoc.data()!;
    if (eventData.sequenceId && (eventData.sequenceOrder ?? 0) > 0) {
      const sequenceSnap = await tx.get(
        db.collection("events").where("sequenceId", "==", eventData.sequenceId)
      );
      const pendingPrevious = sequenceSnap.docs.some((doc) => {
        const data = doc.data();
        return (data.sequenceOrder ?? 0) < eventData.sequenceOrder && data.status !== "closed";
      });
      if (pendingPrevious) {
        return {
          ok: false as const,
          status: 409,
          error: "Este evento faz parte de uma sequência. Inicie e finalize os eventos anteriores primeiro.",
        };
      }
    }

    const openEventsSnap = await tx.get(
      db.collection("events").where("status", "==", "open")
    );
    const otherEventOpen = openEventsSnap.docs.some((d) => d.id !== eventId);
    if (otherEventOpen) {
      return {
        ok: false as const,
        status: 409,
        error: "Já existe um evento em andamento. Finalize o evento atual antes de iniciar outro.",
      };
    }

    tx.update(eventRef, {
      status: "open",
      openedAt: now,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      db.doc(`publicEvents/${eventId}`),
      {
        status: "open",
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
    action: "event_opened",
    actorType: "admin",
    actorId: admin.uid,
  });

  return NextResponse.json({ success: true });
}
