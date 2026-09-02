"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Check, RefreshCw } from "lucide-react";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAccessCode } from "@/lib/utils/format";

interface EventSettings {
  title: string;
  slug: string;
  requireLiveCode: boolean;
  isTest: boolean;
}

export default function EventConfiguracoesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<EventSettings | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!event) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <AdminShell eventId={eventId} eventSlug={event.slug} eventTitle={event.title}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Configurações do evento</h1>
        <p className="text-sm text-gray-500 mt-1">{event.title}</p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Link & QR */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Acesso ao evento</h2>

          <p className="text-xs text-gray-500 mb-1">Link público</p>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-md px-3 py-2 truncate">
              {eventUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR Code do evento" className="w-40 h-40 mx-auto" />
          )}

          <a
            href={`/print/${event.slug}`}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-sm text-[#0b3a6e] mt-4 hover:underline"
          >
            Abrir cartaz A4 para impressão
          </a>
        </div>

        {/* Access control */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Controle de entrada</h2>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Exigir código temporário</p>
              <p className="text-xs text-gray-500 mt-0.5">
                O participante precisa digitar um código exibido no projetor antes de entrar.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={event.requireLiveCode}
              aria-label="Exigir código temporário para entrar"
              disabled={savingCode}
              onClick={toggleLiveCode}
              className={`shrink-0 w-11 h-6 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                event.requireLiveCode ? "bg-[#0b3a6e]" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  event.requireLiveCode ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {event.requireLiveCode && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                O código atual é exibido na{" "}
                <a
                  href={`/projector/${event.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0b3a6e] hover:underline"
                >
                  tela do projetor
                </a>{" "}
                e gira automaticamente a cada 60 segundos.
              </p>
              <Button size="sm" variant="outline" onClick={rotateCode} disabled={rotating}>
                <RefreshCw className={`w-4 h-4 ${rotating ? "animate-spin" : ""}`} />
                Gerar novo código agora
              </Button>
              {newCode && (
                <p className="text-sm mt-2 text-gray-700">
                  Novo código: <strong>{formatAccessCode(newCode)}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
