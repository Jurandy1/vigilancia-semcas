"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ParticipantShell } from "@/components/participant/ParticipantShell";
import { usePublicEvent } from "@/hooks/use-public-event";
import { apiFetch } from "@/lib/api-client";
import { useParticipantStore } from "@/stores/participant-store";
import { Skeleton } from "@/components/ui/skeleton";

export default function AguardePage() {
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;
  const { eventId, reset } = useParticipantStore();
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(eventId);
  const [newRoundAvailable, setNewRoundAvailable] = useState(false);
  const [newRoundId, setNewRoundId] = useState<string | null>(null);

  const { publicEvent, loading } = usePublicEvent(resolvedEventId, eventSlug);

  useEffect(() => {
    if (publicEvent?.status !== "closed" || !publicEvent.nextEventSlug) return;
    reset();
    router.replace(`/e/${publicEvent.nextEventSlug}`);
  }, [publicEvent, reset, router]);

  useEffect(() => {
    async function resolveSession() {
      try {
        const res = await apiFetch(`/api/events/${eventSlug}/session`);
        const data = await res.json();
        if (data.session?.eventId) {
          setResolvedEventId(data.session.eventId);
        }
      } catch {
        router.replace(`/e/${eventSlug}`);
      }
    }
    if (!resolvedEventId) resolveSession();
  }, [eventSlug, resolvedEventId, router]);

  useEffect(() => {
    // Se a rodada que estava "disponível" foi encerrada pelo admin, limpa o
    // botão fantasma "Responder agora" que apontaria para uma rodada morta.
    if (
      !publicEvent?.currentOpenRoundId ||
      publicEvent.currentRoundStatus !== "open"
    ) {
      setNewRoundAvailable(false);
      setNewRoundId(null);
      return;
    }

    async function checkRoundStatus() {
      const res = await apiFetch(`/api/events/${eventSlug}/session`);
      const data = await res.json();
      const pr = data.session?.participantRounds?.find(
        (r: { roundId: string; status: string }) =>
          r.roundId === publicEvent!.currentOpenRoundId
      );

      if (!pr || pr.status !== "completed") {
        setNewRoundAvailable(true);
        setNewRoundId(publicEvent!.currentOpenRoundId);
      } else {
        setNewRoundAvailable(false);
        setNewRoundId(null);
      }
    }

    checkRoundStatus();
  }, [publicEvent, eventSlug]);

  if (loading) {
    return (
      <ParticipantShell eventTitle={publicEvent?.title}>
        <div style={{ padding: "26px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-20 w-full" />
        </div>
      </ParticipantShell>
    );
  }

  if (!publicEvent?.currentOpenRoundId) {
    return (
      <ParticipantShell eventTitle={publicEvent?.title}>
        <section
          aria-label="Aguardando início do evento"
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "26px" }}
        >
          <span aria-hidden="true" style={{ width: "56px", height: "56px", borderRadius: "99px", background: "#eef3f9", border: "1px solid #d6e0ec", color: "#0B3A6E", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ⏳
          </span>
          <h2 style={{ margin: "18px 0 0", fontSize: "19px", fontWeight: 700, color: "#11243c" }}>Você entrou no evento</h2>
          <p style={{ margin: "9px 0 0", fontSize: "14.5px", color: "#5b6b7f" }}>
            Aguarde o organizador iniciar a primeira atividade.
          </p>
          <p style={{ margin: "22px 0 0", fontSize: "11.5px", color: "#8a97a8", display: "inline-flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "99px", background: "#8a97a8" }}></span>Atualiza sozinha quando a atividade abrir
          </p>
        </section>
      </ParticipantShell>
    );
  }

  if (newRoundAvailable && newRoundId) {
    return (
      <ParticipantShell eventTitle={publicEvent?.title}>
        <section style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "26px" }}>
          <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#11243c" }}>Nova etapa disponível</h2>
          <p style={{ margin: "9px 0 0", fontSize: "14.5px", color: "#5b6b7f" }}>
            {publicEvent?.currentRoundTitle
              ? `Uma nova atividade foi aberta: ${publicEvent.currentRoundTitle}`
              : "Uma nova atividade foi aberta."}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/e/${eventSlug}/rodada/${newRoundId}`)}
            style={{ marginTop: "32px", height: "52px", padding: "0 24px", background: "#0B3A6E", color: "#fff", borderRadius: "8px", fontSize: "14.5px", fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Responder agora
          </button>
        </section>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell eventTitle={publicEvent?.title}>
      <section
        aria-label="Aguardando próxima atividade"
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "26px" }}
      >
        <span aria-hidden="true" style={{ width: "56px", height: "56px", borderRadius: "99px", background: "#eef3f9", border: "1px solid #d6e0ec", color: "#0B3A6E", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✓
        </span>
        <h2 style={{ margin: "18px 0 0", fontSize: "19px", fontWeight: 700, color: "#11243c" }}>Resposta enviada</h2>
        <p style={{ margin: "9px 0 0", fontSize: "14.5px", color: "#5b6b7f" }}>Obrigado pela sua participação.</p>
        <p style={{ margin: "4px 0 0", fontSize: "14.5px", color: "#5b6b7f" }}>Aguarde novas atividades.</p>
        <p style={{ margin: "22px 0 0", fontSize: "11.5px", color: "#8a97a8", display: "inline-flex", alignItems: "center", gap: "7px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "99px", background: "#8a97a8" }}></span>Atualiza sozinha quando abrir
        </p>
      </section>
    </ParticipantShell>
  );
}
