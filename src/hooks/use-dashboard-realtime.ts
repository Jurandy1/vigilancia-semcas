"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
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

interface TimelinePoint {
  time: string;
  count: number;
}

interface RoundStats {
  registered: number;
  answering: number;
  completed: number;
}

const EMPTY_STATS: RoundStats = { registered: 0, answering: 0, completed: 0 };

/**
 * Assina o Dashboard do evento via Firestore Realtime — 3 listeners no total
 * (doc do evento, coleção de rodadas, coleção participantRounds), nenhum por
 * participante. O admin já autentica com Firebase Auth (claim admin: true),
 * o que libera leitura direta de events/{eventId}/** pelas regras do Firestore.
 */
export function useDashboardRealtime(eventId: string | null) {
  const [event, setEvent] = useState<DashboardEvent | null>(null);
  const [roundsRaw, setRoundsRaw] = useState<
    Array<{ id: string; title: string; status: string; order: number }>
  >([]);
  const [participantRounds, setParticipantRounds] = useState<
    Array<{ roundId: string; status: string; completedAt: number | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [eventParticipantCount, setEventParticipantCount] = useState<number | null>(null);

  useEffect(() => {
    if (!eventId) return;
    const db = getFirestoreDb();

    const unsubEvent = onSnapshot(doc(db, "events", eventId), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setEvent({
        title: d.title,
        slug: d.slug,
        status: d.status,
        openedAt: d.openedAt?.toDate?.()?.toISOString?.() ?? null,
        participantCount: d.participantCount ?? 0,
        sequenceId: d.sequenceId ?? null,
        sequenceOrder: d.sequenceOrder ?? null,
        sequenceSize: d.sequenceSize ?? null,
        sequenceRootSlug: d.sequenceRootSlug ?? null,
        nextEventId: d.nextEventId ?? null,
        nextEventTitle: d.nextEventTitle ?? null,
        nextEventSlug: d.nextEventSlug ?? null,
      });
      setLoading(false);
    });

    const roundsQuery = query(collection(db, `events/${eventId}/rounds`), orderBy("order"));
    const unsubRounds = onSnapshot(roundsQuery, (snap) => {
      setRoundsRaw(
        snap.docs.map((d) => ({
          id: d.id,
          title: d.data().title as string,
          status: d.data().status as string,
          order: d.data().order as number,
        }))
      );
    });

    const prQuery = collection(db, `events/${eventId}/participantRounds`);
    const unsubPr = onSnapshot(prQuery, (snap) => {
      setParticipantRounds(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            roundId: data.roundId as string,
            status: (data.status as string) ?? "waiting",
            completedAt: data.completedAt?.toDate?.()?.getTime() ?? null,
          };
        })
      );
    });

    const unsubEventParticipants = onSnapshot(
      collection(db, `publicStats/${eventId}/participantShards`),
      (snap) => {
        setEventParticipantCount(
          snap.docs.reduce((total, shard) => total + (shard.data().count ?? 0), 0)
        );
      }
    );

    return () => {
      unsubEvent();
      unsubRounds();
      unsubPr();
      unsubEventParticipants();
    };
  }, [eventId]);

  const openRoundId = roundsRaw.find((r) => r.status === "open")?.id ?? null;

  const perRoundStats = new Map<string, RoundStats>();
  participantRounds.forEach((pr) => {
    const current = perRoundStats.get(pr.roundId) ?? { registered: 0, answering: 0, completed: 0 };
    current.registered += 1;
    if (pr.status === "answering") current.answering += 1;
    if (pr.status === "completed") current.completed += 1;
    perRoundStats.set(pr.roundId, current);
  });

  const rounds: DashboardRound[] = roundsRaw.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    order: r.order,
    submissionCount: perRoundStats.get(r.id)?.completed ?? 0,
  }));

  const stats = openRoundId ? perRoundStats.get(openRoundId) ?? EMPTY_STATS : EMPTY_STATS;

  let timeline: TimelinePoint[] = [];
  const completionTimestamps = participantRounds
    .map((pr) => pr.completedAt)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  if (completionTimestamps.length > 0 && event) {
    const startMs = event.openedAt ? new Date(event.openedAt).getTime() : completionTimestamps[0]!;
    const endMs = Math.max(Date.now(), completionTimestamps[completionTimestamps.length - 1]!);
    const BUCKETS = 8;
    const span = Math.max(endMs - startMs, 60_000);
    const bucketMs = span / BUCKETS;

    timeline = Array.from({ length: BUCKETS + 1 }, (_, i) => {
      const bucketEnd = startMs + i * bucketMs;
      const count = completionTimestamps.filter((t) => t <= bucketEnd).length;
      return { time: new Date(bucketEnd).toISOString(), count };
    });
  }

  const resolvedEvent = event
    ? { ...event, participantCount: eventParticipantCount ?? event.participantCount }
    : null;

  return { event: resolvedEvent, rounds, stats, timeline, loading };
}
