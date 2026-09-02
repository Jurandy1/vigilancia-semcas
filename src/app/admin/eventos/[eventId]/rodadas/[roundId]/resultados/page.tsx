"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";

export default function RoundReportPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const roundId = params.roundId as string;
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [event, setEvent] = useState<{ title: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(true);

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
      answers: Array<{ questionId: string; value: string }>;
    }>;

    const qTitles = questions.map((q) => q.title as string);
    const rows: string[][] = [["Participante", ...qTitles]];
    individual.forEach((ind) => {
      const answers = qTitles.map((_, i) => {
        const qId = (questions[i] as { id: string }).id;
        const ans = ind.answers.find((a) => a.questionId === qId);
        return ans?.value ?? "";
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
      <AdminShell eventId={eventId}>
        <div className="space-y-4">
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
    <AdminShell eventId={eventId} eventTitle={event?.title} eventSlug={event?.slug}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Relatório — {round.title as string}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {summary.totalSubmissions as number} respostas de{" "}
          {summary.totalParticipants as number} participantes ({summary.participationRate as string})
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {questions.map((q, i) => (
          <section key={i} className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-3">
              {i + 1}. {q.title as string}
            </h2>

            {q.type === "single_choice" && (
              <table className="w-full text-sm border border-gray-200">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left p-2">Opção</th>
                    <th className="text-right p-2">Qtd</th>
                    <th className="text-right p-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(q.options as Array<{ option: string; count: number; percent: string }>).map(
                    (opt) => (
                      <tr key={opt.option} className="border-b border-gray-100">
                        <td className="p-2">{opt.option}</td>
                        <td className="p-2 text-right">{opt.count}</td>
                        <td className="p-2 text-right">{opt.percent}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}

            {q.type === "text" && (
              <div className="space-y-3">
                {(q.answers as Array<{ displayName: string; value: string }>).map((a, j) => (
                  <div key={j} className="border-b border-gray-100 pb-3">
                    <p className="text-sm font-medium text-gray-800">{a.displayName}</p>
                    <p className="text-sm text-gray-500 mt-1">&ldquo;{a.value}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <div className="flex gap-2">
          <Button onClick={exportCsv}>Exportar CSV</Button>
          <Button variant="outline" onClick={exportExcel}>
            Exportar Excel
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
