"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicEvent } from "@/hooks/use-public-event";
import { useRoundStats } from "@/hooks/use-round-stats";
import { getSupabaseClient } from "@/lib/supabase/client";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";
import { SECTOR_NAME } from "@/lib/branding";
import QRCode from "qrcode";
import { getAccessCodeRenewalDelay } from "@/lib/projector/access-code-timing";
import { resolveLivePublicEventSlug } from "@/lib/events/resolve-live-slug";
import { ProjectorShell, ProjectorStatusLabel } from "@/components/projector/ProjectorShell";

function LoadingScreen({ message }: { message: string }) {
  return (
    <div
      className="projector-root"
      style={{
        height: "100svh",
        minHeight: 420,
        width: "100%",
        display: "grid",
        gridTemplateRows: "auto minmax(0,1fr)",
        background: "#fff",
        overflow: "hidden",
        fontFamily: 'var(--font-barlow), "Segoe UI", system-ui, sans-serif',
        color: "#11243c",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(14px,2vw,34px)",
          padding: "clamp(10px,1.6vh,26px) clamp(18px,2.4vw,56px)",
          background: "linear-gradient(180deg,#ffffff 0%,#eff5fc 100%)",
          borderBottom: "1px solid #d7e3f0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/projector/brasao-sao-luis.png"
          alt="Brasão de São Luís"
          style={{ height: "clamp(46px,7.2vh,96px)", width: "auto", display: "block", mixBlendMode: "multiply" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-archivo), sans-serif", fontSize: "clamp(9px,1.05vh,15px)", fontWeight: 600, letterSpacing: ".34em", textTransform: "uppercase", color: "#4a6280" }}>
            Prefeitura de
          </span>
          <span style={{ fontFamily: "var(--font-archivo), sans-serif", fontSize: "clamp(20px,3.1vh,44px)", fontWeight: 800, letterSpacing: ".02em", lineHeight: 0.95, color: "#0B3A6E" }}>
            SÃO LUÍS
          </span>
        </div>
      </header>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <p style={{ fontSize: "clamp(18px,2.4vh,28px)", color: "#5b6b7f", margin: 0, textAlign: "center" }}>{message}</p>
      </div>
    </div>
  );
}

function VotingView({ total, completed, percent }: { total: number; completed: number; percent: number }) {
  return (
    <>
      <ProjectorStatusLabel>Votação em andamento</ProjectorStatusLabel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: "clamp(12px,2vw,44px)",
          width: "100%",
          maxWidth: "min(1240px,72vw)",
          flex: "1 1 auto",
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            border: "1px solid #b9d5ed",
            background: "linear-gradient(180deg,rgba(237,246,253,.94) 0%,rgba(255,255,255,.96) 100%)",
            borderRadius: "clamp(6px,.8vh,12px)",
            padding: "clamp(10px,2vh,34px) clamp(12px,1.6vw,40px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(6px,1.4vh,26px)",
            minHeight: 0,
            backdropFilter: "blur(2px)",
          }}
        >
          <span
            style={{
              fontSize: "clamp(11px,min(1.4vw,2.05vh),28px)",
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#2c4568",
              lineHeight: 1.2,
            }}
          >
            Participantes até agora
          </span>
          <span
            style={{
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: "clamp(52px,min(10vw,20vh),260px)",
              fontWeight: 800,
              lineHeight: 0.86,
              letterSpacing: "-.04em",
              color: "#0B3A6E",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {total}
          </span>
        </div>
        <div
          style={{
            border: "1px solid #b6ddc6",
            background: "linear-gradient(180deg,rgba(234,246,239,.94) 0%,rgba(255,255,255,.96) 100%)",
            borderRadius: "clamp(6px,.8vh,12px)",
            padding: "clamp(10px,2vh,34px) clamp(12px,1.6vw,40px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(6px,1.4vh,26px)",
            minHeight: 0,
            backdropFilter: "blur(2px)",
          }}
        >
          <span
            style={{
              fontSize: "clamp(11px,min(1.4vw,2.05vh),28px)",
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#1f4735",
              lineHeight: 1.2,
            }}
          >
            Já finalizaram
          </span>
          <span
            style={{
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: "clamp(52px,min(10vw,20vh),260px)",
              fontWeight: 800,
              lineHeight: 0.86,
              letterSpacing: "-.04em",
              color: "#18754A",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {completed}
          </span>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "min(1240px,72vw)",
          display: "flex",
          flexDirection: "column",
          gap: "clamp(6px,1.1vh,20px)",
        }}
      >
        <div
          role="img"
          aria-label={`${percent}% dos participantes finalizaram`}
          style={{
            height: "clamp(18px,3vh,46px)",
            background: "#e0e8f2",
            border: "1px solid #cddaea",
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              minWidth: 0,
              background: "linear-gradient(90deg,#0B3A6E 0%,#1663ad 100%)",
              borderRadius: 99,
              transition: "width .5s ease-in-out",
            }}
          />
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(14px,min(1.6vw,2.3vh),32px)",
            fontWeight: 500,
            color: "#2c4568",
          }}
        >
          {completed} de {total} finalizaram ·{" "}
          <strong style={{ fontWeight: 700, color: "#0B3A6E" }}>{percent}%</strong>
        </p>
      </div>
    </>
  );
}

function WaitingView({
  hasHadRound,
  qrDataUrl,
  connectedCount,
  requireLiveCode,
}: {
  hasHadRound: boolean;
  qrDataUrl: string;
  connectedCount: number;
  requireLiveCode?: boolean;
}) {
  return (
    <>
      <ProjectorStatusLabel>{hasHadRound ? "Intervalo" : "Participe"}</ProjectorStatusLabel>
      <p
        style={{
          margin: 0,
          fontSize: "clamp(15px,min(1.8vw,2.6vh),34px)",
          fontWeight: 500,
          color: "#2c4568",
          maxWidth: "36ch",
        }}
      >
        {hasHadRound
          ? requireLiveCode
            ? "Aguarde a próxima rodada. Se for um novo evento, entre de novo com o código do telão."
            : "Aguarde a próxima rodada. Escaneie o QR Code para entrar na sala:"
          : "Escaneie o QR Code para participar"}
      </p>
      <div
        style={{
          width: "clamp(160px,min(28vw,36vh),320px)",
          height: "clamp(160px,min(28vw,36vh),320px)",
          margin: "0 auto",
          borderRadius: 12,
          border: "1px solid #d7e3f0",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: 12,
        }}
      >
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR Code de participação" style={{ width: "100%", height: "100%" }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "repeating-linear-gradient(45deg,#e9eef5 0 10px,#fff 10px 20px)",
            }}
          />
        )}
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-archivo), sans-serif",
          fontSize: "clamp(22px,min(2.4vw,4vh),48px)",
          fontWeight: 700,
          color: "#0B3A6E",
        }}
      >
        {connectedCount} participantes conectados
      </p>
    </>
  );
}

function FinishedView() {
  return (
    <>
      <ProjectorStatusLabel>Encerrado</ProjectorStatusLabel>
      <p
        style={{
          margin: "auto 0",
          fontFamily: "var(--font-archivo), sans-serif",
          fontSize: "clamp(28px,min(4vw,7vh),72px)",
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: "-.02em",
          color: "#0B3A6E",
          maxWidth: "18ch",
          textWrap: "pretty",
        }}
      >
        Obrigado pela participação
      </p>
      <p style={{ margin: 0, fontSize: "clamp(15px,min(1.8vw,2.6vh),34px)", color: "#2c4568" }}>
        Este evento foi encerrado.
      </p>
    </>
  );
}

export default function ProjectorPage() {
  const params = useParams();
  const rootSlug = params.eventSlug as string;
  const [activeSlug, setActiveSlug] = useState(rootSlug === DAILY_ACTIVE_SLUG ? null : rootSlug);
  const [resolvingDailyActive, setResolvingDailyActive] = useState(rootSlug === DAILY_ACTIVE_SLUG);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [codeRenewFailures, setCodeRenewFailures] = useState(0);
  const activeSlugRef = useRef(activeSlug);
  function setActiveSlugTracked(value: string | null) {
    activeSlugRef.current = value;
    setActiveSlug(value);
  }
  const resolveActiveEventSlugRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (rootSlug !== DAILY_ACTIVE_SLUG) {
      setActiveSlugTracked(rootSlug);
      setResolvingDailyActive(false);
      return;
    }
    let cancelled = false;
    const supabase = getSupabaseClient();

    async function resolveActiveEventSlug() {
      try {
        const resolved = await resolveLivePublicEventSlug(supabase);
        if (cancelled) return;
        const target = resolved?.slug ?? null;
        if (target !== activeSlugRef.current) setActiveSlugTracked(target);
        setResolvingDailyActive(false);
      } catch {
        if (!cancelled) setResolvingDailyActive(false);
      }
    }
    resolveActiveEventSlugRef.current = () => void resolveActiveEventSlug();

    setResolvingDailyActive(true);
    void resolveActiveEventSlug();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void resolveActiveEventSlug();
    }, 20_000);
    const channel = supabase
      .channel("projector-live-event")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "public_events", filter: "status=eq.open" },
        () => void resolveActiveEventSlug()
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [rootSlug]);

  const { publicEvent, loading, connectionIssue: eventConnectionIssue } = usePublicEvent(null, activeSlug);
  const { stats, connectionIssue: statsConnectionIssue } = useRoundStats(
    publicEvent?.id ?? null,
    publicEvent?.currentOpenRoundId ?? null
  );
  const connectionIssue = eventConnectionIssue || statsConnectionIssue || codeRenewFailures >= 3;

  const advanceTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    if (publicEvent?.slug !== activeSlug || publicEvent.status !== "closed" || !publicEvent.nextEventSlug) return;
    const next = publicEvent.nextEventSlug;
    if (next === activeSlug) return;
    const now = Date.now();
    const recent = advanceTimestampsRef.current.filter((t) => now - t < 5000);
    if (recent.length >= 5) {
      console.error("Projetor: muitos avanços automáticos em poucos segundos (possível ciclo na sequência), avanço interrompido.", {
        de: activeSlug,
        para: next,
      });
      return;
    }
    recent.push(now);
    advanceTimestampsRef.current = recent;
    setActiveSlugTracked(next);
  }, [publicEvent, activeSlug]);

  useEffect(() => {
    const appUrl = window.location.origin || process.env.NEXT_PUBLIC_APP_URL;
    QRCode.toDataURL(`${appUrl}/e/${rootSlug}`, { width: 320, margin: 1 }).then(setQrDataUrl);
  }, [rootSlug]);

  useEffect(() => {
    setLastUpdate(new Date());
  }, [publicEvent, stats]);

  useEffect(() => {
    if (!publicEvent?.requireLiveCode || publicEvent.status !== "open" || publicEvent.slug !== activeSlug) return;
    let cancelled = false;
    let inFlight = false;
    let expiresAt = Date.parse(publicEvent.accessChallenge?.expiresAt ?? "");
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(renew, getAccessCodeRenewalDelay(expiresAt));
    };
    async function renew() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/events/${activeSlug}/rotate-code`, {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("Falha na renovação");
        const result = await response.json();
        expiresAt = Date.parse(result.expiresAt);
        if (!Number.isFinite(expiresAt)) throw new Error("Validade inválida");
        if (!cancelled) {
          setCodeRenewFailures(0);
          schedule();
        }
      } catch {
        if (!cancelled) {
          setCodeRenewFailures((n) => n + 1);
          timer = setTimeout(renew, 5_000);
        }
      } finally {
        inFlight = false;
      }
    }
    function resume() {
      if (document.visibilityState !== "visible" || inFlight) return;
      clearTimeout(timer);
      schedule();
    }
    schedule();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [
    publicEvent?.requireLiveCode,
    publicEvent?.status,
    publicEvent?.slug,
    publicEvent?.accessChallenge?.expiresAt,
    activeSlug,
  ]);

  useEffect(() => {
    if (rootSlug !== DAILY_ACTIVE_SLUG) return;
    if (!publicEvent || publicEvent.slug !== activeSlug) return;
    if (publicEvent.status === "draft" || publicEvent.status === "waiting") {
      resolveActiveEventSlugRef.current();
    }
  }, [publicEvent, activeSlug, rootSlug]);

  const connectedCount = publicEvent?.participantCount ?? 0;
  const isRoundOpen = publicEvent?.currentRoundStatus === "open";
  const hasHadRound = publicEvent?.currentRoundStatus != null;
  const isFinished = publicEvent?.status === "closed" && !publicEvent.nextEventSlug;
  const total = Math.max(connectedCount, stats.registered, stats.completed + stats.answering);
  const completed = stats.completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const accessCode =
    publicEvent?.requireLiveCode && publicEvent.status === "open"
      ? publicEvent.accessChallenge?.code ?? null
      : null;

  if (!resolvingDailyActive && rootSlug === DAILY_ACTIVE_SLUG && !activeSlug) {
    return <LoadingScreen message="Nenhum evento em andamento ou na fila no momento." />;
  }

  if (!resolvingDailyActive && !loading && !publicEvent) {
    return <LoadingScreen message="Não foi possível carregar o evento." />;
  }

  if (!publicEvent) {
    return <LoadingScreen message="Carregando..." />;
  }

  const projectorTitle = publicEvent.projectorTitle || publicEvent.title || SECTOR_NAME;

  return (
    <ProjectorShell
      title={projectorTitle}
      accessCode={accessCode}
      connectionIssue={connectionIssue}
      codeRenewIssue={codeRenewFailures >= 3}
      lastUpdate={lastUpdate}
    >
      {isFinished ? (
        <FinishedView />
      ) : !isRoundOpen ? (
        <WaitingView
          hasHadRound={hasHadRound}
          qrDataUrl={qrDataUrl}
          connectedCount={connectedCount}
          requireLiveCode={Boolean(publicEvent.requireLiveCode)}
        />
      ) : (
        <VotingView total={total} completed={completed} percent={percent} />
      )}
    </ProjectorShell>
  );
}
