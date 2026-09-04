"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ParticipantShell } from "@/components/participant/ParticipantShell";

export default function ConcluidoPage() {
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;

  useEffect(() => {
    // 6s dá tempo do participante ler "Resposta registrada" antes de ir para
    // a tela de espera. Antes eram 2s — o usuário relatou que mal via a
    // confirmação e já estava na próxima tela.
    const timer = setTimeout(() => {
      router.replace(`/e/${eventSlug}/aguarde`);
    }, 6000);
    return () => clearTimeout(timer);
  }, [eventSlug, router]);

  return (
    <ParticipantShell>
      <section
        aria-label="Resposta registrada"
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "26px" }}
      >
        <span aria-hidden="true" style={{ width: "64px", height: "64px", borderRadius: "99px", background: "#e8f5ee", border: "1px solid #c3e4d1", color: "#18754A", fontSize: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✓
        </span>
        <h2 style={{ margin: "20px 0 0", fontSize: "21px", fontWeight: 700, color: "#11243c" }}>Resposta registrada</h2>
        <p style={{ margin: "9px 0 0", fontSize: "14.5px", color: "#5b6b7f" }}>Obrigado por participar.</p>
        <p style={{ margin: "24px 0 0", fontSize: "12px", lineHeight: 1.6, color: "#8a97a8", maxWidth: "30ch" }}>
          SEMCAS — Secretaria Municipal da Criança e Assistência Social
        </p>
      </section>
    </ParticipantShell>
  );
}
