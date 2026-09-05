import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Participant } from "@/types/participant";
import { hashTokenForLookup } from "./cookies";
import { getSessionCookieName } from "./tokens";

interface ParticipantRow {
  id: string;
  event_id: string;
  mode: string;
  name: string | null;
  session_token_hash: string;
  session_expires_at: string;
  created_at: string;
  last_activity_at: string;
}

function serializeParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    eventId: row.event_id,
    mode: row.mode as Participant["mode"],
    name: row.name ?? null,
    sessionTokenHash: row.session_token_hash,
    sessionExpiresAt: row.session_expires_at,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
  };
}

export async function getParticipantFromRequest(
  request: NextRequest,
  eventId: string
): Promise<Participant | null> {
  const token = request.cookies.get(getSessionCookieName(eventId))?.value;
  if (!token) return null;

  const hash = hashTokenForLookup(token);
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .eq("session_token_hash", hash)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const participant = serializeParticipant(data as ParticipantRow);

  if (new Date(participant.sessionExpiresAt) < new Date()) {
    return null;
  }

  return participant;
}

export async function getParticipantById(
  eventId: string,
  participantId: string
): Promise<Participant | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .eq("id", participantId)
    .maybeSingle();
  if (!data) return null;
  return serializeParticipant(data as ParticipantRow);
}
