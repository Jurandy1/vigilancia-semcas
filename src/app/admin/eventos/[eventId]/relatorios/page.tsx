"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
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
    Array<{ id: string; title: string; status: string; submissionCount: number; registeredCount: number; order?: number }>
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
  // Cada rodada tem seu próprio total de registrados (rounds.registered_count) —
  // usar o participantCount do evento inteiro como denominador fixo fazia a
  // participação de rodadas já encerradas parecer cair conforme mais gente
  // entrava no evento depois.
  const totalRegistered = rounds.reduce((sum, r) => sum + (r.registeredCount ?? 0), 0);
  const participationRate = totalRegistered > 0 ? Math.min(100, Math.round((totalResponses / totalRegistered) * 100)) : 0;

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
        round.registeredCount > 0
          ? `${Math.min(100, Math.round(((round.submissionCount ?? 0) / round.registeredCount) * 100))}%`
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
      screenLabel="Resultados e relatórios"
    >
      <section data-screen-label="Resultados e relatórios" style={{ width: "100%", maxWidth: "1080px" }}>
        {error && (
          <div style={{ marginBottom: "20px", borderRadius: "12px", border: "1px solid #fecaca", background: "#fef2f2", padding: "12px 16px", fontSize: "14px", color: "#b91c1c" }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "18px", borderBottom: "1px solid #dbe4ef" }}>
          <div style={{ minWidth: "300px", flex: 1 }}>
            <p style={{ margin: "0 0 8px", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#18754A" }}>Análise do evento</p>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-.02em", color: "#11243c" }}>Relatório consolidado</h1>
            <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: 1.45, color: "#5b6b7f", maxWidth: "46ch" }}>{eventTitle}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={exportSummaryExcel}
              style={{ height: "38px", padding: "0 15px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}
            >
              <Download className="h-4 w-4" /> Exportar Excel
            </button>
            <Link
              href={`/admin/eventos/${eventId}/relatorios/imprimir`}
              style={{ height: "38px", padding: "0 16px", border: "1px solid #0B3A6E", background: "#0B3A6E", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#082F57"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "#0B3A6E"; }}
            >
              <FileText className="mr-2 h-4 w-4" /> Imprimir / PDF
            </Link>
          </div>
        </div>

        <div role="group" aria-label="Resumo do relatório" style={{ marginTop: "20px", border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", overflow: "hidden" }}>
          <div style={{ background: "#fff", padding: "16px 18px", boxShadow: "1px 0 0 0 #dbe4ef" }}>
            <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Participantes</p>
            <p style={{ margin: "10px 0 0", fontSize: "30px", fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em", color: "#0b4a83" }}>{participantCount}</p>
            <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#8a97a8" }}>Pessoas na base</p>
          </div>
          <div style={{ background: "#fff", padding: "16px 18px", boxShadow: "1px 0 0 0 #dbe4ef" }}>
            <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Respostas</p>
            <p style={{ margin: "10px 0 0", fontSize: "30px", fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em", color: "#0b3a6e" }}>{totalResponses}</p>
            <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#8a97a8" }}>Em todas as rodadas</p>
          </div>
          <div style={{ background: "#fff", padding: "16px 18px", boxShadow: "1px 0 0 0 #dbe4ef" }}>
            <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Rodadas</p>
            <p style={{ margin: "10px 0 0", fontSize: "30px", fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em", color: "#11243c" }}>{rounds.length}</p>
            <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#8a97a8" }}>Criadas no evento</p>
          </div>
          <div style={{ background: "#fff", padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Participação média</p>
            <p style={{ margin: "10px 0 0", fontSize: "30px", fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em", color: "#18754a" }}>{participationRate}%</p>
            <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#8a97a8" }}>{roundsWithResponses} rodada(s) com respostas</p>
          </div>
        </div>

        <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", padding: "18px 20px", marginTop: "18px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Participação por rodada</h2>
          {rounds.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13px", color: "#8a97a8" }}>Nenhuma rodada criada ainda.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {rounds.map((round, i) => {
                const pct = round.registeredCount > 0 ? Math.min(100, Math.round(((round.submissionCount ?? 0) / round.registeredCount) * 100)) : 0;
                return (
                  <Link
                    key={round.id}
                    href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                    style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: "6px" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", fontSize: "13px" }}>
                      <span style={{ minWidth: 0, color: "#33415c" }}>
                        <span style={{ fontFamily: "ui-monospace,Consolas,monospace", color: "#8a97a8", marginRight: "8px" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {round.title}
                      </span>
                      <span style={{ flexShrink: 0, color: "#5b6b7f" }}>
                        <strong style={{ color: "#11243c" }}>{round.submissionCount ?? 0}</strong> respostas · {pct}%
                      </span>
                    </div>
                    <div style={{ height: "16px", background: "#f2f5f9", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #0b4a83, #18754a)", borderRadius: "4px", transition: "width 400ms ease" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <p style={{ margin: "16px 0 0", fontSize: "12px", lineHeight: 1.6, color: "#8a97a8" }}>
          O documento oficial com cabeçalho institucional fica em Imprimir / PDF. Exportações CSV e Excel estão disponíveis na tela de resultados de cada rodada.
        </p>
      </section>
    </AdminShell>
  );
}
