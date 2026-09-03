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
  sequenceRootSlug: string | null;
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
  const [savingIsTest, setSavingIsTest] = useState(false);

  const eventUrl =
    typeof window !== "undefined" && event
      ? `${window.location.origin}/e/${event.sequenceRootSlug ?? event.slug}`
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

  async function toggleIsTest() {
    if (!event || savingIsTest) return;
    setGeneralError(null);
    setSavingIsTest(true);
    const next = !event.isTest;
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ isTest: next }),
      });
      if (!res.ok) throw new Error();
      setEvent({ ...event, isTest: next });
    } catch {
      setGeneralError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setSavingIsTest(false);
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
      <section aria-label="Configurações do evento" style={{ maxWidth: "1000px" }}>
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.01em", color: "#1a1a1a" }}>
          Configurações do evento
        </h1>
        <p style={{ marginTop: "6px", marginBottom: 0, fontSize: "14px", color: "#5b6b7f" }}>{event.title}</p>

        {error && (
          <div style={{ marginTop: "16px", fontSize: "14px", color: "#b42318", background: "#fdf2f1", border: "1px solid #e3b3ad", borderRadius: "6px", padding: "8px 12px" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @media (min-width: 768px) {
              .config-grid { grid-template-columns: 200px minmax(0, 1fr) !important; }
            }
          `}} />
          <div className="config-grid" style={{ display: "grid", gap: "20px", gridTemplateColumns: "1fr" }}>
            <nav aria-label="Seções de configuração" style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
              {tabs.map((t) => {
                const selected = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-current={selected ? "page" : undefined}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      backgroundColor: selected ? "#eef3f9" : "transparent",
                      color: selected ? "#0b3a6e" : "#5b6b7f",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseOver={(e) => {
                      if (!selected) {
                        e.currentTarget.style.backgroundColor = "#fff";
                        e.currentTarget.style.color = "#0b3a6e";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!selected) {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#5b6b7f";
                      }
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>

            <div style={{ backgroundColor: "#fff", border: "1px solid #dde4ee", borderRadius: "8px", padding: "22px", minWidth: 0 }}>
              {tab === "geral" && (
                <form onSubmit={saveGeneral}>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>Geral</h2>
                  <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#8a97a8" }}>
                    Identificação do evento no sistema e no telão.
                  </p>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
                    Título
                  </label>
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    required
                    style={{ width: "100%", height: "42px", border: "1px solid #c9d4e2", borderRadius: "6px", padding: "0 12px", fontSize: "14px" }}
                  />
                  <label style={{ display: "block", marginTop: "16px", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
                    Descrição
                  </label>
                  <textarea
                    rows={3}
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    style={{ width: "100%", border: "1px solid #c9d4e2", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", resize: "vertical" }}
                  />
                  <label style={{ display: "block", marginTop: "16px", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
                    Título para o projetor
                  </label>
                  <input
                    value={projectorTitleDraft}
                    onChange={(e) => setProjectorTitleDraft(e.target.value)}
                    placeholder="Usa o título do evento se vazio"
                    style={{ width: "100%", height: "42px", border: "1px solid #c9d4e2", borderRadius: "6px", padding: "0 12px", fontSize: "14px" }}
                  />
                  {generalError && <p style={{ marginTop: "12px", fontSize: "14px", color: "#b42318" }}>{generalError}</p>}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px" }}>
                    <button
                      type="submit"
                      disabled={savingGeneral}
                      style={{ height: "40px", padding: "0 18px", fontSize: "14px", fontWeight: 600, backgroundColor: "#0b3a6e", color: "#fff", borderRadius: "6px", border: "none", cursor: savingGeneral ? "not-allowed" : "pointer", opacity: savingGeneral ? 0.6 : 1 }}
                    >
                      {savingGeneral ? "Salvando..." : "Salvar"}
                    </button>
                    {generalSaved && (
                      <span style={{ fontSize: "12.5px", color: "#1a7f4b" }}>Salvo agora há pouco</span>
                    )}
                  </div>

                  <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #eef1f5", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Marcar como evento de teste</p>
                      <p style={{ marginTop: "4px", marginBottom: 0, fontSize: "13px", color: "#5b6b7f", lineHeight: 1.5 }}>
                        Eventos de teste ficam identificados com o rótulo &quot;Teste&quot; na lista de eventos.
                        Desmarque se este evento passou a ser real.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={event.isTest}
                      disabled={savingIsTest}
                      onClick={toggleIsTest}
                      style={{ flexShrink: 0, width: "44px", height: "24px", borderRadius: "99px", position: "relative", border: "none", cursor: savingIsTest ? "not-allowed" : "pointer", opacity: savingIsTest ? 0.5 : 1, backgroundColor: event.isTest ? "#0b3a6e" : "#dde4ee", transition: "background-color 0.2s" }}
                    >
                      <span
                        style={{ position: "absolute", top: "2px", left: event.isTest ? "22px" : "2px", width: "20px", height: "20px", backgroundColor: "#fff", borderRadius: "99px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "left 0.2s" }}
                      />
                    </button>
                  </div>
                </form>
              )}

              {tab === "participacao" && (
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>Participação</h2>
                  <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#8a97a8" }}>
                    Como as pessoas entram e respondem.
                  </p>
                  <div style={{ border: "1px solid #dde4ee", borderRadius: "6px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Modo de participação</p>
                    <p style={{ marginTop: "6px", marginBottom: 0, fontSize: "13px", color: "#5b6b7f", lineHeight: 1.5 }}>
                      O participante escolhe entre <strong>identificado</strong> (informa o nome) e{" "}
                      <strong>anônimo</strong> na entrada do evento. Este comportamento é padrão do
                      sistema.
                    </p>
                  </div>
                </div>
              )}

              {tab === "acesso" && (
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>Acesso</h2>
                  <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#8a97a8" }}>
                    Link público, QR Code e cartaz impresso.
                  </p>
                  <p style={{ margin: "0 0 6px 0", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>Link público</p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <code style={{ flex: 1, minWidth: "220px", backgroundColor: "#f7f9fc", border: "1px solid #dde4ee", borderRadius: "6px", padding: "10px 12px", fontSize: "12.5px", color: "#33415c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {eventUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyLink}
                      style={{ height: "40px", padding: "0 14px", fontSize: "13.5px", fontWeight: 600, color: "#0b3a6e", backgroundColor: "transparent", border: "1px solid #c9d4e2", borderRadius: "6px", cursor: "pointer" }}
                    >
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "20px", flexWrap: "wrap" }}>
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        style={{ width: "160px", border: "1px solid #dde4ee", borderRadius: "8px", padding: "10px", backgroundColor: "#fff" }}
                      />
                    )}
                    <div>
                      <EventQrDialog
                        eventSlug={event.sequenceRootSlug ?? event.slug}
                        eventTitle={event.title}
                        trigger={
                          <button
                            type="button"
                            style={{ height: "38px", padding: "0 14px", fontSize: "13.5px", fontWeight: 600, color: "#0b3a6e", backgroundColor: "transparent", border: "1px solid #c9d4e2", borderRadius: "6px", cursor: "pointer" }}
                          >
                            Abrir painel de acesso
                          </button>
                        }
                      />
                      <p style={{ marginTop: "10px", marginBottom: 0, fontSize: "12.5px", color: "#8a97a8", lineHeight: 1.5 }}>
                        O cartaz A4 fica em{" "}
                        <code style={{ fontSize: "12px" }}>/print/{event.sequenceRootSlug ?? event.slug}</code>.
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #eef1f5" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Exigir código temporário</p>
                        <p style={{ marginTop: "4px", marginBottom: 0, fontSize: "13px", color: "#5b6b7f", lineHeight: 1.5 }}>
                          O participante digita um código exibido no projetor antes de entrar.
                        </p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={event.requireLiveCode}
                        disabled={savingCode}
                        onClick={toggleLiveCode}
                        style={{ flexShrink: 0, width: "44px", height: "24px", borderRadius: "99px", position: "relative", border: "none", cursor: savingCode ? "not-allowed" : "pointer", opacity: savingCode ? 0.5 : 1, backgroundColor: event.requireLiveCode ? "#0b3a6e" : "#dde4ee", transition: "background-color 0.2s" }}
                      >
                        <span
                          style={{ position: "absolute", top: "2px", left: event.requireLiveCode ? "22px" : "2px", width: "20px", height: "20px", backgroundColor: "#fff", borderRadius: "99px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "left 0.2s" }}
                        />
                      </button>
                    </div>
                    {event.requireLiveCode && (
                      <div style={{ marginTop: "16px" }}>
                        <button
                          type="button"
                          onClick={rotateCode}
                          disabled={rotating}
                          style={{ height: "38px", padding: "0 14px", fontSize: "13.5px", fontWeight: 600, color: "#0b3a6e", backgroundColor: "transparent", border: "1px solid #c9d4e2", borderRadius: "6px", cursor: rotating ? "not-allowed" : "pointer", opacity: rotating ? 0.6 : 1 }}
                        >
                          {rotating ? "Gerando..." : "Gerar novo código agora"}
                        </button>
                        {newCode && (
                          <p style={{ marginTop: "8px", fontSize: "14px", color: "#33415c" }}>
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
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>Projetor</h2>
                  <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#8a97a8" }}>
                    O que aparece no telão do evento.
                  </p>
                  <div style={{ border: "1px solid #dde4ee", borderRadius: "6px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Conteúdo exibido</p>
                    <ul style={{ marginTop: "10px", marginBottom: 0, paddingLeft: "20px", fontSize: "13.5px", color: "#5b6b7f", lineHeight: 1.5, listStyleType: "disc" }}>
                      <li>Entrada: QR Code e link do evento</li>
                      <li>Votação em andamento: participantes até agora e quantos finalizaram</li>
                      <li>Intervalo: aviso de próxima atividade</li>
                    </ul>
                    <p style={{ marginTop: "12px", marginBottom: 0, fontSize: "13px", color: "#33415c", lineHeight: 1.5 }}>
                      Perguntas e resultados <strong>não</strong> aparecem no telão — ficam restritos
                      ao administrativo e ao relatório.
                    </p>
                  </div>
                  <Link
                    href={`/projector/${event.sequenceRootSlug ?? event.slug}`}
                    target="_blank"
                    style={{ display: "inline-flex", alignItems: "center", marginTop: "16px", height: "38px", padding: "0 14px", fontSize: "13.5px", fontWeight: 600, color: "#0b3a6e", border: "1px solid #c9d4e2", borderRadius: "6px", textDecoration: "none" }}
                  >
                    Abrir tela do projetor
                  </Link>
                </div>
              )}

              {tab === "seguranca" && (
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>Segurança</h2>
                  <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#8a97a8" }}>
                    Controle de entrada e encerramento.
                  </p>
                  <div style={{ border: "1px solid #dde4ee", borderRadius: "6px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Entrada pelo link do evento</p>
                    <p style={{ marginTop: "6px", marginBottom: 0, fontSize: "13px", color: "#5b6b7f", lineHeight: 1.5 }}>
                      Quem tem o QR Code ou o link entra na enquete. O acesso deixa de funcionar quando
                      o evento é encerrado.
                    </p>
                  </div>

                  <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid #eef1f5" }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#b42318" }}>
                      Ação irreversível
                    </p>
                    <div style={{ marginTop: "10px", border: "1px solid #e3b3ad", backgroundColor: "#fdf7f6", borderRadius: "6px", padding: "16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#33415c" }}>Encerrar evento</p>
                        <p style={{ marginTop: "6px", marginBottom: 0, fontSize: "13px", color: "#5b6b7f", lineHeight: 1.5 }}>
                          Todas as rodadas serão consideradas encerradas e novas respostas não serão
                          aceitas.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={event.status === "closed"}
                        onClick={() => setClosing(true)}
                        style={{ height: "38px", padding: "0 14px", fontSize: "13.5px", fontWeight: 600, backgroundColor: "#b42318", color: "#fff", border: "none", borderRadius: "6px", cursor: event.status === "closed" ? "not-allowed" : "pointer", opacity: event.status === "closed" ? 0.5 : 1, flexShrink: 0 }}
                      >
                        {event.status === "closed" ? "Evento encerrado" : "Encerrar evento"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
