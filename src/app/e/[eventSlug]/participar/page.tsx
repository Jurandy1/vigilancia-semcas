"use client";

import { useState, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAppCheck } from "@/hooks/use-app-check";
import { apiFetch } from "@/lib/api-client";
import { useParticipantStore } from "@/stores/participant-store";
import type { ParticipantMode } from "@/types/participant";

function ParticiparContent() {
  useAppCheck();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const eventSlug = params.eventSlug as string;
  const mode = (searchParams.get("mode") ?? "identified") as ParticipantMode;

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setParticipant } = useParticipantStore();

  async function handleContinue() {
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch(`/api/events/${eventSlug}/join`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          name: mode === "identified" ? name : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível continuar.");
        return;
      }

      setParticipant(data.participantId, data.mode, data.name);

      const sessionRes = await apiFetch(`/api/events/${eventSlug}/session`);
      const sessionData = await sessionRes.json();

      if (sessionData.session?.currentOpenRoundId) {
        router.push(`/e/${eventSlug}/rodada/${sessionData.session.currentOpenRoundId}`);
      } else {
        router.push(`/e/${eventSlug}/aguarde`);
      }
    } catch {
      setError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "anonymous") {
    return (
      <main className="min-h-screen p-6 max-w-md mx-auto">
        <SemcasHeader title="Participação anônima" />
        <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
          Sua participação será anônima.
          <br />
          Seu nome não será solicitado.
        </p>
        {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
        <Button size="xl" onClick={handleContinue} disabled={loading}>
          {loading ? "Aguarde..." : "CONTINUAR"}
        </Button>
        <button
          className="block mx-auto mt-4 text-sm text-muted-foreground"
          onClick={() => router.back()}
        >
          ← Voltar
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <SemcasHeader title="Identificação" />

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome completo"
            autoComplete="name"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Seu nome será associado às suas respostas neste evento.
          </p>
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        <Button
          size="xl"
          onClick={handleContinue}
          disabled={loading || name.trim().length < 2}
        >
          {loading ? "Aguarde..." : "CONTINUAR"}
        </Button>

        <button
          className="block mx-auto text-sm text-muted-foreground"
          onClick={() => router.back()}
        >
          ← Voltar
        </button>
      </div>
    </main>
  );
}

export default function ParticiparPage() {
  return (
    <Suspense>
      <ParticiparContent />
    </Suspense>
  );
}
