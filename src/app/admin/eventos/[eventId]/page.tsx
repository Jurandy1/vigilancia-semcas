"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { EventDashboardView } from "@/components/admin/EventDashboardView";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [authReady, setAuthReady] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { event, rounds, stats, timeline, loading } = useDashboardRealtime(
    authReady ? eventId : null
  );

  useEffect(() => {
    const unsub = onAdminAuthChange((user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      setAuthReady(true);
    });
    return unsub;
  }, [router]);

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
      }
      // Nenhum recarregamento manual necessário — os listeners do Firestore
      // já refletem a mudança assim que o servidor grava o novo estado.
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
    const openRoundId = rounds.find((r) => r.status === "open")?.id;
    if (!openRoundId) return;
    await runAction(`/rounds/${openRoundId}/close`);
  }

  async function handleOpenNextRound() {
    await runAction("/rounds/next/open");
  }

  async function handleFinalizeEvent() {
    await runAction("/close");
  }

  if (loading || !event) {
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
        event={event}
        stats={stats}
        timeline={timeline}
        rounds={rounds}
        onOpenEvent={handleOpenEvent}
        onCloseRound={handleCloseRound}
        onOpenNextRound={handleOpenNextRound}
        onFinalizeEvent={handleFinalizeEvent}
        actionLoading={actionLoading}
      />
    </>
  );
}
