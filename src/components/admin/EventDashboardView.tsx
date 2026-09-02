"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, CheckCircle2, RefreshCw, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardErrorBoundary } from "@/components/admin/DashboardErrorBoundary";
import { LineChart } from "@/components/admin/LineChart";
import { resolveDashboardState, type DashboardRound } from "@/lib/admin/dashboard-state";

interface DashboardViewProps {
  eventId: string;
  event: {
    title: string;
    slug: string;
    status: string;
    openedAt: string | null;
    participantCount: number;
  };
  stats: { registered: number; answering: number; completed: number };
  timeline: Array<{ time: string; count: number }>;
  rounds: DashboardRound[];
  onOpenEvent: () => void;
  onCloseRound: () => void;
  onOpenNextRound: () => void;
  onFinalizeEvent: () => void;
  actionLoading: boolean;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const eventStatusLabel: Record<string, { label: string; className: string }> = {
  open: { label: "Em andamento", className: "bg-green-100 text-green-700" },
  waiting: { label: "Aguardando início", className: "bg-gray-100 text-gray-600" },
  draft: { label: "Rascunho", className: "bg-gray-100 text-gray-600" },
  closed: { label: "Encerrado", className: "bg-gray-100 text-gray-500" },
};

type PendingAction = "close_round" | "next_round" | "finalize_event" | null;

export function EventDashboardView({
  eventId,
  event,
  stats,
  timeline,
  rounds,
  onOpenEvent,
  onCloseRound,
  onOpenNextRound,
  onFinalizeEvent,
  actionLoading,
}: DashboardViewProps) {
  const [pending, setPending] = useState<PendingAction>(null);

  const dashboardState = resolveDashboardState(event.status, rounds);
  const { currentRound, nextRound, lastClosedRound } = dashboardState;

  const total = event.participantCount;
  const completed = stats.completed;
  const answering = Math.max(0, stats.answering);

  const openedTime = event.openedAt
    ? new Date(event.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const statusInfo = eventStatusLabel[event.status] ?? eventStatusLabel.draft;

  function confirm() {
    if (pending === "close_round") onCloseRound();
    if (pending === "next_round") onOpenNextRound();
    if (pending === "finalize_event") onFinalizeEvent();
    setPending(null);
  }

  return (
    <AdminShell eventId={eventId} eventSlug={event.slug} eventTitle={event.title}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
          {event.openedAt && <span className="text-gray-500">Iniciado às {openedTime}</span>}
        </div>
      </div>

      {dashboardState.case !== "event_waiting" && dashboardState.case !== "event_closed" && (
        <>
          {/* 3 big numbers */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-2">
                <Users className="w-3.5 h-3.5" />
                Participantes
              </div>
              <p className="text-4xl font-bold text-[#0b3a6e]">{total}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Responderam
              </div>
              <p className="text-4xl font-bold text-green-600">{completed}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Respondendo
              </div>
              <p className="text-4xl font-bold text-orange-500">{answering}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">
              Respostas recebidas ao longo do tempo
            </h2>
            <DashboardErrorBoundary label="o gráfico de respostas">
              <LineChart
                points={timeline.map((t) => ({ label: formatTime(t.time), value: t.count }))}
                maxValue={total}
              />
            </DashboardErrorBoundary>
          </div>
        </>
      )}

      {/* Round / action block */}
      <DashboardErrorBoundary label="o estado da rodada">
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          {dashboardState.case === "event_waiting" && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-4">Este evento ainda não foi iniciado.</p>
              <Button onClick={onOpenEvent} disabled={actionLoading}>
                Iniciar evento
              </Button>
            </div>
          )}

          {dashboardState.case === "event_closed" && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">Este evento foi encerrado.</p>
              <Link
                href={`/admin/eventos/${eventId}/relatorios`}
                className="text-sm text-[#0b3a6e] hover:underline mt-2 inline-block"
              >
                Ver relatório
              </Link>
            </div>
          )}

          {dashboardState.case === "no_rounds_yet" && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-4">Nenhuma rodada criada ainda.</p>
              <Button asChild>
                <Link href={`/admin/eventos/${eventId}/rodadas/nova`}>Criar primeira rodada</Link>
              </Button>
            </div>
          )}

          {dashboardState.case === "round_open" && currentRound && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Rodada atual</h2>
              <p className="text-base font-medium text-gray-900 mb-1">{currentRound.title}</p>
              <p className="text-xs text-gray-500 mb-4">
                {currentRound.submissionCount} de {total} responderam
              </p>
              <Button
                variant="destructive"
                onClick={() => setPending("close_round")}
                disabled={actionLoading}
              >
                Encerrar rodada
              </Button>
            </div>
          )}

          {dashboardState.case === "has_next_round" && nextRound && (
            <div>
              {lastClosedRound && (
                <>
                  <h2 className="text-sm font-semibold text-gray-800 mb-1">Última rodada</h2>
                  <p className="text-base font-medium text-gray-900">{lastClosedRound.title}</p>
                  <p className="text-xs text-gray-500 mb-4">
                    ✓ Encerrada · {lastClosedRound.submissionCount} respostas
                  </p>
                </>
              )}
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Próxima rodada</h2>
              <p className="text-base font-medium text-gray-900 mb-4">{nextRound.title}</p>
              <div className="flex flex-wrap gap-2">
                {lastClosedRound && (
                  <Button asChild variant="outline">
                    <Link href={`/admin/eventos/${eventId}/rodadas/${lastClosedRound.id}/resultados`}>
                      Ver relatório
                    </Link>
                  </Button>
                )}
                <Button onClick={() => setPending("next_round")} disabled={actionLoading}>
                  Iniciar próxima rodada
                </Button>
              </div>
            </div>
          )}

          {dashboardState.case === "no_next_round" && (
            <div>
              {lastClosedRound && (
                <>
                  <h2 className="text-sm font-semibold text-gray-800 mb-1">Última rodada</h2>
                  <p className="text-base font-medium text-gray-900">{lastClosedRound.title}</p>
                  <p className="text-xs text-gray-500 mb-4">
                    ✓ Encerrada · {lastClosedRound.submissionCount} respostas
                  </p>
                </>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {lastClosedRound && (
                  <Button asChild variant="outline">
                    <Link href={`/admin/eventos/${eventId}/rodadas/${lastClosedRound.id}/resultados`}>
                      Ver relatório
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link href={`/admin/eventos/${eventId}/rodadas/nova`}>+ Criar rodada</Link>
                </Button>
                <button
                  onClick={() => setPending("finalize_event")}
                  disabled={actionLoading}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 hover:underline"
                >
                  Finalizar evento
                </button>
              </div>
            </div>
          )}
        </div>
      </DashboardErrorBoundary>

      {/* Projector shortcut */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
        <Monitor className="w-8 h-8 text-[#0b3a6e]" />
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-700">Tela do projetor</p>
          <p className="text-[10px] text-gray-400">Exibir no telão do evento</p>
        </div>
        <Link
          href={`/projector/${event.slug}`}
          target="_blank"
          className="text-xs bg-[#0b3a6e] text-white px-3 py-1.5 rounded-md hover:bg-[#0b3a6e]/90"
        >
          Abrir
        </Link>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "close_round" && "Encerrar rodada?"}
              {pending === "next_round" && "Iniciar próxima rodada?"}
              {pending === "finalize_event" && "Finalizar evento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "close_round" &&
                "Após o encerramento, novas respostas não serão aceitas."}
              {pending === "next_round" &&
                nextRound &&
                `Próxima rodada: "${nextRound.title}". ${total} participantes do evento estarão aptos a responder.`}
              {pending === "finalize_event" &&
                "Todas as rodadas deste evento serão consideradas encerradas. Novas respostas não serão aceitas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm}
              disabled={actionLoading}
              className={pending === "finalize_event" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {pending === "close_round" && "Encerrar rodada"}
              {pending === "next_round" && "Iniciar"}
              {pending === "finalize_event" && "Finalizar evento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
