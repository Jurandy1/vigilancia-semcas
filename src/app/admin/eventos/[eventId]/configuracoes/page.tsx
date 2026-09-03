"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventQrDialog } from "@/components/admin/EventQrDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAccessCode } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EventSettings {
  title: string;
  slug: string;
  status: string;
  description: string | null;
  projectorTitle: string | null;
  requireLiveCode: boolean;
  isTest: boolean;
}

type ConfigTab = "geral" | "participacao" | "acesso" | "projetor" | "seguranca";

export default function EventConfiguracoesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [tab, setTab] = useState<ConfigTab>("geral");
  const [event, setEvent] = useState<EventSettings | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [projectorTitleDraft, setProjectorTitleDraft] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);

  const eventUrl =
    typeof window !== "undefined" && event
      ? `${window.location.origin}/e/${event.slug}`
      : "";

  useEffect(() => {
    async function load() {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}`, token);
      const data = await res.json();
      setEvent(data.event);
      setTitleDraft(data.event.title ?? "");
      setDescriptionDraft(data.event.description ?? "");
      setProjectorTitleDraft(data.event.projectorTitle ?? "");
    }
    const unsub = onAdminAuthChange((user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      load();
    });
    return unsub;
  }, [eventId, router]);

  useEffect(() => {
    if (!eventUrl) return;
    QRCode.toDataURL(eventUrl, { width: 220, margin: 2 }).then(setQrDataUrl);
  }, [eventUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setGeneralError(null);
    setGeneralSaved(false);
    setSavingGeneral(true);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          title: titleDraft,
          description: descriptionDraft || null,
          projectorTitle: projectorTitleDraft || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGeneralError(data.error ?? "Não foi possível salvar as alterações.");
        return;
      }
      setEvent({
        ...event,
        title: titleDraft,
        description: descriptionDraft || null,
        projectorTitle: projectorTitleDraft || null,
      });
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 2500);
    } catch {
      setGeneralError("Não foi possível salvar as alterações.");
    } finally {
      setSavingGeneral(false);
    }
  }

  async function toggleLiveCode() {
    if (!event || savingCode) return;
    setError(null);
    setSavingCode(true);
    const next = !event.requireLiveCode;
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ requireLiveCode: next }),
      });
      if (!res.ok) throw new Error();
      setEvent({ ...event, requireLiveCode: next });
    } catch {
      setError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setSavingCode(false);
    }
  }

  async function rotateCode() {
    setRotating(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}/access-code/rotate`, token, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNewCode(data.code);
    } catch {
      setError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setRotating(false);
    }
  }

  async function closeEvent() {
    setCloseLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}/close`, token, { method: "POST" });
      if (!res.ok) throw new Error();
      setClosing(false);
      router.push("/admin/eventos");
    } catch {
      setError("Não foi possível encerrar o evento.");
    } finally {
      setCloseLoading(false);
    }
  }

  if (!event) {
    return (
      <AdminShell eventId={eventId} screenLabel="Configurações">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminShell>
    );
  }

  const tabs: Array<{ id: ConfigTab; label: string }> = [
    { id: "geral", label: "Geral" },
    { id: "participacao", label: "Participação" },
    { id: "acesso", label: "Acesso" },
    { id: "projetor", label: "Projetor" },
    { id: "seguranca", label: "Segurança" },
  ];

  return (
    <AdminShell
      eventId={eventId}
      eventSlug={event.slug}
      eventTitle={event.title}
      eventStatus={event.status}
      screenLabel="Configurações"
    >
      <section aria-label="Configurações do evento" className="max-w-[1000px]">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em] text-[#1a1a1a]">
          Configurações do evento
        </h1>
        <p className="mt-1.5 mb-0 text-sm text-[#5b6b7f]">{event.title}</p>

        {error && (
          <div className="mt-4 text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-5">
          <nav aria-label="Seções de configuração" className="flex flex-col gap-0.5 min-w-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "text-left px-3 py-2.5 rounded-md text-[13.5px] font-semibold",
                  tab === t.id
                    ? "bg-[#eef3f9] text-[#0b3a6e]"
                    : "text-[#5b6b7f] hover:bg-white hover:text-[#0b3a6e]"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="bg-white border border-[#dde4ee] rounded-lg p-[22px] min-w-0">
            {tab === "geral" && (
              <form onSubmit={saveGeneral}>
                <h2 className="m-0 mb-1 text-base font-semibold">Geral</h2>
                <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                  Identificação do evento no sistema e no telão.
                </p>
                <label className="block mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                  Título
                </label>
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  required
                  className="w-full h-[42px] border border-[#c9d4e2] rounded-md px-3 text-sm"
                />
                <label className="block mt-4 mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  className="w-full border border-[#c9d4e2] rounded-md px-3 py-2.5 text-sm resize-y"
                />
                <label className="block mt-4 mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                  Título para o projetor
                </label>
                <input
                  value={projectorTitleDraft}
                  onChange={(e) => setProjectorTitleDraft(e.target.value)}
                  placeholder="Usa o título do evento se vazio"
                  className="w-full h-[42px] border border-[#c9d4e2] rounded-md px-3 text-sm"
                />
                {generalError && <p className="mt-3 text-sm text-[#b42318]">{generalError}</p>}
                <div className="flex items-center gap-3 mt-5">
                  <button
                    type="submit"
                    disabled={savingGeneral}
                    className="h-10 px-[18px] text-sm font-semibold bg-[#0b3a6e] text-white rounded-md hover:bg-[#0d4a8a] disabled:opacity-60"
                  >
                    {savingGeneral ? "Salvando..." : "Salvar"}
                  </button>
                  {generalSaved && (
                    <span className="text-[12.5px] text-[#1a7f4b]">Salvo agora há pouco</span>
                  )}
                </div>
              </form>
            )}

            {tab === "participacao" && (
              <div>
                <h2 className="m-0 mb-1 text-base font-semibold">Participação</h2>
                <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                  Como as pessoas entram e respondem.
                </p>
                <div className="border border-[#dde4ee] rounded-md p-4">
                  <p className="m-0 text-sm font-semibold">Modo de participação</p>
                  <p className="mt-1.5 mb-0 text-[13px] text-[#5b6b7f] leading-relaxed">
                    O participante escolhe entre <strong>identificado</strong> (informa o nome) e{" "}
                    <strong>anônimo</strong> na entrada do evento. Este comportamento é padrão do
                    sistema.
                  </p>
                </div>
              </div>
            )}

            {tab === "acesso" && (
              <div>
                <h2 className="m-0 mb-1 text-base font-semibold">Acesso</h2>
                <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                  Link público, QR Code e cartaz impresso.
                </p>
                <p className="m-0 mb-1.5 text-[12.5px] font-semibold text-[#33415c]">Link público</p>
                <div className="flex gap-2 items-center flex-wrap">
                  <code className="flex-1 min-w-[220px] bg-[#f7f9fc] border border-[#dde4ee] rounded-md px-3 py-2.5 text-[12.5px] text-[#33415c] truncate">
                    {eventUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="h-10 px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9]"
                  >
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <div className="flex gap-5 items-center mt-5 flex-wrap">
                  {qrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      className="w-40 border border-[#dde4ee] rounded-lg p-2.5 bg-white"
                    />
                  )}
                  <div>
                    <EventQrDialog
                      eventSlug={event.slug}
                      eventTitle={event.title}
                      trigger={
                        <button
                          type="button"
                          className="h-[38px] px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9]"
                        >
                          Abrir painel de acesso
                        </button>
                      }
                    />
                    <p className="mt-2.5 mb-0 text-[12.5px] text-[#8a97a8] leading-relaxed">
                      O cartaz A4 fica em{" "}
                      <code className="text-xs">/print/{event.slug}</code>.
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-[#eef1f5]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="m-0 text-sm font-semibold">Exigir código temporário</p>
                      <p className="mt-1 mb-0 text-[13px] text-[#5b6b7f] leading-relaxed">
                        O participante digita um código exibido no projetor antes de entrar.
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={event.requireLiveCode}
                      disabled={savingCode}
                      onClick={toggleLiveCode}
                      className={cn(
                        "shrink-0 w-11 h-6 rounded-full relative disabled:opacity-50",
                        event.requireLiveCode ? "bg-[#0b3a6e]" : "bg-[#dde4ee]"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                          event.requireLiveCode ? "left-[22px]" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>
                  {event.requireLiveCode && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={rotateCode}
                        disabled={rotating}
                        className="h-[38px] px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] disabled:opacity-60"
                      >
                        {rotating ? "Gerando..." : "Gerar novo código agora"}
                      </button>
                      {newCode && (
                        <p className="mt-2 text-sm text-[#33415c]">
                          Novo código: <strong>{formatAccessCode(newCode)}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "projetor" && (
              <div>
                <h2 className="m-0 mb-1 text-base font-semibold">Projetor</h2>
                <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                  O que aparece no telão do evento.
                </p>
                <div className="border border-[#dde4ee] rounded-md p-4">
                  <p className="m-0 text-sm font-semibold">Conteúdo exibido</p>
                  <ul className="mt-2.5 mb-0 pl-5 text-[13.5px] text-[#5b6b7f] leading-relaxed list-disc">
                    <li>Entrada: QR Code e link do evento</li>
                    <li>Votação em andamento: participantes até agora e quantos finalizaram</li>
                    <li>Intervalo: aviso de próxima atividade</li>
                  </ul>
                  <p className="mt-3 mb-0 text-[13px] text-[#33415c] leading-relaxed">
                    Perguntas e resultados <strong>não</strong> aparecem no telão — ficam restritos
                    ao administrativo e ao relatório.
                  </p>
                </div>
                <Link
                  href={`/projector/${event.slug}`}
                  target="_blank"
                  className="inline-flex items-center mt-4 h-[38px] px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] no-underline"
                >
                  Abrir tela do projetor
                </Link>
              </div>
            )}

            {tab === "seguranca" && (
              <div>
                <h2 className="m-0 mb-1 text-base font-semibold">Segurança</h2>
                <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                  Controle de entrada e encerramento.
                </p>
                <div className="border border-[#dde4ee] rounded-md p-4">
                  <p className="m-0 text-sm font-semibold">Entrada pelo link do evento</p>
                  <p className="mt-1.5 mb-0 text-[13px] text-[#5b6b7f] leading-relaxed">
                    Quem tem o QR Code ou o link entra na enquete. O acesso deixa de funcionar quando
                    o evento é encerrado.
                  </p>
                </div>

                <div className="mt-6 pt-[18px] border-t border-[#eef1f5]">
                  <p className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#b42318]">
                    Ação irreversível
                  </p>
                  <div className="mt-2.5 border border-[#e3b3ad] bg-[#fdf7f6] rounded-md p-4 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="m-0 text-sm font-semibold text-[#33415c]">Encerrar evento</p>
                      <p className="mt-1.5 mb-0 text-[13px] text-[#5b6b7f] leading-relaxed">
                        Todas as rodadas serão consideradas encerradas e novas respostas não serão
                        aceitas.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={event.status === "closed"}
                      onClick={() => setClosing(true)}
                      className="h-[38px] px-3.5 text-[13.5px] font-semibold bg-[#b42318] text-white rounded-md hover:bg-[#98200f] disabled:opacity-50 shrink-0"
                    >
                      {event.status === "closed" ? "Evento encerrado" : "Encerrar evento"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <AlertDialog open={closing} onOpenChange={setClosing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as rodadas serão consideradas encerradas. Novas respostas não serão aceitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={closeEvent}
              disabled={closeLoading}
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
