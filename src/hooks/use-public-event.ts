"use client";

import { useEffect, useState } from "react";
import type { PublicEvent } from "@/types/event";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParticipantStore } from "@/stores/participant-store";

interface PublicEventRow {
  event_id: string;
  slug: string;
  title: string;
  description: string | null;
  projector_title: string | null;
  status: string;
  require_live_code: boolean;
  participant_count: number;
  current_open_round_id: string | null;
  current_round_title: string | null;
  current_round_status: string | null;
  access_challenge: { code: string; expiresAt: string; rotationSeconds: number } | null;
  updated_at: string;
}

const PUBLIC_EVENT_FIELDS =
  "event_id,slug,title,description,projector_title,status,require_live_code,participant_count,current_open_round_id,current_round_title,current_round_status,access_challenge,updated_at";

function mapRow(row: PublicEventRow): PublicEvent {
  return {
    id: row.event_id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    projectorTitle: row.projector_title ?? null,
    status: row.status as PublicEvent["status"],
    requireLiveCode: row.require_live_code,
    participantCount: row.participant_count ?? 0,
    currentOpenRoundId: row.current_open_round_id ?? null,
    currentRoundTitle: row.current_round_title ?? null,
    currentRoundStatus: (row.current_round_status as PublicEvent["currentRoundStatus"]) ?? null,
    accessChallenge: row.access_challenge,
    updatedAt: row.updated_at,
  };
}

export function usePublicEvent(eventId: string | null, eventSlug?: string | null) {
  const [publicEvent, setPublicEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const setConnectionState = useParticipantStore((s) => s.setConnectionState);

  useEffect(() => {
    if (!eventId && !eventSlug) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    setConnectionState("connecting");

    let resolvedEventId = eventId;

    async function bootstrap() {
      if (!resolvedEventId && eventSlug) {
        const { data } = await supabase
          .from("public_events")
          .select(PUBLIC_EVENT_FIELDS)
          .eq("slug", eventSlug)
          .maybeSingle();
        if (data) {
          resolvedEventId = data.event_id;
          setPublicEvent(mapRow(data as PublicEventRow));
        }
      } else if (resolvedEventId) {
        const { data } = await supabase
          .from("public_events")
          .select(PUBLIC_EVENT_FIELDS)
          .eq("event_id", resolvedEventId)
          .maybeSingle();
        if (data) setPublicEvent(mapRow(data as PublicEventRow));
      }
      setLoading(false);

      if (!resolvedEventId) {
        setConnectionState("error");
        return;
      }

      const channel = supabase
        .channel(`public_events:${resolvedEventId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "public_events", filter: `event_id=eq.${resolvedEventId}` },
          (payload) => {
            setPublicEvent(mapRow(payload.new as PublicEventRow));
            setConnectionState("connected");
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setConnectionState("connected");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnectionState("error");
        });

      return channel;
    }

    let channelRef: Awaited<ReturnType<typeof bootstrap>> | undefined;
    bootstrap().then((channel) => {
      channelRef = channel;
    });

    return () => {
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [eventId, eventSlug, setConnectionState]);

  return { publicEvent, loading };
}
