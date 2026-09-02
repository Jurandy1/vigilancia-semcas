"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import { useRoundStats } from "@/hooks/use-round-stats";
import { formatAccessCode } from "@/lib/utils/format";
import { Users, CheckCircle2, RefreshCw, Clock } from "lucide-react";
import QRCode from "qrcode";

interface PublicEventData {
  id: string;
  title: string;
  slug: string;
  status: string;
  currentOpenRoundId: string | null;
  currentRoundTitle: string | null;
  currentRoundStatus: string | null;
  accessChallenge: {
    code: string;
    expiresAt: string;
    rotationSeconds: number;
  } | null;
}

export default function ProjectorPage() {
  const params = useParams();
  const eventSlug = params.eventSlug as string;
  const [publicEvent, setPublicEvent] = useState<PublicEventData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { stats } = useRoundStats(
    publicEvent?.id ?? null,
    publicEvent?.currentOpenRoundId ?? null,
    eventSlug
  );

  useEffect(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    QRCode.toDataURL(`${appUrl}/e/${eventSlug}`, { width: 280, margin: 2 }).then(setQrDataUrl);
  }, [eventSlug]);

  useEffect(() => {
    const db = getFirestoreDb();

    async function findEvent() {
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const eventsRef = collection(db, "publicEvents");
      const q = query(eventsRef, where("slug", "==", eventSlug));
      const snap = await getDocs(q);
      if (snap.empty) return;

      const eventDoc = snap.docs[0]!;
      const eventId = eventDoc.id;

      const unsubscribe = onSnapshot(doc(db, "publicEvents", eventId), (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        setPublicEvent({
          id: snapshot.id,
          title: data.title,
          slug: data.slug,
          status: data.status,
          currentOpenRoundId: data.currentOpenRoundId ?? null,
          currentRoundTitle: data.currentRoundTitle ?? null,
          currentRoundStatus: data.currentRoundStatus ?? null,
          accessChallenge: data.accessChallenge
            ? {
                code: data.accessChallenge.code,
                expiresAt:
                  data.accessChallenge.expiresAt?.toDate?.()?.toISOString?.() ??
                  data.accessChallenge.expiresAt,
                rotationSeconds: data.accessChallenge.rotationSeconds ?? 60,
              }
            : null,
        });
        setConnectedCount(data.participantCount ?? stats.registered);
        setLastUpdate(new Date());
      });

      return unsubscribe;
    }

    let cleanup: (() => void) | undefined;
    findEvent().then((unsub) => {
      cleanup = unsub;
    });

    return () => cleanup?.();
  }, [eventSlug, stats.registered]);

  useEffect(() => {
    if (!publicEvent?.accessChallenge) return;
    const interval = setInterval(() => {
      const expires = new Date(publicEvent.accessChallenge!.expiresAt).getTime();
      setCountdown(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [publicEvent?.accessChallenge]);

  const isRoundOpen = publicEvent?.currentRoundStatus === "open";
  const total = Math.max(connectedCount, stats.registered, stats.completed + stats.answering);
  const completed = stats.completed;
  const answering = stats.answering;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!publicEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <p className="text-2xl text-gray-400">Carregando...</p>
      </div>
    );
  }

  /* ── Entry screen (no round open) ── */
  if (!isRoundOpen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fb] p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute left-0 top-0 w-48 h-full bg-gradient-to-r from-blue-100/40 to-transparent" />
        </div>

        <p className="text-5xl font-bold text-[#0b3a6e] mb-3 tracking-wide relative">SEMCAS</p>
        <h1 className="text-2xl font-semibold text-gray-700 mb-12 relative">PARTICIPE DA AVALIAÇÃO</h1>

        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR Code" className="w-72 h-72 mb-10 relative border-4 border-white shadow-lg rounded-xl" />
        )}

        {publicEvent.accessChallenge && (
          <div className="mb-10 relative">
            <p className="text-xl text-gray-500 mb-3">Código para participar</p>
            <p className="text-6xl font-mono font-bold tracking-[0.3em] text-[#0b3a6e]">
              {formatAccessCode(publicEvent.accessChallenge.code)}
            </p>
            <p className="text-lg text-gray-400 mt-4">
              Atualiza em: {String(Math.floor(countdown / 60)).padStart(2, "0")}:
              {String(countdown % 60).padStart(2, "0")}
            </p>
          </div>
        )}

        <p className="text-xl text-gray-500 relative">
          Participantes conectados: <span className="font-bold text-[#0b3a6e]">{connectedCount}</span>
        </p>
      </div>
    );
  }

  /* ── Active round screen ── */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fb] p-8 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-blue-50 to-transparent opacity-60" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-blue-50 to-transparent opacity-60" />
      </div>

      <div className="relative w-full max-w-3xl mx-auto text-center space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-5xl font-bold text-[#0b3a6e] tracking-wide mb-3">SEMCAS</h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto leading-snug">{publicEvent.title}</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-600 font-medium">Atualização em tempo real</span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Users className="w-6 h-6 text-[#0b3a6e]" />
              <span className="text-base font-semibold text-[#0b3a6e]">Participantes</span>
            </div>
            <p className="text-7xl font-bold text-[#0b3a6e] leading-none">{total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <div className="flex items-center justify-center gap-2 mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <span className="text-base font-semibold text-green-600">Responderam</span>
            </div>
            <p className="text-7xl font-bold text-green-600 leading-none">{completed}</p>
          </div>
        </div>

        {/* Still responding bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-center gap-3 shadow-sm">
          <RefreshCw className="w-5 h-5 text-green-500" />
          <span className="text-lg text-gray-700">
            Ainda respondendo:{" "}
            <strong className="text-green-600 text-xl">{answering}</strong>
          </span>
        </div>

        {/* Progress bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0b3a6e] rounded-full transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-2xl font-bold text-[#0b3a6e] whitespace-nowrap">
              {percent}% concluído
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          Última atualização:{" "}
          {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
