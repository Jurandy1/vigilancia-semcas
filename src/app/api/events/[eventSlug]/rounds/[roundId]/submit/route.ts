import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAppCheck, appCheckUnauthorized } from "@/lib/security/app-check";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { submitSchema } from "@/lib/validation/submission";
import { getParticipantRoundId, getSubmissionId } from "@/lib/sessions/tokens";
import { getShardId, getShardPath } from "@/lib/counters/shard";
import { writeAuditLog } from "@/lib/firebase/helpers";
import type { Question } from "@/types/round";

import { getEventIdFromSlug } from "@/lib/data/events";
import { shouldUseMockData } from "@/lib/dev/config";
import {
  getMockQuestions,
  getMockRound,
  getParticipantFromRequestMock,
  submitMockAnswers,
} from "@/lib/data/mock-participant";

export const runtime = "nodejs";

function validateAnswers(
  questions: Question[],
  answers: { questionId: string; type: string; value: string | string[] }[]
) {
  const errors: string[] = [];
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  for (const q of questions) {
    const answer = answerMap.get(q.id);
    const isEmpty =
      !answer ||
      (Array.isArray(answer.value) ? answer.value.length === 0 : !answer.value.trim());

    if (q.required && isEmpty) {
      errors.push(`Pergunta obrigatória não respondida: ${q.title}`);
      continue;
    }
    if (!answer || isEmpty) continue;

    if (q.type === "single_choice") {
      if (typeof answer.value !== "string" || !q.options?.includes(answer.value)) {
        errors.push(`Opção inválida para: ${q.title}`);
      }
    }
    if (q.type === "multi_choice") {
      if (!Array.isArray(answer.value) || !answer.value.every((v) => q.options?.includes(v))) {
        errors.push(`Opção inválida para: ${q.title}`);
      } else if (q.maxSelections && answer.value.length > q.maxSelections) {
        errors.push(`Número de opções excede o permitido para: ${q.title}`);
      }
    }
    if (q.type === "text") {
      const max = q.maxLength ?? 2000;
      if (typeof answer.value !== "string" || answer.value.length > max) {
        errors.push(`Resposta muito longa para: ${q.title}`);
      }
    }
  }

  return errors;
}

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
    const parsed = submitSchema.safeParse(body);
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

      const questions = getMockQuestions(eventId, roundId);
      const validationErrors = validateAnswers(questions, parsed.data.answers);
      if (validationErrors.length > 0) {
        return NextResponse.json({ error: validationErrors[0] }, { status: 400 });
      }

      const result = submitMockAnswers({
        eventId,
        roundId,
        participantId: participant.id,
        mode: participant.mode,
        answers: parsed.data.answers,
      });

      return NextResponse.json({
        success: true,
        alreadySubmitted: result.alreadySubmitted,
      });
    }

    const participant = await getParticipantFromRequest(request, eventId);
    if (!participant) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const db = getAdminDb();

    const eventDoc = await db.doc(`events/${eventId}`).get();
    if (!eventDoc.exists || eventDoc.data()?.status === "closed") {
      return NextResponse.json({ error: "Evento encerrado." }, { status: 403 });
    }

    const roundDoc = await db.doc(`events/${eventId}/rounds/${roundId}`).get();
    if (!roundDoc.exists || roundDoc.data()?.status !== "open") {
      return NextResponse.json({ error: "Esta etapa não está aberta." }, { status: 403 });
    }

    const questionsSnap = await db
      .collection(`events/${eventId}/rounds/${roundId}/questions`)
      .orderBy("order")
      .get();

    const questions: Question[] = questionsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Question[];

    const validationErrors = validateAnswers(questions, parsed.data.answers);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors[0] }, { status: 400 });
    }

    const submissionId = getSubmissionId(roundId, participant.id);
    const prId = getParticipantRoundId(roundId, participant.id);
    const submissionRef = db.doc(`events/${eventId}/submissions/${submissionId}`);
    const prRef = db.doc(`events/${eventId}/participantRounds/${prId}`);
    const shardId = getShardId(participant.id, roundId);
    const shardPath = getShardPath(eventId, roundId, shardId);
    const now = Timestamp.now();

    let alreadySubmitted = false;

    await db.runTransaction(async (tx) => {
      // Firestore exige que todas as leituras da transação aconteçam antes de qualquer escrita.
      const existingSubmission = await tx.get(submissionRef);
      if (existingSubmission.exists) {
        alreadySubmitted = true;
        return;
      }

      const prDoc = await tx.get(prRef);
      if (prDoc.exists && prDoc.data()?.status === "completed") {
        alreadySubmitted = true;
        return;
      }

      const shardRef = db.doc(shardPath);
      const shardDoc = await tx.get(shardRef);
      const wasNew = !prDoc.exists;

      tx.set(submissionRef, {
        id: submissionId,
        eventId,
        roundId,
        participantId: participant.id,
        mode: participant.mode,
        answers: parsed.data.answers,
        submittedAt: now,
      });

      tx.set(
        prRef,
        {
          id: prId,
          eventId,
          roundId,
          participantId: participant.id,
          status: "completed",
          currentQuestion: questions.length,
          startedAt: prDoc.data()?.startedAt ?? now,
          lastActivityAt: now,
          completedAt: now,
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
          answering: 0,
          completed: 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const updates: Record<string, unknown> = {
          completed: FieldValue.increment(1),
          answering: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (wasNew) updates.registered = FieldValue.increment(1);
        const currentAnswering = shardDoc.data()?.answering ?? 0;
        if (currentAnswering <= 0) delete updates.answering;
        tx.update(shardRef, updates);
      }
    });

    if (!alreadySubmitted) {
      await writeAuditLog({
        eventId,
        action: "participant_completed",
        actorType: "participant",
        actorId: participant.id,
        roundId,
      });
    }

    return NextResponse.json({
      success: true,
      alreadySubmitted,
    });
  } catch (error) {
    console.error("Erro ao enviar respostas:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Tente novamente." },
      { status: 500 }
    );
  }
}
