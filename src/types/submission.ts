import type { ParticipantMode } from "./participant";
import type { QuestionType } from "./round";

export interface Answer {
  questionId: string;
  type: QuestionType;
  value: string | string[];
  otherText?: string;
}

export interface Submission {
  id: string;
  eventId: string;
  roundId: string;
  participantId: string;
  mode: ParticipantMode;
  answers: Answer[];
  submittedAt: string;
}
