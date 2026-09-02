/**
 * Load test — somente para eventos isTest === true.
 * Uso: npm run load-test
 */
import "./load-env";
import { getAdminDb } from "../src/lib/firebase/admin";
import {
  generateSessionToken,
  hashSessionToken,
  getSubmissionId,
  getParticipantRoundId,
  getSessionExpiry,
} from "../src/lib/sessions/tokens";
import { getShardId, getShardPath } from "../src/lib/counters/shard";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const NUM_PARTICIPANTS = 100;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  const db = getAdminDb();

  const eventsSnap = await db
    .collection("events")
    .where("isTest", "==", true)
    .limit(1)
    .get();

  if (eventsSnap.empty) {
    console.error("Nenhum evento de teste encontrado. Execute npm run seed primeiro.");
    process.exit(1);
  }

  const eventDoc = eventsSnap.docs[0]!;
  const eventId = eventDoc.id;
  const eventData = eventDoc.data();

  const roundsSnap = await db
    .collection(`events/${eventId}/rounds`)
    .where("status", "==", "open")
    .limit(1)
    .get();

  if (roundsSnap.empty) {
    console.error("Nenhuma rodada aberta. Abra uma rodada antes do load test.");
    process.exit(1);
  }

  const roundId = roundsSnap.docs[0]!.id;
  const questionsSnap = await db
    .collection(`events/${eventId}/rounds/${roundId}/questions`)
    .orderBy("order")
    .get();

  const questions = questionsSnap.docs.map((d) => ({
    id: d.id,
    type: d.data().type as string,
    options: d.data().options as string[] | undefined,
  }));

  console.log(`Iniciando load test: ${NUM_PARTICIPANTS} participantes`);
  console.log(`Evento: ${eventId}, Rodada: ${roundId}`);

  const results = await Promise.allSettled(
    Array.from({ length: NUM_PARTICIPANTS }, async (_, i) => {
      const participantRef = db.collection(`events/${eventId}/participants`).doc();
      const participantId = participantRef.id;
      const sessionToken = generateSessionToken();
      const now = Timestamp.now();

      await participantRef.set({
        eventId,
        mode: i % 3 === 0 ? "anonymous" : "identified",
        name: i % 3 === 0 ? null : `Participante ${i + 1}`,
        sessionTokenHash: hashSessionToken(sessionToken),
        sessionExpiresAt: Timestamp.fromDate(getSessionExpiry()),
        createdAt: now,
        lastActivityAt: now,
      });

      const answers = questions.map((q) => {
        if (q.type === "single_choice") {
          const opts = q.options as string[];
          return { questionId: q.id, type: q.type, value: opts[i % opts.length] };
        }
        return { questionId: q.id, type: q.type, value: `Resposta do participante ${i + 1}` };
      });

      const submissionId = getSubmissionId(roundId, participantId);
      const prId = getParticipantRoundId(roundId, participantId);
      const shardId = getShardId(participantId, roundId);
      const shardPath = getShardPath(eventId, roundId, shardId);

      await db.runTransaction(async (tx) => {
        const existing = await tx.get(db.doc(`events/${eventId}/submissions/${submissionId}`));
        if (existing.exists) return;

        tx.set(db.doc(`events/${eventId}/submissions/${submissionId}`), {
          id: submissionId,
          eventId,
          roundId,
          participantId,
          mode: i % 3 === 0 ? "anonymous" : "identified",
          answers,
          submittedAt: now,
        });

        tx.set(
          db.doc(`events/${eventId}/participantRounds/${prId}`),
          {
            id: prId,
            eventId,
            roundId,
            participantId,
            status: "completed",
            currentQuestion: questions.length,
            startedAt: now,
            lastActivityAt: now,
            completedAt: now,
          },
          { merge: true }
        );

        const shardRef = db.doc(shardPath);
        const shardDoc = await tx.get(shardRef);
        if (!shardDoc.exists) {
          tx.set(shardRef, {
            shardId,
            registered: 1,
            answering: 0,
            completed: 1,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(shardRef, {
            registered: FieldValue.increment(1),
            completed: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

      return participantId;
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  const submissionsSnap = await db
    .collection(`events/${eventId}/submissions`)
    .where("roundId", "==", roundId)
    .count()
    .get();

  const shardsSnap = await db
    .collection(`publicStats/${eventId}/rounds/${roundId}/shards`)
    .get();

  let shardCompleted = 0;
  shardsSnap.docs.forEach((d) => {
    shardCompleted += d.data().completed ?? 0;
  });

  console.log(`\nResultados:`);
  console.log(`  Sucesso: ${succeeded}`);
  console.log(`  Falhas: ${failed}`);
  console.log(`  Submissions no Firestore: ${submissionsSnap.data().count}`);
  console.log(`  Completed nos shards: ${shardCompleted}`);

  if (submissionsSnap.data().count !== shardCompleted) {
    console.error("FALHA: contadores divergem das submissions!");
    process.exit(1);
  }

  console.log("Load test concluído com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
