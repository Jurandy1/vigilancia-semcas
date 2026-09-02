"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface RoundItem {
  id: string;
  title: string;
  status: string;
  order: number;
  submissionCount: number;
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  waiting: "Aguardando",
  open: "Em andamento",
  closed: "Encerrada",
};

const statusStyle: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  waiting: "bg-gray-100 text-gray-600",
  open: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

type PendingAction = { type: "open" | "close"; round: RoundItem } | null;

export default function RodadasPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<{ title: string; slug: string } | null>(null);
  const [rounds, setRounds] = useState<RoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAdminIdToken();
    if (!token) return;
    const [roundsRes, eventRes] = await Promise.all([
      adminFetch(`/api/admin/events/${eventId}/rounds`, token),
      adminFetch(`/api/admin/events/${eventId}`, token),
    ]);
    const roundsData = await roundsRes.json();
    const eventData = await eventRes.json();
    setRounds(roundsData.rounds ?? []);
    setEvent(eventData.event ?? null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    const unsub = onAdminAuthChange((user) => {
      if (user) load();
    });
    return unsub;
  }, [load]);

  const hasOpenRound = rounds.some((r) => r.status === "open");

  async function confirmAction() {
    if (!pending) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(
        `/api/admin/events/${eventId}/rounds/${pending.round.id}/${pending.type}`,
        token,
        { method: "POST" }
      );
      if (!res.ok) throw new Error();
      setPending(null);
      await load();
    } catch {
      setError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminShell eventId={eventId}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell eventId={eventId} eventTitle={event?.title} eventSlug={event?.slug}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rodadas</h1>
          <p className="text-sm text-gray-500 mt-1">{event?.title}</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/admin/eventos/${eventId}/rodadas/nova`}>+ Nova rodada</Link>
        </Button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="max-w-2xl bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {rounds.length === 0 ? (
          <p className="text-sm text-gray-500 p-5">Nenhuma rodada criada ainda.</p>
        ) : (
          rounds
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((round, i) => {
              const isDraft = round.status === "draft" || round.status === "waiting";
              const isOpen = round.status === "open";
              const isClosed = round.status === "closed";
              const openDisabled = isDraft && hasOpenRound;

              return (
                <div key={round.id} className="flex items-center justify-between py-4 px-5 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {i + 1}. {round.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          statusStyle[round.status] ?? statusStyle.draft
                        }`}
                      >
                        {statusLabel[round.status] ?? round.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {round.submissionCount ?? 0} respostas
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(isOpen || isClosed) && (
                      <Link
                        href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                        className="text-sm text-[#0b3a6e] hover:underline px-2"
                      >
                        Resultados
                      </Link>
                    )}
                    {isDraft && (
                      <Button
                        size="sm"
                        disabled={openDisabled}
                        title={
                          openDisabled
                            ? "Encerre a rodada aberta antes de abrir outra."
                            : undefined
                        }
                        onClick={() => setPending({ type: "open", round })}
                      >
                        Abrir rodada
                      </Button>
                    )}
                    {isOpen && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setPending({ type: "close", round })}
                      >
                        Encerrar rodada
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.type === "open" ? "Abrir rodada?" : "Encerrar rodada?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.type === "open"
                ? "Todos os participantes aptos poderão responder esta etapa."
                : "Após o encerramento, novas respostas não serão aceitas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={actionLoading}>
              {actionLoading
                ? "Aguarde..."
                : pending?.type === "open"
                  ? "Abrir rodada"
                  : "Encerrar rodada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
