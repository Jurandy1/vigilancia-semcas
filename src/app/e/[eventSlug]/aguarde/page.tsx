"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";
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
      <main className="min-h-screen p-6 max-w-md mx-auto space-y-4">
        <Skeleton className="h-14 w-14 mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
      </main>
    );
  }

  if (newRoundAvailable && newRoundId) {
    return (
      <main className="min-h-screen p-6 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <SemcasHeader title="Nova etapa disponível" />
        <p className="text-sm text-muted-foreground mb-8">
          {publicEvent?.currentRoundTitle
            ? `Uma nova atividade foi aberta: ${publicEvent.currentRoundTitle}`
            : "Uma nova atividade foi aberta."}
        </p>
        <Button
          size="xl"
          onClick={() => router.push(`/e/${eventSlug}/rodada/${newRoundId}`)}
        >
          RESPONDER AGORA
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto flex flex-col items-center justify-center text-center">
      <SemcasHeader />
      <div className="text-3xl text-accent mb-4">✓</div>
      <h2 className="text-lg font-semibold mb-2">Resposta enviada</h2>
      <p className="text-sm text-muted-foreground mb-2">Obrigado pela sua participação.</p>
      <p className="text-sm text-muted-foreground">Aguarde novas atividades.</p>
      <div className="mt-8 flex gap-1" aria-hidden="true">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse delay-100" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse delay-200" />
      </div>
    </main>
  );
}
