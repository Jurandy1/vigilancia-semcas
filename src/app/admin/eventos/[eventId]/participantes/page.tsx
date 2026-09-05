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
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const unsub = onAdminAuthChange((user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      void load();
      interval = setInterval(refreshWhenVisible, 10_000);
    });
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      unsub();
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router, load]);

  if (!data) {
    return (
      <AdminShell eventId={eventId} screenLabel="Participantes">
        {loadError ? (
          <div style={{ maxWidth: "560px", borderRadius: "12px", border: "1px solid #fecaca", background: "#fef2f2", padding: "16px", fontSize: "14px", color: "#b91c1c" }}>
            <p style={{ margin: 0 }}>Não foi possível carregar a lista de participantes.</p>
            <button
              type="button"
              onClick={() => void load()}
              style={{ marginTop: "12px", height: "36px", padding: "0 14px", borderRadius: "8px", border: "1px solid #f0b4b0", background: "#fff", fontWeight: 600, color: "#b42318", cursor: "pointer" }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-[1000px]">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}
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
      <section data-screen-label="Participantes">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "1px solid #dbe4ef" }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#18754A" }}>Evento atual</p>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-.02em", color: "#11243c" }}>Participantes</h1>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#5b6b7f" }}><strong style={{ color: "#11243c" }}>{data.event.participantCount}</strong> registros · atualização automática</p>
        </div>

        {loadError ? (
          <div style={{ marginTop: "20px", fontSize: "14px", color: "#5b6b7f", background: "#fff", border: "1px solid #dde4ee", borderRadius: "8px", padding: "20px" }}>
            Falha ao carregar esta informação.{" "}
            <button onClick={load} style={{ color: "#0b3a6e", border: "none", background: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline", padding: 0 }}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <LiveParticipantList participants={data.participants} />
        )}
      </section>
    </AdminShell>
  );
}
