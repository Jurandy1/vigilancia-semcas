"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicEvent } from "@/hooks/use-public-event";
import { useRoundStats } from "@/hooks/use-round-stats";
import { SemcasBrand } from "@/components/branding/SemcasBrand";
import QRCode from "qrcode";

function ProjectorChrome({
  title,
  lastUpdate,
  connectionIssue,
  children,
}: {
  title: string;
  lastUpdate: Date;
  connectionIssue?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7", padding: "26px 22px 48px" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        
        {/* The new designer puts the projector directly in a card instead of full screen. Let's make it look like the mockup */}
        <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", overflow: "hidden" }}>
          
          <div style={{ background: "#fff", borderBottom: "1px solid #dbe4ef", padding: "18px 28px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <img src="/logo-prefeitura-saoluis.jpg" alt="Prefeitura de São Luís" style={{ height: "44px", width: "auto", display: "block" }} />
            <span aria-hidden="true" style={{ width: "1px", height: "40px", background: "#e2e8f0" }}></span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#5b6b7f" }}>SEMCAS · Prefeitura de São Luís</p>
              <p style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 600, color: "#11243c" }}>{title}</p>
            </div>
            
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: 600, color: connectionIssue ? "#9a6700" : "#18754A" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "99px", background: connectionIssue ? "#dba514" : "#1a7f4b", animation: connectionIssue ? "none" : "semcasPulse 2.4s ease-in-out infinite" }}></span>
              {connectionIssue ? "Conexão instável" : "Atualização em tempo real"}
            </span>
          </div>

          <div style={{ background: "#f4f7fb", padding: "52px 32px 60px", textAlign: "center", minHeight: "440px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {children}
          </div>
          
        </div>

        <p style={{ margin: "12px 0 0", fontSize: "12.5px", lineHeight: 1.6, color: "#8a97a8", maxWidth: "70ch" }}>
          O telão exibe apenas contagens. Perguntas e resultados nunca aparecem para a plateia — permanecem no painel administrativo e nos relatórios. Última atualização: {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>

      </div>
    </div>
  );
}

export default function ProjectorPage() {
  const params = useParams();
  // Link fixo divulgado para a plateia (QR Code e URL exibidos nunca mudam,
  // mesmo quando a sequência avança para o próximo evento).
  const rootSlug = params.eventSlug as string;
  // Slug do evento cujos dados estão sendo exibidos agora — avança sozinho
  // quando o evento atual encerra e a sequência abre o próximo.
  const [activeSlug, setActiveSlug] = useState(rootSlug);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    setActiveSlug(rootSlug);
  }, [rootSlug]);

  const { publicEvent, loading, connectionIssue: eventConnectionIssue } = usePublicEvent(null, activeSlug);
  const { stats, connectionIssue: statsConnectionIssue } = useRoundStats(publicEvent?.id ?? null, publicEvent?.currentOpenRoundId ?? null);
  const connectionIssue = eventConnectionIssue || statsConnectionIssue;

  useEffect(() => {
    if (publicEvent?.status !== "closed" || !publicEvent.nextEventSlug) return;
    setActiveSlug(publicEvent.nextEventSlug);
  }, [publicEvent]);

  useEffect(() => {
    // Preferir sempre a origem real do navegador: se NEXT_PUBLIC_APP_URL for
    // configurada incorretamente (ex.: apontando para localhost), o QR Code
    // real exibido no telão não pode ser afetado por isso.
    const appUrl = window.location.origin || process.env.NEXT_PUBLIC_APP_URL;
    setEventUrl(`${window.location.host}/e/${rootSlug}`);
    QRCode.toDataURL(`${appUrl}/e/${rootSlug}`, { width: 230, margin: 0 }).then(setQrDataUrl);
  }, [rootSlug]);

  useEffect(() => {
    setLastUpdate(new Date());
  }, [publicEvent, stats]);

  const connectedCount = publicEvent?.participantCount ?? 0;
  const isRoundOpen = publicEvent?.currentRoundStatus === "open";
  const hasHadRound = Boolean(publicEvent?.currentRoundTitle);
  const isFinished = publicEvent?.status === "closed" && !publicEvent.nextEventSlug;
  const isIntermission = Boolean(publicEvent) && !isRoundOpen && hasHadRound && !isFinished;
  const displayTitle = publicEvent?.projectorTitle ?? publicEvent?.title ?? "";
  const total = Math.max(connectedCount, stats.registered, stats.completed + stats.answering);
  const completed = stats.completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!loading && !publicEvent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f7" }}>
        <p style={{ fontSize: "20px", color: "#5b6b7f" }}>Não foi possível carregar o evento.</p>
      </div>
    );
  }

  if (!publicEvent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f7" }}>
        <p style={{ fontSize: "20px", color: "#5b6b7f" }}>Carregando...</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <ProjectorChrome title={displayTitle} lastUpdate={lastUpdate} connectionIssue={connectionIssue}>
        <div>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#5b6b7f" }}>Encerrado</p>
          <p style={{ margin: "24px auto 0", fontSize: "46px", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-.02em", color: "#11243c", maxWidth: "24ch", textWrap: "pretty" }}>Obrigado pela participação</p>
          <p style={{ margin: "22px 0 0", fontSize: "20px", color: "#5b6b7f" }}>Este evento foi encerrado.</p>
        </div>
      </ProjectorChrome>
    );
  }

  if (isIntermission) {
    return (
      <ProjectorChrome title={displayTitle} lastUpdate={lastUpdate} connectionIssue={connectionIssue}>
        <div>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#5b6b7f" }}>Intervalo</p>
          <p style={{ margin: "24px auto 0", fontSize: "46px", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-.02em", color: "#11243c", maxWidth: "24ch", textWrap: "pretty" }}>Aguarde a próxima atividade</p>
          <p style={{ margin: "22px 0 0", fontSize: "20px", color: "#5b6b7f" }}>Mantenha o celular à mão — a próxima rodada abre em instantes.</p>
        </div>
      </ProjectorChrome>
    );
  }

  if (!isRoundOpen) {
    return (
      <ProjectorChrome title={displayTitle} lastUpdate={lastUpdate} connectionIssue={connectionIssue}>
        <div>
          <p style={{ margin: 0, fontSize: "52px", fontWeight: 800, letterSpacing: "-.02em", color: "#0B3A6E", lineHeight: 1 }}>PARTICIPE</p>
          <p style={{ margin: "16px 0 30px", fontSize: "20px", color: "#33415c" }}>Escaneie o QR Code ou acesse pelo link abaixo</p>
          
          <div aria-hidden="true" style={{ width: "230px", height: "230px", margin: "0 auto", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" style={{ width: "100%", height: "100%" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "repeating-linear-gradient(45deg,#e9eef5 0 10px,#fff 10px 20px)" }} />
            )}
          </div>
          
          <p style={{ margin: "22px 0 0", fontSize: "22px", fontFamily: "ui-monospace,Consolas,monospace", color: "#0B3A6E" }}>{eventUrl}</p>
          <p style={{ margin: "26px 0 0", fontSize: "32px", fontWeight: 700, color: "#11243c" }}>{connectedCount} participantes conectados</p>
        </div>
      </ProjectorChrome>
    );
  }

  return (
    <ProjectorChrome title={displayTitle} lastUpdate={lastUpdate} connectionIssue={connectionIssue}>
      <div>
        <p style={{ margin: "0 0 30px", fontSize: "15px", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#5b6b7f" }}>Votação em andamento</p>
        
        <div style={{ display: "flex", gap: "24px", justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#fff", border: "1px solid #dbe4ef", borderRadius: "10px", padding: "26px 44px", minWidth: "280px" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#5b6b7f" }}>Participantes até agora</p>
            <p style={{ margin: "14px 0 0", fontSize: "88px", fontWeight: 800, lineHeight: ".9", letterSpacing: "-.03em", color: "#0B3A6E" }}>{total}</p>
          </div>
          <div style={{ background: "#fff", border: "1px solid #dbe4ef", borderRadius: "10px", padding: "26px 44px", minWidth: "280px" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#5b6b7f" }}>Já finalizaram</p>
            <p style={{ margin: "14px 0 0", fontSize: "88px", fontWeight: 800, lineHeight: ".9", letterSpacing: "-.03em", color: "#18754A" }}>{completed}</p>
          </div>
        </div>

        <div style={{ maxWidth: "620px", margin: "34px auto 0" }}>
          <div role="img" aria-label={`${percent}% dos participantes finalizaram`} style={{ height: "18px", background: "#e3e9f1", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${percent}%`, background: "#0B3A6E", borderRadius: "99px", transition: "width 0.5s ease-in-out" }}></div>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "19px", color: "#33415c" }}>
            {completed} de {total} finalizaram · <strong style={{ color: "#0B3A6E" }}>{percent}%</strong>
          </p>
        </div>
      </div>
    </ProjectorChrome>
  );
}
