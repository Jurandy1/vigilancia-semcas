import type { ReactNode } from "react";
import { Archivo, Barlow } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export default function ProjectorLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${archivo.variable} ${barlow.variable}`} style={{ height: "100%" }}>
      <style>{`
        @keyframes semcasPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .3; transform: scale(.82); }
        }
        .projector-root {
          font-family: var(--font-barlow), "Segoe UI", system-ui, sans-serif;
        }
        .projector-root h1,
        .projector-root [data-display-font] {
          font-family: var(--font-archivo), "Segoe UI", system-ui, sans-serif;
        }
      `}</style>
      {children}
    </div>
  );
}
