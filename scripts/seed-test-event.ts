/**
 * Seed do evento de teste com a primeira rodada real.
 * Uso: npm run seed
 */
import "./load-env";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../src/lib/firebase/admin";

const QUESTIONS = [
  {
    order: 1,
    type: "single_choice",
    title: "Como você avalia a metodologia utilizada no evento?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    order: 2,
    type: "single_choice",
    title: "Como você avalia o local onde o evento foi realizado?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    order: 3,
    type: "single_choice",
    title: "Como você avalia a organização geral do evento?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    order: 4,
    type: "single_choice",
    title: "A duração do evento foi adequada?",
    required: true,
    options: ["Sim", "Parcialmente", "Não"],
  },
  {
    order: 5,
    type: "text",
    title: "Quais foram os principais pontos positivos do evento?",
    required: true,
    maxLength: 2000,
  },
  {
    order: 6,
    type: "single_choice",
    title: "O conteúdo abordado no evento foi relevante para sua atuação profissional?",
    required: true,
    options: ["Muito relevante", "Relevante", "Pouco relevante", "Não foi relevante"],
  },
  {
    order: 7,
    type: "text",
    title: "Quais sugestões você daria para melhorar os próximos eventos?",
    required: true,
    maxLength: 2000,
  },
];

async function main() {
  const db = getAdminDb();
  const now = Timestamp.now();

  const eventRef = db.collection("events").doc();
  const roundRef = db.collection(`events/${eventRef.id}/rounds`).doc();

  await db.runTransaction(async (tx) => {
    tx.set(eventRef, {
      title: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
      slug: "monitoramento-2026",
      description: "Evento de teste para validação do sistema",
      status: "waiting",
      isTest: true,
      requireLiveCode: false,
      currentOpenRoundId: null,
      participantCount: 0,
      createdAt: now,
      updatedAt: now,
      openedAt: null,
      closedAt: null,
      accessCodeHash: null,
      accessCodeExpiresAt: null,
    });

    tx.set(db.doc(`publicEvents/${eventRef.id}`), {
      id: eventRef.id,
      slug: "monitoramento-2026",
      title: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
      description: "Evento de teste para validação do sistema",
      status: "waiting",
      requireLiveCode: false,
      currentOpenRoundId: null,
      currentRoundTitle: null,
      currentRoundStatus: null,
      accessChallenge: null,
      updatedAt: now,
    });

    tx.set(roundRef, {
      eventId: eventRef.id,
      title: "Avaliação do Evento",
      description: null,
      order: 1,
      type: "survey",
      status: "draft",
      allowNewParticipants: true,
      resultsVisibility: "after_close",
      questionCount: QUESTIONS.length,
      createdAt: now,
      openedAt: null,
      closedAt: null,
    });

    QUESTIONS.forEach((q) => {
      const qRef = db.collection(`events/${eventRef.id}/rounds/${roundRef.id}/questions`).doc();
      tx.set(qRef, q);
    });
  });

  console.log("Evento de teste criado:");
  console.log(`  ID: ${eventRef.id}`);
  console.log(`  Slug: monitoramento-2026`);
  console.log(`  URL: /e/monitoramento-2026`);
  console.log(`  Rodada ID: ${roundRef.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
