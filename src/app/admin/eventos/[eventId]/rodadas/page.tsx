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
  questionCount?: number;
  submissionCount: number;
}

type PendingAction = { type: "open" | "close"; round: RoundItem } | null;

export default function RodadasPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<
    { title: string; slug: string; status: string; participantCount: number } | null
  >(null);
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
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível concluir esta operação. Tente novamente.");
        return;
      }
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

  const sorted = [...rounds].sort((a, b) => a.order - b.order);
  const currentRound = sorted.find((r) => r.status === "open") ?? null;
  const draftRounds = sorted.filter((r) => r.status === "draft" || r.status === "waiting");
  const closedRounds = sorted.filter((r) => r.status === "closed").reverse();

  return (
    <AdminShell eventId={eventId} eventTitle={event?.title} eventSlug={event?.slug} eventStatus={event?.status}>
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

      <div className="max-w-2xl space-y-6">
        {currentRound && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Rodada atual
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{currentRound.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                      Em andamento
                    </span>
                    <span className="text-xs text-gray-500">
                      {currentRound.submissionCount} de {event?.participantCount ?? 0} respostas
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/eventos/${eventId}/rodadas/${currentRound.id}/resultados`}
                    className="text-sm text-[#0b3a6e] hover:underline px-2"
                  >
                    Resultados
                  </Link>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setPending({ type: "close", round: currentRound })}
                  >
                    Encerrar rodada
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {draftRounds.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Próximas / rascunhos
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {draftRounds.map((round) => (
                <div key={round.id} className="flex items-center justify-between py-4 px-5 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{round.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                        Rascunho
                      </span>
                      <span className="text-xs text-gray-500">
                        {round.questionCount ?? 0} perguntas
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {round.submissionCount === 0 && (
                      <Link
                        href={`/admin/eventos/${eventId}/rodadas/${round.id}/editar`}
                        className="text-sm text-[#0b3a6e] hover:underline px-2"
                      >
                        Editar
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={hasOpenRound}
                      title={hasOpenRound ? "Encerre a rodada aberta antes de abrir outra." : undefined}
                      onClick={() => setPending({ type: "open", round })}
                    >
                      Abrir rodada
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {closedRounds.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Encerradas
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {closedRounds.map((round) => (
                <div key={round.id} className="flex items-center justify-between py-4 px-5 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{round.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                        Encerrada
                      </span>
                      <span className="text-xs text-gray-500">
                        {round.submissionCount} respostas
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                    className="text-sm text-[#0b3a6e] hover:underline px-2 shrink-0"
                  >
                    Ver resultados
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {rounds.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-500">Nenhuma rodada criada ainda.</p>
          </div>
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
