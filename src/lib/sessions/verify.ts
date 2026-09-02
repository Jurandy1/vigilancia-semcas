import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Participant } from "@/types/participant";
import { hashTokenForLookup } from "./cookies";
import { SESSION_COOKIE_NAME } from "./tokens";

function serializeParticipant(data: FirebaseFirestore.DocumentData, id: string): Participant {
  return {
    id,
    eventId: data.eventId,
    mode: data.mode,
    name: data.name ?? null,
    sessionTokenHash: data.sessionTokenHash,
    sessionExpiresAt: data.sessionExpiresAt?.toDate?.()?.toISOString?.() ?? data.sessionExpiresAt,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
    lastActivityAt: data.lastActivityAt?.toDate?.()?.toISOString?.() ?? data.lastActivityAt,
  };
}

export async function getParticipantFromRequest(
  request: NextRequest,
  eventId: string
): Promise<Participant | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const hash = hashTokenForLookup(token);
  const db = getAdminDb();

  const snapshot = await db
    .collection(`events/${eventId}/participants`)
    .where("sessionTokenHash", "==", hash)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0]!;
  const participant = serializeParticipant(doc.data(), doc.id);

  if (new Date(participant.sessionExpiresAt) < new Date()) {
    return null;
  }

  return participant;
}

export async function getParticipantById(
  eventId: string,
  participantId: string
): Promise<Participant | null> {
  const db = getAdminDb();
  const doc = await db.doc(`events/${eventId}/participants/${participantId}`).get();
  if (!doc.exists) return null;
  return serializeParticipant(doc.data()!, doc.id);
}
