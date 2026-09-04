"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { DashboardRound } from "@/lib/admin/dashboard-state";

interface DashboardEvent {
  title: string;
  slug: string;
  status: string;
  openedAt: string | null;
  participantCount: number;
  sequenceId: string | null;
  sequenceOrder: number | null;
  sequenceSize: number | null;
  sequenceRootSlug: string | null;
  nextEventId: string | null;
  nextEventTitle: string | null;
  nextEventSlug: string | null;
}

interface RoundStats {
  registered: number;
  answering: number;
  completed: number;
}

const EMPTY_STATS: RoundStats = { registered: 0, answering: 0, completed: 0 };

function mapEventRow(d: Record<string, unknown>): DashboardEvent {
  return {
    title: d.title as string,
    slug: d.slug as string,
    status: d.status as string,
    openedAt: (d.opened_at as string | null) ?? null,
    participantCount: (d.participant_count as number) ?? 0,
    sequenceId: (d.sequence_id as string | null) ?? null,
    sequenceOrder: (d.sequence_order as number | null) ?? null,
    sequenceSize: (d.sequence_size as number | null) ?? null,
    sequenceRootSlug: (d.sequence_root_slug as string | null) ?? null,
    nextEventId: (d.next_event_id as string | null) ?? null,
    nextEventTitle: (d.next_event_title as string | null) ?? null,
    nextEventSlug: (d.next_event_slug as string | null) ?? null,
  };
}

/**
 * Assina o Dashboard do evento via Supabase Realtime — 2 canais no total
 * (tabela events e tabela rounds, filtrados por event_id), sem listener por
 * participante. Os contadores por rodada (registered/answering/completed) já
 * vêm como colunas nas linhas de rounds, sem precisar de agregação por shard.
 */
export function useDashboardRealtime(eventId: string | null) {
  const [event, setEvent] = useState<DashboardEvent | null>(null);
  const [roundsRaw, setRoundsRaw] = useState<
    Array<{
      id: string;
      title: string;
      status: string;
      order: number;
      registered: number;
      answering: number;
      completed: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!eventId) return;
    const supabase = getSupabaseClient();
    let latestEventUpdatedAt: string | null = null;
    let latestRoundUpdatedAt: string | null = null;

    function mapRoundRow(r: Record<string, unknown>) {
      return {
        id: r.id as string,
        title: r.title as string,
        status: r.status as string,
        order: r.order as number,
        registered: (r.registered_count as number) ?? 0,
        answering: (r.answering_count as number) ?? 0,
        completed: (r.completed_count as number) ?? 0,
      };
    }

    async function bootstrap() {
      const [{ data: eventRow }, { data: roundRows }] = await Promise.all([
        supabase
          .from("events")
          .select("title,slug,status,opened_at,participant_count,sequence_id,sequence_order,sequence_size,sequence_root_slug,next_event_id,next_event_title,next_event_slug,updated_at")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("rounds")
          .select("id,title,status,order,registered_count,answering_count,completed_count,updated_at")
          .eq("event_id", eventId)
          .order("order", { ascending: true }),
      ]);
      
      if (eventRow) {
        const rowUpdatedAt = eventRow.updated_at as string | undefined;
        if (!rowUpdatedAt || !latestEventUpdatedAt || rowUpdatedAt >= latestEventUpdatedAt) {
          if (rowUpdatedAt) latestEventUpdatedAt = rowUpdatedAt;
          setEvent(mapEventRow(eventRow));
        }
      }
      
      if (roundRows) {
        // Encontra o max updated_at entre as rodadas recebidas
        const maxUpdated = roundRows.reduce((max, r) => {
          const d = r.updated_at as string | undefined;
          if (!d) return max;
          return max === null || d > max ? d : max;
        }, null as string | null);
        
        if (!maxUpdated || !latestRoundUpdatedAt || maxUpdated >= latestRoundUpdatedAt) {
          if (maxUpdated) latestRoundUpdatedAt = maxUpdated;
          setRoundsRaw(roundRows.map(mapRoundRow));
        }
      }
      
      if (eventRow || roundRows) {
        setConnectionIssue(false);
        setLastSyncedAt(new Date());
      } else {
        setConnectionIssue(true);
      }
      setLoading(false);
    }

    bootstrap();

    const eventChannel = supabase
      .channel(`events:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const rowUpdatedAt = row.updated_at as string | undefined;
          if (rowUpdatedAt) {
            if (latestEventUpdatedAt && rowUpdatedAt < latestEventUpdatedAt) return;
            latestEventUpdatedAt = rowUpdatedAt;
          }
          setEvent(mapEventRow(row));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionIssue(false);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnectionIssue(true);
      });

    const roundsChannel = supabase
      .channel(`rounds:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const rowUpdatedAt = row.updated_at as string | undefined;
          if (rowUpdatedAt) {
            if (latestRoundUpdatedAt && rowUpdatedAt < latestRoundUpdatedAt) return;
            latestRoundUpdatedAt = rowUpdatedAt;
          }
          supabase
            .from("rounds")
            .select("id,title,status,order,registered_count,answering_count,completed_count")
            .eq("event_id", eventId)
            .order("order", { ascending: true })
            .then(({ data }) => {
              if (data) setRoundsRaw(data.map(mapRoundRow));
            });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionIssue(false);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnectionIssue(true);
          void bootstrap();
        }
      });

    const fallbackPoll = window.setInterval(() => {
      if (document.visibilityState === "visible") void bootstrap();
    }, 15_000);

    return () => {
      supabase.removeChannel(eventChannel);
      supabase.removeChannel(roundsChannel);
      window.clearInterval(fallbackPoll);
    };
  }, [eventId]);

  const openRoundId = roundsRaw.find((r) => r.status === "open")?.id ?? null;

  const rounds: DashboardRound[] = roundsRaw.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    order: r.order,
    submissionCount: r.completed,
  }));

  const openRound = roundsRaw.find((r) => r.id === openRoundId);
  const stats: RoundStats = openRound
    ? { registered: openRound.registered, answering: openRound.answering, completed: openRound.completed }
    : EMPTY_STATS;

  return { event, rounds, stats, loading, connectionIssue, lastSyncedAt };
}
