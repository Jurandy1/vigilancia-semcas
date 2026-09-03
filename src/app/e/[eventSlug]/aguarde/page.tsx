"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ParticipantShell } from "@/components/participant/ParticipantShell";
import { useAppCheck } from "@/hooks/use-app-check";
import { usePublicEvent } from "@/hooks/use-public-event";
import { apiFetch } from "@/lib/api-client";
import { useParticipantStore } from "@/stores/participant-store";
import { Skeleton } from "@/components/ui/skeleton";

export default function AguardePage() {
  useAppCheck();
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;
  const { eventId } = useParticipantStore();
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(eventId);
  const [newRoundAvailable, setNewRoundAvailable] = useState(false);
  const [newRoundId, setNewRoundId] = useState<string | null>(null);

  const { publicEvent, loading } = usePublicEvent(resolvedEventId, eventSlug);

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
    if (!publicEvent?.currentOpenRoundId) return;
    if (publicEvent.currentRoundStatus !== "open") return;

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
      }
    }

    checkRoundStatus();
  }, [publicEvent, eventSlug]);

  if (loading) {
    return (
      <ParticipantShell eventTitle={publicEvent?.title}>
        <div className="p-6 space-y-4">
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
          className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8"
        >
          <span
            aria-hidden
            className="w-14 h-14 rounded-full bg-[#eef3f9] border border-[#d6e0ec] text-[#0b3a6e] text-[26px] flex items-center justify-center"
          >
            ⏳
          </span>
          <h2 className="mt-5 mb-0 text-xl font-bold text-[#1a1a1a]">Você entrou no evento</h2>
          <p className="mt-2.5 mb-0 text-[15px] text-[#5b6b7f]">
            Aguarde o organizador iniciar a primeira atividade.
          </p>
          <p className="mt-[26px] mb-0 inline-flex items-center gap-2 text-[13px] text-[#8a97a8]">
            <span className="w-2 h-2 rounded-full bg-[#8a97a8] animate-pulse" />
            Esta tela atualiza sozinha quando a atividade abrir
          </p>
        </section>
      </ParticipantShell>
    );
  }

  if (newRoundAvailable && newRoundId) {
    return (
      <ParticipantShell eventTitle={publicEvent?.title}>
        <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8">
          <h2 className="m-0 text-xl font-bold text-[#1a1a1a]">Nova etapa disponível</h2>
          <p className="mt-2.5 mb-0 text-[15px] text-[#5b6b7f]">
            {publicEvent?.currentRoundTitle
              ? `Uma nova atividade foi aberta: ${publicEvent.currentRoundTitle}`
              : "Uma nova atividade foi aberta."}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/e/${eventSlug}/rodada/${newRoundId}`)}
            className="mt-8 h-[52px] px-6 bg-[#0b3a6e] text-white rounded-lg text-base font-semibold hover:bg-[#0d4a8a]"
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
        className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8"
      >
        <span
          aria-hidden
          className="w-14 h-14 rounded-full bg-[#eef3f9] border border-[#d6e0ec] text-[#0b3a6e] text-[26px] flex items-center justify-center"
        >
          ✓
        </span>
        <h2 className="mt-5 mb-0 text-xl font-bold text-[#1a1a1a]">Resposta enviada</h2>
        <p className="mt-2.5 mb-0 text-[15px] text-[#5b6b7f]">Obrigado pela sua participação.</p>
        <p className="mt-1.5 mb-0 text-[15px] text-[#5b6b7f]">Aguarde novas atividades.</p>
        <p className="mt-[26px] mb-0 inline-flex items-center gap-2 text-[13px] text-[#8a97a8]">
          <span className="w-2 h-2 rounded-full bg-[#8a97a8] animate-pulse" />
          Esta tela atualiza sozinha quando a próxima rodada abrir
        </p>
      </section>
    </ParticipantShell>
  );
}
