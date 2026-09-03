"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ParticipantShell } from "@/components/participant/ParticipantShell";

export default function ConcluidoPage() {
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(`/e/${eventSlug}/aguarde`);
    }, 2000);
    return () => clearTimeout(timer);
  }, [eventSlug, router]);

  return (
    <ParticipantShell>
      <section
        aria-label="Resposta registrada"
        className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8"
      >
        <span
          aria-hidden
          className="w-16 h-16 rounded-full bg-[#e8f5ee] border border-[#c3e4d1] text-[#1a7f4b] text-[30px] flex items-center justify-center"
        >
          ✓
        </span>
        <h2 className="mt-[22px] mb-0 text-[22px] font-bold text-[#1a1a1a]">Resposta registrada</h2>
        <p className="mt-2.5 mb-0 text-[15px] text-[#5b6b7f]">Obrigado por participar.</p>
        <p className="mt-[26px] mb-0 text-[13px] text-[#8a97a8] leading-relaxed">
          SEMCAS — Secretaria Municipal da Criança e Assistência Social
        </p>
        <button
          type="button"
          onClick={() => router.replace(`/e/${eventSlug}/aguarde`)}
          className="mt-[26px] h-12 px-5 bg-white text-[#0b3a6e] border border-[#c9d4e2] rounded-lg text-[15px] font-semibold hover:bg-[#f4f6f9] hover:border-[#0b3a6e]"
        >
          Continuar
        </button>
      </section>
    </ParticipantShell>
  );
}
