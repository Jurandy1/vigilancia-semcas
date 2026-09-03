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
  MoreVertical,
  ListOrdered,
  Plus,
  Printer,
  QrCode,
  Settings,
  Trash2,
  UsersRound,
  XCircle,
} from "lucide-react";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
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
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [sequenceIds, setSequenceIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequenceQueryHandled = useRef(false);

  const load = useCallback(async () => {
    const token = await getAdminIdToken();
    if (!token) return;
    const res = await adminFetch("/api/admin/events", token);
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

  function openSequenceManager() {
    const existingSequenceId = events.find((event) => event.sequenceId)?.sequenceId;
    const existing = events
      .filter((event) => event.sequenceId === existingSequenceId)
      .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
    setSequenceIds(existing.map((event) => event.id));
    setError(null);
    setSequenceOpen(true);
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

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: "todos", label: "Todos" },
    { key: "open", label: "Em andamento" },
    { key: "waiting", label: "Aguardando" },
    { key: "closed", label: "Encerrados" },
  ];

  return (
    <AdminShell screenLabel="Eventos">
      <section aria-label="Eventos" className="w-full max-w-[1180px]">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-[0.12em] text-[#18754a]">
              Painel administrativo
            </p>
            <h1 className="admin-page-title m-0">Eventos</h1>
            <p className="mt-2 mb-0 text-sm text-[#64748b] max-w-[56ch]">
              Gerencie avaliações, consultas e atividades participativas da SEMCAS.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild variant="outline" className="h-11 gap-2 rounded-xl border-[#b9c9d9] bg-white px-4 text-sm font-semibold text-[#0b4a83]">
              <Link href="/admin/eventos/sequencia"><ListOrdered className="h-4 w-4" /> Organizar sequência</Link>
            </Button>
            <Button asChild className="h-11 gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm">
              <Link href="/admin/eventos/novo"><Plus className="h-4 w-4" /> Criar evento</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 max-w-3xl text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div
          role="tablist"
          aria-label="Filtrar eventos"
          className="mb-5 flex gap-1.5 overflow-x-auto rounded-xl border border-[#dbe4ef] bg-white p-1.5 shadow-sm"
        >
          {filters.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-lg px-3.5 py-2 text-[13.5px] transition-colors",
                  selected
                    ? "bg-[#eaf2fa] text-[#0b4a83] font-semibold"
                    : "text-[#64748b] hover:bg-[#f4f7fb] hover:text-[#0b4a83]"
                )}
              >
                {f.label}
                <span className="text-[#8a97a8] font-medium"> {counts[f.key]}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-card flex min-h-52 flex-col items-center justify-center px-5 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#edf3f8] text-[#6c8199]">
              <QrCode className="h-5 w-5" />
            </span>
            <p className="m-0 text-sm font-semibold text-[#33415c]">Nenhum evento neste filtro</p>
            <p className="mb-0 mt-1 text-sm text-[#7b8ba0]">Escolha outro filtro ou crie um novo evento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filtered.map((event) => (
              <div
                key={event.id}
                className="admin-card group flex min-w-0 flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#b8cadc] hover:shadow-[0_10px_30px_rgba(15,35,59,.08)] sm:p-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="m-0 text-lg font-semibold leading-snug text-[#11243c]">{event.title}</h2>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-semibold rounded px-2 py-0.5 border",
                        event.status === "open"
                          ? "text-[#1a7f4b] bg-[#e8f5ee] border-[#c3e4d1]"
                          : "text-[#5b6b7f] bg-[#f4f6f9] border-[#dde4ee]"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          event.status === "open" ? "bg-[#1a7f4b]" : "bg-[#8a97a8]"
                        )}
                      />
                      {statusLabel[event.status] ?? event.status}
                    </span>
                    {event.isTest && (
                      <span className="text-[11.5px] font-semibold tracking-wide uppercase text-[#8a5a00] bg-[#fdf5e3] border border-[#f0dfae] rounded px-1.5 py-0.5">
                        Evento de teste
                      </span>
                    )}
                    {event.sequenceId && event.sequenceOrder !== null && (
                      <span className="rounded-full border border-[#b9d5ed] bg-[#edf6fd] px-2.5 py-1 text-xs font-semibold text-[#0b4a83]">
                        Sequência {event.sequenceOrder + 1} de {event.sequenceSize}
                      </span>
                    )}
                  </div>
                  {event.currentRoundTitle && (
                    <p className="mb-0 mt-3 truncate text-[13px] text-[#64748b]">
                      Rodada atual: <strong className="font-semibold text-[#33415c]">{event.currentRoundTitle}</strong>
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f9fc] p-3">
                    <div className="flex items-center gap-2.5 text-[13px] text-[#5b6b7f]">
                      <UsersRound className="h-4 w-4 text-[#0b4a83]" />
                      <span><strong className="text-[#11243c]">{event.participantCount}</strong> participantes</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[13px] text-[#5b6b7f]">
                      <MessageSquareText className="h-4 w-4 text-[#18754a]" />
                      <span><strong className="text-[#11243c]">{event.submissionCount}</strong> respostas</span>
                    </div>
                  </div>
                  <div className="hidden flex-wrap gap-x-5 gap-y-1.5 mt-2 text-[13px] text-[#5b6b7f]">
                    {event.currentRoundTitle && (
                      <span>
                        Rodada atual:{" "}
                        <strong className="text-[#33415c] font-semibold">
                          {event.currentRoundTitle}
                        </strong>
                      </span>
                    )}
                    <span>{event.participantCount} participantes</span>
                    <span>{event.submissionCount} respostas</span>
                  </div>
                  <p className="mt-3 mb-0 truncate text-xs text-[#8a97a8] font-mono">
                    /e/{event.sequenceRootSlug ?? event.slug}
                    {event.sequenceId ? " · QR compartilhado" : ""}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-[#e8eef5] pt-4">
                  <Button asChild variant="outline" className="h-10 flex-1 gap-2 rounded-lg border-[#b9c9d9] px-3 text-[13.5px] font-semibold text-[#0b4a83]">
                    <Link href={`/admin/eventos/${event.id}/perguntas`}>
                      <MessageSquareText className="h-4 w-4" /> Editar perguntas
                    </Link>
                  </Button>
                  <Button asChild className="h-10 flex-1 gap-2 rounded-lg px-4 text-[13.5px] font-semibold">
                    <Link href={`/admin/eventos/${event.id}`}>Abrir evento <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-[38px] h-[38px] border border-[#dde4ee] bg-white rounded-md text-[#5b6b7f] hover:bg-[#f4f6f9] hover:text-[#0b3a6e]"
                        aria-label="Mais ações do evento"
                      >
                        <MoreVertical className="w-4 h-4 mx-auto" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/eventos/${event.id}/ao-vivo`}>Ir para sessão ao vivo</Link>
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
                        <Link href={`/admin/eventos/${event.id}/configuracoes`}>
                          <Settings className="w-4 h-4" />
                          Configurar
                        </Link>
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
              </div>
            ))}
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
