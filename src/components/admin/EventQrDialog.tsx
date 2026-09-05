"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Check, Download, Printer, QrCode, Monitor } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";

interface EventQrDialogProps {
  /** Mantido por compatibilidade; o QR sempre usa o alias fixo `atual`. */
  eventSlug?: string;
  eventTitle?: string;
  trigger?: React.ReactNode;
}

export function EventQrDialog({
  eventTitle = "QR fixo do sistema",
  trigger,
}: EventQrDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedProjector, setCopiedProjector] = useState(false);
  const [eventUrl, setEventUrl] = useState("");
  const [projectorUrl, setProjectorUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const join = `${origin}/e/${DAILY_ACTIVE_SLUG}`;
    const projector = `${origin}/projector/${DAILY_ACTIVE_SLUG}`;
    setEventUrl(join);
    setProjectorUrl(projector);
    QRCode.toDataURL(join, { width: 260, margin: 2 }).then(setQrDataUrl);
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyProjectorLink() {
    await navigator.clipboard.writeText(projectorUrl);
    setCopiedProjector(true);
    setTimeout(() => setCopiedProjector(false), 2000);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <QrCode className="w-4 h-4" />
            Ver QR Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl p-0">
        <div className="bg-[linear-gradient(135deg,#0a2d55,#0b4a83)] px-5 py-5 pr-12 text-white sm:px-6">
          <DialogHeader>
            <DialogTitle className="text-lg text-white">Acesso único do sistema</DialogTitle>
            <DialogDescription className="text-pretty text-blue-100">
              {eventTitle}. O mesmo QR serve para a sequência do dia; o projetor identifica o evento iniciado.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
          {qrDataUrl && (
            <div className="mx-auto mt-1 w-fit max-w-full rounded-2xl border border-[#dbe4ef] bg-white p-3 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Code fixo do sistema" className="h-auto w-48 max-w-full sm:w-56" />
            </div>
          )}

          <div>
            <p className="mb-1.5 mt-0 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              Link de participação (QR)
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-[#dbe4ef] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#33415c]">
                {eventUrl}
              </code>
              <Button size="sm" variant="outline" onClick={copyLink} className="h-10 shrink-0" aria-label="Copiar link">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 mt-0 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              Link do projetor (telão)
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-[#dbe4ef] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#33415c]">
                {projectorUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={copyProjectorLink}
                className="h-10 shrink-0"
                aria-label="Copiar link do projetor"
              >
                {copiedProjector ? <Check className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="w-full">
              <a href={qrDataUrl} download={`qrcode-${DAILY_ACTIVE_SLUG}.png`}>
                <Download className="w-4 h-4" />
                Baixar QR
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/print/${DAILY_ACTIVE_SLUG}`} target="_blank">
                <Printer className="w-4 h-4" />
                Imprimir A4
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
