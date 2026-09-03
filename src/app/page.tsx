import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f4f7fb] px-5 py-8 sm:px-8">
      <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#0b3a6e_0_62%,#18754a_62%)]" />
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1080px] flex-col">
        <header className="flex items-center justify-between gap-4 py-4">
          <Image
            src="/images/logo-prefeitura-saoluis.jpg"
            alt="Prefeitura de São Luís"
            width={152}
            height={48}
            priority
            className="h-auto w-[132px] sm:w-[152px]"
          />
          <Button variant="outline" asChild className="rounded-xl border-[#cbd7e4] bg-white text-[#0b4a83]">
            <Link href="/admin/login">Área administrativa</Link>
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr] lg:py-16">
          <div>
            <p className="mb-4 mt-0 text-xs font-bold uppercase tracking-[0.14em] text-[#18754a]">
              SEMCAS · São Luís
            </p>
            <h1 className="m-0 max-w-[14ch] text-[clamp(2.2rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.045em] text-[#0c2947]">
              Sua participação transforma o evento.
            </h1>
            <p className="mb-0 mt-6 max-w-[52ch] text-base leading-relaxed text-[#5b6b7f] sm:text-lg">
              Responda avaliações e consultas da SEMCAS usando o link ou QR Code apresentado durante o encontro.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#0b3a6e,#0a4d78)] p-6 text-white shadow-[0_24px_70px_rgba(11,58,110,.22)] sm:p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[36px] border-white/[0.06]" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <ScanLine className="h-7 w-7" />
            </span>
            <h2 className="relative mb-0 mt-8 text-2xl font-semibold tracking-[-0.02em]">Como participar</h2>
            <ol className="relative mb-0 mt-5 space-y-4 p-0 list-none">
              {["Escaneie o QR Code exibido no evento", "Informe seus dados, se solicitado", "Responda e envie sua participação"].map((text, index) => (
                <li key={text} className="flex items-center gap-3.5 text-sm text-white/85 sm:text-base">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#0b4a83]">{index + 1}</span>
                  {text}
                </li>
              ))}
            </ol>
            <p className="relative mb-0 mt-7 flex items-center gap-2 border-t border-white/15 pt-5 text-sm text-white/65">
              O acesso é feito pelo endereço específico do evento <ArrowRight className="h-4 w-4" />
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
