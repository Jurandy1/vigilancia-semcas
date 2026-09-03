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

  const { event, rounds, stats, loading } = useDashboardRealtime(authReady ? eventId : null);

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

  async function handleOpenEvent() {
    setActionLoading(true);
    setActionError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}/open`, token, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? "Não foi possível concluir esta operação. Tente novamente.");
      }
    } catch {
      setActionError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !event) {
    return (
      <div className="min-h-screen bg-[#eaeef4] p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <>
      {actionError && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-[#fdf2f1] border border-[#e3b3ad] text-[#b42318] text-sm rounded-md px-4 py-3">
          {actionError}
        </div>
      )}
      <EventDashboardView
        eventId={eventId}
        event={event}
        stats={stats}
        rounds={rounds}
        onOpenEvent={handleOpenEvent}
        actionLoading={actionLoading}
      />
    </>
  );
}
