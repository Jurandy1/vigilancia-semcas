"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";
import { BarChart3, Download, FileText, UsersRound } from "lucide-react";

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
    Array<{ id: string; title: string; status: string; submissionCount: number; order?: number }>
  >([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [eventStatus, setEventStatus] = useState<string | undefined>();
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getAdminIdToken();
        if (!token) throw new Error("Sessão administrativa não encontrada.");
        const res = await adminFetch(`/api/admin/events/${eventId}/dashboard`, token);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar o relatório.");
        setEventTitle(data.event?.title ?? "");
        setEventSlug(data.event?.slug ?? "");
        setEventStatus(data.event?.status);
        setParticipantCount(data.event?.participantCount ?? 0);
        setRounds(data.rounds ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar o relatório.");
      } finally {
        setLoading(false);
      }
    }
    const unsub = onAdminAuthChange((user) => {
      if (user) load();
    });
    return unsub;
  }, [eventId]);

  if (loading) {
    return (
      <AdminShell eventId={eventId} screenLabel="Relatório">
        <div className="space-y-4 max-w-[880px]">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AdminShell>
    );
  }

  const totalResponses = rounds.reduce((sum, r) => sum + (r.submissionCount ?? 0), 0);
  const roundsWithResponses = rounds.filter((round) => round.submissionCount > 0).length;
  const averageResponses = rounds.length > 0 ? Math.round(totalResponses / rounds.length) : 0;
  const participationRate =
    participantCount > 0 && rounds.length > 0
      ? Math.min(100, Math.round((totalResponses / (participantCount * rounds.length)) * 100))
      : 0;

  async function exportSummaryExcel() {
    const XLSX = await import("xlsx");
    const rows = [
      ["Relatório consolidado", eventTitle],
      ["Participantes", participantCount],
      ["Total de respostas", totalResponses],
      ["Média de respostas por rodada", averageResponses],
      [],
      ["Ordem", "Rodada", "Status", "Respostas", "Participação"],
      ...rounds.map((round, index) => [
        index + 1,
        round.title,
        statusLabel[round.status] ?? round.status,
        round.submissionCount ?? 0,
        participantCount > 0
          ? `${Math.min(100, Math.round(((round.submissionCount ?? 0) / participantCount) * 100))}%`
          : "0%",
      ]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 12 }, { wch: 48 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Resumo");
    XLSX.writeFile(workbook, `relatorio-consolidado-${eventSlug || eventId}.xlsx`);
  }

  return (
    <AdminShell
      eventId={eventId}
      eventTitle={eventTitle}
      eventSlug={eventSlug}
      eventStatus={eventStatus}
      screenLabel="Relatório"
    >
      <section aria-label="Relatório consolidado" className="w-full max-w-[1080px]">
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex items-start justify-between gap-5 flex-wrap mb-6">
          <div>
            <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-[0.12em] text-[#18754a]">Análise do evento</p>
            <h1 className="admin-page-title m-0">
              Relatório consolidado
            </h1>
            <p className="mt-2 mb-0 text-sm text-[#64748b] max-w-[56ch]">{eventTitle}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportSummaryExcel}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#b9c9d9] bg-white px-4 text-sm font-semibold text-[#0b4a83] hover:bg-[#f5f8fb]"
            >
              <Download className="h-4 w-4" /> Exportar Excel
            </button>
            <Link
              href={`/admin/eventos/${eventId}/relatorios/imprimir`}
              className="inline-flex items-center h-10 px-4 text-sm font-semibold bg-[#0b3a6e] text-white rounded-md hover:bg-[#0d4a8a] no-underline"
            >
              <FileText className="mr-2 h-4 w-4" /> Imprimir / PDF
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <div className="admin-card p-5">
            <UsersRound className="mb-4 h-5 w-5 text-[#0b4a83]" />
            <p className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
              Participantes
            </p>
            <p className="mt-2 mb-0 text-[32px] font-bold text-[#0b3a6e] leading-none">
              {participantCount}
            </p>
          </div>
          <div className="admin-card p-5">
            <BarChart3 className="mb-4 h-5 w-5 text-[#18754a]" />
            <p className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
              Respostas
            </p>
            <p className="mt-2 mb-0 text-[32px] font-bold text-[#0b3a6e] leading-none">
              {totalResponses}
            </p>
          </div>
          <div className="admin-card p-5">
            <p className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
              Rodadas
            </p>
            <p className="mt-2 mb-0 text-[32px] font-bold text-[#0b3a6e] leading-none">
              {rounds.length}
            </p>
          </div>
          <div className="admin-card p-5">
            <p className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">Participação média</p>
            <p className="mt-2 mb-0 text-[32px] font-bold text-[#18754a] leading-none">{participationRate}%</p>
            <p className="mb-0 mt-2 text-xs text-[#718198]">{roundsWithResponses} rodada(s) com respostas</p>
          </div>
        </div>

        <div className="admin-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#eef1f5]">
            <h2 className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
              Por rodada
            </h2>
          </div>
          {rounds.length === 0 ? (
            <p className="text-sm text-[#8a97a8] p-5">Nenhuma rodada criada ainda.</p>
          ) : (
            <div className="divide-y divide-[#eef1f5]">
              {rounds.map((round, i) => (
                <Link
                  key={round.id}
                  href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                  className="flex flex-col gap-3 py-4 px-5 hover:bg-[#f7f9fc] no-underline sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold text-[#1a1a1a]">
                      {String(i + 1).padStart(2, "0")} · {round.title}
                    </p>
                    <p className="mt-1 mb-0 text-[13px] text-[#5b6b7f]">
                      {statusLabel[round.status] ?? round.status} · {round.submissionCount ?? 0}{" "}
                      respostas
                    </p>
                    <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-[#e8eef5]">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#0b4a83,#18754a)]" style={{ width: `${participantCount > 0 ? Math.min(100, Math.round(((round.submissionCount ?? 0) / participantCount) * 100)) : 0}%` }} />
                    </div>
                  </div>
                  <span className="text-[#0b3a6e] text-sm font-semibold">Ver resultados →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 mb-0 text-[12.5px] text-[#8a97a8] leading-relaxed">
          O documento oficial com cabeçalho institucional fica em Imprimir / PDF. Exportações CSV e
          Excel estão disponíveis na tela de Resultados de cada rodada.
        </p>
      </section>
    </AdminShell>
  );
}
