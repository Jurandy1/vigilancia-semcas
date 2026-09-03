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
    const currentRef = db.doc(`events/${eventId}`);
    const currentDoc = await tx.get(currentRef);
    if (!currentDoc.exists) {
      return { ok: false as const, status: 404, error: "Evento não encontrado." };
    }

    const current = currentDoc.data()!;
    if (!current.nextEventId) {
      return { ok: false as const, status: 409, error: "Este é o último evento da sequência." };
    }

    const nextRef = db.doc(`events/${current.nextEventId}`);
    const nextDoc = await tx.get(nextRef);
    const openRounds = await tx.get(
      db.collection(`events/${eventId}/rounds`).where("status", "==", "open")
    );
    const openEvents = await tx.get(db.collection("events").where("status", "==", "open"));

    if (!nextDoc.exists) {
      return { ok: false as const, status: 404, error: "O próximo evento não foi encontrado." };
    }
    if (!openRounds.empty) {
      return {
        ok: false as const,
        status: 409,
        error: "Encerre a rodada em andamento antes de avançar para o próximo evento.",
      };
    }
    if (current.status !== "open" && current.status !== "closed") {
      return {
        ok: false as const,
        status: 409,
        error: "Inicie o evento atual antes de avançar na sequência.",
      };
    }

    const nextData = nextDoc.data()!;
    if (nextData.status !== "draft" && nextData.status !== "waiting") {
      return {
        ok: false as const,
        status: 409,
        error: "O próximo evento não está disponível para início.",
      };
    }

    const anotherOpen = openEvents.docs.some((doc) => doc.id !== eventId && doc.id !== nextDoc.id);
    if (anotherOpen) {
      return {
        ok: false as const,
        status: 409,
        error: "Existe outro evento em andamento. Encerre-o antes de continuar.",
      };
    }

    tx.set(
      currentRef,
      {
        status: "closed",
        closedAt: current.closedAt ?? now,
        currentOpenRoundId: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
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
    tx.set(
      nextRef,
      { status: "open", openedAt: now, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.set(
      db.doc(`publicEvents/${nextDoc.id}`),
      { status: "open", updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return {
      ok: true as const,
      nextEventId: nextDoc.id,
      nextEventSlug: nextData.slug as string,
      nextEventTitle: nextData.title as string,
    };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await Promise.all([
    writeAuditLog({ eventId, action: "event_closed", actorType: "admin", actorId: admin.uid }),
    writeAuditLog({
      eventId: result.nextEventId,
      action: "event_opened",
      actorType: "admin",
      actorId: admin.uid,
      metadata: { previousEventId: eventId },
    }),
  ]);

  return NextResponse.json({ success: true, ...result });
}
