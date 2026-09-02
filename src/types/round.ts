import type { RoundStatus, RoundType, ResultsVisibility } from "./event";

export type QuestionType = "single_choice" | "text";

export interface Question {
  id: string;
  order: number;
  type: QuestionType;
  title: string;
  required: boolean;
  options?: string[];
  maxLength?: number;
}

export interface Round {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  order: number;
  type: RoundType;
  status: RoundStatus;
  allowNewParticipants: boolean;
  resultsVisibility: ResultsVisibility;
  questionCount: number;
  createdAt: string;
  openedAt: string | null;
  closedAt: string | null;
}
