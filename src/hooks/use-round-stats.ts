"use client";

import { useEffect, useState } from "react";
import type { AggregatedStats } from "@/types/index";
import { getSupabaseClient } from "@/lib/supabase/client";

const EMPTY = { registered: 0, answering: 0, completed: 0 };

export function useRoundStats(_eventId: string | null, roundId: string | null) {
  const [stats, setStats] = useState<AggregatedStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!roundId) { setStats(EMPTY); setLoading(false); return; }
    const supabase = getSupabaseClient();
    let disposed = false;

    function apply(row: { registered_count: number; answering_count: number; completed_count: number }) {
      if (disposed) return;
      setStats({ registered: row.registered_count ?? 0, answering: row.answering_count ?? 0, completed: row.completed_count ?? 0 });
      setConnectionIssue(false);
      setLastSyncedAt(new Date());
    }

    async function refresh() {
      try {
        const { data, error } = await supabase.from("public_round_stats").select("registered_count,answering_count,completed_count").eq("round_id", roundId).maybeSingle();
        if (error) throw error;
        if (data) apply(data);
      } catch { if (!disposed) setConnectionIssue(true); }
      finally { if (!disposed) setLoading(false); }
    }

    void refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 10_000);
    const channel = supabase.channel(`public_round_stats:${roundId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "public_round_stats", filter: `round_id=eq.${roundId}` }, (payload) => apply(payload.new as never))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionIssue(false);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { setConnectionIssue(true); void refresh(); }
      });

    return () => { disposed = true; window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [roundId]);

  return { stats, loading, connectionIssue, lastSyncedAt };
}
