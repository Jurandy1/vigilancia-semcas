"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  List,
  MapPin,
  Monitor,
  QrCode,
  Users,
  XCircle,
} from "lucide-react";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { resolveDashboardState } from "@/lib/admin/dashboard-state";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventQrDialog } from "@/components/admin/EventQrDialog";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { DonutChart } from "@/components/admin/DonutChart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  stats: { completed: number; notStarted: number };
  round: { id: string; title: string; status: string; questionCount: number } | null;
  nextRound: { id: string; title: string; questionCount: number } | null;
  nextEvent: { id: string; title: string | null } | null;
  checkedAt: string;
}

export default function EventDashboardPage() {
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
  const [questionListOpen, setQuestionListOpen] = useState(false);

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
    if (!authReady) return;
    try {
      const warning = window.sessionStorage.getItem("semcas-round-open-warning");
      if (warning) {
        window.sessionStorage.removeItem("semcas-round-open-warning");
        setActionError(
          `O evento avançou, mas a primeira rodada não abriu automaticamente (${warning}). Abra-a manualmente abaixo.`
        );
      }
    } catch {
      /* best-effort */
    }
  }, [authReady]);

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
  const completed = currentRound ? stats.completed : (dashboardState.lastClosedRound?.submissionCount ?? 0);
  const waiting = Math.max(0, total - completed);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const openedTime = event?.openedAt
    ? new Date(event.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const openedDate = event?.openedAt
    ? new Date(event.openedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
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
        if (json.roundOpenWarning) {
          // A navegação troca de página, então guardamos o aviso para o
          // destino ler ao montar — senão o admin nunca veria que a
          // primeira rodada do próximo evento não abriu sozinha.
          try {
            window.sessionStorage.setItem("semcas-round-open-warning", String(json.roundOpenWarning));
          } catch {
            /* best-effort */
          }
        }
        router.push(`/admin/eventos/${json.nextEventId}`);
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
  const rootSlug = event.sequenceRootSlug ?? event.slug;

  return (
    <AdminShell
      eventId={eventId}
      eventSlug={event.slug}
      eventTitle={event.title}
      eventStatus={event.status}
      screenLabel="Painel do evento"
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

      <section aria-label="Painel do evento" className="max-w-[1280px]">
        <div
          className="relative text-white rounded-[10px] overflow-hidden"
          style={{ background: "radial-gradient(120% 160% at 100% 0%, #163e6e 0%, #0a2d55 45%, #081f3d 100%)" }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #fff 0px, #fff 1px, transparent 1px, transparent 34px)",
            }}
          />
          <div className="relative flex items-start justify-between gap-5 p-4 sm:p-[22px] flex-wrap">
            <div className="min-w-0">
              <p className="m-0 inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.1em] uppercase bg-white/12 border border-white/20 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5ecf92] animate-pulse" />
                {event.status === "open" ? "Em andamento" : event.status === "closed" ? "Encerrado" : "Aguardando início"}
                {event.status === "open" && (
                  <span className="text-[#8fb6e0] font-medium normal-case tracking-normal">
                    &nbsp;| Iniciado às {openedTime}
                  </span>
                )}
              </p>
              {event.sequenceId && event.sequenceOrder !== null && (
                <p className="mb-0 mt-2.5 text-xs font-semibold text-[#7fdda9]">
                  Evento {event.sequenceOrder + 1} de {event.sequenceSize} na sequência
                  {event.nextEventTitle ? ` · próximo: ${event.nextEventTitle}` : " · último evento"}
                </p>
              )}
              <h1 className="mt-2.5 mb-0 text-xl sm:text-2xl font-bold leading-snug max-w-[46ch] text-pretty text-balance">
                {event.title}
              </h1>
              <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-5 flex-wrap text-[12.5px] sm:text-[13px] text-[#c7d9ec]">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={15} className="text-[#8fb6e0]" /> {openedDate}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={15} className="text-[#8fb6e0]" /> Iniciado às {openedTime}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} className="text-[#8fb6e0]" /> São Luís - MA
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:contents">
              <EventQrDialog
                eventSlug={rootSlug}
                eventTitle={event.title}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 text-sm font-semibold bg-white text-[#0a2d55] border border-white rounded-md hover:bg-[#e6edf6] w-full sm:w-auto"
                  >
                    <QrCode size={16} /> Acesso dos participantes
                  </button>
                }
              />
              <div className="flex gap-2 flex-wrap w-full sm:contents">
                <Link
                  href={`/projector/${DAILY_ACTIVE_SLUG}`}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 text-sm font-semibold text-white border border-white/45 rounded-md hover:bg-white/10 no-underline flex-1 min-w-[140px] sm:flex-none sm:min-w-0"
                >
                  <Monitor size={16} /> Abrir projetor
                </Link>
                {currentRound ? (
                  <button
                    type="button"
                    onClick={() => void prepareAction("close")}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 text-sm font-semibold text-[#ffc9c2] border border-[rgba(255,201,194,.5)] rounded-md hover:bg-[rgba(180,35,24,.28)] hover:text-white disabled:opacity-50 flex-1 min-w-[140px] sm:flex-none sm:min-w-0"
                  >
                    <XCircle size={16} /> Encerrar rodada
                  </button>
                ) : event.status === "waiting" || event.status === "draft" ? (
                  <button
                    type="button"
                    onClick={() => runAction("/open")}
                    disabled={actionLoading}
                    className="h-11 sm:h-10 px-4 text-sm font-semibold bg-white text-[#0a2d55] border border-white rounded-md hover:bg-[#e6edf6] disabled:opacity-50 flex-1 min-w-[140px] sm:flex-none sm:min-w-0"
                  >
                    Iniciar evento
                  </button>
                ) : nextRound ? (
                  <button
                    type="button"
                    onClick={() => void prepareAction("round")}
                    disabled={actionLoading}
                    className="h-11 sm:h-10 px-4 text-sm font-semibold bg-white text-[#0a2d55] border border-white rounded-md hover:bg-[#e6edf6] disabled:opacity-50 flex-1 min-w-[140px] sm:flex-none sm:min-w-0"
                  >
                    Iniciar próxima rodada
                  </button>
                ) : event.nextEventId && (event.status === "open" || event.status === "closed") ? (
                  <button
                    type="button"
                    onClick={() => void prepareAction("event")}
                    disabled={actionLoading}
                    className="h-11 sm:h-10 px-4 text-sm font-semibold bg-[#5ecf92] text-[#082f57] border border-[#5ecf92] rounded-md hover:bg-[#7bdda7] disabled:opacity-50 flex-1 min-w-[140px] sm:flex-none sm:min-w-0"
                  >
                    Próximo evento
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: "Registrados", value: String(total), sub: "participante" + (total === 1 ? "" : "s"), icon: Users, iconBg: "#e7effa", iconColor: "#0b3a6e" },
            { label: "Finalizaram", value: String(completed), sub: `${percent}% do total`, icon: CheckCircle2, iconBg: "#e4f5ea", iconColor: "#18754a" },
            { label: "Conclusão", value: `${percent}%`, sub: "da rodada", icon: BarChart3, iconBg: "#e7effa", iconColor: "#0b3a6e" },
          ].map((m, idx) => (
            <div
              key={m.label}
              className={`bg-white border border-[#dde4ee] rounded-lg p-3.5 sm:p-4 flex items-start gap-3 ${
                idx === 2 ? "col-span-2 md:col-span-1" : ""
              }`}
            >
              <span
                className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: m.iconBg, color: m.iconColor }}
              >
                <m.icon size={19} />
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-bold tracking-[0.06em] uppercase text-[#8a97a8]">
                  {m.label}
                </p>
                <p className="mt-1 mb-0 text-2xl font-bold leading-none tabular-nums text-[#11243c]">
                  {m.value}
                </p>
                <p className="mt-1 mb-0 text-[12px] text-[#8a97a8]">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {currentRound ? (
          <div className="mt-4 sm:mt-5 grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_280px] gap-4 sm:gap-5">
            <div className="bg-white border border-[#dde4ee] rounded-lg p-3.5 sm:p-4 min-w-0">
              {/* Mobile/tablet: compact question navigator (reuses questions/selectedQuestionId state) */}
              <div className="lg:hidden">
                <div className="flex items-center justify-between gap-2.5 mb-3">
                  <h2 className="m-0 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                    <Monitor size={14} /> Fluxo da sessão
                  </h2>
                  <span className="text-[11.5px] text-[#8a97a8] shrink-0">
                    {questions.length > 0
                      ? `${Math.max(1, questions.findIndex((q) => q.id === selectedQuestion?.id) + 1)} de ${questions.length}`
                      : "—"}
                  </span>
                </div>

                {selectedQuestion ? (
                  <div className="rounded-md bg-[#eef3f9] border border-[#cfdcea] px-3 py-2.5 mb-3">
                    <p className="m-0 text-[10.5px] font-bold tracking-[0.08em] uppercase text-[#0b3a6e]">
                      Pergunta atual
                    </p>
                    <p className="mt-1 mb-0 text-[13.5px] font-semibold text-[#1a2c44] leading-snug text-pretty">
                      {selectedQuestion.title}
                    </p>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-[#8a97a8] mb-3">Carregando perguntas…</p>
                )}

                {questions.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {questions.map((q, idx) => {
                      const active = selectedQuestion?.id === q.id;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setSelectedQuestionId(q.id)}
                          aria-current={active ? "true" : undefined}
                          aria-label={`Pergunta ${idx + 1} de ${questions.length}`}
                          className={`shrink-0 w-11 h-11 rounded text-[13px] font-bold flex items-center justify-center ${
                            active ? "bg-[#0b3a6e] text-white" : "bg-[#eef1f5] text-[#5b6b7f]"
                          }`}
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                )}

                {questions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuestionListOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 h-11 text-[12.5px] font-semibold text-[#0b3a6e]"
                  >
                    <List size={14} /> Ver todas as perguntas
                  </button>
                )}
              </div>

              {/* Desktop: full question list */}
              <div className="hidden lg:block">
                <div className="flex items-center justify-between gap-2.5 mb-3">
                  <h2 className="m-0 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                    <Monitor size={14} /> Fluxo da sessão
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
                        <ChevronRight size={15} className="shrink-0 text-[#b7c2cf]" />
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
            </div>

            <div className="bg-white border border-[#dde4ee] rounded-lg p-4 sm:p-[22px] min-w-0">
              <div className="flex items-start justify-between gap-3.5 flex-wrap">
                <div className="min-w-0">
                  <h2 className="m-0 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                    <BarChart3 size={14} /> Análise ao vivo
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

            <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
              <div className="bg-white border border-[#dde4ee] rounded-lg p-4 sm:p-5">
                <h2 className="m-0 mb-3.5 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  <Users size={14} /> Participação
                </h2>
                <div className="flex flex-col">
                  {[
                    {
                      label: "Ainda não responderam",
                      value: Math.max(0, total - completed),
                      className: "text-[#5b6b7f] font-semibold",
                    },
                    {
                      label: "Já finalizaram",
                      value: completed,
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
                  className="inline-flex items-center justify-center gap-2 w-full mt-3.5 h-[38px] text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline"
                >
                  <Users size={15} /> Ver participantes
                </Link>
              </div>

              <div className="bg-white border border-[#dde4ee] rounded-lg p-4 sm:p-5">
                <h2 className="m-0 mb-3 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  <Monitor size={14} /> No telão agora
                </h2>
                <p className="m-0 text-sm font-semibold text-[#33415c]">
                  Participantes e conclusões
                </p>
                <p className="mt-1.5 mb-0 text-[12.5px] text-[#5b6b7f] leading-relaxed">
                  O projetor mostra apenas {total} participantes e {completed} conclusões.
                  Perguntas e resultados não aparecem para a plateia.
                </p>
                <Link
                  href={`/projector/${DAILY_ACTIVE_SLUG}`}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 w-full mt-3.5 h-[38px] text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline"
                >
                  <Monitor size={15} /> Conferir projetor
                </Link>
              </div>

              <div className="bg-white border border-[#dde4ee] rounded-lg p-4 sm:p-5">
                <h2 className="m-0 mb-3 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  <Flag size={14} /> Ao encerrar
                </h2>
                <p className="m-0 text-[12.5px] text-[#5b6b7f] leading-relaxed">
                  Encerrar a rodada bloqueia novas respostas e libera o relatório consolidado do
                  evento.
                </p>
                <Link
                  href={`/admin/eventos/${eventId}/relatorios`}
                  className="inline-flex items-center justify-center gap-2 w-full mt-3.5 h-[38px] text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline"
                >
                  <FileText size={15} /> Prévia do relatório
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
            <div className="flex flex-col gap-5 min-w-0">
              <div className="bg-white border border-[#dde4ee] rounded-lg p-8 text-center">
                <p className="text-[#5b6b7f] mb-4">
                  {dashboardState.case === "no_rounds_yet"
                    ? "Nenhuma rodada criada ainda."
                    : dashboardState.case === "has_next_round"
                      ? `Próxima rodada pronta: ${nextRound?.title}`
                      : dashboardState.case === "event_closed"
                        ? "Evento encerrado."
                        : dashboardState.case === "event_waiting"
                          ? "Este evento ainda não foi iniciado. A primeira rodada disponível será aberta automaticamente."
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

              {total > 0 && (
                <div className="bg-white border border-[#dde4ee] rounded-lg p-5">
                  <h2 className="m-0 mb-1 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                    <Users size={14} /> Situação da participação
                  </h2>
                  <p className="m-0 mb-3.5 text-[12.5px] text-[#8a97a8]">
                    Distribuição dos {total} participantes do evento
                  </p>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="relative w-[168px] h-[168px] shrink-0">
                      <DonutChart
                        size={168}
                        centerValue={total}
                        centerLabel="participantes"
                        showLegend={false}
                        segments={[
                          { label: "Concluíram", value: completed, color: "#18754a" },
                          { label: "Não iniciaram", value: waiting, color: "#cbd5e1" },
                        ]}
                      />
                    </div>
                    <ul className="list-none m-0 p-0 flex-1 min-w-[180px] flex flex-col gap-px bg-[#eef2f7] border border-[#eef2f7] rounded-lg overflow-hidden">
                      {[
                        { label: "Concluíram", value: completed, color: "#18754a" },
                        { label: "Não iniciaram", value: waiting, color: "#cbd5e1" },
                      ].map((seg) => (
                        <li key={seg.label} className="bg-white px-3 py-2.5 flex items-center gap-2.5 text-[13px]">
                          <span aria-hidden="true" className="w-[9px] h-[9px] rounded-sm shrink-0" style={{ background: seg.color }} />
                          <span className="flex-1 text-[#33415c]">{seg.label}</span>
                          <span className="font-semibold text-[#11243c]">{seg.value}</span>
                          <span className="w-[52px] text-right text-[#5b6b7f]">{total ? Math.round((seg.value / total) * 100) : 0}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {rounds.length > 0 && (
                <div className="bg-white border border-[#dde4ee] rounded-lg p-5">
                  <h2 className="m-0 mb-4 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                    <BarChart3 size={14} /> Participação por rodada
                  </h2>
                  <div className="flex flex-col gap-3.5">
                    {rounds.map((round) => {
                      const roundPercent = total ? Math.min(100, Math.round((round.submissionCount / total) * 100)) : 0;
                      return (
                        <div key={round.id} className="grid gap-1.5">
                          <div className="flex justify-between gap-3.5 text-[13px]">
                            <span className="min-w-0 text-[#33415c]">
                              <span className="font-mono text-[#8a97a8] mr-2">{String(round.order).padStart(2, "0")}</span>
                              {round.title}
                            </span>
                            <span className="shrink-0 text-[#5b6b7f]">
                              <strong className="text-[#11243c]">{round.submissionCount}</strong> respostas · {roundPercent}%
                            </span>
                          </div>
                          <div className="h-4 bg-[#f2f5f9] rounded overflow-hidden">
                            <div className="h-full bg-[#477da9] rounded transition-all duration-500" style={{ width: `${roundPercent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              <div className="bg-white border border-[#dde4ee] rounded-lg p-5">
                <h2 className="m-0 mb-3.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                  Atalhos
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/admin/eventos/${eventId}/participantes`} className="flex items-center justify-center h-10 text-[12.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline">
                    Participantes
                  </Link>
                  <Link href={`/admin/eventos/${eventId}/perguntas`} className="flex items-center justify-center h-10 text-[12.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline">
                    Perguntas
                  </Link>
                  <Link href={`/admin/eventos/${eventId}/relatorios`} className="flex items-center justify-center h-10 text-[12.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline">
                    Relatórios
                  </Link>
                  <Link href={`/admin/eventos/${eventId}/configuracoes`} className="flex items-center justify-center h-10 text-[12.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline">
                    Configurações
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {currentRound && (
        <Dialog open={questionListOpen} onOpenChange={setQuestionListOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Todas as perguntas</DialogTitle>
              <DialogDescription>
                {String(currentRound.order).padStart(2, "0")} · {currentRound.title}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto">
              {questions.map((q, idx) => {
                const active = selectedQuestion?.id === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setSelectedQuestionId(q.id);
                      setQuestionListOpen(false);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-left transition-colors ${
                      active ? "bg-[#eef3f9]" : "hover:bg-[#f7f9fc]"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded text-[11px] font-bold flex items-center justify-center shrink-0 ${
                        active ? "bg-[#0b3a6e] text-white" : "bg-[#eef1f5] text-[#5b6b7f]"
                      }`}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[13.5px] leading-snug text-[#33415c]">{q.title}</span>
                    {active && <ChevronRight size={15} className="shrink-0 text-[#0b3a6e]" />}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar rodada?</AlertDialogTitle>
            <AlertDialogDescription>
              Foram recebidas {readiness?.stats.completed ?? completed} respostas
              {readiness?.stats.notStarted ? ` · ${readiness.stats.notStarted} ainda não responderam` : ""}.
              Após o encerramento, novas respostas não serão aceitas nesta rodada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={() => {
                if (!currentRound) return;
                setConfirmClose(false);
                void runAction(`/rounds/${currentRound.id}/close`);
              }}
            >
              Encerrar rodada
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
            <div><strong className="block text-lg text-[#9a6700]">{readiness?.stats.notStarted ?? 0}</strong>ainda não responderam</div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={actionLoading} onClick={() => { setConfirmNextEvent(false); void runAction("/next"); }} className="bg-[#18754a] hover:bg-[#12633e]">Confirmar próximo evento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
