"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Copy,
  MessageSquareText,
  MonitorUp,
  MoreVertical,
  ListOrdered,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Settings,
  Star,
  Trash2,
  UsersRound,
  XCircle,
} from "lucide-react";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventQrDialog } from "@/components/admin/EventQrDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface EventItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  isTest: boolean;
  isDailyActive: boolean;
  participantCount: number;
  submissionCount: number;
  currentRoundTitle: string | null;
  updatedAt?: string | null;
  sequenceId: string | null;
  sequenceOrder: number | null;
  sequenceSize: number | null;
  sequenceRootEventId: string | null;
  sequenceRootSlug: string | null;
  nextEventId: string | null;
  nextEventTitle: string | null;
  nextEventSlug: string | null;
}

type FilterKey = "todos" | "open" | "waiting" | "closed";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  waiting: "Aguardando",
  open: "Em andamento",
  closed: "Encerrado",
};

export default function AdminEventosPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [closingEvent, setClosingEvent] = useState<EventItem | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [resettingEvent, setResettingEvent] = useState<EventItem | null>(null);
  const [resetForceRequired, setResetForceRequired] = useState(false);
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [sequenceIds, setSequenceIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequenceQueryHandled = useRef(false);

  const load = useCallback(async () => {
    const token = await getAdminIdToken();
    if (!token) return;
    const res = await adminFetch("/api/admin/events", token, { cache: "no-store" });
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsub = onAdminAuthChange((user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      load();
    });
    return unsub;
  }, [router, load]);

  const dailyActiveEvent = useMemo(() => events.find((e) => e.isDailyActive) ?? null, [events]);

  const counts = useMemo(() => {
    return {
      todos: events.length,
      open: events.filter((e) => e.status === "open").length,
      waiting: events.filter((e) => e.status === "waiting" || e.status === "draft").length,
      closed: events.filter((e) => e.status === "closed").length,
    };
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === "todos") return events;
    if (filter === "waiting") {
      return events.filter((e) => e.status === "waiting" || e.status === "draft");
    }
    return events.filter((e) => e.status === filter);
  }, [events, filter]);

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`);
  }

  async function setDailyActive(event: EventItem) {
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch("/api/admin/events/daily-active", token, {
        method: "POST",
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível definir o evento do dia.");
        return;
      }
      await load();
    } catch {
      setError("Não foi possível definir o evento do dia.");
    } finally {
      setActionLoading(false);
    }
  }

  async function clearDailyActive() {
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch("/api/admin/events/daily-active", token, { method: "DELETE" });
      if (!res.ok) {
        setError("Não foi possível remover o evento do dia.");
        return;
      }
      await load();
    } catch {
      setError("Não foi possível remover o evento do dia.");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmCloseEvent() {
    if (!closingEvent) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${closingEvent.id}/close`, token, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível concluir esta operação. Tente novamente.");
        return;
      }
      setClosingEvent(null);
      await load();
    } catch {
      setError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    if (loading || sequenceQueryHandled.current) return;
    if (new URLSearchParams(window.location.search).get("sequencia") === "1") {
      sequenceQueryHandled.current = true;
      const existingSequenceId = events.find((event) => event.sequenceId)?.sequenceId;
      const existing = events
        .filter((event) => event.sequenceId === existingSequenceId)
        .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
      setSequenceIds(existing.map((event) => event.id));
      setError(null);
      setSequenceOpen(true);
    }
  }, [loading, events]);

  function toggleSequenceEvent(eventId: string) {
    setSequenceIds((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]
    );
  }

  function moveSequenceEvent(eventId: string, direction: -1 | 1) {
    setSequenceIds((current) => {
      const index = current.indexOf(eventId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  async function saveSequence() {
    if (sequenceIds.length < 2) {
      setError("Selecione pelo menos dois eventos para criar uma sequência.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch("/api/admin/events/sequence", token, {
        method: "POST",
        body: JSON.stringify({ eventIds: sequenceIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar a sequência.");
        return;
      }
      setSequenceOpen(false);
      await load();
    } catch {
      setError("Não foi possível salvar a sequência.");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDeleteEvent() {
    if (!deletingEvent) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${deletingEvent.id}`, token, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível excluir o evento.");
        return;
      }
      try {
        const selected = window.localStorage.getItem("semcas-admin-selected-event");
        if (selected && JSON.parse(selected).id === deletingEvent.id) {
          window.localStorage.removeItem("semcas-admin-selected-event");
        }
      } catch {
        window.localStorage.removeItem("semcas-admin-selected-event");
      }
      setDeletingEvent(null);
      await load();
    } catch {
      setError("Não foi possível excluir o evento.");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmResetEvent(force = false) {
    if (!resettingEvent) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${resettingEvent.id}/reset`, token, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PARTICIPANTS_ANSWERING") {
          // Marca o dialog como "precisa força" — o usuário confirma de novo
          // com o botão vermelho "Apagar mesmo assim".
          setResetForceRequired(true);
          setError(null);
          return;
        }
        setError(data.error ?? "Não foi possível resetar o evento.");
        return;
      }
      setResetForceRequired(false);
      setResettingEvent(null);
      await load();
    } catch {
      setError("Não foi possível resetar o evento.");
    } finally {
      setActionLoading(false);
    }
  }

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: "todos", label: "Todos" },
    { key: "open", label: "Em andamento" },
    { key: "waiting", label: "Aguardando" },
    { key: "closed", label: "Encerrados" },
  ];

  return (
    <AdminShell screenLabel="Eventos">
      <section aria-label="Eventos" data-screen-label="Eventos">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "1px solid #dbe4ef", marginBottom: "20px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 6px", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#18754A" }}>Painel administrativo</p>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-.02em", color: "#11243c" }}>Eventos</h1>
            <p style={{ margin: "6px 0 0", fontSize: "13.5px", color: "#5b6b7f" }}>Avaliações, consultas e atividades participativas da SEMCAS.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => router.push("/admin/eventos/sequencia")} style={{ height: "38px", padding: "0 14px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer", textDecoration: "none" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}>
              Organizar sequência
            </button>
            <button type="button" onClick={() => router.push("/admin/eventos/novo")} style={{ height: "38px", padding: "0 16px", border: "1px solid #0B3A6E", background: "#0B3A6E", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer", textDecoration: "none" }} onMouseOver={(e) => { e.currentTarget.style.background = "#082F57"; }} onMouseOut={(e) => { e.currentTarget.style.background = "#0B3A6E"; }}>
              Criar evento
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: "16px", maxWidth: "768px", fontSize: "14px", color: "#b42318", background: "#fdf2f1", border: "1px solid #e3b3ad", borderRadius: "6px", padding: "8px 12px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "14px", marginBottom: "18px", padding: "14px 18px", borderRadius: "10px", border: "1px solid #b9d5ed", background: "#edf6fd" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#0b4a83" }}>QR Code fixo</p>
            {dailyActiveEvent ? (
              <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: "#244c70" }}>
                Hoje começa em <strong>{dailyActiveEvent.title}</strong>
                {dailyActiveEvent.sequenceSize && dailyActiveEvent.sequenceSize > 1
                  ? ` (${dailyActiveEvent.sequenceSize} eventos na sequência)`
                  : ""}
                . O link e o QR nunca mudam — se essa sequência tiver mais de um evento, ao clicar em
                &quot;Próximo evento&quot; o link segue sozinho para o seguinte, sem precisar ativar de novo.
              </p>
            ) : (
              <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: "#244c70" }}>
                Nenhum evento definido. Imprima este QR uma vez e use &quot;Definir como evento do dia&quot; em
                qualquer evento (ou no primeiro de uma sequência) para ativá-lo — os demais eventos dessa
                sequência são seguidos automaticamente conforme você avança com &quot;Próximo evento&quot;.
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <EventQrDialog
              eventSlug={DAILY_ACTIVE_SLUG}
              eventTitle="QR fixo do dia"
              trigger={
                <button type="button" style={{ height: "36px", padding: "0 14px", border: "1px solid #79a9ce", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0b4a83", cursor: "pointer" }}>
                  Ver QR fixo
                </button>
              }
            />
            <a href={`/projector/${DAILY_ACTIVE_SLUG}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", height: "36px", padding: "0 14px", border: "1px solid #79a9ce", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0b4a83", textDecoration: "none" }}>
              Abrir projetor fixo
            </a>
            {dailyActiveEvent && (
              <button type="button" onClick={clearDailyActive} disabled={actionLoading} style={{ height: "36px", padding: "0 14px", border: "1px solid #c9d4e2", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#5b6b7f", cursor: actionLoading ? "not-allowed" : "pointer" }}>
                Desativar
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
          {filters.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  height: "34px",
                  padding: "0 12px",
                  border: selected ? "1px solid #0B3A6E" : "1px solid #c9d4e2",
                  background: selected ? "#0B3A6E" : "#fff",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: selected ? 600 : 500,
                  color: selected ? "#fff" : "#5b6b7f",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = "#a8b8cc";
                    e.currentTarget.style.background = "#f8fafd";
                    e.currentTarget.style.color = "#33415c";
                  }
                }}
                onMouseOut={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = "#c9d4e2";
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.color = "#5b6b7f";
                  }
                }}
              >
                {f.label} <span style={{ opacity: selected ? 0.8 : 0.65 }}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", minHeight: "208px", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", border: "1px dashed #c9d4e2", borderRadius: "10px", background: "#f8fafc" }}>
            <span style={{ marginBottom: "12px", display: "flex", height: "44px", width: "44px", alignItems: "center", justifyContent: "center", borderRadius: "99px", background: "#edf3f8", color: "#6c8199" }}>
              <QrCode style={{ height: "20px", width: "20px" }} />
            </span>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#33415c" }}>Nenhum evento neste filtro</p>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#7b8ba0" }}>Escolha outro filtro ou crie um novo evento.</p>
          </div>
        ) : (
          <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#e6ecf4", display: "flex", flexDirection: "column", gap: "1px", overflow: "hidden" }}>
            {filtered.map((event) => {
              const statusStyle = event.status === "open"
                ? { badgeStyle: "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#1a7f4b;background:#e8f5ee;border:1px solid #c3e4d1;border-radius:4px;padding:2px 6px;", dotColor: "#1a7f4b" }
                : { badgeStyle: "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#5b6b7f;background:#f4f6f9;border:1px solid #dde4ee;border-radius:4px;padding:2px 6px;", dotColor: "#8a97a8" };

              return (
                <article key={event.id} style={{ background: "#fff", padding: "18px 20px", display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ minWidth: "260px", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, fontSize: "15.5px", fontWeight: 600, lineHeight: 1.35, color: "#11243c", maxWidth: "52ch" }}>
                        {event.title}
                      </h2>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 600, color: event.status === "open" ? "#1a7f4b" : "#5b6b7f", background: event.status === "open" ? "#e8f5ee" : "#f4f6f9", border: event.status === "open" ? "1px solid #c3e4d1" : "1px solid #dde4ee", borderRadius: "4px", padding: "2px 6px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "99px", background: statusStyle.dotColor }} />
                        {statusLabel[event.status] ?? event.status}
                      </span>
                      {event.isTest && (
                        <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#8a5a00", background: "#fdf5e3", border: "1px solid #f0dfae", borderRadius: "4px", padding: "2px 6px" }}>
                          Teste
                        </span>
                      )}
                      {event.sequenceId && event.sequenceOrder !== null && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#0b4a83", background: "#edf6fd", border: "1px solid #b9d5ed", borderRadius: "99px", padding: "2px 8px" }}>
                          Sequência {event.sequenceOrder + 1} de {event.sequenceSize}
                        </span>
                      )}
                      {event.isDailyActive && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "#0b4a83", background: "#edf6fd", border: "1px solid #b9d5ed", borderRadius: "4px", padding: "2px 6px" }}>
                          <Star style={{ width: "11px", height: "11px" }} />
                          QR fixo hoje
                        </span>
                      )}
                    </div>
                    
                    {event.currentRoundTitle ? (
                      <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#5b6b7f" }}>
                        Rodada atual: <strong style={{ color: "#33415c", fontWeight: 600 }}>{event.currentRoundTitle}</strong>
                      </p>
                    ) : (
                      <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#8a97a8" }}>Nenhuma rodada ativa</p>
                    )}

                    <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "10px", fontSize: "13px", color: "#5b6b7f" }}>
                      <span><strong style={{ color: "#11243c" }}>{event.participantCount}</strong> participantes</span>
                      <span><strong style={{ color: "#11243c" }}>{event.submissionCount}</strong> respostas</span>
                      <span style={{ fontFamily: "ui-monospace,Consolas,monospace", fontSize: "12px", color: "#8a97a8" }}>
                        {event.sequenceRootSlug ?? event.slug}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => router.push(`/admin/eventos/${event.id}/perguntas`)} style={{ height: "36px", padding: "0 13px", border: "1px solid #b9c9d9", background: "#fff", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#0B3A6E", cursor: "pointer" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.background = "#fff"; }}>
                      Editar perguntas
                    </button>
                    <button type="button" onClick={() => router.push(`/admin/eventos/${event.id}`)} style={{ height: "36px", padding: "0 15px", border: "1px solid #0B3A6E", background: "#0B3A6E", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "#fff", cursor: "pointer" }} onMouseOver={(e) => { e.currentTarget.style.background = "#082F57"; }} onMouseOut={(e) => { e.currentTarget.style.background = "#0B3A6E"; }}>
                      Abrir evento
                    </button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Mais ações"
                          title="Mais ações"
                          style={{ width: "36px", height: "36px", border: "1px solid #dbe4ef", background: "#fff", borderRadius: "8px", color: "#5b6b7f", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseOver={(e) => { e.currentTarget.style.borderColor = "#b9c9d9"; e.currentTarget.style.color = "#0B3A6E"; }}
                          onMouseOut={(e) => { e.currentTarget.style.borderColor = "#dbe4ef"; e.currentTarget.style.color = "#5b6b7f"; }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ width: "16px", height: "16px" }}>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/eventos/${event.id}`}>Abrir painel do evento</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/eventos/${event.id}/perguntas`}>
                            <MessageSquareText className="w-4 h-4" />
                            Editar perguntas
                          </Link>
                        </DropdownMenuItem>
                        <EventQrDialog
                          eventSlug={event.sequenceRootSlug ?? event.slug}
                          eventTitle={event.title}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <QrCode className="w-4 h-4" />
                              Ver QR Code
                            </DropdownMenuItem>
                          }
                        />
                        <DropdownMenuItem onClick={() => copyLink(event.sequenceRootSlug ?? event.slug)}>
                          <Copy className="w-4 h-4" />
                          Copiar link
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={`/print/${event.sequenceRootSlug ?? event.slug}`} target="_blank" rel="noreferrer">
                            <Printer className="w-4 h-4" />
                            Imprimir A4
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={`/projector/${DAILY_ACTIVE_SLUG}`} target="_blank" rel="noreferrer">
                            <MonitorUp className="w-4 h-4" />
                            Abrir projetor
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/eventos/${event.id}/configuracoes`}>
                            <Settings className="w-4 h-4" />
                            Configurar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => (event.isDailyActive ? clearDailyActive() : setDailyActive(event))}>
                          <Star className="w-4 h-4" />
                          {event.isDailyActive ? "Remover do QR fixo" : "Definir como evento do dia"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setResettingEvent(event)}
                          className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Resetar evento
                        </DropdownMenuItem>
                        {event.status === "open" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setClosingEvent(event)}
                              className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Encerrar evento
                            </DropdownMenuItem>
                          </>
                        )}
                        {event.status !== "open" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingEvent(event)}
                              className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir evento
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog open={closingEvent !== null} onOpenChange={(open) => !open && setClosingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {closingEvent?.title}. Todas as rodadas deste evento serão consideradas encerradas.
              Novas respostas não serão aceitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCloseEvent}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              Encerrar evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingEvent !== null} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingEvent?.title}” e todas as suas rodadas, respostas, participantes e relatórios serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEvent} disabled={actionLoading} className="bg-red-600 hover:bg-red-700">
              {actionLoading ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resettingEvent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResettingEvent(null);
            setResetForceRequired(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resetForceRequired
                ? "Há gente respondendo agora — apagar mesmo assim?"
                : "Resetar evento e apagar respostas?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetForceRequired
                ? `Existe participante com resposta em andamento em “${resettingEvent?.title}”. Se você seguir agora, essa pessoa vê erro ao clicar Enviar e o voto dela não é registrado. Recomendo encerrar o evento ou aguardar; use "Apagar mesmo assim" só se tiver certeza.`
                : `Isso apaga permanentemente os ${resettingEvent?.participantCount ?? 0} participante(s) e ${resettingEvent?.submissionCount ?? 0} resposta(s) de “${resettingEvent?.title}”, e volta o evento ao estado inicial (rascunho) — mesmo que já esteja encerrado. As perguntas continuam intactas. Esta ação não pode ser desfeita — use apenas se algo deu errado e o evento precisa ser votado de novo do zero.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {resettingEvent?.status === "open" && !resetForceRequired && (
            <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              <strong>Atenção:</strong> este evento está <strong>em andamento</strong>. Se há gente
              respondendo agora, os votos em curso podem ser perdidos e a tela do participante pode
              mostrar erro. Encerre o evento antes de resetar, ou avise os presentes para
              recarregarem a página depois.
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmResetEvent(resetForceRequired)}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading
                ? "Resetando..."
                : resetForceRequired
                  ? "Apagar mesmo assim"
                  : "Apagar e resetar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={sequenceOpen} onOpenChange={setSequenceOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="border-b border-[#e3eaf2] px-6 py-5 pr-12">
            <DialogTitle className="text-xl text-[#11243c]">Sequência de eventos</DialogTitle>
            <DialogDescription>
              Selecione e ordene os eventos. Todos usarão o QR Code do primeiro evento da sequência.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5">
            <div className="mb-5 rounded-xl border border-[#b9d5ed] bg-[#edf6fd] p-4 text-sm leading-relaxed text-[#244c70]">
              <strong>Como funciona:</strong> ao finalizar o primeiro evento, use “Próximo evento” na tela ao vivo. O mesmo QR Code passará a abrir o evento seguinte automaticamente.
            </div>

            <div className="space-y-2">
              {events
                .filter((event) => event.status === "draft" || event.status === "waiting")
                .sort((a, b) => {
                  const ai = sequenceIds.indexOf(a.id);
                  const bi = sequenceIds.indexOf(b.id);
                  if (ai >= 0 && bi >= 0) return ai - bi;
                  if (ai >= 0) return -1;
                  if (bi >= 0) return 1;
                  return a.title.localeCompare(b.title, "pt-BR");
                })
                .map((event) => {
                  const selected = sequenceIds.includes(event.id);
                  const position = sequenceIds.indexOf(event.id);
                  return (
                    <div key={event.id} className={cn("flex items-center gap-3 rounded-xl border p-3", selected ? "border-[#79a9ce] bg-[#f3f8fc]" : "border-[#dbe4ef] bg-white")}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSequenceEvent(event.id)}
                        aria-label={`Selecionar ${event.title}`}
                        className="h-5 w-5 accent-[#0b4a83]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 truncate text-sm font-semibold text-[#11243c]">{event.title}</p>
                        <p className="mb-0 mt-0.5 text-xs text-[#718198]">{selected ? `${position + 1}º evento` : "Fora da sequência"}</p>
                      </div>
                      {selected && (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => moveSequenceEvent(event.id, -1)} disabled={position === 0} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbd7e4] bg-white text-[#0b4a83] disabled:opacity-30" aria-label="Mover para cima">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => moveSequenceEvent(event.id, 1)} disabled={position === sequenceIds.length - 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbd7e4] bg-white text-[#0b4a83] disabled:opacity-30" aria-label="Mover para baixo">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {error && <p className="mb-0 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#e3eaf2] bg-[#f8fafc] px-6 py-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSequenceOpen(false)} disabled={actionLoading}>Cancelar</Button>
            <Button onClick={saveSequence} disabled={actionLoading || sequenceIds.length < 2}>
              {actionLoading ? "Salvando..." : `Salvar sequência (${sequenceIds.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
