export type ParticipantMode = "identified" | "anonymous";
export type ParticipantRoundStatus = "waiting" | "answering" | "completed" | "inactive";

export interface Participant {
  id: string;
  eventId: string;
  mode: ParticipantMode;
  name: string | null;
  sessionTokenHash: string;
  sessionExpiresAt: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface ParticipantRound {
  id: string;
  eventId: string;
  roundId: string;
  participantId: string;
  status: ParticipantRoundStatus;
  currentQuestion: number;
  startedAt: string | null;
  lastActivityAt: string;
  completedAt: string | null;
}
