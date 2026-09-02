import type { Question } from "@/types/round";

export const MOCK_EVENT_ID = "mock-event-001";
export const MOCK_ROUND_ID = "mock-round-001";
export const MOCK_EVENT_SLUG = "monitoramento-2026";

const QUESTIONS: Question[] = [
  {
    id: "q1",
    order: 1,
    type: "single_choice",
    title: "Como você avalia a metodologia utilizada no evento?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    id: "q2",
    order: 2,
    type: "single_choice",
    title: "Como você avalia o local onde o evento foi realizado?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    id: "q3",
    order: 3,
    type: "single_choice",
    title: "Como você avalia a organização geral do evento?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    id: "q4",
    order: 4,
    type: "single_choice",
    title: "A duração do evento foi adequada?",
    required: true,
    options: ["Sim", "Parcialmente", "Não"],
  },
  {
    id: "q5",
    order: 5,
    type: "text",
    title: "Quais foram os principais pontos positivos do evento?",
    required: true,
    maxLength: 2000,
  },
  {
    id: "q6",
    order: 6,
    type: "single_choice",
    title: "O conteúdo abordado no evento foi relevante para sua atuação profissional?",
    required: true,
    options: ["Muito relevante", "Relevante", "Pouco relevante", "Não foi relevante"],
  },
  {
    id: "q7",
    order: 7,
    type: "text",
    title: "Quais sugestões você daria para melhorar os próximos eventos?",
    required: true,
    maxLength: 2000,
  },
];

interface MockParticipant {
  id: string;
  eventId: string;
  mode: "identified" | "anonymous";
  name: string | null;
  sessionTokenHash: string;
  sessionExpiresAt: string;
  createdAt: string;
  lastActivityAt: string;
}

interface MockParticipantRound {
  id: string;
  eventId: string;
  roundId: string;
  participantId: string;
  status: "waiting" | "answering" | "completed";
  currentQuestion: number;
  startedAt: string | null;
  lastActivityAt: string;
  completedAt: string | null;
}

interface MockSubmission {
  id: string;
  eventId: string;
  roundId: string;
  participantId: string;
  mode: "identified" | "anonymous";
  answers: Array<{ questionId: string; type: string; value: string }>;
  submittedAt: string;
}

interface MockPublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "waiting" | "open" | "closed";
  requireLiveCode: boolean;
  currentOpenRoundId: string | null;
  currentRoundTitle: string | null;
  currentRoundStatus: "waiting" | "open" | "closed" | null;
  accessChallenge: null;
  updatedAt: string;
  participantCount: number;
}

const store = {
  event: {
    id: MOCK_EVENT_ID,
    title: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
    slug: MOCK_EVENT_SLUG,
    description: "Modo de desenvolvimento local — dados simulados",
    status: "open" as const,
    isTest: true,
    requireLiveCode: false,
    currentOpenRoundId: MOCK_ROUND_ID,
    participantCount: 0,
  },
  publicEvent: {
    id: MOCK_EVENT_ID,
    slug: MOCK_EVENT_SLUG,
    title: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
    description: "Modo de desenvolvimento local — dados simulados",
    status: "open" as const,
    requireLiveCode: false,
    currentOpenRoundId: MOCK_ROUND_ID,
    currentRoundTitle: "Avaliação do Evento",
    currentRoundStatus: "open" as const,
    accessChallenge: null,
    updatedAt: new Date().toISOString(),
    participantCount: 0,
  } satisfies MockPublicEvent,
  round: {
    id: MOCK_ROUND_ID,
    eventId: MOCK_EVENT_ID,
    title: "Avaliação do Evento",
    description: null,
    order: 1,
    type: "survey" as const,
    status: "open" as const,
    allowNewParticipants: true,
    resultsVisibility: "after_close" as const,
    questionCount: QUESTIONS.length,
  },
  questions: QUESTIONS,
  participants: new Map<string, MockParticipant>(),
  participantRounds: new Map<string, MockParticipantRound>(),
  submissions: new Map<string, MockSubmission>(),
  shards: { registered: 0, answering: 0, completed: 0 },
  sessions: new Map<string, string>(),
};

export function isDevMockMode(): boolean {
  return process.env.USE_DEV_MOCK === "true";
}

export function getMockEventBySlug(slug: string) {
  if (slug !== MOCK_EVENT_SLUG) return null;
  return { ...store.event };
}

export function getMockPublicEvent() {
  return { ...store.publicEvent, updatedAt: new Date().toISOString() };
}

export function getMockPublicEventBySlug(slug: string) {
  if (slug !== MOCK_EVENT_SLUG) return null;
  return getMockPublicEvent();
}

export function getMockRound(eventId: string, roundId: string) {
  if (eventId !== MOCK_EVENT_ID || roundId !== MOCK_ROUND_ID) return null;
  return { ...store.round };
}

export function getMockQuestions(eventId: string, roundId: string) {
  if (eventId !== MOCK_EVENT_ID || roundId !== MOCK_ROUND_ID) return [];
  return [...store.questions];
}

export function getMockParticipantBySessionHash(hash: string, eventId: string) {
  for (const p of store.participants.values()) {
    if (p.eventId === eventId && p.sessionTokenHash === hash) return p;
  }
  return null;
}

export function createMockParticipant(params: {
  eventId: string;
  mode: "identified" | "anonymous";
  name: string | null;
  sessionTokenHash: string;
  sessionExpiresAt: Date;
}) {
  const id = `mock-p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const participant: MockParticipant = {
    id,
    eventId: params.eventId,
    mode: params.mode,
    name: params.name,
    sessionTokenHash: params.sessionTokenHash,
    sessionExpiresAt: params.sessionExpiresAt.toISOString(),
    createdAt: now,
    lastActivityAt: now,
  };
  store.participants.set(id, participant);
  store.event.participantCount += 1;
  store.publicEvent.participantCount += 1;
  store.shards.registered += 1;
  return participant;
}

export function getMockParticipantRounds(participantId: string) {
  return Array.from(store.participantRounds.values()).filter(
    (pr) => pr.participantId === participantId
  );
}

export function updateMockProgress(params: {
  eventId: string;
  roundId: string;
  participantId: string;
  currentQuestion: number;
}) {
  const prId = `${params.roundId}_${params.participantId}`;
  const existing = store.participantRounds.get(prId);
  const now = new Date().toISOString();

  if (!existing) {
    store.participantRounds.set(prId, {
      id: prId,
      eventId: params.eventId,
      roundId: params.roundId,
      participantId: params.participantId,
      status: "answering",
      currentQuestion: params.currentQuestion,
      startedAt: now,
      lastActivityAt: now,
      completedAt: null,
    });
    store.shards.answering += 1;
  } else if (existing.status !== "completed") {
    store.participantRounds.set(prId, {
      ...existing,
      status: "answering",
      currentQuestion: params.currentQuestion,
      lastActivityAt: now,
    });
  }
}

export function submitMockAnswers(params: {
  eventId: string;
  roundId: string;
  participantId: string;
  mode: "identified" | "anonymous";
  answers: Array<{ questionId: string; type: string; value: string }>;
}) {
  const submissionId = `${params.roundId}_${params.participantId}`;
  if (store.submissions.has(submissionId)) {
    return { alreadySubmitted: true };
  }

  const now = new Date().toISOString();
  store.submissions.set(submissionId, {
    id: submissionId,
    eventId: params.eventId,
    roundId: params.roundId,
    participantId: params.participantId,
    mode: params.mode,
    answers: params.answers,
    submittedAt: now,
  });

  const prId = submissionId;
  const existing = store.participantRounds.get(prId);
  store.participantRounds.set(prId, {
    id: prId,
    eventId: params.eventId,
    roundId: params.roundId,
    participantId: params.participantId,
    status: "completed",
    currentQuestion: store.questions.length,
    startedAt: existing?.startedAt ?? now,
    lastActivityAt: now,
    completedAt: now,
  });

  if (!existing || existing.status !== "completed") {
    store.shards.completed += 1;
    if (store.shards.answering > 0) store.shards.answering -= 1;
  }

  return { alreadySubmitted: false };
}

export function getMockStats() {
  return { ...store.shards };
}

export function getMockSession(participantId: string, eventId: string) {
  const participant = store.participants.get(participantId);
  if (!participant || participant.eventId !== eventId) return null;
  return participant;
}
