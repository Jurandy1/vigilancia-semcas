export type EventStatus = "draft" | "waiting" | "open" | "closed";
export type RoundStatus = "draft" | "waiting" | "open" | "closed";
export type RoundType = "survey" | "poll";
export type ResultsVisibility = "hidden" | "after_close" | "admin_only";

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  projectorTitle: string | null;
  order: number;
  status: EventStatus;
  isTest: boolean;
  requireLiveCode: boolean;
  currentOpenRoundId: string | null;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
  openedAt: string | null;
  closedAt: string | null;
  accessCodeHash?: string | null;
  accessCodeExpiresAt?: string | null;
  sequenceId?: string | null;
  sequenceOrder?: number | null;
  sequenceSize?: number | null;
  sequenceRootEventId?: string | null;
  sequenceRootSlug?: string | null;
  nextEventId?: string | null;
  nextEventTitle?: string | null;
  nextEventSlug?: string | null;
}

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  projectorTitle?: string | null;
  status: EventStatus;
  requireLiveCode: boolean;
  participantCount: number;
  currentOpenRoundId: string | null;
  currentRoundTitle: string | null;
  currentRoundStatus: RoundStatus | null;
  accessChallenge: {
    code: string;
    expiresAt: string;
    rotationSeconds: number;
  } | null;
  updatedAt: string;
  sequenceId?: string | null;
  sequenceOrder?: number | null;
  sequenceSize?: number | null;
  sequenceRootSlug?: string | null;
  nextEventId?: string | null;
  nextEventTitle?: string | null;
}
