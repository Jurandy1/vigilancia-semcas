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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acesso ao evento</DialogTitle>
          <DialogDescription className="text-pretty">{eventTitle}</DialogDescription>
        </DialogHeader>

        {qrDataUrl && (
          <div className="mx-auto w-fit rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR Code do evento" className="w-52 h-52" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 text-xs bg-gray-50 border border-gray-200 rounded-md px-3 py-2 truncate">
            {eventUrl}
          </code>
          <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <a href={qrDataUrl} download={`qrcode-${eventSlug}.png`}>
              <Download className="w-4 h-4" />
              Baixar QR
            </a>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/print/${eventSlug}`} target="_blank">
              <Printer className="w-4 h-4" />
              Imprimir A4
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
