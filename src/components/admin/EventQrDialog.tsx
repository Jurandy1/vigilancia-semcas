"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Check, Download, Printer, QrCode } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface EventQrDialogProps {
  eventSlug: string;
  eventTitle: string;
  trigger?: React.ReactNode;
}

export function EventQrDialog({ eventSlug, eventTitle, trigger }: EventQrDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [eventUrl, setEventUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/e/${eventSlug}`;
    setEventUrl(url);
    QRCode.toDataURL(url, { width: 260, margin: 2 }).then(setQrDataUrl);
  }, [eventSlug]);

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <DialogTitle className="text-lg text-white">Acesso ao evento</DialogTitle>
          <DialogDescription className="text-pretty text-blue-100">{eventTitle}</DialogDescription>
        </DialogHeader>
        </div>

        <div className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
          {qrDataUrl && (
            <div className="mx-auto mt-1 w-fit max-w-full rounded-2xl border border-[#dbe4ef] bg-white p-3 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Code do evento" className="h-auto w-48 max-w-full sm:w-56" />
            </div>
          )}

          <div>
            <p className="mb-1.5 mt-0 text-xs font-semibold uppercase tracking-wide text-[#64748b]">Link de participação</p>
            <div className="flex min-w-0 items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-[#dbe4ef] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#33415c]">
                {eventUrl}
              </code>
              <Button size="sm" variant="outline" onClick={copyLink} className="h-10 shrink-0" aria-label="Copiar link">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="w-full">
            <a href={qrDataUrl} download={`qrcode-${eventSlug}.png`}>
              <Download className="w-4 h-4" />
              Baixar QR
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/print/${eventSlug}`} target="_blank">
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
