"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ORG_SHORT, SECRETARIAT_NAME, SECTOR_NAME, CITY_NAME_FULL } from "@/lib/branding";

interface RoundReport {
  round: { id: string; title: string };
  summary: { totalParticipants: number; totalSubmissions: number; participationRate: string };
  questions: Array<{
    id: string;
    title: string;
    type: string;
    options?: Array<{ option: string; count: number; percent: string }>;
    allowsMultiple?: boolean;
    answers?: Array<{ displayName: string; value: string }>;
    otherAnswers?: Array<{ displayName: string; value: string }>;
  }>;
}

const PRINT_STYLES = `
  @page {
    size: A4;
    margin: 20mm 16mm 20mm;
  }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table thead { display: table-header-group; }
    .report-question { break-inside: avoid; }
    .report-round-title { break-after: avoid; }
  }
`;

export default function EventReportPrintPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [eventTitle, setEventTitle] = useState("");
  const [eventStatus, setEventStatus] = useState("");
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [reports, setReports] = useState<RoundReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedRounds, setFailedRounds] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAdminAuthChange((user) => {
      if (!user) router.replace("/admin/login");
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    async function load() {
      try {
        const token = await getAdminIdToken();
        if (!token) return;

        const dashRes = await adminFetch(`/api/admin/events/${eventId}/dashboard`, token);
        const dash = await dashRes.json();
        if (!dashRes.ok) throw new Error(dash.error ?? "Não foi possível carregar o dashboard.");
        setEventTitle(dash.event?.title ?? "");
        setEventStatus(dash.event?.status ?? "");
        setOpenedAt(dash.event?.openedAt ?? null);
        setClosedAt(dash.event?.closedAt ?? null);
        setParticipantCount(dash.event?.participantCount ?? 0);

        const rounds = (dash.rounds ?? []) as Array<{ id: string; title: string }>;
        const failures: string[] = [];
        const loaded = await Promise.all(
          rounds.map(async (r) => {
            const res = await adminFetch(
              `/api/admin/events/${eventId}/rounds/${r.id}/report`,
              token
            );
            if (!res.ok) {
              failures.push(r.title);
              return null;
            }
            return (await res.json()) as RoundReport;
          })
        );
        setFailedRounds(failures);
        setReports(loaded.filter((r): r is RoundReport => Boolean(r?.round && r?.summary)));
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Não foi possível carregar o relatório.");
        setReports([]);
      }
    }
    void load();
  }, [eventId]);

  if (reports === null) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-xl">
        <p className="text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">{loadError}</p>
        <button
          type="button"
          className="mt-3 h-9 px-3 text-sm font-semibold border border-[#c9d4e2] rounded-md"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    draft: "Rascunho",
    waiting: "Aguardando início",
    open: "Em andamento",
    closed: "Encerrado",
  };

  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const issuedAt = dateTimeFormatter.format(new Date());
  const period = openedAt
    ? closedAt
      ? `${dateFormatter.format(new Date(openedAt))} a ${dateFormatter.format(new Date(closedAt))}`
      : `Iniciado em ${dateFormatter.format(new Date(openedAt))}`
    : "Não iniciado";

  const totalSubmissions = reports.reduce((sum, r) => sum + r.summary.totalSubmissions, 0);

  return (
    <main className="min-h-screen bg-white p-10 print:p-0 max-w-[820px] mx-auto text-[#1a1a1a]">
      <style>{PRINT_STYLES}</style>

      {/* Timbre oficial */}
      <header className="flex items-start gap-4 border-b-[3px] border-[#0b3a6e] pb-4 mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-prefeitura-saoluis.jpg" alt={CITY_NAME_FULL} className="h-14 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#5b6b7f]">
            {CITY_NAME_FULL}
          </p>
          <p className="m-0 mt-0.5 text-[13px] font-bold uppercase tracking-[0.04em] text-[#0b3a6e]">
            {ORG_SHORT} — {SECRETARIAT_NAME}
          </p>
          <p className="m-0 mt-0.5 text-[12px] font-semibold text-[#33415c]">{SECTOR_NAME}</p>
        </div>
      </header>

      <div className="mb-7 text-center">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a97a8]">
          Relatório consolidado de participação
        </p>
        <h1 className="m-0 mt-2 text-lg font-bold leading-snug text-[#11243c]">{eventTitle}</h1>
      </div>

      {failedRounds.length > 0 && (
        <div className="mb-6 rounded-md border border-[#e3b3ad] bg-[#fdf2f1] px-3 py-2 text-[12.5px] text-[#b42318] no-print">
          Não foi possível incluir {failedRounds.length === 1 ? "a rodada" : "as rodadas"}:{" "}
          <strong>{failedRounds.join(", ")}</strong>. Recarregue a página antes de imprimir.
        </div>
      )}

      {/* Ficha do evento */}
      <table className="w-full mb-8 border border-[#dbe4ef] text-[12px]">
        <tbody>
          <tr className="border-b border-[#dbe4ef]">
            <td className="w-1/3 bg-[#f4f6f9] px-3 py-2 font-semibold text-[#5b6b7f]">Situação</td>
            <td className="px-3 py-2">{statusLabel[eventStatus] ?? eventStatus}</td>
          </tr>
          <tr className="border-b border-[#dbe4ef]">
            <td className="bg-[#f4f6f9] px-3 py-2 font-semibold text-[#5b6b7f]">Período</td>
            <td className="px-3 py-2">{period}</td>
          </tr>
          <tr className="border-b border-[#dbe4ef]">
            <td className="bg-[#f4f6f9] px-3 py-2 font-semibold text-[#5b6b7f]">Participantes</td>
            <td className="px-3 py-2">{participantCount}</td>
          </tr>
          <tr>
            <td className="bg-[#f4f6f9] px-3 py-2 font-semibold text-[#5b6b7f]">Total de respostas</td>
            <td className="px-3 py-2">{totalSubmissions}</td>
          </tr>
        </tbody>
      </table>

      {reports.map((r) => (
        <section key={r.round.id} className="mb-10">
          <h2 className="report-round-title m-0 mb-1 bg-[#0b3a6e] px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-white">
            {r.round.title}
          </h2>
          <p className="m-0 mb-4 px-1 text-[11.5px] text-[#5b6b7f]">
            {r.summary.totalSubmissions} respostas de {r.summary.totalParticipants} participantes
            ({r.summary.participationRate})
          </p>

          {r.questions.map((q, i) => (
            <div key={q.id} className="report-question mb-6">
              <p className="m-0 mb-2 text-[12.5px] font-semibold text-[#11243c]">
                {i + 1}. {q.title}
              </p>

              {(q.type === "single_choice" || q.type === "multi_choice") && q.options && (
                <>
                  {q.allowsMultiple ? (
                    <p className="m-0 mb-1.5 text-[10.5px] italic text-[#8a97a8]">
                      Múltipla escolha — a soma dos percentuais pode ultrapassar 100%.
                    </p>
                  ) : null}
                  <table className="w-full border border-[#dbe4ef] text-[12px]">
                    <thead>
                      <tr className="bg-[#f4f6f9]">
                        <th className="border-b border-[#dbe4ef] px-2.5 py-1.5 text-left font-semibold text-[#5b6b7f]">Alternativa</th>
                        <th className="w-20 border-b border-[#dbe4ef] px-2.5 py-1.5 text-right font-semibold text-[#5b6b7f]">Respostas</th>
                        <th className="w-16 border-b border-[#dbe4ef] px-2.5 py-1.5 text-right font-semibold text-[#5b6b7f]">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.options.map((opt, idx) => (
                        <tr key={opt.option} className={idx % 2 === 1 ? "bg-[#fafbfc]" : undefined}>
                          <td className="border-b border-[#eef1f5] px-2.5 py-1.5">{opt.option}</td>
                          <td className="border-b border-[#eef1f5] px-2.5 py-1.5 text-right tabular-nums">{opt.count}</td>
                          <td className="border-b border-[#eef1f5] px-2.5 py-1.5 text-right tabular-nums">{opt.percent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {q.otherAnswers && q.otherAnswers.length > 0 && (
                    <table className="mt-2 w-full border border-[#dbe4ef] text-[11.5px]">
                      <thead>
                        <tr className="bg-[#f4f6f9]">
                          <th colSpan={2} className="border-b border-[#dbe4ef] px-2.5 py-1.5 text-left font-semibold text-[#5b6b7f]">
                            Detalhes informados em &quot;Outro&quot;
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.otherAnswers.map((answer, index) => (
                          <tr key={index} className={index % 2 === 1 ? "bg-[#fafbfc]" : undefined}>
                            <td className="w-1/4 border-b border-[#eef1f5] px-2.5 py-1.5 align-top font-medium text-[#33415c]">{answer.displayName}</td>
                            <td className="border-b border-[#eef1f5] px-2.5 py-1.5 align-top text-[#33415c]">{answer.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {q.type === "text" && q.answers && (
                <table className="w-full border border-[#dbe4ef] text-[11.5px]">
                  <thead>
                    <tr className="bg-[#f4f6f9]">
                      <th className="w-1/4 border-b border-[#dbe4ef] px-2.5 py-1.5 text-left font-semibold text-[#5b6b7f]">Participante</th>
                      <th className="border-b border-[#dbe4ef] px-2.5 py-1.5 text-left font-semibold text-[#5b6b7f]">Resposta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.answers.map((a, j) => (
                      <tr key={j} className={j % 2 === 1 ? "bg-[#fafbfc]" : undefined}>
                        <td className="border-b border-[#eef1f5] px-2.5 py-1.5 align-top font-medium text-[#33415c]">{a.displayName}</td>
                        <td className="border-b border-[#eef1f5] px-2.5 py-1.5 align-top text-[#33415c]">{a.value}</td>
                      </tr>
                    ))}
                    {q.answers.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-2.5 py-1.5 text-[#8a97a8]">Nenhuma resposta registrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </section>
      ))}

      <footer className="mt-10 border-t border-[#dbe4ef] pt-3 text-[10px] text-[#8a97a8]">
        Documento gerado automaticamente pelo sistema de participação e avaliação da {ORG_SHORT} em {issuedAt}.
      </footer>

      <button
        className="no-print mt-6 px-6 py-2 border border-gray-300 rounded-md text-sm"
        onClick={() => window.print()}
      >
        Imprimir / Salvar como PDF
      </button>
    </main>
  );
}
