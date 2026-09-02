import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEMCAS — Avaliações e Consultas",
  description: "Plataforma de avaliações, consultas e votações em eventos da SEMCAS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
