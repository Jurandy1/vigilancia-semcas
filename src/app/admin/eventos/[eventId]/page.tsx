"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { EventDashboardView } from "@/components/admin/EventDashboardView";

interface DashboardData {
  event: {
    title: string;
    slug: string;
    openedAt: string | null;
    participantCount: number;
  };
  participants: Array<{
    id: string;
    displayName: string;
    status: string;
    currentQuestion: number;
    questionCount: number;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  rounds: Array<{
    id: string;
    title: string;
    status: string;
    order: number;
    submissionCount?: number;
  }>;
  stats: { registered: number; answering: number; completed: number };
  questionSummaries: Array<{
    id: string;
    title: string;
    type: string;
    options?: Array<{ option: string; count: number; percent: string }>;
  }>;
  recentCompletions: Array<{ displayName: string; completedAt: string | null }>;
  timeline: Array<{ time: string; count: number }>;
}

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const currentRound = data?.rounds.find((r) => r.status === "open") ?? null;
  const roundId = currentRound?.id;

  const loadDashboard = useCallback(async () => {
    const token = await getAdminIdToken();
    if (!token) return;
    const url = `/api/admin/events/${eventId}/dashboard${roundId ? `?roundId=${roundId}` : ""}`;
    const res = await adminFetch(url, token);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [eventId, roundId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const unsub = onAdminAuthChange((user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      loadDashboard();
      interval = setInterval(loadDashboard, 5000);
    });
    return () => {
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [router, loadDashboard]);

  async function handleCloseRound() {
    if (!currentRound) return;
    setActionLoading(true);
    const token = await getAdminIdToken();
    if (!token) return;
    await adminFetch(`/api/admin/events/${eventId}/rounds/${currentRound.id}/close`, token, {
      method: "POST",
    });
    await loadDashboard();
    setActionLoading(false);
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <EventDashboardView
      eventId={eventId}
      event={data.event}
      participants={data.participants}
      stats={data.stats}
      questionSummaries={data.questionSummaries}
      recentCompletions={data.recentCompletions}
      timeline={data.timeline}
      rounds={data.rounds}
      currentRound={currentRound}
      onCloseRound={handleCloseRound}
      actionLoading={actionLoading}
    />
  );
}
