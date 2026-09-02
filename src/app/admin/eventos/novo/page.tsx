"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Check, Download, Printer } from "lucide-react";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { slugify } from "@/lib/utils/format";
import { AdminShell } from "@/components/admin/AdminShell";

interface CreatedEvent {
  eventId: string;
  slug: string;
  title: string;
}

function EventCreatedView({ created }: { created: CreatedEvent }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [eventUrl, setEventUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/e/${created.slug}`;
    setEventUrl(url);
    QRCode.toDataURL(url, { width: 260, margin: 2 }).then(setQrDataUrl);
  }, [created.slug]);

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AdminShell eventId={created.eventId} eventTitle={created.title} eventSlug={created.slug}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Evento criado</h1>
        <p className="text-sm text-gray-500 mt-1">{created.title}</p>
      </div>

      <div className="max-w-sm bg-white border border-gray-200 rounded-lg p-5">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR Code do evento" className="w-52 h-52 mx-auto mb-4" />
        )}

        <p className="text-xs text-gray-500 mb-1">Link de participação</p>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-md px-3 py-2 truncate">
            {eventUrl}
          </code>
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <Button asChild variant="outline" className="flex-1">
            <a href={qrDataUrl} download={`qrcode-${created.slug}.png`}>
              <Download className="w-4 h-4" />
              Baixar QR
            </a>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/print/${created.slug}`} target="_blank">
              <Printer className="w-4 h-4" />
              Imprimir A4
            </Link>
          </Button>
        </div>

        <Button asChild className="w-full">
          <Link href={`/admin/eventos/${created.eventId}/rodadas/nova`}>Criar primeira rodada</Link>
        </Button>
      </div>
    </AdminShell>
  );
}

export default function NovoEventoPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectorTitle, setProjectorTitle] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [requireLiveCode, setRequireLiveCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedEvent | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const unsub = onAdminAuthChange((user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      setAuthReady(true);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const previewSlug = slugify(title) || "meu-evento";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = await getAdminIdToken();
      if (!token) throw new Error("Não autenticado.");

      const res = await adminFetch("/api/admin/events", token, {
        method: "POST",
        body: JSON.stringify({
          title,
          slug: slugify(title),
          description: description || null,
          projectorTitle: projectorTitle || null,
          isTest,
          requireLiveCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar evento.");
        return;
      }

      setCreated({ eventId: data.eventId, slug: data.slug, title });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar evento.");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return <EventCreatedView created={created} />;
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Novo evento</h1>
      </div>

      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título do evento</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <p className="text-xs text-gray-400">
              Link: {origin}/e/{previewSlug}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectorTitle">Título para o projetor</Label>
            <Input
              id="projectorTitle"
              value={projectorTitle}
              onChange={(e) => setProjectorTitle(e.target.value)}
              placeholder="Usa o título do evento se ficar em branco"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
            Evento de teste
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireLiveCode}
              onChange={(e) => setRequireLiveCode(e.target.checked)}
            />
            Exigir código temporário para entrar
          </label>

          {error && <Alert variant="destructive">{error}</Alert>}

          <Button type="submit" disabled={loading || !authReady}>
            {loading ? "Salvando..." : "Criar evento"}
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
