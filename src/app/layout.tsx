import type { Metadata } from "next";
import { ORG_SHORT } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: `${ORG_SHORT} — Avaliações e Consultas`,
  description: `Plataforma de avaliações, consultas e votações em eventos da ${ORG_SHORT}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
