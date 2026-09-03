"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventQrDialog } from "@/components/admin/EventQrDialog";
import { resolveDashboardState, type DashboardRound } from "@/lib/admin/dashboard-state";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Layers3,
  ListChecks,
  MonitorUp,
  QrCode,
  UsersRound,
} from "lucide-react";

interface DashboardViewProps {
  eventId: string;
  event: {
    title: string;
    slug: string;
    status: string;
    openedAt: string | null;
    participantCount: number;
    sequenceId?: string | null;
    sequenceOrder?: number | null;
    sequenceSize?: number | null;
    sequenceRootSlug?: string | null;
    nextEventTitle?: string | null;
  };
  stats: { registered: number; answering: number; completed: number };
  rounds: DashboardRound[];
  onOpenEvent: () => void;
  actionLoading: boolean;
}

const eventStatusLabel: Record<string, { label: string; className: string }> = {
  open: { label: "Em andamento", className: "text-[#1a7f4b]" },
  waiting: { label: "Aguardando início", className: "text-[#5b6b7f]" },
  draft: { label: "Rascunho", className: "text-[#5b6b7f]" },
  closed: { label: "Encerrado", className: "text-[#5b6b7f]" },
};

export function EventDashboardView({
  eventId,
  event,
  stats,
  rounds,
  onOpenEvent,
  actionLoading,
}: DashboardViewProps) {
  const dashboardState = resolveDashboardState(event.status, rounds);
  const { currentRound } = dashboardState;
  const statusInfo = eventStatusLabel[event.status] ?? eventStatusLabel.draft!;
  const total = event.participantCount;
  const completed = stats.completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const openedTime = event.openedAt
    ? new Date(event.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const openCount = rounds.filter((r) => r.status === "open").length;
  const closedCount = rounds.filter((r) => r.status === "closed").length;
  const draftCount = rounds.filter((r) => r.status === "draft" || r.status === "waiting").length;

  const roundLabel = currentRound
    ? `${String(currentRound.order).padStart(2, "0")} · ${currentRound.title}`
    : dashboardState.case === "event_waiting"
      ? "Evento ainda não iniciado"
      : dashboardState.case === "no_rounds_yet"
        ? "Nenhuma rodada criada"
        : "Nenhuma rodada em andamento";

  return (
    <AdminShell
      eventId={eventId}
      eventSlug={event.slug}
      eventTitle={event.title}
      eventStatus={event.status}
      screenLabel="Visão geral"
    >
      <section aria-label="Visão geral do evento" className="w-full max-w-[1180px]">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-[0.12em] text-[#18754a]">
              Visão geral
            </p>
            <h1 className="admin-page-title m-0 max-w-[34ch] text-pretty">
              {event.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-[#64748b]">
              <span className={`inline-flex items-center gap-2 rounded-full border border-[#dbe4ef] bg-white px-3 py-1 font-semibold shadow-sm ${statusInfo.className}`}>
                <span
                  className={`w-2 h-2 rounded-full ${
                    event.status === "open" ? "bg-[#1a7f4b]" : "bg-[#8a97a8]"
                  }`}
                />
                {statusInfo.label}
              </span>
              {openedTime && <span>Iniciado às {openedTime}</span>}
              {event.sequenceId && event.sequenceOrder !== null && event.sequenceOrder !== undefined && (
                <span>Evento {event.sequenceOrder + 1} de {event.sequenceSize}</span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild variant="outline" className="h-11 w-full gap-2 rounded-xl border-[#b9c9d9] bg-white px-5 text-sm font-semibold text-[#0b4a83] sm:w-auto">
              <Link href={`/admin/eventos/${eventId}/perguntas`}>
                <ListChecks className="h-4 w-4" /> Editar perguntas
              </Link>
            </Button>
            <Button asChild className="h-11 w-full shrink-0 gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm sm:w-auto">
              <Link href={`/admin/eventos/${eventId}/ao-vivo`}>
                Abrir sessão ao vivo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {dashboardState.case === "event_waiting" && (
          <div className="admin-card mb-5 flex flex-col items-start justify-between gap-4 border-l-4 border-l-[#d29a20] p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-[#5b6b7f] mb-4">Este evento ainda não foi iniciado.</p>
            <Button onClick={onOpenEvent} disabled={actionLoading}>
              Iniciar evento
            </Button>
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Participantes", value: stats.registered || total, icon: UsersRound, tone: "text-[#0b4a83] bg-[#e9f2fb]" },
            { label: "Respondendo agora", value: stats.answering, icon: Activity, tone: "text-[#9a6700] bg-[#fff6dc]" },
            { label: "Respostas concluídas", value: completed, icon: CheckCircle2, tone: "text-[#18754a] bg-[#e9f7ef]" },
            { label: "Rodadas criadas", value: rounds.length, icon: Layers3, tone: "text-[#6c4bb4] bg-[#f2edff]" },
          ].map((item) => (
            <div key={item.label} className="admin-card flex items-center gap-4 p-4 sm:block sm:p-5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                <item.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 sm:mt-4">
                <p className="m-0 text-2xl font-bold leading-none tracking-[-0.02em] text-[#11243c]">{item.value}</p>
                <p className="mb-0 mt-1.5 text-[13px] text-[#64748b]">{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
          <div className="admin-card p-5 sm:p-6">
            <h2 className="m-0 mb-3.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
              Situação atual
            </h2>
            <p className="m-0 text-[12.5px] text-[#5b6b7f]">Rodada atual</p>
            <p className="mt-1 mb-0 text-xl font-semibold leading-snug text-[#11243c]">{roundLabel}</p>
            <p className="mt-3.5 mb-2 text-sm text-[#33415c]">
              <strong className="text-base">{completed}</strong> de {total} respostas ·{" "}
              <strong className="font-semibold">{percent}%</strong>
            </p>
            <div
              role="img"
              aria-label={`${percent}% das respostas recebidas`}
              className="h-2.5 bg-[#edf2f7] rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-[linear-gradient(90deg,#0b4a83,#18754a)] rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-[18px] pt-4 border-t border-[#eef1f5] flex items-center justify-between gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#5b6b7f]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#1a7f4b] animate-pulse" />
                Atualização em tempo real
              </span>
              <Link
                href={`/admin/eventos/${eventId}/ao-vivo`}
                className="inline-flex items-center h-9 px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] bg-white border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e]"
              >
                Acompanhar ao vivo
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-5 min-w-0">
            <div className="admin-card p-5">
              <h2 className="m-0 mb-3 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                Participação
              </h2>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[32px] font-bold text-[#0b3a6e] leading-none">{total}</span>
                <span className="text-[13.5px] text-[#5b6b7f]">participantes no evento</span>
              </div>
              <p className="mt-3 mb-0 text-[12.5px] text-[#8a97a8] leading-relaxed">
                O modo de participação (identificado ou anônimo) é definido nas configurações do
                evento.
              </p>
            </div>

            <div className="admin-card p-5">
              <h2 className="m-0 mb-3 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
                Perguntas e rodadas
              </h2>
              <div className="flex flex-col gap-2 text-[13.5px] text-[#33415c]">
                <div className="flex justify-between">
                  <span>Em andamento</span>
                  <strong className="font-semibold">{openCount}</strong>
                </div>
                <div className="flex justify-between text-[#5b6b7f]">
                  <span>Concluídas</span>
                  <strong className="font-semibold">{closedCount}</strong>
                </div>
                <div className="flex justify-between text-[#5b6b7f]">
                  <span>Rascunhos</span>
                  <strong className="font-semibold">{draftCount}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card mt-5 p-5 sm:p-6">
          <h2 className="m-0 mb-3.5 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
            Acesso rápido
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <EventQrDialog
              eventSlug={event.sequenceRootSlug ?? event.slug}
              eventTitle={event.title}
              trigger={
                <button
                  type="button"
                  className="flex min-h-[62px] w-full items-center gap-3 rounded-xl border border-[#dbe4ef] bg-[#f8fafc] px-4 text-left text-sm font-semibold text-[#0b4a83] transition hover:-translate-y-0.5 hover:border-[#9cb8d4] hover:bg-white hover:shadow-sm"
                >
                  <QrCode className="h-5 w-5 shrink-0" /> QR e código de acesso
                </button>
              }
            />
            <Link
              href={`/admin/eventos/${eventId}/perguntas`}
              className="flex min-h-[62px] items-center gap-3 rounded-xl border border-[#dbe4ef] bg-[#f8fafc] px-4 text-sm font-semibold text-[#0b4a83] no-underline transition hover:-translate-y-0.5 hover:border-[#9cb8d4] hover:bg-white hover:shadow-sm"
            >
              <ListChecks className="h-5 w-5 shrink-0" /> Editar perguntas
            </Link>
            <Link
              href={`/projector/${event.slug}`}
              target="_blank"
              className="flex min-h-[62px] items-center gap-3 rounded-xl border border-[#dbe4ef] bg-[#f8fafc] px-4 text-sm font-semibold text-[#0b4a83] no-underline transition hover:-translate-y-0.5 hover:border-[#9cb8d4] hover:bg-white hover:shadow-sm"
            >
              <MonitorUp className="h-5 w-5 shrink-0" /> Tela do projetor
            </Link>
            {currentRound && (
              <Link
                href={`/admin/eventos/${eventId}/rodadas/${currentRound.id}/resultados`}
                className="flex min-h-[62px] items-center gap-3 rounded-xl border border-[#dbe4ef] bg-[#f8fafc] px-4 text-sm font-semibold text-[#0b4a83] no-underline transition hover:-translate-y-0.5 hover:border-[#9cb8d4] hover:bg-white hover:shadow-sm"
              >
                <BarChart3 className="h-5 w-5 shrink-0" /> Resultados da rodada
              </Link>
            )}
            <Link
              href={`/admin/eventos/${eventId}/relatorios`}
              className="flex min-h-[62px] items-center gap-3 rounded-xl border border-[#dbe4ef] bg-[#f8fafc] px-4 text-sm font-semibold text-[#0b4a83] no-underline transition hover:-translate-y-0.5 hover:border-[#9cb8d4] hover:bg-white hover:shadow-sm"
            >
              <BarChart3 className="h-5 w-5 shrink-0" /> Relatório consolidado
            </Link>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
