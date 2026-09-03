"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { DonutChart } from "@/components/admin/DonutChart";
import { EventQrDialog } from "@/components/admin/EventQrDialog";
import { resolveDashboardState, type DashboardRound } from "@/lib/admin/dashboard-state";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, ListChecks, MonitorUp, QrCode } from "lucide-react";

interface DashboardViewProps {
  eventId: string;
  event: {
    title: string; slug: string; status: string; openedAt: string | null; participantCount: number;
    sequenceId?: string | null; sequenceOrder?: number | null; sequenceSize?: number | null;
    sequenceRootSlug?: string | null; nextEventTitle?: string | null;
  };
  stats: { registered: number; answering: number; completed: number };
  rounds: DashboardRound[];
  onOpenEvent: () => void;
  actionLoading: boolean;
}

const statusLabels: Record<string, string> = {
  open: "Em andamento", waiting: "Aguardando início", draft: "Rascunho", closed: "Encerrado",
};

export function EventDashboardView({ eventId, event, stats, rounds, onOpenEvent, actionLoading }: DashboardViewProps) {
  const dashboard = resolveDashboardState(event.status, rounds);
  const currentRound = dashboard.currentRound;
  const total = Math.max(event.participantCount, stats.registered);
  const completed = stats.completed;
  const answering = stats.answering;
  const waiting = Math.max(0, total - completed - answering);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const openedTime = event.openedAt
    ? new Date(event.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  const roundLabel = currentRound
    ? `${String(currentRound.order).padStart(2, "0")} · ${currentRound.title}`
    : dashboard.case === "event_waiting" ? "Evento ainda não iniciado"
      : dashboard.case === "no_rounds_yet" ? "Nenhuma rodada criada" : "Nenhuma rodada em andamento";

  return (
    <AdminShell eventId={eventId} eventSlug={event.slug} eventTitle={event.title} eventStatus={event.status} screenLabel="Visão geral">
      <section data-screen-label="Visão geral">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "18px", borderBottom: "1px solid #dbe4ef" }}>
          <div style={{ minWidth: "320px", flex: 1 }}>
            <p style={{ margin: "0 0 8px", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#18754A" }}>Visão geral</p>
            <h1 style={{ margin: 0, fontSize: "27px", fontWeight: 700, letterSpacing: "-.022em", lineHeight: 1.2, color: "#11243c", maxWidth: "34ch", textWrap: "pretty" }}>{event.title}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", marginTop: "12px", fontSize: "13px", color: "#5b6b7f" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontWeight: 600, color: event.status === "open" ? "#18754A" : "#5b6b7f" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "99px", background: event.status === "open" ? "#1a7f4b" : "#8a97a8" }} className={event.status === "open" ? "animate-pulse" : ""} />
                {statusLabels[event.status] ?? event.status}
              </span>
              {openedTime && <span>Iniciado às {openedTime}</span>}
              {event.sequenceId && event.sequenceOrder != null && <span>Evento {event.sequenceOrder + 1} de {event.sequenceSize}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link href={`/admin/eventos/${eventId}/perguntas`} style={{ display: "inline-flex", alignItems: "center", height: "40px", padding: "0 16px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "13.5px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", textDecoration: "none" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}>
              Editar perguntas
            </Link>
            <Link href={`/admin/eventos/${eventId}/ao-vivo`} style={{ display: "inline-flex", alignItems: "center", height: "40px", padding: "0 18px", border: "1px solid #0B3A6E", background: "#0B3A6E", borderRadius: "8px", fontSize: "13.5px", fontWeight: 600, color: "#fff", cursor: "pointer", textDecoration: "none" }} onMouseOver={(e) => { e.currentTarget.style.background = "#082F57"; }} onMouseOut={(e) => { e.currentTarget.style.background = "#0B3A6E"; }}>
              Abrir sessão ao vivo
            </Link>
          </div>
        </div>

        {dashboard.case === "event_waiting" && (
          <div style={{ marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderLeft: "4px solid #d29a20", padding: "20px", background: "#fff", borderTop: "1px solid #dbe4ef", borderRight: "1px solid #dbe4ef", borderBottom: "1px solid #dbe4ef", borderRadius: "10px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#11243c" }}>Este evento ainda não foi iniciado.</p>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>A primeira rodada disponível será aberta automaticamente.</p>
            </div>
            <Button onClick={onOpenEvent} disabled={actionLoading}>Iniciar evento</Button>
          </div>
        )}

        <div role="group" aria-label="Indicadores do evento" style={{ marginTop: "20px", border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", overflow: "hidden" }}>
          {[
            { label: "Participantes", value: total, color: "#11243c", divider: "1px 0 0 0 #dbe4ef" },
            { label: "Concluíram", value: completed, color: "#18754A", divider: "1px 0 0 0 #dbe4ef, 1px 0 0 0 #dbe4ef inset" },
            { label: "Respondendo", value: answering, color: "#dba514", divider: "1px 0 0 0 #dbe4ef, 1px 0 0 0 #dbe4ef inset" },
            { label: "Conclusão", value: `${percent}%`, color: "#0B3A6E", divider: "1px 0 0 0 #dbe4ef, 1px 0 0 0 #dbe4ef inset" }
          ].map((k, i) => (
            <div key={k.label} style={{ background: "#fff", padding: "16px 18px", borderRight: i !== 3 ? "1px solid #dbe4ef" : "none", borderBottom: "none" }}>
              <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>{k.label}</p>
              <p style={{ margin: "10px 0 0", fontSize: "30px", fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em", color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: "18px", marginTop: "18px" }}>
          <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", padding: "18px 20px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Situação da participação</h2>
            <p style={{ margin: "0 0 8px", fontSize: "12.5px", color: "#8a97a8" }}>Distribuição dos {total} participantes do evento</p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px", marginTop: "14px" }}>
              <div style={{ position: "relative", width: "168px", height: "168px", flexShrink: 0 }}>
                <DonutChart size={168} centerValue={total} centerLabel="participantes" showLegend={false} segments={[{ label: "Concluíram", value: completed, color: "#18754a" }, { label: "Respondendo", value: answering, color: "#dba514" }, { label: "Não iniciaram", value: waiting, color: "#cbd5e1" }]} />
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "1px", background: "#eef2f7", border: "1px solid #eef2f7", borderRadius: "8px", overflow: "hidden" }}>
                {[
                  { label: "Concluíram", value: completed, color: "#18754a" },
                  { label: "Respondendo", value: answering, color: "#dba514" },
                  { label: "Não iniciaram", value: waiting, color: "#cbd5e1" }
                ].map((seg) => (
                  <li key={seg.label} style={{ background: "#fff", padding: "10px 12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                    <span aria-hidden="true" style={{ width: "9px", height: "9px", borderRadius: "2px", background: seg.color, flexShrink: 0 }}></span>
                    <span style={{ flex: 1, color: "#33415c" }}>{seg.label}</span>
                    <span style={{ fontWeight: 600, color: "#11243c" }}>{seg.value}</span>
                    <span style={{ width: "52px", textAlign: "right", color: "#5b6b7f" }}>{total ? Math.round((seg.value / total) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", padding: "18px 20px", display: "flex", flexDirection: "column" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Rodada atual</h2>
            <p style={{ margin: "8px 0 0", fontSize: "19px", fontWeight: 600, lineHeight: 1.35, color: "#11243c", textWrap: "pretty" }}>{roundLabel}</p>
            <p style={{ margin: "14px 0 8px", fontSize: "14px", color: "#33415c" }}><strong style={{ fontSize: "17px" }}>{completed}</strong> de {total} respostas · <strong>{percent}%</strong></p>
            <div role="img" aria-label="Progresso da rodada" style={{ height: "10px", background: "#eef2f7", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${percent}%`, background: "#0B3A6E", borderRadius: "99px", transition: "width 400ms ease" }}></div>
            </div>
            <div style={{ marginTop: "auto", paddingTop: "18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", borderTop: "1px solid #eef1f5" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12.5px", color: "#5b6b7f" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "99px", background: "#1a7f4b" }} className="animate-pulse"></span>Atualização em tempo real
              </span>
              <button type="button" onClick={() => window.location.href = `/admin/eventos/${eventId}/ao-vivo`} style={{ height: "34px", padding: "0 13px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}>Acompanhar ao vivo</button>
            </div>
          </div>
        </div>

        <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", padding: "18px 20px", marginTop: "18px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>Participação por rodada</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {rounds.length ? rounds.map((round) => {
              const roundPercent = total ? Math.min(100, Math.round((round.submissionCount / total) * 100)) : 0;
              return (
                <div key={round.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", fontSize: "13px" }}>
                    <span style={{ minWidth: 0, color: "#33415c" }}><span style={{ fontFamily: "ui-monospace,Consolas,monospace", color: "#8a97a8", marginRight: "8px" }}>{String(round.order).padStart(2, "0")}</span>{round.title}</span>
                    <span style={{ flexShrink: 0, color: "#5b6b7f" }}><strong style={{ color: "#11243c" }}>{round.submissionCount}</strong> respostas · {roundPercent}%</span>
                  </div>
                  <div style={{ height: "16px", background: "#f2f5f9", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${roundPercent}%`, background: "#477da9", borderRadius: "4px", transition: "width 400ms ease" }}></div>
                  </div>
                </div>
              );
            }) : (
              <p style={{ margin: 0, fontSize: "13px", color: "#8a97a8" }}>Nenhuma rodada criada.</p>
            )}
          </div>
        </div>

        <div style={{ marginTop: "18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
          <EventQrDialog eventSlug={event.sequenceRootSlug ?? event.slug} eventTitle={event.title} trigger={<button type="button" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "40px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", width: "100%" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}><QrCode style={{ width: "16px", height: "16px" }} />QR e acesso</button>} />
          <Link href={`/projector/${event.sequenceRootSlug ?? event.slug}`} target="_blank" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "40px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", textDecoration: "none" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}><MonitorUp style={{ width: "16px", height: "16px" }} />Projetor</Link>
          <Link href={`/admin/eventos/${eventId}/perguntas`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "40px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", textDecoration: "none" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}><ListChecks style={{ width: "16px", height: "16px" }} />Perguntas</Link>
          <Link href={`/admin/eventos/${eventId}/relatorios`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "40px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", textDecoration: "none" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}><BarChart3 style={{ width: "16px", height: "16px" }} />Relatórios</Link>
        </div>
      </section>
    </AdminShell>
  );
}
