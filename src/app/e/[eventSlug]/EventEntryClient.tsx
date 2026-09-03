"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ParticipantShell } from "@/components/participant/ParticipantShell";
import { useAppCheck } from "@/hooks/use-app-check";
import { apiFetch } from "@/lib/api-client";
import { useParticipantStore } from "@/stores/participant-store";
import { Skeleton } from "@/components/ui/skeleton";

interface EventEntryClientProps {
  event: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    status: string;
    requireLiveCode: boolean;
  };
}

export function EventEntryClient({ event }: EventEntryClientProps) {
  useAppCheck();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { setEvent, setParticipant } = useParticipantStore();

  useEffect(() => {
    setEvent(event.id, event.slug);

    async function checkSession() {
      try {
        const res = await apiFetch(`/api/events/${event.slug}/session`);
        const data = await res.json();

        if (data.session) {
          setParticipant(data.session.participantId, data.session.mode, data.session.name);

          if (data.session.currentOpenRoundId) {
            const roundStatus = data.session.participantRounds?.find(
              (pr: { roundId: string }) => pr.roundId === data.session.currentOpenRoundId
            );

            if (roundStatus?.status === "completed") {
              router.replace(`/e/${event.slug}/aguarde`);
              return;
            }
            router.replace(`/e/${event.slug}/rodada/${data.session.currentOpenRoundId}`);
            return;
          }

          router.replace(`/e/${event.slug}/aguarde`);
          return;
        }
      } catch {
        // continue to entry
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [event, router, setEvent, setParticipant]);

  if (loading) {
    return (
      <ParticipantShell eventTitle={event.title}>
        <div className="p-6 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </ParticipantShell>
    );
  }

  if (event.requireLiveCode) {
    router.replace(`/e/${event.slug}/codigo`);
    return null;
  }

  const isDevMock = process.env.NEXT_PUBLIC_USE_DEV_MOCK === "true";

  return (
    <ParticipantShell eventTitle={event.title}>
      <section aria-label="Entrada" className="flex-1 flex flex-col p-6">
        {isDevMock && (
          <div className="mb-4 rounded-md bg-[#fdf5e3] border border-[#f0dfae] px-3 py-2 text-xs text-[#8a5a00]">
            Modo desenvolvimento local — dados simulados
          </div>
        )}
        <h2 className="m-0 text-xl font-bold leading-snug text-pretty text-[#1a1a1a]">
          {event.title}
        </h2>
        <p className="mt-3.5 mb-0 text-[15px] text-[#5b6b7f]">Como deseja participar?</p>

        <div className="flex flex-col gap-3 mt-5">
          <button
            type="button"
            onClick={() => router.push(`/e/${event.slug}/participar?mode=identified`)}
            className="text-left bg-white border border-[#c9d4e2] rounded-lg p-4 min-h-16 hover:border-[#0b3a6e] hover:bg-[#f7f9fc]"
          >
            <span className="block text-base font-semibold text-[#1a1a1a]">
              Responder com identificação
            </span>
            <span className="block text-[13px] text-[#5b6b7f] mt-1">
              Informarei meu nome completo
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push(`/e/${event.slug}/participar?mode=anonymous`)}
            className="text-left bg-white border border-[#c9d4e2] rounded-lg p-4 min-h-16 hover:border-[#0b3a6e] hover:bg-[#f7f9fc]"
          >
            <span className="block text-base font-semibold text-[#1a1a1a]">
              Responder anonimamente
            </span>
            <span className="block text-[13px] text-[#5b6b7f] mt-1">
              Meu nome não será coletado
            </span>
          </button>
        </div>

        <p className="mt-auto mb-0 pt-6 text-xs text-[#8a97a8] leading-relaxed">
          Você entrou pelo QR Code do evento — não é preciso código nem cadastro. As respostas só
          são enviadas quando você confirmar.
        </p>
      </section>
    </ParticipantShell>
  );
}
