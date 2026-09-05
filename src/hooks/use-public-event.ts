"use client";

import { useEffect, useState } from "react";
import type { PublicEvent } from "@/types/event";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParticipantStore } from "@/stores/participant-store";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";
import { resolveLivePublicEventSlug } from "@/lib/events/resolve-live-slug";

interface PublicEventRow {
  event_id: string; slug: string; title: string; description: string | null; projector_title: string | null;
  status: string; require_live_code: boolean; participant_count: number; current_open_round_id: string | null;
  current_round_title: string | null; current_round_status: string | null;
  access_challenge: { code: string; expiresAt: string; rotationSeconds: number } | null; updated_at: string;
  sequence_id: string | null; sequence_order: number | null; sequence_size: number | null;
  sequence_root_slug: string | null;
  next_event_id: string | null; next_event_title: string | null; next_event_slug: string | null;
}

const FIELDS = "event_id,slug,title,description,projector_title,status,require_live_code,participant_count,current_open_round_id,current_round_title,current_round_status,access_challenge,updated_at,sequence_id,sequence_order,sequence_size,sequence_root_slug,next_event_id,next_event_title,next_event_slug";
const CACHE_PREFIX = "semcas-public-event:";

function mapRow(row: PublicEventRow): PublicEvent {
  return {
    id: row.event_id, slug: row.slug, title: row.title, description: row.description ?? null,
    projectorTitle: row.projector_title ?? null, status: row.status as PublicEvent["status"],
    requireLiveCode: row.require_live_code, participantCount: row.participant_count ?? 0,
    currentOpenRoundId: row.current_open_round_id ?? null, currentRoundTitle: row.current_round_title ?? null,
    currentRoundStatus: (row.current_round_status as PublicEvent["currentRoundStatus"]) ?? null,
    accessChallenge: row.access_challenge, updatedAt: row.updated_at,
    sequenceId: row.sequence_id ?? null, sequenceOrder: row.sequence_order ?? null,
    sequenceSize: row.sequence_size ?? null, sequenceRootSlug: row.sequence_root_slug ?? null,
    nextEventId: row.next_event_id ?? null, nextEventTitle: row.next_event_title ?? null,
    nextEventSlug: row.next_event_slug ?? null,
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
    let latestUpdatedAt: string | null = null;

    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PublicEvent;
        setPublicEvent(parsed);
        latestUpdatedAt = parsed.updatedAt;
      }
    } catch { /* cache is best-effort */ }

    function apply(row: PublicEventRow) {
      if (disposed) return;
      if (latestUpdatedAt && row.updated_at < latestUpdatedAt) {
        return; // Prevents stale HTTP responses from overwriting newer realtime updates
      }
      latestUpdatedAt = row.updated_at;
      const mapped = mapRow(row);
      resolvedId = mapped.id;
      setPublicEvent(mapped);
      setLastSyncedAt(new Date());
      setConnectionIssue(false);
      setConnectionState("connected");
      try { window.localStorage.setItem(cacheKey, JSON.stringify(mapped)); } catch { /* ignore */ }
    }

    // O slug reservado "atual" não existe como row. Resolve o evento ao vivo
    // (aberto ou próximo da sequência) sem depender de marca manual.
    const isDailyAlias = !eventId && eventSlug === DAILY_ACTIVE_SLUG;

    async function refresh(explicitSlug?: string) {
      try {
        let query = supabase.from("public_events").select(FIELDS);
        const slugToUse = explicitSlug ?? (isDailyAlias ? null : eventSlug);
        if (resolvedId) query = query.eq("event_id", resolvedId);
        else if (slugToUse) query = query.eq("slug", slugToUse);
        else if (isDailyAlias) {
          const live = await resolveLivePublicEventSlug(supabase);
          if (!live) return;
          query = supabase.from("public_events").select(FIELDS).eq("slug", live.slug);
        } else return;
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

    async function bootstrap() {
      // Resolve o event_id real (via /atual → evento ao vivo) e só depois
      // monta o canal realtime com o filtro correto.
      await refresh();
      if (disposed) return;
      const filter = resolvedId
        ? `event_id=eq.${resolvedId}`
        : `slug=eq.${eventSlug}`;
      const channel = supabase.channel(`public_events:${resolvedId ?? eventSlug}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "public_events", filter }, (payload) => apply(payload.new as PublicEventRow))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") { setConnectionIssue(false); setConnectionState("connected"); }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { setConnectionIssue(true); setConnectionState("error"); void refresh(); }
        });
      cleanupChannel = () => { void supabase.removeChannel(channel); };
    }

    let cleanupChannel: (() => void) | null = null;
    void bootstrap();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);

    return () => { disposed = true; window.clearInterval(poll); cleanupChannel?.(); };
  }, [eventId, eventSlug, setConnectionState]);

  return { publicEvent, loading, connectionIssue, lastSyncedAt };
}
