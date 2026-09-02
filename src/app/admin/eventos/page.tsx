"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { getAdminIdToken } from "@/lib/firebase/auth-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";

interface EventItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  isTest: boolean;
  participantCount: number;
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  waiting: "Aguardando",
  open: "Aberto",
  closed: "Encerrado",
};

export default function AdminEventosPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAdminAuthChange(async (user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      const token = await getAdminIdToken();
      if (!token) return;

      const res = await adminFetch("/api/admin/events", token);
      const data = await res.json();
      setEvents(data.events ?? []);
      setLoading(false);
    });
    return unsub;
  }, [router]);

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Eventos</h1>
        <Button asChild size="sm">
          <Link href="/admin/eventos/novo">+ Novo evento</Link>
        </Button>
      </div>

      <div className="max-w-3xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento cadastrado.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/admin/eventos/${event.id}`}
                className="flex items-center justify-between py-4 px-5 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">{event.title}</p>
                  <p className="text-xs text-gray-500">
                    {event.isTest ? "Teste · " : ""}
                    {event.participantCount} participantes
                  </p>
                </div>
                <span className="text-sm text-gray-500">
                  {statusLabel[event.status] ?? event.status} →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
