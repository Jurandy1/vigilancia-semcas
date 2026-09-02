import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAppCheck, appCheckUnauthorized } from "@/lib/security/app-check";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { progressSchema } from "@/lib/validation/submission";
import { getParticipantRoundId } from "@/lib/sessions/tokens";
import { getShardId, getShardPath } from "@/lib/counters/shard";

import { getEventIdFromSlug } from "@/lib/data/events";
import { shouldUseMockData } from "@/lib/dev/config";
import {
  getMockRound,
  getParticipantFromRequestMock,
  updateMockProgress,
} from "@/lib/data/mock-participant";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string; roundId: string }> }
) {
  try {
    const appCheckOk = await verifyAppCheck(request);
    if (!appCheckOk) return appCheckUnauthorized();

    const { eventSlug, roundId } = await params;
    const eventId = await getEventIdFromSlug(eventSlug);
    if (!eventId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = progressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    if (shouldUseMockData()) {
      const participant = await getParticipantFromRequestMock(request, eventId);
      if (!participant) {
        return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
      }

      const round = getMockRound(eventId, roundId);
      if (!round || round.status !== "open") {
        return NextResponse.json({ error: "Esta etapa não está aberta." }, { status: 403 });
      }

      updateMockProgress({
        eventId,
        roundId,
        participantId: participant.id,
        currentQuestion: parsed.data.currentQuestion,
      });

      return NextResponse.json({ success: true });
    }

    const participant = await getParticipantFromRequest(request, eventId);
    if (!participant) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const db = getAdminDb();
    const roundDoc = await db.doc(`events/${eventId}/rounds/${roundId}`).get();
    if (!roundDoc.exists || roundDoc.data()?.status !== "open") {
      return NextResponse.json({ error: "Esta etapa não está aberta." }, { status: 403 });
    }

    const prId = getParticipantRoundId(roundId, participant.id);
    const prRef = db.doc(`events/${eventId}/participantRounds/${prId}`);
    const prDoc = await prRef.get();

    if (prDoc.exists && prDoc.data()?.status === "completed") {
      return NextResponse.json({ error: "Participação já registrada." }, { status: 409 });
    }

    const now = Timestamp.now();
    const shardId = getShardId(participant.id, roundId);
    const shardPath = getShardPath(eventId, roundId, shardId);

    await db.runTransaction(async (tx) => {
      // Firestore exige que todas as leituras da transação aconteçam antes de qualquer escrita.
      const freshPr = await tx.get(prRef);
      if (freshPr.exists && freshPr.data()?.status === "completed") return;

      const shardRef = db.doc(shardPath);
      const shardDoc = await tx.get(shardRef);

      const wasNew = !freshPr.exists;
      const prevStatus = freshPr.data()?.status;

      tx.set(
        prRef,
        {
          id: prId,
          eventId,
          roundId,
          participantId: participant.id,
          status: parsed.data.status ?? "answering",
          currentQuestion: parsed.data.currentQuestion,
          startedAt: freshPr.data()?.startedAt ?? now,
          lastActivityAt: now,
          completedAt: null,
        },
        { merge: true }
      );

      tx.update(db.doc(`events/${eventId}/participants/${participant.id}`), {
        lastActivityAt: now,
      });

      if (!shardDoc.exists) {
        tx.set(shardRef, {
          shardId,
          registered: wasNew ? 1 : 0,
          answering: 1,
          completed: 0,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const updates: Record<string, unknown> = {
          answering: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (wasNew) updates.registered = FieldValue.increment(1);
        if (prevStatus === "completed") updates.completed = FieldValue.increment(-1);
        tx.update(shardRef, updates);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao registrar progresso:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Tente novamente." },
      { status: 500 }
    );
  }
}
