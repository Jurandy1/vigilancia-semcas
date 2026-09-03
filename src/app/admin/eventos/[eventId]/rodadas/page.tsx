"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/AdminShell";
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

function RoundCard({
  round,
  participantCount,
  actions,
}: {
  round: RoundItem;
  participantCount: number;
  actions: React.ReactNode;
}) {
  const num = String(round.order).padStart(2, "0");
  const isOpen = round.status === "open";
  return (
    <div className="bg-white border border-[#dde4ee] rounded-lg px-5 py-[18px] flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className="m-0 text-base font-semibold text-[#1a1a1a]">
          {num} · {round.title}
        </p>
        <div className="flex items-center gap-2.5 mt-2 flex-wrap">
          <span
            className={
              isOpen
                ? "inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a7f4b] bg-[#e8f5ee] border border-[#c3e4d1] rounded px-2 py-0.5"
                : round.status === "closed"
                  ? "inline-flex text-xs font-semibold text-[#5b6b7f] bg-[#f4f6f9] border border-[#dde4ee] rounded px-2 py-0.5"
                  : "inline-flex text-xs font-semibold text-[#8a5a00] bg-[#fdf5e3] border border-[#f0dfae] rounded px-2 py-0.5"
            }
          >
            {isOpen ? "Aberta" : round.status === "closed" ? "Encerrada" : "Rascunho"}
          </span>
          <span className="text-[13px] text-[#5b6b7f]">
            {isOpen || round.status === "closed"
              ? `${round.submissionCount} de ${participantCount} respostas`
              : `${round.questionCount ?? 0} perguntas`}
            {isOpen ? ` · ${round.questionCount ?? 0} perguntas` : ""}
          </span>
        </div>
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap">{actions}</div>
    </div>
  );
}

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
  const participantCount = event?.participantCount ?? 0;

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
      <AdminShell eventId={eventId} screenLabel="Perguntas do evento">
        <div className="space-y-4 max-w-[900px]">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-28 w-full" />
        </div>
      </AdminShell>
    );
  }

  const sorted = [...rounds].sort((a, b) => a.order - b.order);
  const openRounds = sorted.filter((r) => r.status === "open");
  const draftRounds = sorted.filter((r) => r.status === "draft" || r.status === "waiting");
  const closedRounds = sorted.filter((r) => r.status === "closed");

  const outlineBtn =
    "inline-flex items-center h-[38px] px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] bg-white border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline";
  const dangerBtn =
    "inline-flex items-center h-[38px] px-3.5 text-[13.5px] font-semibold text-[#b42318] bg-white border border-[#e3b3ad] rounded-md hover:bg-[#fdf2f1] hover:border-[#b42318]";

  return (
    <AdminShell
      eventId={eventId}
      eventTitle={event?.title}
      eventSlug={event?.slug}
      eventStatus={event?.status}
      screenLabel="Perguntas do evento"
    >
      <section aria-label="Rodadas" className="max-w-[900px]">
        <div className="flex items-start justify-between gap-5 flex-wrap mb-6">
          <div>
            <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em] text-[#1a1a1a]">Perguntas do evento</h1>
            <p className="mt-1.5 mb-0 text-sm text-[#5b6b7f]">
              Revise os enunciados, explicações, alternativas e campos de resposta deste evento.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {draftRounds.length === 1 && (
              <Link
                href={`/admin/eventos/${eventId}/rodadas/${draftRounds[0]!.id}/editar`}
                className="inline-flex items-center justify-center h-10 px-[18px] text-sm font-semibold text-[#0b3a6e] bg-white border border-[#b9c9d9] rounded-md hover:bg-[#f4f7fb] no-underline"
              >
                Editar perguntas
              </Link>
            )}
            <Link
              href={`/admin/eventos/${eventId}/rodadas/nova`}
              className="inline-flex items-center justify-center h-10 px-[18px] text-sm font-semibold bg-[#0b3a6e] text-white rounded-md hover:bg-[#0d4a8a] no-underline"
            >
              + Novo bloco de perguntas
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <h2 className="m-0 mb-2.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
          Em andamento
        </h2>
        {openRounds.length === 0 ? (
          <div className="bg-white border border-[#dde4ee] rounded-lg p-[22px] text-center mb-0">
            <p className="m-0 text-sm text-[#8a97a8]">Nenhuma rodada aberta no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openRounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                participantCount={participantCount}
                actions={
                  <>
                    <Link
                      href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                      className={outlineBtn}
                    >
                      Resultados
                    </Link>
                    <Link
                      href={`/admin/eventos/${eventId}/ao-vivo`}
                      className={outlineBtn}
                    >
                      Gerenciar
                    </Link>
                    <button
                      type="button"
                      className={dangerBtn}
                      onClick={() => setPending({ type: "close", round })}
                    >
                      Encerrar
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}

        <h2 className="mt-[26px] mb-2.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
          Próximas / rascunhos
        </h2>
        {draftRounds.length === 0 ? (
          <div className="bg-white border border-dashed border-[#c9d4e2] rounded-lg p-[22px] text-center">
            <p className="m-0 text-sm text-[#5b6b7f]">Nenhuma rodada em rascunho.</p>
            <Link
              href={`/admin/eventos/${eventId}/rodadas/nova`}
              className={`${outlineBtn} mt-3`}
            >
              Criar próxima rodada
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {draftRounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                participantCount={participantCount}
                actions={
                  <>
                    {round.submissionCount === 0 && (
                      <Link
                        href={`/admin/eventos/${eventId}/rodadas/${round.id}/editar`}
                        className={outlineBtn}
                      >
                        Editar perguntas
                      </Link>
                    )}
                    <button
                      type="button"
                      className={outlineBtn}
                      disabled={hasOpenRound}
                      title={
                        hasOpenRound ? "Encerre a rodada aberta antes de abrir outra." : undefined
                      }
                      onClick={() => setPending({ type: "open", round })}
                    >
                      Abrir rodada
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}

        <h2 className="mt-[26px] mb-2.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
          Concluídas
        </h2>
        {closedRounds.length === 0 ? (
          <div className="bg-white border border-[#dde4ee] rounded-lg p-[22px] text-center">
            <p className="m-0 text-sm text-[#8a97a8]">Nenhuma rodada encerrada até agora.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closedRounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                participantCount={participantCount}
                actions={
                  <Link
                    href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                    className={outlineBtn}
                  >
                    Ver resultados
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </section>

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
