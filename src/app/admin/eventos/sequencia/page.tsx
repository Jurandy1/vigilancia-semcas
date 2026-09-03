"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ListOrdered } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/api-client";
import { getAdminIdToken, onAdminAuthChange } from "@/lib/supabase/auth-client";

interface EventItem {
  id: string;
  title: string;
  status: string;
  sequenceId: string | null;
  sequenceOrder: number | null;
  sequenceSize: number | null;
}

export default function EventSequencePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const token = await getAdminIdToken();
    if (!token) return;
    const response = await adminFetch("/api/admin/events", token);
    const data = await response.json();
    const loaded = (data.events ?? []) as EventItem[];
    setEvents(loaded);

    const activeSequenceId = loaded.find((event) => event.sequenceId)?.sequenceId;
    const sequenced = loaded
      .filter((event) => event.sequenceId === activeSequenceId)
      .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
    const available = loaded.filter(
      (event) => event.status === "draft" || event.status === "waiting"
    );
    setOrderedIds((sequenced.length > 0 ? sequenced : available).map((event) => event.id));
    setLoading(false);
  }, []);

  useEffect(() => {
    return onAdminAuthChange((user) => {
      if (user) void load();
    });
  }, [load]);

  const orderedEvents = useMemo(
    () => orderedIds.map((id) => events.find((event) => event.id === id)).filter(Boolean) as EventItem[],
    [events, orderedIds]
  );

  function move(eventId: string, direction: -1 | 1) {
    setSaved(false);
    setOrderedIds((current) => {
      const index = current.indexOf(eventId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  async function save() {
    if (orderedIds.length < 2) {
      setError("A sequência precisa ter pelo menos dois eventos.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const response = await adminFetch("/api/admin/events/sequence", token, {
        method: "POST",
        body: JSON.stringify({ eventIds: orderedIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível salvar a sequência.");
        return;
      }
      setSaved(true);
      await load();
    } catch {
      setError("Não foi possível salvar a sequência.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell screenLabel="Sequência de eventos">
      <section aria-label="Sequência de eventos" className="w-full max-w-[980px]">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-[0.12em] text-[#18754a]">
              Ordem de realização
            </p>
            <h1 className="admin-page-title m-0">Sequência de eventos</h1>
            <p className="mb-0 mt-2 max-w-[65ch] text-sm leading-relaxed text-[#64748b]">
              Defina qual evento começa primeiro. Ao avançar, o mesmo QR Code passa a direcionar os participantes para o próximo evento.
            </p>
          </div>
          <Button asChild variant="outline" className="h-10 shrink-0 gap-2 rounded-xl">
            <Link href="/admin/eventos"><ArrowLeft className="h-4 w-4" /> Voltar aos eventos</Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div>
        ) : (
          <div className="admin-card overflow-hidden">
            <div className="border-b border-[#e3eaf2] bg-[#f8fafc] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0b4a83]">
                <ListOrdered className="h-4 w-4" /> {orderedEvents.length} eventos na sequência
              </div>
            </div>

            <div className="space-y-0 px-4 py-3 sm:px-6 sm:py-4">
              {orderedEvents.map((event, index) => (
                <div key={event.id}>
                  <article className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#dbe4ef] bg-white p-4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0b4a83] text-lg font-bold text-white sm:h-14 sm:w-14">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#18754a]">
                        {index === 0 ? "Começa primeiro" : index === orderedEvents.length - 1 ? "Último evento" : "Próximo evento"}
                      </p>
                      <h2 className="mb-0 mt-1 text-base font-semibold leading-snug text-[#11243c] sm:text-lg">
                        {event.title}
                      </h2>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:flex-row">
                      <button type="button" onClick={() => move(event.id, -1)} disabled={index === 0} aria-label={`Mover ${event.title} para cima`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#cbd7e4] bg-white text-[#0b4a83] hover:bg-[#edf4fa] disabled:opacity-25">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => move(event.id, 1)} disabled={index === orderedEvents.length - 1} aria-label={`Mover ${event.title} para baixo`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#cbd7e4] bg-white text-[#0b4a83] hover:bg-[#edf4fa] disabled:opacity-25">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                  {index < orderedEvents.length - 1 && (
                    <div className="flex h-10 items-center justify-center text-[#7a91aa]" aria-hidden>
                      <ArrowRight className="h-5 w-5 rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-[#e3eaf2] bg-[#f8fafc] px-5 py-4 sm:px-6">
              {error && <p className="mb-3 mt-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {saved && (
                <p className="mb-3 mt-0 flex items-center gap-2 rounded-lg border border-[#bfe2cf] bg-[#edf8f2] px-3 py-2 text-sm font-semibold text-[#18754a]">
                  <CheckCircle2 className="h-4 w-4" /> Sequência salva com sucesso.
                </p>
              )}
              <div className="flex justify-end">
                <Button onClick={save} disabled={saving || orderedEvents.length < 2} className="h-11 rounded-xl px-6">
                  {saving ? "Salvando..." : "Salvar ordem dos eventos"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
