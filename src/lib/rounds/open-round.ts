import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { rotateAccessCode } from "@/lib/security/access-code";
import { NUM_SHARDS } from "@/types/index";

export type OpenRoundResult =
  | { ok: true; roundId: string; roundTitle: string }
  | { ok: false; status: number; error: string };

/**
 * Abre uma rodada dentro de um evento. Server-side, dentro de uma única transação:
 * exige que o evento já esteja "open" e que nenhuma outra rodada do evento esteja
 * "open" — a UI também bloqueia isso preventivamente, mas essa é a proteção definitiva.
 */
export async function openRoundTransaction(
  eventId: string,
  roundId: string
): Promise<OpenRoundResult> {
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
        error: "O evento precisa estar em andamento antes de iniciar uma rodada.",
      };
    }

    const roundRef = db.doc(`events/${eventId}/rounds/${roundId}`);
    const roundDoc = await tx.get(roundRef);
    if (!roundDoc.exists) {
      return { ok: false as const, status: 404, error: "Rodada não encontrada." };
    }
    const roundStatus = roundDoc.data()!.status;
    if (roundStatus === "open") {
      return { ok: false as const, status: 409, error: "Esta rodada já está aberta." };
    }
    if (roundStatus === "closed") {
      return {
        ok: false as const,
        status: 409,
        error: "Esta rodada já foi encerrada e não pode ser reaberta.",
      };
    }

    const openRoundsSnap = await tx.get(
      db.collection(`events/${eventId}/rounds`).where("status", "==", "open")
    );
    const otherRoundOpen = openRoundsSnap.docs.some((d) => d.id !== roundId);
    if (otherRoundOpen) {
      return {
        ok: false as const,
        status: 409,
        error: "Já existe uma rodada em andamento. Encerre-a antes de abrir outra.",
      };
    }

    tx.update(roundRef, {
      status: "open",
      openedAt: now,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(eventRef, {
      currentOpenRoundId: roundId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      db.doc(`publicEvents/${eventId}`),
      {
        currentOpenRoundId: roundId,
        currentRoundId: roundId,
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

    return {
      ok: true as const,
      roundId,
      roundTitle: roundDoc.data()!.title as string,
    };
  });

  if (!result.ok) return result;

  const eventDoc = await db.doc(`events/${eventId}`).get();
  if (eventDoc.data()?.requireLiveCode) {
    await rotateAccessCode(eventId);
  }

  return result;
}
