"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";
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
      <main className="min-h-screen p-6 max-w-md mx-auto space-y-4">
        <Skeleton className="h-14 w-14 mx-auto rounded-full" />
        <Skeleton className="h-6 w-3/4 mx-auto" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (event.requireLiveCode) {
    router.replace(`/e/${event.slug}/codigo`);
    return null;
  }

  const isDevMock = process.env.NEXT_PUBLIC_USE_DEV_MOCK === "true";

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      {isDevMock && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 text-center">
          Modo desenvolvimento local — dados simulados
        </div>
      )}
      <SemcasHeader title={event.title} />

      <p className="text-center text-sm text-muted-foreground mb-8">
        Como deseja participar?
      </p>

      <div className="space-y-3">
        <Button
          variant="outline"
          size="xl"
          className="h-auto py-4 flex flex-col items-start text-left"
          onClick={() => router.push(`/e/${event.slug}/participar?mode=identified`)}
        >
          <span className="font-semibold">Responder com identificação</span>
          <span className="text-xs text-muted-foreground font-normal mt-1">
            Informarei meu nome completo
          </span>
        </Button>

        <Button
          variant="outline"
          size="xl"
          className="h-auto py-4 flex flex-col items-start text-left"
          onClick={() => router.push(`/e/${event.slug}/participar?mode=anonymous`)}
        >
          <span className="font-semibold">Responder anonimamente</span>
          <span className="text-xs text-muted-foreground font-normal mt-1">
            Meu nome não será coletado
          </span>
        </Button>
      </div>
    </main>
  );
}
