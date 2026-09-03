"use client";

import { useEffect, useState } from "react";
import type { PublicEvent } from "@/types/event";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParticipantStore } from "@/stores/participant-store";

interface PublicEventRow {
  event_id: string; slug: string; title: string; description: string | null; projector_title: string | null;
  status: string; require_live_code: boolean; participant_count: number; current_open_round_id: string | null;
  current_round_title: string | null; current_round_status: string | null;
  access_challenge: { code: string; expiresAt: string; rotationSeconds: number } | null; updated_at: string;
}

const FIELDS = "event_id,slug,title,description,projector_title,status,require_live_code,participant_count,current_open_round_id,current_round_title,current_round_status,access_challenge,updated_at";
const CACHE_PREFIX = "semcas-public-event:";

function mapRow(row: PublicEventRow): PublicEvent {
  return {
    id: row.event_id, slug: row.slug, title: row.title, description: row.description ?? null,
    projectorTitle: row.projector_title ?? null, status: row.status as PublicEvent["status"],
    requireLiveCode: row.require_live_code, participantCount: row.participant_count ?? 0,
    currentOpenRoundId: row.current_open_round_id ?? null, currentRoundTitle: row.current_round_title ?? null,
    currentRoundStatus: (row.current_round_status as PublicEvent["currentRoundStatus"]) ?? null,
    accessChallenge: row.access_challenge, updatedAt: row.updated_at,
  };
}

export function usePublicEvent(eventId: string | null, eventSlug?: string | null) {
  const [publicEvent, setPublicEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const setConnectionState = useParticipantStore((state) => state.setConnectionState);

  useEffect(() => {
    if (!eventId && !eventSlug) { setLoading(false); return; }
    const supabase = getSupabaseClient();
    const cacheKey = `${CACHE_PREFIX}${eventId ?? eventSlug}`;
    let resolvedId = eventId;
    let disposed = false;

    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) setPublicEvent(JSON.parse(cached) as PublicEvent);
    } catch { /* cache is best-effort */ }

    function apply(row: PublicEventRow) {
      if (disposed) return;
      const mapped = mapRow(row);
      resolvedId = mapped.id;
      setPublicEvent(mapped);
      setLastSyncedAt(new Date());
      setConnectionIssue(false);
      setConnectionState("connected");
      try { window.localStorage.setItem(cacheKey, JSON.stringify(mapped)); } catch { /* ignore */ }
    }

    async function refresh() {
      try {
        let query = supabase.from("public_events").select(FIELDS);
        query = resolvedId ? query.eq("event_id", resolvedId) : query.eq("slug", eventSlug!);
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (data) apply(data as PublicEventRow);
      } catch {
        if (!disposed) { setConnectionIssue(true); setConnectionState("error"); }
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    setConnectionState("connecting");
    void refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);
    const channel = supabase.channel(`public_events:${eventId ?? eventSlug}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "public_events", filter: eventId ? `event_id=eq.${eventId}` : `slug=eq.${eventSlug}` }, (payload) => apply(payload.new as PublicEventRow))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") { setConnectionIssue(false); setConnectionState("connected"); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { setConnectionIssue(true); setConnectionState("error"); void refresh(); }
      });

    return () => { disposed = true; window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [eventId, eventSlug, setConnectionState]);

  return { publicEvent, loading, connectionIssue, lastSyncedAt };
}
