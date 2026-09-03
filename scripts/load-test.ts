/**
 * Teste de carga isolado.
 * Cria seus próprios dados, simula os votos e remove tudo ao terminar.
 */
import "./load-env";
import { performance } from "node:perf_hooks";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../src/lib/firebase/admin";
import {
  generateSessionToken,
  getParticipantRoundId,
  getSessionExpiry,
  getSubmissionId,
  hashSessionToken,
} from "../src/lib/sessions/tokens";
import {
  getEventParticipantShardPath,
  getShardId,
  getShardPath,
} from "../src/lib/counters/shard";
import { NUM_SHARDS } from "../src/types";

const NUM_PARTICIPANTS = Number(process.env.LOAD_TEST_PARTICIPANTS ?? 200);
const ANSWER_OPTIONS = ["Aprovo", "Aprovo com ressalvas", "Não aprovo"];

function percentile(values: number[], percent: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

async function main() {
  if (!Number.isInteger(NUM_PARTICIPANTS) || NUM_PARTICIPANTS < 1) {
    throw new Error("LOAD_TEST_PARTICIPANTS deve ser um número inteiro positivo.");
  }

  const db = getAdminDb();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventRef = db.collection("events").doc(`load-test-${suffix}`);
  const eventId = eventRef.id;
  const eventSlug = `load-test-${suffix}`;
  const publicEventRef = db.collection("publicEvents").doc(eventSlug);
  const publicStatsRef = db.collection("publicStats").doc(eventId);
  const roundRef = eventRef.collection("rounds").doc("round-001");
  const roundId = roundRef.id;
  const latencies: number[] = [];
  const startedAt = performance.now();

  console.log(`Preparando teste isolado com ${NUM_PARTICIPANTS} votantes...`);

  try {
    const setup = db.batch();
    const now = Timestamp.now();
    setup.set(eventRef, {
      name: "Teste isolado de carga",
      slug: eventSlug,
      status: "open",
      isTest: true,
      participantCount: 0,
      currentRoundId: roundId,
      createdAt: now,
      updatedAt: now,
    });
    setup.set(publicEventRef, {
      eventId,
      name: "Teste isolado de carga",
      slug: eventSlug,
      status: "open",
      currentRoundId: roundId,
      updatedAt: now,
    });
    setup.set(roundRef, {
      title: "Rodada de validação",
      status: "open",
      order: 1,
      questionCount: 3,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < 3; i += 1) {
      setup.set(roundRef.collection("questions").doc(`question-${i + 1}`), {
        text: `Questão ${i + 1}`,
        type: "single_choice",
        options: ANSWER_OPTIONS,
        order: i + 1,
        required: true,
      });
    }

    for (let shardId = 0; shardId < NUM_SHARDS; shardId += 1) {
      setup.set(db.doc(getShardPath(eventId, roundId, shardId)), {
        shardId,
        registered: 0,
        answering: 0,
        completed: 0,
        updatedAt: now,
      });
    }
    await setup.commit();

    const results = await Promise.allSettled(
      Array.from({ length: NUM_PARTICIPANTS }, async (_, index) => {
        const operationStartedAt = performance.now();
        const participantRef = eventRef.collection("participants").doc();
        const participantId = participantRef.id;
        const sessionToken = generateSessionToken();
        const joinedAt = Timestamp.now();
        const participantShardId = getShardId(participantId, eventId);

        const joinBatch = db.batch();
        joinBatch.set(participantRef, {
          eventId,
          mode: index % 3 === 0 ? "anonymous" : "identified",
          name: index % 3 === 0 ? null : `Participante ${index + 1}`,
          sessionTokenHash: hashSessionToken(sessionToken),
          sessionExpiresAt: Timestamp.fromDate(getSessionExpiry()),
          createdAt: joinedAt,
          lastActivityAt: joinedAt,
        });
        joinBatch.set(
          db.doc(getEventParticipantShardPath(eventId, participantShardId)),
          {
            count: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await joinBatch.commit();

        const submissionId = getSubmissionId(roundId, participantId);
        const participantRoundId = getParticipantRoundId(roundId, participantId);
        const roundShardId = getShardId(participantId, roundId);
        const submissionRef = eventRef.collection("submissions").doc(submissionId);
        const participantRoundRef = eventRef
          .collection("participantRounds")
          .doc(participantRoundId);
        const roundShardRef = db.doc(getShardPath(eventId, roundId, roundShardId));
        const submittedAt = Timestamp.now();
        const answers = Array.from({ length: 3 }, (_, questionIndex) => ({
          questionId: `question-${questionIndex + 1}`,
          type: "single_choice",
          value: ANSWER_OPTIONS[(index + questionIndex) % ANSWER_OPTIONS.length]!,
        }));

        await db.runTransaction(async (transaction) => {
          const submissionSnapshot = await transaction.get(submissionRef);
          const shardSnapshot = await transaction.get(roundShardRef);
          if (submissionSnapshot.exists) return;
          if (!shardSnapshot.exists) throw new Error(`Shard ${roundShardId} não inicializado.`);

          transaction.set(submissionRef, {
            id: submissionId,
            eventId,
            roundId,
            participantId,
            mode: index % 3 === 0 ? "anonymous" : "identified",
            answers,
            submittedAt,
          });
          transaction.set(
            participantRoundRef,
            {
              id: participantRoundId,
              eventId,
              roundId,
              participantId,
              status: "completed",
              currentQuestion: answers.length,
              startedAt: joinedAt,
              lastActivityAt: submittedAt,
              completedAt: submittedAt,
            },
            { merge: true }
          );
          transaction.update(roundShardRef, {
            registered: FieldValue.increment(1),
            completed: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        latencies.push(performance.now() - operationStartedAt);
        return participantId;
      })
    );

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    const participantsCount = (
      await eventRef.collection("participants").count().get()
    ).data().count;
    const submissionsCount = (
      await eventRef.collection("submissions").count().get()
    ).data().count;
    const participantShards = await publicStatsRef.collection("participantShards").get();
    const roundShards = await publicStatsRef
      .collection("rounds")
      .doc(roundId)
      .collection("shards")
      .get();
    const participantShardCount = participantShards.docs.reduce(
      (sum, document) => sum + Number(document.data().count ?? 0),
      0
    );
    const completedShardCount = roundShards.docs.reduce(
      (sum, document) => sum + Number(document.data().completed ?? 0),
      0
    );
    const durationMs = performance.now() - startedAt;

    const summary = {
      requested: NUM_PARTICIPANTS,
      succeeded: results.length - failures.length,
      failed: failures.length,
      participants: participantsCount,
      submissions: submissionsCount,
      participantCounter: participantShardCount,
      completedCounter: completedShardCount,
      durationMs: Math.round(durationMs),
      throughputPerSecond: Number(((results.length - failures.length) / (durationMs / 1000)).toFixed(2)),
      latencyMs: {
        p50: Math.round(percentile(latencies, 50)),
        p95: Math.round(percentile(latencies, 95)),
        max: Math.round(Math.max(0, ...latencies)),
      },
    };

    console.log(JSON.stringify(summary, null, 2));
    if (failures.length > 0) {
      console.error("Primeiras falhas:", failures.slice(0, 5).map((failure) => failure.reason));
    }

    const countsAreExact = [
      participantsCount,
      submissionsCount,
      participantShardCount,
      completedShardCount,
    ].every((count) => count === NUM_PARTICIPANTS);
    if (failures.length > 0 || !countsAreExact) {
      throw new Error("Teste reprovado: houve falha ou divergência nos contadores.");
    }

    console.log(
      `Teste aprovado: ${NUM_PARTICIPANTS} votantes processados sem perda ou divergência.`
    );
  } finally {
    await Promise.all([
      db.recursiveDelete(eventRef),
      db.recursiveDelete(publicStatsRef),
      publicEventRef.delete(),
    ]);
    console.log("Dados isolados do teste removidos.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
