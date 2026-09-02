"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ParticipantMode } from "@/types/participant";
import type { Answer } from "@/types/submission";
import type { ConnectionState } from "@/types/index";

interface DraftState {
  [roundId: string]: {
    answers: Record<string, string>;
    currentQuestion: number;
  };
}

interface ParticipantStore {
  eventId: string | null;
  eventSlug: string | null;
  roundId: string | null;
  participantId: string | null;
  participantMode: ParticipantMode | null;
  participantName: string | null;
  currentQuestion: number;
  submissionState: "idle" | "submitting" | "success" | "error";
  connectionState: ConnectionState;
  drafts: DraftState;
  setEvent: (eventId: string, eventSlug: string) => void;
  setParticipant: (id: string, mode: ParticipantMode, name: string | null) => void;
  setRound: (roundId: string) => void;
  setCurrentQuestion: (n: number) => void;
  setSubmissionState: (state: ParticipantStore["submissionState"]) => void;
  setConnectionState: (state: ConnectionState) => void;
  saveDraftAnswer: (roundId: string, questionId: string, value: string) => void;
  getDraftAnswers: (roundId: string) => Record<string, string>;
  clearDraft: (roundId: string) => void;
  reset: () => void;
}

export const useParticipantStore = create<ParticipantStore>()(
  persist(
    (set, get) => ({
      eventId: null,
      eventSlug: null,
      roundId: null,
      participantId: null,
      participantMode: null,
      participantName: null,
      currentQuestion: 0,
      submissionState: "idle",
      connectionState: "connecting",
      drafts: {},
      setEvent: (eventId, eventSlug) => set({ eventId, eventSlug }),
      setParticipant: (id, mode, name) =>
        set({ participantId: id, participantMode: mode, participantName: name }),
      setRound: (roundId) => set({ roundId }),
      setCurrentQuestion: (n) => set({ currentQuestion: n }),
      setSubmissionState: (submissionState) => set({ submissionState }),
      setConnectionState: (connectionState) => set({ connectionState }),
      saveDraftAnswer: (roundId, questionId, value) => {
        const drafts = { ...get().drafts };
        if (!drafts[roundId]) drafts[roundId] = { answers: {}, currentQuestion: 0 };
        drafts[roundId]!.answers[questionId] = value;
        set({ drafts });
      },
      getDraftAnswers: (roundId) => get().drafts[roundId]?.answers ?? {},
      clearDraft: (roundId) => {
        const drafts = { ...get().drafts };
        delete drafts[roundId];
        set({ drafts });
      },
      reset: () =>
        set({
          eventId: null,
          eventSlug: null,
          roundId: null,
          participantId: null,
          participantMode: null,
          participantName: null,
          currentQuestion: 0,
          submissionState: "idle",
          drafts: {},
        }),
    }),
    {
      name: "semcas-participant",
      partialize: (state) => ({
        eventId: state.eventId,
        eventSlug: state.eventSlug,
        participantId: state.participantId,
        participantMode: state.participantMode,
        participantName: state.participantName,
        drafts: state.drafts,
      }),
    }
  )
);

export function buildAnswersFromDraft(
  questions: { id: string; type: "single_choice" | "text" }[],
  draft: Record<string, string>
): Answer[] {
  return questions
    .filter((q) => draft[q.id])
    .map((q) => ({
      questionId: q.id,
      type: q.type,
      value: draft[q.id]!,
    }));
}
