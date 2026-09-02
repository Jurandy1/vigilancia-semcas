"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Monitor,
  FileText,
  FileSpreadsheet,
  FileDown,
  Eye,
  CheckCircle2,
} from "lucide-react";
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
import { StatCard } from "@/components/admin/StatCard";
import { DonutChart } from "@/components/admin/DonutChart";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";
import { LineChart } from "@/components/admin/LineChart";
import { formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";

interface Participant {
  id: string;
  displayName: string;
  status: string;
  currentQuestion: number;
  questionCount: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface DashboardViewProps {
  eventId: string;
  event: {
    title: string;
    slug: string;
    openedAt: string | null;
    participantCount: number;
  };
  participants: Participant[];
  stats: { registered: number; answering: number; completed: number };
  questionSummaries: Array<{
    id: string;
    title: string;
    type: string;
    options?: Array<{ option: string; count: number; percent: string }>;
  }>;
  recentCompletions: Array<{ displayName: string; completedAt: string | null }>;
  timeline: Array<{ time: string; count: number }>;
  rounds: Array<{ id: string; title: string }>;
  currentRound: { id: string; title: string } | null;
  onCloseRound: () => void;
  actionLoading: boolean;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora há pouco";
  if (mins < 60) return `há ${mins} minuto${mins > 1 ? "s" : ""}`;
  return `há ${Math.floor(mins / 60)}h`;
}

const statusLabel: Record<string, string> = {
  completed: "Concluído",
  answering: "Em andamento",
  waiting: "Não iniciou",
};

const statusStyle: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  answering: "bg-orange-100 text-orange-700",
  waiting: "bg-gray-100 text-gray-600",
};

export function EventDashboardView({
  eventId,
  event,
  participants,
  stats,
  questionSummaries,
  recentCompletions,
  timeline,
  rounds,
  currentRound,
  onCloseRound,
  actionLoading,
}: DashboardViewProps) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const total = event.participantCount || stats.registered || participants.length;
  const completed = stats.completed;
  const answering = stats.answering;
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const notStarted = Math.max(0, total - completed - answering);

  const openedTime = event.openedAt
    ? new Date(event.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  async function exportEventExcel() {
    if (rounds.length === 0 || exportingExcel) return;
    setExportingExcel(true);
    try {
      const token = await getAdminIdToken();
      if (!token) return;

      const [XLSX, ...reports] = await Promise.all([
        import("xlsx"),
        ...rounds.map(async (round) => {
          const res = await adminFetch(
            `/api/admin/events/${eventId}/rounds/${round.id}/report`,
            token
          );
          return res.json() as Promise<{
            questions: Array<{ id: string; title: string }>;
            individual: Array<{
              displayName: string;
              answers: Array<{ questionId: string; value: string }>;
            }>;
          }>;
        }),
      ]);

      const wb = XLSX.utils.book_new();
      rounds.forEach((round, idx) => {
        const report = reports[idx];
        const qTitles = report.questions.map((q) => q.title);
        const rows: string[][] = [["Participante", ...qTitles]];
        report.individual.forEach((ind) => {
          const answers = report.questions.map((q) => {
            const ans = ind.answers.find((a) => a.questionId === q.id);
            return ans?.value ?? "";
          });
          rows.push([ind.displayName, ...answers]);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const sheetName = `${idx + 1} - ${round.title}`.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, `relatorio-evento-${eventId}.xlsx`);
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <AdminShell eventId={eventId} eventSlug={event.slug} eventTitle={event.title}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                Evento em andamento
              </span>
              <span className="text-gray-500">
                {new Date().toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">Iniciado às {openedTime}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizado agora há pouco
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Participantes conectados"
          value={total}
          subtitle="Total que acessou o link"
          variant="blue"
          icon="users"
        />
        <StatCard
          label="Concluíram a avaliação"
          value={completed}
          subtitle={`${formatPercent(completed, total)} do total`}
          variant="green"
          icon="check"
        />
        <StatCard
          label="Em andamento"
          value={answering}
          subtitle="Ainda não finalizaram"
          variant="orange"
          icon="clock"
        />
        <StatCard
          label="Taxa de conclusão"
          value={`${percent.toFixed(0)}%`}
          subtitle="Percentual geral"
          variant="purple"
          icon="trend"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Real-time tracking */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Acompanhamento em tempo real</h2>
          <DashboardErrorBoundary label="o acompanhamento em tempo real">
            <DonutChart
              segments={[
                { value: completed, color: "#1b6b4a", label: "Concluídos" },
                { value: answering, color: "#f59e0b", label: "Em andamento" },
              ]}
              centerValue={`${percent.toFixed(0)}%`}
              centerLabel="concluído"
            />

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-600 mb-2">Participações ao longo do tempo</p>
              <LineChart
                points={timeline.map((t) => ({
                  label: formatTime(t.time),
                  value: t.count,
                }))}
                maxValue={total}
              />
            </div>
          </DashboardErrorBoundary>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
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
          </div>
        </div>

        {/* Participant status */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Status dos participantes</h2>
          <DashboardErrorBoundary label="o status dos participantes">
            <DonutChart
              segments={[
                { value: completed, color: "#1b6b4a", label: "Concluídos" },
                { value: answering, color: "#f59e0b", label: "Em andamento" },
                { value: notStarted, color: "#ef4444", label: "Não iniciaram" },
              ]}
              centerValue={total}
              centerLabel="total"
            />
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Últimas finalizações</p>
              <div className="space-y-2">
                {recentCompletions.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma finalização ainda.</p>
                ) : (
                  recentCompletions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-gray-700 font-medium truncate">{c.displayName}</span>
                      <span className="text-gray-400 ml-auto shrink-0">
                        {timeAgo(c.completedAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DashboardErrorBoundary>
        </div>

        {/* Question summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Resumo por perguntas</h2>
          <DashboardErrorBoundary label="o resumo por perguntas">
            {questionSummaries.length === 0 ? (
              <p className="text-xs text-gray-400">Abra uma rodada para ver os resultados.</p>
            ) : (
              <div className="space-y-5">
                {questionSummaries.map((q, i) => (
                  <div key={q.id}>
                    <p className="text-xs font-medium text-gray-700 mb-2 line-clamp-2">
                      {i + 1}. {q.title}
                    </p>
                    {q.options && (
                      <HorizontalBarChart
                        items={q.options.map((o) => ({
                          label: o.option,
                          count: o.count,
                          percent: o.percent,
                        }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </DashboardErrorBoundary>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Participants table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Participantes recentes</h2>
          <DashboardErrorBoundary label="os participantes recentes">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Início</th>
                    <th className="pb-2 font-medium">Conclusão</th>
                    <th className="pb-2 font-medium">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.slice(0, 8).map((p) => {
                    const progress =
                      p.status === "completed"
                        ? 100
                        : p.questionCount > 0
                          ? Math.round((p.currentQuestion / p.questionCount) * 100)
                          : 0;
                    return (
                      <tr key={p.id} className="border-b border-gray-50">
                        <td className="py-2.5 font-medium text-gray-800">{p.displayName}</td>
                        <td className="py-2.5">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              statusStyle[p.status] ?? statusStyle.waiting
                            )}
                          >
                            {statusLabel[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-500 text-xs">{formatTime(p.startedAt)}</td>
                        <td className="py-2.5 text-gray-500 text-xs">{formatTime(p.completedAt)}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                              <div
                                className="h-full bg-[#0b3a6e] rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{progress}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashboardErrorBoundary>
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Ações rápidas</h2>
          <div className="space-y-2">
            <Link
              href={`/admin/eventos/${eventId}/relatorios`}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md border border-gray-100"
            >
              <Eye className="w-4 h-4 text-gray-400" />
              Visualizar todas as respostas
            </Link>
            <Link
              href={`/admin/eventos/${eventId}/relatorios`}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md border border-gray-100"
            >
              <FileText className="w-4 h-4 text-gray-400" />
              Gerar relatório consolidado
            </Link>
            <button
              onClick={exportEventExcel}
              disabled={exportingExcel || rounds.length === 0}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md border border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4 text-gray-400" />
              {exportingExcel ? "Gerando..." : "Exportar para Excel"}
            </button>
            <Link
              href={`/admin/eventos/${eventId}/relatorios/imprimir`}
              target="_blank"
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md border border-gray-100"
            >
              <FileDown className="w-4 h-4 text-gray-400" />
              Exportar para PDF
            </Link>
            {currentRound && (
              <Button
                variant="destructive"
                className="w-full mt-2"
                onClick={() => setConfirmClose(true)}
                disabled={actionLoading}
              >
                Encerrar avaliação
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar rodada?</AlertDialogTitle>
            <AlertDialogDescription>
              Após o encerramento, novas respostas não serão aceitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                onCloseRound();
              }}
              disabled={actionLoading}
            >
              Encerrar rodada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
