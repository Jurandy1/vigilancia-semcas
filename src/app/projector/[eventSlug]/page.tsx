"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import { useRoundStats } from "@/hooks/use-round-stats";
import QRCode from "qrcode";

interface PublicEventData {
  id: string;
  title: string;
  projectorTitle: string | null;
  slug: string;
  status: string;
  currentOpenRoundId: string | null;
  currentRoundId: string | null;
  currentRoundTitle: string | null;
  currentRoundStatus: string | null;
}

function ProjectorChrome({
  title,
  lastUpdate,
  children,
}: {
  title: string;
  lastUpdate: Date;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fb] text-[#1a1a1a]">
      <header className="shrink-0 bg-[#0b3a6e] text-white px-5 sm:px-12 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-5 min-w-0">
          <div className="bg-white rounded px-2.5 py-1.5 shrink-0">
            <Image
              src="/images/logo-prefeitura-saoluis.jpg"
              alt="Prefeitura de São Luís"
              width={176}
              height={57}
              priority
              className="block w-[140px] sm:w-[176px] h-auto"
            />
          </div>
          <div className="border-l border-white/30 pl-5 min-w-0 hidden sm:block">
            <div className="text-[22px] font-bold tracking-[0.1em]">SEMCAS</div>
            <div className="text-sm text-white/70 mt-0.5">
              Secretaria Municipal da Criança e Assistência Social
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 max-w-[44ch]">
          <p className="m-0 text-[15px] text-white/70 leading-snug text-pretty">{title}</p>
          <p className="mt-1.5 mb-0 inline-flex items-center gap-2 text-sm font-semibold text-[#a8e0c0]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5ecf92] animate-pulse" />
            Atualização em tempo real
          </p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-5 sm:p-12">{children}</main>

      <footer className="shrink-0 bg-white border-t border-[#e2e8f0] px-5 sm:px-12 py-3.5 flex items-center justify-between gap-6">
        <p className="m-0 text-[15px] text-[#5b6b7f]">
          SEMCAS · Secretaria Municipal da Criança e Assistência Social · Prefeitura de São Luís
        </p>
        <p className="m-0 text-[15px] text-[#8a97a8] shrink-0">
          Última atualização:{" "}
          {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </footer>
    </div>
  );
}

export default function ProjectorPage() {
  const params = useParams();
  const eventSlug = params.eventSlug as string;
  const [publicEvent, setPublicEvent] = useState<PublicEventData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [connectedCount, setConnectedCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loadError, setLoadError] = useState(false);

  const { stats } = useRoundStats(
    publicEvent?.id ?? null,
    publicEvent?.currentRoundId ?? publicEvent?.currentOpenRoundId ?? null,
    eventSlug
  );

  useEffect(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    QRCode.toDataURL(`${appUrl}/e/${eventSlug}`, { width: 400, margin: 2 }).then(setQrDataUrl);
  }, [eventSlug]);

  useEffect(() => {
    const db = getFirestoreDb();

    async function findEvent() {
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const eventsRef = collection(db, "publicEvents");
      const q = query(eventsRef, where("slug", "==", eventSlug));
      const snap = await getDocs(q);
      if (snap.empty) return undefined;

      const eventDoc = snap.docs[0]!;
      const eventId = eventDoc.id;

      const unsubscribeEvent = onSnapshot(
        doc(db, "publicEvents", eventId),
        (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          setPublicEvent({
            id: snapshot.id,
            title: data.title,
            projectorTitle: data.projectorTitle ?? null,
            slug: data.slug,
            status: data.status,
            currentOpenRoundId: data.currentOpenRoundId ?? null,
            currentRoundId: data.currentRoundId ?? null,
            currentRoundTitle: data.currentRoundTitle ?? null,
            currentRoundStatus: data.currentRoundStatus ?? null,
          });
          setLastUpdate(new Date());
          setLoadError(false);
        },
        (error) => {
          console.error("Erro ao acompanhar o evento:", error);
          setLoadError(true);
        }
      );
      const unsubscribeParticipants = onSnapshot(
        collection(db, `publicStats/${eventId}/participantShards`),
        (snapshot) => {
          setConnectedCount(
            snapshot.docs.reduce((total, shard) => total + (shard.data().count ?? 0), 0)
          );
          setLastUpdate(new Date());
        },
        () => setLoadError(true)
      );

      return () => {
        unsubscribeEvent();
        unsubscribeParticipants();
      };
    }

    let cleanup: (() => void) | undefined;
    findEvent()
      .then((unsub) => {
        cleanup = unsub;
      })
      .catch((error) => {
        console.error("Erro ao buscar o evento:", error);
        setLoadError(true);
      });

    return () => cleanup?.();
  }, [eventSlug]);

  const isRoundOpen = publicEvent?.currentRoundStatus === "open";
  const hasHadRound = Boolean(publicEvent?.currentRoundTitle);
  const isIntermission = Boolean(publicEvent) && !isRoundOpen && hasHadRound;
  const displayTitle = publicEvent?.projectorTitle ?? publicEvent?.title ?? "";
  const total = Math.max(connectedCount, stats.registered, stats.completed + stats.answering);
  const completed = stats.completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const eventUrl =
    typeof window !== "undefined"
      ? `${window.location.host}/e/${eventSlug}`
      : `localhost:3000/e/${eventSlug}`;

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f7f9fb] text-center px-6">
        <p className="text-xl text-gray-500">Não foi possível carregar o evento.</p>
      </div>
    );
  }

  if (!publicEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
        <p className="text-2xl text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (isIntermission) {
    return (
      <ProjectorChrome title={displayTitle} lastUpdate={lastUpdate}>
        <section aria-label="Intervalo entre rodadas" className="w-full max-w-[900px] text-center">
          <h1 className="m-0 text-[clamp(34px,5vw,60px)] leading-tight font-bold tracking-[-0.015em] text-[#0b3a6e]">
            Aguardando próxima atividade
          </h1>
          <p className="mt-7 mb-0 text-[clamp(19px,2.4vw,30px)] text-[#33415c]">
            Votação encerrada — {total} participantes, {completed} finalizaram
          </p>
          <p className="mt-12 mb-0 inline-flex items-center gap-3.5 text-2xl text-[#5b6b7f]">
            <span className="w-3 h-3 rounded-full bg-[#0b3a6e] animate-pulse" />
            A tela atualiza automaticamente quando a próxima rodada começar
          </p>
        </section>
      </ProjectorChrome>
    );
  }

  if (!isRoundOpen) {
    return (
      <ProjectorChrome title={displayTitle} lastUpdate={lastUpdate}>
        <section
          aria-label="Entrada dos participantes"
          className="w-full max-w-[1240px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_460px] gap-10 lg:gap-16 items-center"
        >
          <div>
            <h1 className="m-0 text-[clamp(52px,7vw,88px)] leading-[0.95] font-extrabold tracking-[-0.02em] text-[#0b3a6e]">
              PARTICIPE
            </h1>
            <p className="mt-6 mb-0 text-[clamp(20px,2.4vw,30px)] leading-snug text-[#33415c] max-w-[24ch] text-pretty">
              Escaneie o QR Code ou acesse pelo link abaixo.
            </p>
            <div className="mt-10 bg-white border border-[#e2e8f0] rounded-[10px] px-8 py-7 inline-block max-w-full">
              <p className="m-0 text-[clamp(15px,1.6vw,20px)] font-bold tracking-[0.12em] uppercase text-[#5b6b7f]">
                Link do evento
              </p>
              <p className="mt-3.5 mb-0 text-[clamp(22px,3vw,44px)] font-bold leading-snug text-[#0b3a6e] break-words">
                {eventUrl}
              </p>
            </div>
            <p className="mt-7 mb-0 text-[clamp(16px,2vw,26px)] text-[#5b6b7f] break-words">
              Sem código e sem cadastro — basta abrir e responder.
            </p>
          </div>
          <div>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR Code de acesso ao evento"
                className="w-full bg-white border border-[#e2e8f0] rounded-xl p-6"
              />
            )}
            <p className="mt-6 mb-0 text-center text-[clamp(21px,2.6vw,30px)] font-bold text-[#0b3a6e]">
              {connectedCount} participantes conectados
            </p>
            <p className="mt-2 mb-0 text-center text-[19px] text-[#5b6b7f]">
              Aguardando a abertura da primeira rodada
            </p>
          </div>
        </section>
      </ProjectorChrome>
    );
  }

  return (
    <ProjectorChrome title={displayTitle} lastUpdate={lastUpdate}>
      <section
        aria-label="Participação da rodada em andamento"
        className="w-full max-w-[1240px] text-center"
      >
        <p className="m-0 text-[clamp(16px,1.8vw,22px)] font-bold tracking-[0.14em] uppercase text-[#5b6b7f]">
          Votação em andamento
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-10 mt-8 sm:mt-12">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-11">
            <p className="m-0 text-[clamp(18px,2.2vw,28px)] font-semibold text-[#5b6b7f]">
              Participantes até agora
            </p>
            <p className="mt-4 mb-0 text-[clamp(88px,13vw,180px)] font-extrabold leading-[0.9] text-[#0b3a6e] tabular-nums">
              {total}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-11">
            <p className="m-0 text-[clamp(18px,2.2vw,28px)] font-semibold text-[#5b6b7f]">
              Já finalizaram
            </p>
            <p className="mt-4 mb-0 text-[clamp(88px,13vw,180px)] font-extrabold leading-[0.9] text-[#1a7f4b] tabular-nums">
              {completed}
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mt-12 mx-auto max-w-[1000px]">
          <div
            role="img"
            aria-label={`${completed} de ${total} participantes finalizaram`}
            className="h-[26px] bg-[#e6eaf0] rounded-[13px] overflow-hidden"
          >
            <div
              className="h-full bg-[#0b3a6e] rounded-[13px] transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-4 text-[clamp(17px,2vw,26px)] text-[#5b6b7f]">
            <span>
              {completed} de {total} finalizaram
            </span>
            <span className="font-bold text-[#0b3a6e]">{percent}%</span>
          </div>
        </div>

        <p className="mt-8 sm:mt-12 mb-0 inline-flex items-center gap-3.5 text-[clamp(19px,2.4vw,28px)] font-semibold text-[#5b6b7f]">
          <span className="w-3.5 h-3.5 rounded-full bg-[#0b3a6e] animate-pulse" />
          Votação aberta — responda pelo seu celular
        </p>
      </section>
    </ProjectorChrome>
  );
}
