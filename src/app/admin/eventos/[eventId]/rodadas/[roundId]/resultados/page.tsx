"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";
import { HorizontalBarChart } from "@/components/admin/HorizontalBarChart";

export default function RoundReportPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const roundId = params.roundId as string;
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [event, setEvent] = useState<{ title: string; slug: string; status?: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const token = await getAdminIdToken();
      if (!token) return;
      const [reportRes, eventRes] = await Promise.all([
        adminFetch(`/api/admin/events/${eventId}/rounds/${roundId}/report`, token),
        adminFetch(`/api/admin/events/${eventId}`, token),
      ]);
      const reportData = await reportRes.json();
      const eventData = await eventRes.json();
      setReport(reportData);
      setEvent(eventData.event ?? null);
      setLoading(false);
    }
    const unsub = onAdminAuthChange((user) => {
      if (user) load();
    });
    return unsub;
  }, [eventId, roundId]);

  function buildReportRows(report: Record<string, unknown>) {
    const questions = report.questions as Array<Record<string, unknown>>;
    const individual = report.individual as Array<{
      displayName: string;
      answers: Array<{ questionId: string; value: string | string[]; otherText?: string }>;
    }>;

    const qTitles = questions.map((q) => q.title as string);
    const rows: string[][] = [["Participante", ...qTitles]];
    individual.forEach((ind) => {
      const answers = qTitles.map((_, i) => {
        const qId = (questions[i] as { id: string }).id;
        const ans = ind.answers.find((a) => a.questionId === qId);
        if (!ans) return "";
        const value = Array.isArray(ans.value) ? ans.value.join("; ") : ans.value;
        return ans.otherText ? `${value} — ${ans.otherText}` : value;
      });
      rows.push([ind.displayName, ...answers]);
    });
    return rows;
  }

  function exportCsv() {
    if (!report) return;
    const rows = buildReportRows(report);
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${roundId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    if (!report) return;
    const XLSX = await import("xlsx");
    const rows = buildReportRows(report);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Respostas");
    XLSX.writeFile(wb, `relatorio-${roundId}.xlsx`);
  }

  if (loading || !report) {
    return (
      <AdminShell eventId={eventId} screenLabel="Resultados">
        <div className="space-y-4 max-w-[840px]">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AdminShell>
    );
  }

  const summary = report.summary as Record<string, unknown>;
  const questions = report.questions as Array<Record<string, unknown>>;
  const round = report.round as Record<string, unknown>;

  return (
    <AdminShell
      eventId={eventId}
      eventTitle={event?.title}
      eventSlug={event?.slug}
      eventStatus={event?.status}
      screenLabel="Resultados"
    >
      <section aria-label="Resultados" className="max-w-[840px]">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em] text-[#1a1a1a]">Resultados</h1>
        <p className="mt-2 mb-0 text-sm text-[#5b6b7f]">
          Rodada: {round.title as string} — {summary.totalSubmissions as number} de{" "}
          {summary.totalParticipants as number} responderam · {summary.participationRate as string}{" "}
          de participação
        </p>
        <p className="mt-2 mb-0 text-[12.5px] text-[#8a97a8]">
          Visão analítica para consulta em tela. Para o documento oficial, use o{" "}
          <Link href={`/admin/eventos/${eventId}/relatorios`} className="text-[#0b3a6e] hover:underline">
            Relatório
          </Link>
          .
        </p>

        <div className="flex flex-col gap-5 mt-6">
          {questions.map((q, i) => {
            const id = q.id as string;
            const options =
              (q.options as Array<{ option: string; count: number; percent: string }> | undefined) ??
              [];
            const answers =
              (q.answers as Array<{ displayName: string; value: string }> | undefined) ?? [];
            const otherAnswers =
              (q.otherAnswers as Array<{ displayName: string; value: string }> | undefined) ?? [];
            const open = expanded[id];

            return (
              <div key={id} className="bg-white border border-[#dde4ee] rounded-lg p-5">
                <h2 className="m-0 mb-4 text-[15px] font-semibold leading-snug text-pretty text-[#1a1a1a]">
                  {i + 1}. {q.title as string}
                </h2>

                {(q.type === "single_choice" || q.type === "multi_choice") && (
                  <>
                    <HorizontalBarChart
                      items={options.map((o) => ({
                        label: o.option,
                        count: o.count,
                        percent: o.percent.includes("%") ? o.percent : `${o.percent}%`,
                      }))}
                    />
                    {otherAnswers.length > 0 && (
                      <div className="mt-4 rounded-lg border border-[#cfe0ef] bg-[#f7fbfe] p-4">
                        <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.07em] text-[#0b4a83]">
                          Respostas informadas em “Outro”
                        </p>
                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {otherAnswers.map((answer, index) => (
                            <div key={index} className="rounded-md border border-[#dde7f0] bg-white px-3 py-2.5">
                              <p className="m-0 text-[11.5px] text-[#8a97a8]">{answer.displayName}</p>
                              <p className="mb-0 mt-1 text-sm text-[#33415c]">{answer.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 mt-4 pt-3.5 border-t border-[#eef1f5]">
                      <span className="text-[12.5px] text-[#8a97a8]">
                        {(summary.totalSubmissions as number) ?? 0} respostas ·{" "}
                        {q.type === "multi_choice" ? "múltipla escolha" : "resposta única"}
                      </span>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded((s) => ({ ...s, [id]: !open }))}
                        className="h-[34px] px-3 text-[13px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e]"
                      >
                        {open ? "Ocultar dados" : "Ver dados"}
                      </button>
                    </div>
                    {open && (
                      <table className="w-full border-collapse text-[13px] mt-3.5 border border-[#dde4ee]">
                        <thead>
                          <tr className="bg-[#f7f9fc]">
                            <th className="text-left px-2.5 py-2 font-semibold text-[#5b6b7f] border-b border-[#dde4ee]">
                              Opção
                            </th>
                            <th className="text-right px-2.5 py-2 font-semibold text-[#5b6b7f] border-b border-[#dde4ee]">
                              Qtd
                            </th>
                            <th className="text-right px-2.5 py-2 font-semibold text-[#5b6b7f] border-b border-[#dde4ee]">
                              %
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {options.map((opt) => (
                            <tr key={opt.option}>
                              <td className="px-2.5 py-2 border-b border-[#f2f5f8]">{opt.option}</td>
                              <td className="px-2.5 py-2 text-right border-b border-[#f2f5f8] tabular-nums">
                                {opt.count}
                              </td>
                              <td className="px-2.5 py-2 text-right border-b border-[#f2f5f8] tabular-nums">
                                {opt.percent}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {q.type === "text" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {answers.length === 0 ? (
                      <p className="text-sm text-[#8a97a8]">Nenhuma resposta aberta.</p>
                    ) : (
                      answers.map((a, j) => (
                        <div
                          key={j}
                          className="border border-[#dde4ee] border-l-[3px] border-l-[#0b3a6e] rounded-md px-3.5 py-3 bg-[#fbfcfd]"
                        >
                          <p className="m-0 text-[11.5px] text-[#8a97a8]">{a.displayName}</p>
                          <p className="mt-1 mb-0 text-sm text-[#33415c] leading-relaxed">
                            {a.value || "—"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-6 flex-wrap">
          <button
            type="button"
            onClick={exportCsv}
            className="h-10 px-4 text-sm font-semibold bg-[#0b3a6e] text-white rounded-md hover:bg-[#0d4a8a]"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="h-10 px-4 text-sm font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9]"
          >
            Exportar Excel
          </button>
          <Link
            href={`/admin/eventos/${eventId}/relatorios/imprimir`}
            className="inline-flex items-center h-10 px-4 text-sm font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] no-underline"
          >
            Documento oficial / PDF
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
