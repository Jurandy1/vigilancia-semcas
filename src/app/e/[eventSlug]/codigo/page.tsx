"use client";

import { Suspense, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api-client";
import { useParticipantStore } from "@/stores/participant-store";
import { formatAccessCode } from "@/lib/utils/format";
import type { ParticipantMode } from "@/types/participant";

function AccessCodeContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const eventSlug = params.eventSlug as string;
  // Eventos com código exigido pulavam direto para cá sem deixar escolher
  // identificado/anônimo — a escolha agora acontece antes (EventEntryClient)
  // e chega como query param; sem ela (link direto antigo), mantém anônimo.
  const mode = (searchParams.get("mode") ?? "anonymous") as ParticipantMode;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setParticipant, setEvent } = useParticipantStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let clientToken: string | undefined;
      try {
        const key = `semcas-join-token:${eventSlug}`;
        clientToken = window.localStorage.getItem(key) ?? undefined;
        if (!clientToken) {
          clientToken = crypto.randomUUID();
          window.localStorage.setItem(key, clientToken);
        }
      } catch {
        /* localStorage indisponível — segue sem token */
      }

      const res = await apiFetch(`/api/events/${eventSlug}/join`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          name: mode === "identified" ? name : null,
          accessCode: code.replace(/\s/g, ""),
          clientToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error ?? "Muitas tentativas agora. Aguarde alguns segundos e tente de novo.");
          return;
        }
        setError(data.error ?? "Código inválido.");
        return;
      }

      const resolvedSlug = (data.eventSlug as string | undefined) ?? eventSlug;
      if (data.eventId && data.eventSlug) {
        setEvent(data.eventId as string, data.eventSlug as string);
      }
      setParticipant(data.participantId, data.mode, data.name);

      const sessionRes = await apiFetch(`/api/events/${resolvedSlug}/session`);
      const sessionData = await sessionRes.json();
      if (sessionData.session?.currentOpenRoundId) {
        router.replace(`/e/${resolvedSlug}/rodada/${sessionData.session.currentOpenRoundId}`);
      } else {
        router.replace(`/e/${resolvedSlug}/aguarde`);
      }
    } catch {
      setError("Não foi possível validar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = code.length === 6 && (mode !== "identified" || name.trim().length >= 2);

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <SemcasHeader title="Código de acesso" />

      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === "identified" && (
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
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="code">Informe o código exibido no projetor</Label>
          <Input
            id="code"
            inputMode="numeric"
            placeholder="000 000"
            value={formatAccessCode(code)}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl tracking-widest font-mono"
            autoComplete="off"
            autoFocus={mode !== "identified"}
          />
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        <Button type="submit" size="xl" disabled={loading || !canSubmit}>
          {loading ? "Verificando..." : "CONTINUAR"}
        </Button>
      </form>
    </main>
  );
}

export default function AccessCodePage() {
  return (
    <Suspense>
      <AccessCodeContent />
    </Suspense>
  );
}
