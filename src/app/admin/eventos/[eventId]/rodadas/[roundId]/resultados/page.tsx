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
  const [answerLimits, setAnswerLimits] = useState<Record<string, number>>({});

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
      <section data-screen-label="Resultados da rodada" style={{ width: "100%", maxWidth: "1080px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "18px", borderBottom: "1px solid #dbe4ef", marginBottom: "20px" }}>
          <div style={{ minWidth: "300px", flex: 1 }}>
            <p style={{ margin: "0 0 8px", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#18754A" }}>Resultados da rodada</p>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-.02em", color: "#11243c" }}>{round.title as string}</h1>
            <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: 1.45, color: "#5b6b7f", maxWidth: "46ch" }}>
              {(summary.totalSubmissions as number) ?? 0} de {(summary.totalParticipants as number) ?? 0} responderam · {summary.participationRate as string} de participação
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={exportCsv}
              style={{ height: "38px", padding: "0 15px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={exportExcel}
              style={{ height: "38px", padding: "0 15px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              Exportar Excel
            </button>
            <Link
              href={`/admin/eventos/${eventId}/relatorios/imprimir`}
              style={{ height: "38px", padding: "0 16px", border: "1px solid #0B3A6E", background: "#0B3A6E", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              Documento oficial
            </Link>
          </div>
        </div>

        <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", padding: "20px" }}>
          {questions.map((q, i) => {
            const id = q.id as string;
            const options = (q.options as Array<{ option: string; count: number; percent: string }> | undefined) ?? [];
            const answers = (q.answers as Array<{ displayName: string; value: string }> | undefined) ?? [];
            const otherAnswers = (q.otherAnswers as Array<{ displayName: string; value: string }> | undefined) ?? [];
            const open = expanded[id];
            const answerLimit = answerLimits[id] ?? 20;

            return (
              <div key={id} style={{ padding: "18px 0", borderBottom: i < questions.length - 1 ? "1px solid #f2f5f8" : "none" }}>
                <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#8a97a8" }}>
                  Pergunta {i + 1} · {q.type === "multi_choice" ? "Múltipla Escolha" : q.type === "single_choice" ? "Escolha Única" : "Resposta Aberta"}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "15.5px", fontWeight: 600, lineHeight: 1.4, color: "#11243c", maxWidth: "64ch", textWrap: "pretty" }}>
                  {q.title as string}
                </p>

                {(q.type === "single_choice" || q.type === "multi_choice") && (
                  <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <HorizontalBarChart
                      items={options.map((o) => ({
                        label: o.option,
                        count: o.count,
                        percent: o.percent.includes("%") ? o.percent : `${o.percent}%`,
                      }))}
                    />
                    
                    {otherAnswers.length > 0 && (
                      <div style={{ marginTop: "16px", borderRadius: "8px", border: "1px solid #cfe0ef", background: "#f7fbfe", padding: "16px" }}>
                        <p style={{ margin: 0, fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#0b4a83" }}>
                          Respostas informadas em “Outro”
                        </p>
                        <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px" }}>
                          {otherAnswers.slice(0, answerLimit).map((answer, index) => (
                            <div key={index} style={{ borderRadius: "6px", border: "1px solid #dde7f0", background: "#fff", padding: "10px 12px" }}>
                              <p style={{ margin: 0, fontSize: "11.5px", color: "#8a97a8" }}>{answer.displayName}</p>
                              <p style={{ margin: "4px 0 0", maxHeight: "128px", overflowY: "auto", wordBreak: "break-word", fontSize: "14px", color: "#33415c" }}>{answer.value}</p>
                            </div>
                          ))}
                        </div>
                        {otherAnswers.length > answerLimit && (
                          <button type="button" onClick={() => setAnswerLimits((state) => ({ ...state, [id]: answerLimit + 20 }))} style={{ marginTop: "12px", height: "36px", borderRadius: "8px", border: "1px solid #b9c9d9", background: "transparent", padding: "0 12px", fontSize: "12px", fontWeight: 600, color: "#0b3a6e", cursor: "pointer" }}>Carregar mais respostas</button>
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #eef1f5" }}>
                      <span style={{ fontSize: "12.5px", color: "#8a97a8" }}>
                        {(summary.totalSubmissions as number) ?? 0} respostas
                      </span>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded((s) => ({ ...s, [id]: !open }))}
                        style={{ height: "34px", padding: "0 12px", fontSize: "13px", fontWeight: 600, color: "#0b3a6e", background: "transparent", border: "1px solid #c9d4e2", borderRadius: "6px", cursor: "pointer" }}
                      >
                        {open ? "Ocultar dados" : "Ver dados em tabela"}
                      </button>
                    </div>

                    {open && (
                      <div style={{ marginTop: "14px", overflowX: "auto" }}>
                        <table style={{ width: "100%", minWidth: "480px", borderCollapse: "collapse", border: "1px solid #dde4ee", fontSize: "13px" }}>
                          <thead>
                            <tr style={{ background: "#f7f9fc" }}>
                              <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#5b6b7f", borderBottom: "1px solid #dde4ee" }}>Opção</th>
                              <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#5b6b7f", borderBottom: "1px solid #dde4ee" }}>Qtd</th>
                              <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#5b6b7f", borderBottom: "1px solid #dde4ee" }}>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {options.map((opt) => (
                              <tr key={opt.option}>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f2f5f8" }}>{opt.option}</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #f2f5f8", fontVariantNumeric: "tabular-nums" }}>{opt.count}</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #f2f5f8", fontVariantNumeric: "tabular-nums" }}>{opt.percent}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {q.type === "text" && (
                  <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "10px" }}>
                    {answers.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "14px", color: "#8a97a8" }}>Nenhuma resposta aberta.</p>
                    ) : (
                      answers.slice(0, answerLimit).map((a, j) => (
                        <div key={j} style={{ border: "1px solid #dde4ee", borderLeft: "3px solid #0b3a6e", borderRadius: "6px", padding: "12px 14px", background: "#fbfcfd" }}>
                          <p style={{ margin: 0, fontSize: "11.5px", color: "#8a97a8" }}>{a.displayName}</p>
                          <p style={{ marginTop: "4px", marginBottom: 0, maxHeight: "160px", overflowY: "auto", wordBreak: "break-word", fontSize: "14px", color: "#33415c", lineHeight: 1.6 }}>
                            {a.value || "—"}
                          </p>
                        </div>
                      ))
                    )}
                    {answers.length > answerLimit && (
                      <button type="button" onClick={() => setAnswerLimits((state) => ({ ...state, [id]: answerLimit + 20 }))} style={{ gridColumn: "1 / -1", height: "40px", borderRadius: "8px", border: "1px solid #b9c9d9", background: "transparent", padding: "0 16px", fontSize: "14px", fontWeight: 600, color: "#0b3a6e", cursor: "pointer" }}>
                        Exibir mais 20 respostas ({answers.length - answerLimit} restantes)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}
