"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ParticipantShell } from "@/components/participant/ParticipantShell";
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

  const isDevMock = process.env.NEXT_PUBLIC_USE_DEV_MOCK === "true";
  // Com código de acesso exigido, o destino é /codigo em vez de /participar —
  // a escolha identificado/anônimo continua acontecendo aqui, e não fica
  // travada em "anônimo" pulando essa tela como acontecia antes.
  const nextStep = event.requireLiveCode ? "codigo" : "participar";

  return (
    <ParticipantShell eventTitle={event.title}>
      <section aria-label="Entrada" style={{ padding: "20px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
        {isDevMock && (
          <div style={{ marginBottom: "16px", borderRadius: "6px", background: "#fdf5e3", border: "1px solid #f0dfae", padding: "8px 12px", fontSize: "12px", color: "#8a5a00" }}>
            Modo desenvolvimento local — dados simulados
          </div>
        )}
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, lineHeight: 1.35, color: "#11243c" }}>
          {event.title}
        </h2>
        <p style={{ margin: "14px 0 0", fontSize: "14px", color: "#5b6b7f" }}>Como deseja participar?</p>

        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={() => router.push(`/e/${event.slug}/${nextStep}?mode=identified`)}
            style={{ textAlign: "left", padding: "14px 16px", border: "1px solid #c9d4e2", borderRadius: "10px", background: "#fff", cursor: "pointer", minHeight: "64px" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#c9d4e2"; e.currentTarget.style.background = "#fff"; }}
          >
            <span style={{ display: "block", fontSize: "14.5px", fontWeight: 600, color: "#11243c" }}>
              Responder com identificação
            </span>
            <span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#5b6b7f" }}>
              Informarei meu nome completo
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/e/${event.slug}/${nextStep}?mode=anonymous`)}
            style={{ textAlign: "left", padding: "14px 16px", border: "1px solid #c9d4e2", borderRadius: "10px", background: "#fff", cursor: "pointer", minHeight: "64px" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0B3A6E"; e.currentTarget.style.background = "#f7fafd"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#c9d4e2"; e.currentTarget.style.background = "#fff"; }}
          >
            <span style={{ display: "block", fontSize: "14.5px", fontWeight: 600, color: "#11243c" }}>
              Responder anonimamente
            </span>
            <span style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#5b6b7f" }}>
              Meu nome não será coletado
            </span>
          </button>
        </div>

        <p style={{ margin: "auto 0 0", paddingTop: "24px", fontSize: "11.5px", lineHeight: 1.6, color: "#8a97a8" }}>
          {event.requireLiveCode
            ? "Você entrou pelo QR Code do evento — na próxima tela, informe o código exibido no telão. As respostas só são enviadas quando você confirmar."
            : "Você entrou pelo QR Code do evento — não é preciso código nem cadastro. As respostas só são enviadas quando você confirmar."}
        </p>
      </section>
    </ParticipantShell>
  );
}
