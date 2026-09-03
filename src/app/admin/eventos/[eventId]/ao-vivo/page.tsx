"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { resolveDashboardState } from "@/lib/admin/dashboard-state";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventQrDialog } from "@/components/admin/EventQrDialog";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuestionSummary {
  id: string;
  order: number;
  type: string;
  title: string;
  options?: Array<{ option: string; count: number; percent: string }>;
  answers?: Array<{ displayName: string; value: string }>;
}

interface ReadinessSnapshot {
  stats: { registered: number; answering: number; completed: number; notStarted: number };
  round: { id: string; title: string; status: string; questionCount: number } | null;
  nextRound: { id: string; title: string; questionCount: number } | null;
  nextEvent: { id: string; title: string | null } | null;
  checkedAt: string;
}

export default function AoVivoPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [authReady, setAuthReady] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmNextRound, setConfirmNextRound] = useState(false);
  const [confirmNextEvent, setConfirmNextEvent] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const { event, rounds, stats, loading, connectionIssue, lastSyncedAt } = useDashboardRealtime(authReady ? eventId : null);
  const dashboardState = resolveDashboardState(event?.status ?? "draft", rounds);
  const currentRound = dashboardState.currentRound;
  const currentRoundId = currentRound?.id ?? null;
  const nextRound = dashboardState.nextRound;

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

  useEffect(() => {
    if (!authReady || !currentRoundId) {
      setQuestions([]);
      setSelectedQuestionId(null);
      return;
    }

    let cancelled = false;

    async function loadReport() {
      const token = await getAdminIdToken();
      if (!token) return;
      try {
        const res = await adminFetch(
          `/api/admin/events/${eventId}/rounds/${currentRoundId}/report`,
          token
        );
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const qs = (data.questions ?? []) as QuestionSummary[];
        setQuestions(qs);
        setSelectedQuestionId((prev) =>
          prev && qs.some((q) => q.id === prev) ? prev : qs[0]?.id ?? null
        );
      } catch {
        if (!cancelled) setQuestions([]);
      }
    }

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [authReady, currentRoundId, eventId, stats.completed]);

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedQuestionId) ?? questions[0] ?? null,
    [questions, selectedQuestionId]
  );

  const total = event?.participantCount ?? 0;
  const completed = stats.completed;
  const answering = Math.max(0, stats.answering);
  const participantsPending = {
    answering,
    waiting: Math.max(0, stats.registered - stats.answering - stats.completed),
    completed: stats.completed,
  };
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const openedTime = event?.openedAt
    ? new Date(event.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  async function prepareAction(kind: "close" | "round" | "event") {
    setActionLoading(true);
    setActionError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}/readiness`, token, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setReadiness(json);
      if (kind === "close") setConfirmClose(true);
      if (kind === "round") setConfirmNextRound(true);
      if (kind === "event") setConfirmNextEvent(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível conferir o estado atual.");
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(path: string, body?: Record<string, unknown>) {
    setActionLoading(true);
    setActionError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}${path}`, token, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? "Não foi possível concluir esta operação.");
        return;
      }
      if (path === "/next" && json.nextEventId) {
        router.push(`/admin/eventos/${json.nextEventId}/ao-vivo`);
      }
    } catch {
      setActionError("Não foi possível concluir esta operação.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !event) {
    return (
      <div className="min-h-screen bg-[#eaeef4] p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const choiceBars =
    selectedQuestion?.options?.map((o) => ({
      label: o.option,
      count: o.count,
      percent: o.percent.includes("%") ? o.percent : `${o.percent}%`,
    })) ?? [];

  const lead = choiceBars.slice().sort((a, b) => b.count - a.count)[0];

  return (
    <AdminShell
      eventId={eventId}
      eventSlug={event.slug}
      eventTitle={event.title}
      eventStatus={event.status}
      screenLabel="Ao vivo"
    >
      {actionError && (
        <div className="mb-4 max-w-xl text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">
          {actionError}
        </div>
      )}
      {connectionIssue && (
        <div role="status" className="mb-4 max-w-2xl rounded-lg border border-[#ead69c] bg-[#fff8e5] px-4 py-3 text-sm text-[#7a5600]">
          Conexão instável. Mantendo os últimos dados recebidos{lastSyncedAt ? ` às ${lastSyncedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""} e tentando reconectar automaticamente. Ações críticas serão conferidas no servidor antes de executar.
        </div>
      )}

      <section aria-label="Central da sessão" className="max-w-[1280px]">
        <div className="bg-[#0a2d55] text-white rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between gap-5 p-[18px_22px] flex-wrap">
            <div className="min-w-0">
              <p className="m-0 inline-flex items-center gap-2 text-[11.5px] font-bold tracking-[0.1em] uppercase text-[#8fb6e0]">
                <span className="w-2 h-2 rounded-full bg-[#5ecf92] animate-pulse" />
                Sessão {event.status === "open" ? "em andamento" : event.status === "closed" ? "encerrada" : "aguardando"} · iniciada às{" "}
                {openedTime}
              </p>
              {event.sequenceId && event.sequenceOrder !== null && (
                <p className="mb-0 mt-2 text-xs font-semibold text-[#7fdda9]">
                  Evento {event.sequenceOrder + 1} de {event.sequenceSize} na sequência
                  {event.nextEventTitle ? ` · próximo: ${event.nextEventTitle}` : " · último evento"}
                </p>
              )}
              <h1 className="mt-2 mb-0 text-xl font-bold leading-snug max-w-[46ch] text-pretty">
                {event.title}
              </h1>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <EventQrDialog
                eventSlug={event.sequenceRootSlug ?? event.slug}
                eventTitle={event.title}
                trigger={
                  <button
                    type="button"
                    className="h-10 px-4 text-sm font-semibold bg-white text-[#0a2d55] border border-white rounded-md hover:bg-[#e6edf6]"
                  >
                    Acesso dos participantes
                  </button>
                }
              />
              <Link
                href={`/projector/${event.sequenceRootSlug ?? event.slug}`}
                target="_blank"
                className="inline-flex items-center h-10 px-4 text-sm font-semibold text-white border border-white/45 rounded-md hover:bg-white/10 no-underline"
              >
                Abrir projetor
              </Link>
              {currentRound ? (
                <button
                  type="button"
                  onClick={() => void prepareAction("close")}
                  disabled={actionLoading}
                  className="h-10 px-4 text-sm font-semibold text-[#ffc9c2] border border-[rgba(255,201,194,.5)] rounded-md hover:bg-[rgba(180,35,24,.28)] hover:text-white disabled:opacity-50"
                >
                  Encerrar rodada
                </button>
              ) : event.status === "waiting" || event.status === "draft" ? (
                <button
                  type="button"
                  onClick={() => runAction("/open")}
                  disabled={actionLoading}
                  className="h-10 px-4 text-sm font-semibold bg-white text-[#0a2d55] border border-white rounded-md hover:bg-[#e6edf6] disabled:opacity-50"
                >
                  Iniciar evento
                </button>
              ) : nextRound ? (
                <button
                  type="button"
                  onClick={() => void prepareAction("round")}
                  disabled={actionLoading}
                  className="h-10 px-4 text-sm font-semibold bg-white text-[#0a2d55] border border-white rounded-md hover:bg-[#e6edf6] disabled:opacity-50"
                >
                  Iniciar próxima rodada
                </button>
              ) : event.nextEventId && (event.status === "open" || event.status === "closed") ? (
                <button
                  type="button"
                  onClick={() => void prepareAction("event")}
                  disabled={actionLoading}
                  className="h-10 px-4 text-sm font-semibold bg-[#5ecf92] text-[#082f57] border border-[#5ecf92] rounded-md hover:bg-[#7bdda7] disabled:opacity-50"
                >
                  Próximo evento
                </button>
              ) : null}
            </div>
          </div>

          <div className="border-t border-white/14 px-[22px] py-4 flex items-center gap-7 flex-wrap">
            {[
              { label: "Conectados", value: String(total), accent: false },
              { label: "Responderam", value: String(completed), accent: true },
              { label: "Respondendo", value: String(answering), accent: false },
              { label: "Conclusão", value: `${percent}%`, accent: false },
            ].map((m) => (
              <div key={m.label} className="min-w-[104px]">
                <p className="m-0 text-[11.5px] tracking-[0.05em] uppercase text-[#8fb6e0]">
                  {m.label}
                </p>
                <p
                  className={`mt-1 mb-0 text-[28px] font-bold leading-none tabular-nums ${
                    m.accent ? "text-[#5ecf92]" : "text-white"
                  }`}
                >
                  {m.value}
                </p>
              </div>
            ))}
            <div className="flex-1 min-w-[220px]">
              <div
                role="img"
                aria-label={`${completed} de ${total} participantes concluíram, ${percent} por cento`}
                className="h-2.5 bg-white/16 rounded-[5px] overflow-hidden"
              >
                <div
                  className="h-full bg-[#5ecf92] rounded-[5px] transition-all duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 mb-0 text-[12.5px] text-[#8fb6e0]">
                {percent}% concluíram a rodada · atualização em tempo real
              </p>
            </div>
          </div>
        </div>

        {!currentRound ? (
          <div className="mt-5 bg-white border border-[#dde4ee] rounded-lg p-8 text-center">
            <p className="text-[#5b6b7f] mb-4">
              {dashboardState.case === "no_rounds_yet"
                ? "Nenhuma rodada criada ainda."
                : dashboardState.case === "has_next_round"
                  ? `Próxima rodada pronta: ${nextRound?.title}`
                  : dashboardState.case === "event_closed"
                    ? "Evento encerrado."
                    : "Nenhuma rodada aberta no momento."}
            </p>
            {dashboardState.case === "no_rounds_yet" && (
              <Link
                href={`/admin/eventos/${eventId}/rodadas/nova`}
                className="inline-flex items-center h-10 px-4 text-sm font-semibold bg-[#0b3a6e] text-white rounded-md"
              >
                Criar primeira rodada
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_280px] gap-5">
            <div className="bg-white border border-[#dde4ee] rounded-lg p-4 min-w-0">
              <div className="flex items-center justify-between gap-2.5 mb-3">
                <h2 className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  Fluxo da sessão
                </h2>
                <span className="text-[11.5px] text-[#8a97a8]">
                  Rodada {String(currentRound.order).padStart(2, "0")} de{" "}
                  {String(rounds.length).padStart(2, "0")}
                </span>
              </div>
              <p className="m-0 mb-2 text-[13.5px] font-semibold text-[#33415c]">
                {String(currentRound.order).padStart(2, "0")} · {currentRound.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {questions.map((q, idx) => {
                  const active = selectedQuestion?.id === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQuestionId(q.id)}
                      aria-current={active ? "true" : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                        active ? "bg-[#eef3f9]" : "hover:bg-[#f7f9fc]"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded text-[11px] font-bold flex items-center justify-center shrink-0 ${
                          active
                            ? "bg-[#0b3a6e] text-white"
                            : "bg-[#eef1f5] text-[#5b6b7f]"
                        }`}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-[13px] leading-snug text-[#33415c] line-clamp-2">
                        {q.title}
                      </span>
                    </button>
                  );
                })}
                {questions.length === 0 && (
                  <p className="text-[12.5px] text-[#8a97a8]">Carregando perguntas…</p>
                )}
              </div>
              <p className="mt-3.5 mb-0 pt-3 border-t border-[#eef1f5] text-[11.5px] text-[#8a97a8] leading-relaxed">
                A rodada é respondida por inteiro no celular. Selecionar uma pergunta aqui muda
                apenas a análise exibida ao operador.
              </p>
            </div>

            <div className="bg-white border border-[#dde4ee] rounded-lg p-[22px] min-w-0">
              <div className="flex items-start justify-between gap-3.5 flex-wrap">
                <div className="min-w-0">
                  <h2 className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                    Análise ao vivo
                  </h2>
                  <p className="mt-2.5 mb-0 text-lg font-semibold leading-snug max-w-[46ch] text-pretty text-[#1a1a1a]">
                    {selectedQuestion?.title ?? "Aguardando respostas…"}
                  </p>
                  <p className="mt-2 mb-0 text-[13px] text-[#5b6b7f]">
                    {selectedQuestion
                      ? selectedQuestion.type === "text"
                        ? "Respostas abertas"
                        : "Distribuição das alternativas"
                      : "—"}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-bold tracking-[0.06em] uppercase text-[#0b3a6e] bg-[#eef3f9] border border-[#cfdcea] rounded px-2 py-0.5">
                  Visível só para o operador
                </span>
              </div>

              {selectedQuestion?.type === "text" ? (
                <div className="flex flex-col gap-2.5 mt-[22px]">
                  {(selectedQuestion.answers ?? []).slice(0, 6).map((a, i) => (
                    <div
                      key={`${a.displayName}-${i}`}
                      className="border border-[#dde4ee] border-l-[3px] border-l-[#0b3a6e] rounded-md px-3.5 py-3 bg-[#fbfcfd]"
                    >
                      <p className="m-0 text-[11.5px] text-[#8a97a8]">{a.displayName}</p>
                      <p className="mt-1 mb-0 text-sm text-[#33415c] leading-relaxed text-pretty">
                        {a.value || "—"}
                      </p>
                    </div>
                  ))}
                  {(selectedQuestion.answers?.length ?? 0) === 0 && (
                    <p className="text-sm text-[#8a97a8]">Nenhuma resposta aberta ainda.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-[22px]">
                    <HorizontalBarChart items={choiceBars} />
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-[#eef1f5] flex-wrap">
                    <p className="m-0 text-[13px] text-[#33415c]">
                      Tendência:{" "}
                      <strong className="font-semibold">{lead?.label ?? "—"}</strong>
                    </p>
                    <Link
                      href={`/admin/eventos/${eventId}/rodadas/${currentRound.id}/resultados`}
                      className="inline-flex items-center h-[34px] px-3 text-[13px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e]"
                    >
                      Ver na análise completa
                    </Link>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              <div className="bg-white border border-[#dde4ee] rounded-lg p-5">
                <h2 className="m-0 mb-3.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  Quem ainda falta
                </h2>
                <div className="flex flex-col">
                  {[
                    {
                      label: "Respondendo agora",
                      value: participantsPending.answering || answering,
                      className: "text-[#8a5a00] font-semibold",
                    },
                    {
                      label: "Ainda não iniciaram",
                      value: participantsPending.waiting,
                      className: "text-[#5b6b7f] font-semibold",
                    },
                    {
                      label: "Já finalizaram",
                      value: participantsPending.completed || completed,
                      className: "text-[#1a7f4b] font-semibold",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-[#f2f5f8] last:border-0"
                    >
                      <span className="text-[13.5px] text-[#33415c]">{row.label}</span>
                      <span className={`text-[13.5px] tabular-nums ${row.className}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/admin/eventos/${eventId}/participantes`}
                  className="flex items-center justify-center w-full mt-3.5 h-[38px] text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline"
                >
                  Ver participantes
                </Link>
              </div>

              <div className="bg-white border border-[#dde4ee] rounded-lg p-5">
                <h2 className="m-0 mb-3 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  No telão agora
                </h2>
                <p className="m-0 text-sm font-semibold text-[#33415c]">
                  Participantes e conclusões
                </p>
                <p className="mt-1.5 mb-0 text-[12.5px] text-[#5b6b7f] leading-relaxed">
                  O projetor mostra apenas {total} participantes e {completed} conclusões.
                  Perguntas e resultados não aparecem para a plateia.
                </p>
                <Link
                  href={`/projector/${event.sequenceRootSlug ?? event.slug}`}
                  target="_blank"
                  className="flex items-center justify-center w-full mt-3.5 h-[38px] text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline"
                >
                  Conferir projetor
                </Link>
              </div>

              <div className="bg-white border border-[#dde4ee] rounded-lg p-5">
                <h2 className="m-0 mb-3 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  Ao encerrar
                </h2>
                <p className="m-0 text-[12.5px] text-[#5b6b7f] leading-relaxed">
                  Encerrar a rodada bloqueia novas respostas e libera o relatório consolidado do
                  evento.
                </p>
                <Link
                  href={`/admin/eventos/${eventId}/relatorios`}
                  className="flex items-center justify-center w-full mt-3.5 h-[38px] text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline"
                >
                  Prévia do relatório
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{readiness?.stats.answering ? "Pessoas ainda estão respondendo" : "Encerrar rodada?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {readiness?.stats.answering
                ? `${readiness.stats.answering} participante(s) ainda estão respondendo e ${readiness.stats.notStarted} ainda não iniciaram. Ao encerrar, novas respostas serão bloqueadas.`
                : `Foram recebidas ${readiness?.stats.completed ?? completed} respostas. Após o encerramento, novas respostas não serão aceitas nesta rodada.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={() => {
                if (!currentRound) return;
                setConfirmClose(false);
                void runAction(`/rounds/${currentRound.id}/close`, { force: Boolean(readiness?.stats.answering) });
              }}
              className={readiness?.stats.answering ? "bg-[#b42318] hover:bg-[#8f1c13]" : undefined}
            >
              {readiness?.stats.answering ? "Encerrar mesmo assim" : "Encerrar rodada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmNextRound} onOpenChange={setConfirmNextRound}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar a próxima rodada?</AlertDialogTitle>
            <AlertDialogDescription>
              “{readiness?.nextRound?.title ?? nextRound?.title}” será aberta para todos os participantes
              {readiness?.nextRound ? ` com ${readiness.nextRound.questionCount} pergunta(s).` : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-[#dbe4ef] bg-[#f7f9fc] px-4 py-3 text-sm text-[#33415c]">
            Rodada anterior: <strong>{readiness?.stats.completed ?? 0} concluíram</strong>
            {readiness?.stats.notStarted ? ` · ${readiness.stats.notStarted} não iniciaram` : ""}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Continuar aguardando</AlertDialogCancel>
            <AlertDialogAction disabled={actionLoading} onClick={() => { setConfirmNextRound(false); void runAction("/rounds/next/open"); }}>Iniciar próxima rodada</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmNextEvent} onOpenChange={setConfirmNextEvent}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avançar para o próximo evento?</AlertDialogTitle>
            <AlertDialogDescription>
              O mesmo QR Code passará a direcionar os participantes para “{readiness?.nextEvent?.title ?? event.nextEventTitle}”. Esta ação não deve ser feita enquanto pessoas ainda estiverem concluindo o evento atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#dbe4ef] bg-[#f7f9fc] p-3 text-center text-xs text-[#64748b]">
            <div><strong className="block text-lg text-[#18754a]">{readiness?.stats.completed ?? 0}</strong>concluíram</div>
            <div><strong className="block text-lg text-[#9a6700]">{(readiness?.stats.answering ?? 0) + (readiness?.stats.notStarted ?? 0)}</strong>ainda pendentes</div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={actionLoading} onClick={() => { setConfirmNextEvent(false); void runAction("/next"); }} className={readiness?.stats.answering ? "bg-[#b42318] hover:bg-[#8f1c13]" : "bg-[#18754a] hover:bg-[#12633e]"}>{readiness?.stats.answering ? "Avançar mesmo assim" : "Confirmar próximo evento"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AdminShell>
  );
}
