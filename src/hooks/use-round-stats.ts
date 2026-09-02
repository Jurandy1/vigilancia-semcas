"use client";

import { useEffect, useState } from "react";
import type { AggregatedStats } from "@/types/index";
import { aggregateShardStats } from "@/lib/counters/aggregate";
import { useParticipantStore } from "@/stores/participant-store";

const IS_MOCK =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_DEV_MOCK === "true";

export function useRoundStats(
  eventId: string | null,
  roundId: string | null,
  eventSlug?: string | null
) {
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

    if (IS_MOCK && eventSlug) {
      async function poll() {
        try {
          const res = await fetch(`/api/dev/public-event/${eventSlug}`);
          const data = await res.json();
          if (data.stats) {
            setStats({
              registered: data.stats.registered ?? 0,
              answering: data.stats.answering ?? 0,
              completed: data.stats.completed ?? 0,
            });
            setConnectionState("connected");
          }
        } catch {
          setConnectionState("error");
        } finally {
          setLoading(false);
        }
      }

      poll();
      const interval = setInterval(poll, 3000);
      return () => clearInterval(interval);
    }

    if (!eventId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    async function subscribe() {
      const { collection, onSnapshot, query } = await import("firebase/firestore");
      const { getFirestoreDb } = await import("@/lib/firebase/client");
      const db = getFirestoreDb();
      const shardsRef = collection(db, `publicStats/${eventId}/rounds/${roundId}/shards`);
      const q = query(shardsRef);

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const shards = snapshot.docs.map((doc) => ({
            shardId: doc.data().shardId ?? 0,
            registered: doc.data().registered ?? 0,
            answering: doc.data().answering ?? 0,
            completed: doc.data().completed ?? 0,
            updatedAt: "",
          }));
          setStats(aggregateShardStats(shards));
          setLoading(false);
          setConnectionState("connected");
        },
        () => {
          setConnectionState("error");
          setLoading(false);
        }
      );
    }

    subscribe();

    return () => {
      unsubscribe?.();
    };
  }, [eventId, roundId, eventSlug, setConnectionState]);

  return { stats, loading };
}
