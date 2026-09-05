"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { SemcasBrand } from "@/components/branding/SemcasBrand";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";

interface PrintPosterProps {
  appUrl: string;
}

/**
 * Cartaz A4 único do sistema: o QR sempre aponta para /e/atual.
 * Qualquer evento (rascunho, em andamento, encerrado ou resetado) usa o mesmo
 * código; o alias "atual" resolve para o evento do dia / aberto no momento.
 * O telão fica em /projector/atual e identifica sozinho o evento iniciado.
 */
export function PrintPoster({ appUrl }: PrintPosterProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const joinPath = `/e/${DAILY_ACTIVE_SLUG}`;
  const projectorPath = `/projector/${DAILY_ACTIVE_SLUG}`;
  const host = appUrl.replace(/^https?:\/\//, "");

  useEffect(() => {
    QRCode.toDataURL(`${appUrl}${joinPath}`, { width: 320, margin: 2 }).then(setQrDataUrl);
  }, [appUrl, joinPath]);

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center p-12 print:p-8">
      <div className="max-w-md w-full text-center space-y-8">
        <SemcasBrand variant="poster" className="mx-auto" />

        <div>
          <h1 className="text-xl font-bold uppercase leading-relaxed tracking-wide">
            Avaliação ao vivo
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Um único QR para todos os eventos do sistema
          </p>
        </div>

        <p className="text-lg font-semibold uppercase tracking-widest">Participe da avaliação</p>

        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR Code fixo do sistema" className="mx-auto w-80 h-80" />
        )}

        <div className="text-sm text-gray-600 space-y-1">
          <p>Aponte a câmera do seu celular para o QR Code</p>
          <p>
            ou acesse:{" "}
            <span className="font-mono text-primary">
              {host}
              {joinPath}
            </span>
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
          <p className="font-semibold uppercase tracking-wide text-gray-700">Telão (projetor)</p>
          <p className="font-mono">
            {host}
            {projectorPath}
          </p>
          <p>O projetor identifica automaticamente o evento que estiver iniciado.</p>
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
