"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

interface PrintPosterProps {
  event: { title: string; slug: string };
  appUrl: string;
}

export function PrintPoster({ event, appUrl }: PrintPosterProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(`${appUrl}/e/${event.slug}`, { width: 320, margin: 2 }).then(setQrDataUrl);
  }, [appUrl, event.slug]);

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center p-12 print:p-8">
      <div className="max-w-md w-full text-center space-y-8">
        <Image
          src="/images/logo-prefeitura-saoluis.jpg"
          alt="Prefeitura de São Luís"
          width={280}
          height={90}
          className="mx-auto"
          priority
        />

        <div>
          <h1 className="text-xl font-bold uppercase leading-relaxed tracking-wide">
            {event.title}
          </h1>
        </div>

        <p className="text-lg font-semibold uppercase tracking-widest">Participe da avaliação</p>

        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR Code" className="mx-auto w-80 h-80" />
        )}

        <div className="text-sm text-gray-600 space-y-1">
          <p>Aponte a câmera do seu celular para o QR Code</p>
          <p>
            ou acesse:{" "}
            <span className="font-mono text-primary">
              {appUrl.replace(/^https?:\/\//, "")}/e/{event.slug}
            </span>
          </p>
        </div>
      </div>

      <button
        className="no-print mt-8 px-6 py-2 border border-gray-300 rounded-md text-sm"
        onClick={() => window.print()}
      >
        Imprimir
      </button>
    </main>
  );
}
