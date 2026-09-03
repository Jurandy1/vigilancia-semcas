"use client";

import { useEffect, useState } from "react";
import type { AggregatedStats } from "@/types/index";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParticipantStore } from "@/stores/participant-store";

export function useRoundStats(_eventId: string | null, roundId: string | null) {
  const [stats, setStats] = useState<AggregatedStats>({
    registered: 0,
    answering: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const setConnectionState = useParticipantStore((s) => s.setConnectionState);

  useEffect(() => {
    if (!roundId) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    setConnectionState("connecting");

    function applyRow(row: {
      registered_count: number;
      answering_count: number;
      completed_count: number;
    }) {
      setStats({
        registered: row.registered_count ?? 0,
        answering: row.answering_count ?? 0,
        completed: row.completed_count ?? 0,
      });
    }

    supabase
      .from("public_round_stats")
      .select("registered_count, answering_count, completed_count")
      .eq("round_id", roundId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) applyRow(data);
        setLoading(false);
      });

    const channel = supabase
      .channel(`public_round_stats:${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "public_round_stats", filter: `round_id=eq.${roundId}` },
        (payload) => {
          applyRow(payload.new as never);
          setConnectionState("connected");
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionState("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnectionState("error");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId, setConnectionState]);

  return { stats, loading };
}
