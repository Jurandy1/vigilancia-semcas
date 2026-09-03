"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
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
  lastActivityAt?: string | null;
}

interface DashboardData {
  event: { title: string; slug: string; participantCount: number; status?: string };
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
      <AdminShell eventId={eventId} screenLabel="Participantes">
        <div className="space-y-4 max-w-[1000px]">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      eventId={eventId}
      eventSlug={data.event.slug}
      eventTitle={data.event.title}
      eventStatus={data.event.status}
      screenLabel="Participantes"
    >
      <section aria-label="Participantes" className="max-w-[1000px]">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em] text-[#1a1a1a]">
          Participantes
        </h1>
        <p className="mt-1.5 mb-0 text-sm text-[#5b6b7f]">
          {data.event.participantCount} participantes no evento · atualiza a cada 5 segundos
        </p>

        <div className="mt-5">
          {loadError ? (
            <div className="text-sm text-[#5b6b7f] bg-white border border-[#dde4ee] rounded-lg p-5">
              Falha ao carregar esta informação.{" "}
              <button onClick={load} className="text-[#0b3a6e] hover:underline font-semibold">
                Tentar novamente
              </button>
            </div>
          ) : (
            <LiveParticipantList participants={data.participants} />
          )}
        </div>
      </section>
    </AdminShell>
  );
}
