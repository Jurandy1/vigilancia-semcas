"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreVertical, QrCode, Copy, Printer, Settings, XCircle } from "lucide-react";
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

interface EventItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  isTest: boolean;
  participantCount: number;
  submissionCount: number;
  currentRoundTitle: string | null;
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  waiting: "Aguardando",
  open: "Em andamento",
  closed: "Encerrado",
};

const statusStyle: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  waiting: "bg-gray-100 text-gray-600",
  open: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

export default function AdminEventosPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingEvent, setClosingEvent] = useState<EventItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Eventos</h1>
        <Button asChild size="sm">
          <Link href="/admin/eventos/novo">+ Novo evento</Link>
        </Button>
      </div>

      {error && (
        <div className="mb-4 max-w-3xl text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="max-w-3xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento cadastrado.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between py-4 px-5 gap-4">
                <Link
                  href={`/admin/eventos/${event.id}`}
                  className="min-w-0 flex-1 hover:opacity-80"
                >
                  <p className="font-medium text-gray-800 truncate">{event.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        statusStyle[event.status] ?? statusStyle.draft
                      }`}
                    >
                      {statusLabel[event.status] ?? event.status}
                    </span>
                    {event.isTest && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        Teste
                      </span>
                    )}
                    {event.currentRoundTitle && (
                      <span className="text-xs text-gray-500">Rodada: {event.currentRoundTitle}</span>
                    )}
                    <span className="text-xs text-gray-500">
                      {event.participantCount} participantes · {event.submissionCount} respostas
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-1 shrink-0">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/eventos/${event.id}`}>Abrir</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md"
                        aria-label="Mais ações"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <EventQrDialog
                        eventSlug={event.slug}
                        eventTitle={event.title}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <QrCode className="w-4 h-4" />
                            Ver QR Code
                          </DropdownMenuItem>
                        }
                      />
                      <DropdownMenuItem onClick={() => copyLink(event.slug)}>
                        <Copy className="w-4 h-4" />
                        Copiar link
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`/print/${event.slug}`} target="_blank" rel="noreferrer">
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </AdminShell>
  );
}
