"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  waiting: "Aguardando",
  open: "Em andamento",
  closed: "Encerrada",
};

export default function RelatoriosPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [rounds, setRounds] = useState<
    Array<{ id: string; title: string; status: string; submissionCount: number }>
  >([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}/dashboard`, token);
      const data = await res.json();
      setEventTitle(data.event?.title ?? "");
      setEventSlug(data.event?.slug ?? "");
      setParticipantCount(data.event?.participantCount ?? 0);
      setRounds(data.rounds ?? []);
      setLoading(false);
    }
    const unsub = onAdminAuthChange((user) => {
      if (user) load();
    });
    return unsub;
  }, [eventId]);

  if (loading) {
    return (
      <AdminShell eventId={eventId}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell eventId={eventId} eventTitle={eventTitle} eventSlug={eventSlug}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Relatório do evento</h1>
        <p className="text-sm text-gray-500 mt-1">{eventTitle}</p>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-2xl font-bold text-gray-900">{participantCount}</p>
          <p className="text-xs text-gray-500 uppercase">Participantes únicos</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {rounds.length === 0 ? (
            <p className="text-sm text-gray-500 p-5">Nenhuma rodada criada ainda.</p>
          ) : (
            rounds.map((round, i) => (
              <Link
                key={round.id}
                href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                className="flex items-center justify-between py-4 px-5 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">
                    Rodada {i + 1}: {round.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {statusLabel[round.status] ?? round.status} · {round.submissionCount ?? 0}{" "}
                    respostas
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}
