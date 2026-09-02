import { NextRequest } from "next/server";
import {
  createMockParticipant,
  getMockParticipantBySessionHash,
  getMockParticipantRounds,
  getMockPublicEvent,
  getMockQuestions,
  getMockRound,
  getMockSession,
  getMockStats,
  MOCK_EVENT_ID,
  submitMockAnswers,
  updateMockProgress,
} from "@/lib/dev/mock-store";
import { hashTokenForLookup } from "@/lib/sessions/cookies";
import { SESSION_COOKIE_NAME } from "@/lib/sessions/tokens";
import type { Participant } from "@/types/participant";

export async function getParticipantFromRequestMock(
  request: NextRequest,
  eventId: string
): Promise<Participant | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const hash = hashTokenForLookup(token);
  const p = getMockParticipantBySessionHash(hash, eventId);
  if (!p) return null;

  if (new Date(p.sessionExpiresAt) < new Date()) return null;

  return {
    id: p.id,
    eventId: p.eventId,
    mode: p.mode,
    name: p.name,
    sessionTokenHash: p.sessionTokenHash,
    sessionExpiresAt: p.sessionExpiresAt,
    createdAt: p.createdAt,
    lastActivityAt: p.lastActivityAt,
  };
}

export {
  createMockParticipant,
  getMockParticipantRounds,
  getMockPublicEvent,
  getMockQuestions,
  getMockRound,
  getMockSession,
  getMockStats,
  MOCK_EVENT_ID,
  submitMockAnswers,
  updateMockProgress,
};
