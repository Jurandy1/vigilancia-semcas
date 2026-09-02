"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { EventDashboardView } from "@/components/admin/EventDashboardView";
import type { DashboardRound } from "@/lib/admin/dashboard-state";

interface DashboardData {
  event: {
    title: string;
    slug: string;
    status: string;
    openedAt: string | null;
    participantCount: number;
  };
  rounds: DashboardRound[];
  stats: { registered: number; answering: number; completed: number };
  timeline: Array<{ time: string; count: number }>;
}

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const roundId = data?.rounds.find((r) => r.status === "open")?.id;

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

  async function runAction(path: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}${path}`, token, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? "Não foi possível concluir esta operação. Tente novamente.");
        return;
      }
      await loadDashboard();
    } catch {
      setActionError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOpenEvent() {
    await runAction("/open");
  }

  async function handleCloseRound() {
    if (!roundId) return;
    await runAction(`/rounds/${roundId}/close`);
  }

  async function handleOpenNextRound() {
    await runAction("/rounds/next/open");
  }

  async function handleFinalizeEvent() {
    await runAction("/close");
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      {actionError && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 shadow-lg">
          {actionError}
        </div>
      )}
      <EventDashboardView
        eventId={eventId}
        event={data.event}
        stats={data.stats}
        timeline={data.timeline}
        rounds={data.rounds}
        onOpenEvent={handleOpenEvent}
        onCloseRound={handleCloseRound}
        onOpenNextRound={handleOpenNextRound}
        onFinalizeEvent={handleFinalizeEvent}
        actionLoading={actionLoading}
      />
    </>
  );
}
