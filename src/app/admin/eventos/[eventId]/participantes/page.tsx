"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/AdminShell";
import { LiveParticipantList } from "@/components/admin/LiveParticipantList";
import { Skeleton } from "@/components/ui/skeleton";

interface Participant {
  id: string;
  displayName: string;
  mode: string;
  status: string;
  currentQuestion: number;
  questionCount: number;
}

interface DashboardData {
  event: { title: string; slug: string; participantCount: number };
  participants: Participant[];
}

export default function EventParticipantsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    const token = await getAdminIdToken();
    if (!token) return;
    try {
      const res = await adminFetch(`/api/admin/events/${eventId}/dashboard`, token);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [eventId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const unsub = onAdminAuthChange((user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      load();
      interval = setInterval(load, 5000);
    });
    return () => {
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [router, load]);

  if (!data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <AdminShell eventId={eventId} eventSlug={data.event.slug} eventTitle={data.event.title}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Participantes</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.event.title} · {data.event.participantCount} participantes
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        {loadError ? (
          <div className="text-sm text-gray-500">
            Falha ao carregar esta informação.{" "}
            <button onClick={load} className="text-[#0b3a6e] hover:underline">
              Tentar novamente
            </button>
          </div>
        ) : (
          <LiveParticipantList participants={data.participants} />
        )}
      </div>
    </AdminShell>
  );
}
