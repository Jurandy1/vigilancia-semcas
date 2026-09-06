"use client";

import { useEffect, useState } from "react";
import { Archivo, Archivo_Narrow } from "next/font/google";
import QRCode from "qrcode";
import { CITY_NAME, ORG_SHORT } from "@/lib/branding";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

interface PrintPosterProps {
  appUrl: string;
}

/**
 * Cartaz A4 único do sistema: o QR sempre aponta para /e/atual.
 * Layout oficial SEMCAS (folha A4 de avaliação).
 */
export function PrintPoster({ appUrl }: PrintPosterProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const joinPath = `/e/${DAILY_ACTIVE_SLUG}`;
  const joinUrl = `${appUrl}${joinPath}`;
  const host = appUrl.replace(/^https?:\/\//, "");
  const displayUrl = `${host}${joinPath}`;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 560,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [joinUrl]);

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-sheet {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <main
        className={`${archivo.className} flex min-h-screen flex-col items-center justify-center bg-[#e8edf4] py-6 print:block print:bg-white print:py-0`}
      >
        <section
          className="print-sheet box-border flex w-[210mm] max-w-full flex-col items-center bg-white px-[16mm] pb-[12mm] pt-[14mm] text-center text-[#12336b] shadow-[0_8px_32px_rgba(18,51,107,0.12)] print:shadow-none"
          style={{ minHeight: "297mm" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-saoluis-brasao.png"
            alt="Brasão de São Luís"
            className="block h-auto w-[82mm]"
          />

          <div className="mt-[4mm] text-[13pt] font-medium tracking-[0.16em]">
            PREFEITURA DE
          </div>
          <div className="mt-[0.5mm] text-[28pt] font-bold leading-none tracking-[0.02em]">
            SÃO LUÍS
          </div>

          <div className="my-[4mm] h-px w-[62mm] bg-[#12336b]" />

          <div className="text-[16pt] font-bold tracking-[0.04em]">{ORG_SHORT}</div>
          <div className="mt-[1.5mm] text-[10.5pt] font-medium leading-[1.35]">
            Secretaria Municipal da Criança
            <br />e Assistência Social
          </div>

          <div className="mt-[5mm] w-full max-w-[150mm] border-y border-[#12336b] py-[4mm]">
            <div className="text-[12pt] font-semibold uppercase leading-[1.5] tracking-[0.18em]">
              COORDENAÇÃO DE PLANEJAMENTO
              <br />E VIGILÂNCIA SOCIOASSISTENCIAL
            </div>
          </div>

          <h1
            className={`${archivoNarrow.className} m-0 mt-[9mm] text-[37pt] font-bold leading-none tracking-[-0.01em]`}
          >
            PARTICIPE DA AVALIAÇÃO
          </h1>

          <div className="mt-[5mm] h-[2.2mm] w-[22mm] rounded-[1mm] bg-[#f5b335]" />

          <p className="m-0 mt-[5mm] max-w-[145mm] text-[14pt] font-normal leading-[1.4]">
            Aponte a câmera do seu celular para o QR Code
            <br />e acesse o evento em andamento.
          </p>

          <div className="mt-[7mm] flex h-[78mm] w-[78mm] items-center justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR Code para ${displayUrl}`}
                className="h-full w-full"
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-[#e8edf9]" aria-hidden />
            )}
          </div>

          <div className="mt-[6mm] text-[12.5pt] font-normal">Ou acesse:</div>

          <div className="mt-[2.5mm] rounded-[3mm] bg-[#e8edf9] px-[8mm] py-[4mm]">
            <div className="text-[16pt] font-bold tracking-[-0.01em]">{displayUrl}</div>
          </div>

          <div className="min-h-[8mm] flex-1" />

          <div className="h-px w-full max-w-[150mm] bg-[#12336b]" />

          <p className="m-0 mt-[4mm] max-w-[150mm] text-[9pt] font-medium uppercase leading-[1.35] tracking-[0.06em]">
            Planejamento, informação e direitos por uma assistência social mais
            forte.
          </p>
        </section>

        <button
          type="button"
          className="no-print mt-6 rounded-md border border-[#12336b]/30 bg-white px-6 py-2 text-sm text-[#12336b]"
          onClick={() => window.print()}
        >
          Imprimir A4
        </button>

        <p className="no-print mt-2 max-w-md px-4 text-center text-xs text-[#5b6b7f]">
          {CITY_NAME} · QR fixo do sistema ({joinPath})
        </p>
      </main>
    </>
  );
}
