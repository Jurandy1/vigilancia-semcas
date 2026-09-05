"use client";

import { useState, Suspense, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ParticipantShell } from "@/components/participant/ParticipantShell";
import { apiFetch } from "@/lib/api-client";
import { useParticipantStore } from "@/stores/participant-store";
import type { ParticipantMode } from "@/types/participant";

function ParticiparContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const eventSlug = params.eventSlug as string;
  const mode = (searchParams.get("mode") ?? "identified") as ParticipantMode;

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setParticipant, setEvent } = useParticipantStore();

  const handleContinue = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      // Gerado uma vez por evento e reaproveitado em qualquer retry (mesmo
      // depois de recarregar a página) — deixa o /join idempotente quando a
      // resposta se perde na rede e a pessoa toca "Continuar" de novo, em vez
      // de criar um segundo participante.
      let clientToken: string | undefined;
      try {
        const key = `semcas-join-token:${eventSlug}`;
        clientToken = window.localStorage.getItem(key) ?? undefined;
        if (!clientToken) {
          clientToken = crypto.randomUUID();
          window.localStorage.setItem(key, clientToken);
        }
      } catch {
        /* localStorage indisponível — segue sem token, comportamento anterior */
      }

      const res = await apiFetch(`/api/events/${eventSlug}/join`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          name: mode === "identified" ? name : null,
          clientToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível continuar.");
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
      setError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [eventSlug, mode, name, router, setParticipant, setEvent]);

  if (mode === "anonymous") {
    return (
      <ParticipantShell>
        <section aria-label="Participação anônima" className="flex-1 flex flex-col p-6">
          <h2 className="m-0 text-xl font-bold text-[#1a1a1a]">Participação anônima</h2>
          <p className="mt-4 mb-0 text-[15px] text-[#5b6b7f] leading-relaxed">
            Sua participação será anônima. Seu nome não será solicitado.
          </p>
          {error && (
            <div
              role="alert"
              className="mt-4 border border-[#e3b3ad] bg-[#fdf2f1] rounded-md px-3 py-2 text-[13.5px] text-[#b42318]"
            >
              {error}
            </div>
          )}
          <div className="mt-auto flex gap-2.5">
            <button
              type="button"
              onClick={() => router.push(`/e/${eventSlug}`)}
              className="h-[52px] px-[18px] bg-white text-[#33415c] border border-[#c9d4e2] rounded-lg text-base font-semibold hover:bg-[#f4f6f9]"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={loading}
              className="flex-1 h-[52px] bg-[#0b3a6e] text-white border border-[#0b3a6e] rounded-lg text-base font-semibold hover:bg-[#0d4a8a] disabled:opacity-60"
            >
              {loading ? "Aguarde..." : "Continuar"}
            </button>
          </div>
        </section>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell>
      <section aria-label="Identificação" className="flex-1 flex flex-col p-6">
        <h2 className="m-0 text-xl font-bold text-[#1a1a1a]">Identificação</h2>
        <label
          htmlFor="semcas-nome"
          className="block mt-[18px] mb-2 text-sm font-semibold text-[#33415c]"
        >
          Nome completo
        </label>
        <input
          id="semcas-nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome completo"
          autoComplete="name"
          autoFocus
          className="w-full h-[52px] border border-[#c9d4e2] rounded-lg px-3.5 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b3a6e] focus-visible:outline-offset-2"
        />
        <p className="mt-2.5 mb-0 text-[12.5px] text-[#8a97a8] leading-relaxed">
          Seu nome será associado às suas respostas neste evento.
        </p>
        {error && (
          <div
            role="alert"
            className="mt-4 border border-[#e3b3ad] bg-[#fdf2f1] rounded-md px-3 py-2 text-[13.5px] text-[#b42318]"
          >
            {error}
          </div>
        )}
        <div className="mt-auto flex gap-2.5">
          <button
            type="button"
            onClick={() => router.push(`/e/${eventSlug}`)}
            className="h-[52px] px-[18px] bg-white text-[#33415c] border border-[#c9d4e2] rounded-lg text-base font-semibold hover:bg-[#f4f6f9]"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={loading || name.trim().length < 2}
            className="flex-1 h-[52px] bg-[#0b3a6e] text-white border border-[#0b3a6e] rounded-lg text-base font-semibold hover:bg-[#0d4a8a] disabled:opacity-60"
          >
            {loading ? "Aguarde..." : "Continuar"}
          </button>
        </div>
      </section>
    </ParticipantShell>
  );
}

export default function ParticiparPage() {
  return (
    <Suspense>
      <ParticiparContent />
    </Suspense>
  );
}
