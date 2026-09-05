"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicEvent } from "@/hooks/use-public-event";
import { useRoundStats } from "@/hooks/use-round-stats";
import { getSupabaseClient } from "@/lib/supabase/client";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";
import { ORG_SHORT, SECTOR_NAME } from "@/lib/branding";
import { formatAccessCode } from "@/lib/utils/format";
import QRCode from "qrcode";
import { getAccessCodeRenewalDelay } from "@/lib/projector/access-code-timing";

function ProjectorChrome({
  lastUpdate,
  connectionIssue,
  accessCode,
  title,
  children,
}: {
  lastUpdate: Date;
  connectionIssue?: boolean;
  accessCode?: string | null;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7", padding: "clamp(14px,4vw,26px) clamp(12px,4vw,22px) clamp(24px,6vw,48px)" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>

        {/* The new designer puts the projector directly in a card instead of full screen. Let's make it look like the mockup */}
        <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", overflow: "hidden" }}>

          <div style={{ background: "#fff", borderBottom: "1px solid #dbe4ef", padding: "clamp(12px,3vw,18px) clamp(14px,4vw,28px)", display: "flex", alignItems: "center", gap: "clamp(10px,2.5vw,20px)", flexWrap: "wrap" }}>
            <img src="/logo-prefeitura-saoluis.jpg" alt="Prefeitura de São Luís" style={{ height: "clamp(32px,6vw,44px)", width: "auto", display: "block" }} />
            <span aria-hidden="true" style={{ width: "1px", height: "40px", background: "#e2e8f0" }}></span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "clamp(9px,1.8vw,10.5px)", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#5b6b7f" }}>{ORG_SHORT}</p>
              <p style={{ margin: "4px 0 0", fontSize: "clamp(13px,3vw,20px)", fontWeight: 600, color: "#11243c" }}>{title.toUpperCase()}</p>
            </div>

            {accessCode && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px", borderRadius: "8px", border: "1px solid #b9d5ed", background: "#edf6fd", padding: "6px 14px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#0b4a83" }}>Código de acesso</span>
                <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: ".08em", fontFamily: "ui-monospace,Consolas,monospace", color: "#0b3a6e" }}>{formatAccessCode(accessCode)}</span>
              </div>
            )}
            <span style={{ marginLeft: accessCode ? undefined : "auto", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: 600, color: connectionIssue ? "#9a6700" : "#18754A" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "99px", background: connectionIssue ? "#dba514" : "#1a7f4b", animation: connectionIssue ? "none" : "semcasPulse 2.4s ease-in-out infinite" }}></span>
              {connectionIssue ? "Conexão instável" : "Atualização em tempo real"}
            </span>
          </div>

          <div style={{ background: "#f4f7fb", padding: "clamp(28px,7vw,52px) clamp(16px,4vw,32px) clamp(34px,8vw,60px)", textAlign: "center", minHeight: "clamp(320px,42vw,440px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
  const [activeSlug, setActiveSlug] = useState(rootSlug === DAILY_ACTIVE_SLUG ? null : rootSlug);
  const [resolvingDailyActive, setResolvingDailyActive] = useState(rootSlug === DAILY_ACTIVE_SLUG);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  // Duas coisas mudam activeSlug de forma independente (a resolução do
  // "evento do dia" e o avanço automático da sequência) — sem uma referência
  // única e sempre atualizada, cada uma só enxerga o próprio último valor
  // conhecido. Isso fazia a resolução, ao recalcular e coincidentemente
  // chegar de novo no mesmo slug que ELA MESMA tinha visto da última vez,
  // achar que "nada mudou" e deixar de corrigir um activeSlug que na
  // verdade já tinha sido alterado pelo outro efeito.
  const activeSlugRef = useRef(activeSlug);
  function setActiveSlugTracked(value: string | null) {
    activeSlugRef.current = value;
    setActiveSlug(value);
  }
  // Permite o efeito mais abaixo (que reage ao evento exibido virar
  // rascunho) forçar uma nova resolução sem esperar o poll de 20s.
  const resolveActiveEventSlugRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (rootSlug !== DAILY_ACTIVE_SLUG) {
      setActiveSlugTracked(rootSlug);
      setResolvingDailyActive(false);
      return;
    }
    // Link fixo: descobre qual evento está marcado como "o de hoje" antes de
    // assinar os dados ao vivo — a URL/QR exibidos continuam mostrando /atual.
    // Não basta achar a raiz da sequência e depois só seguir next_event_slug
    // pra frente: resetar e reabrir um evento anterior da sequência (uso
    // normal ao refazer o dia) faz o evento realmente em andamento voltar a
    // ser um que já tinha ficado pra trás — sem checar isso, o telão ficava
    // preso mostrando o evento errado até alguém recarregar a página manual.
    // Por isso a resolução busca sempre qual evento da sequência está com
    // status "open" agora (só existe um evento aberto no sistema por vez),
    // e só cai de volta pra raiz se nenhum estiver.
    let cancelled = false;
    const supabase = getSupabaseClient();

    async function resolveActiveEventSlug() {
      const { data: rootRow, error } = await supabase
        .from("public_events")
        .select("slug, sequence_root_slug")
        .eq("is_daily_active", true)
        .maybeSingle();
      if (cancelled || error) return;

      if (!rootRow) {
        if (activeSlugRef.current !== null) setActiveSlugTracked(null);
        setResolvingDailyActive(false);
        return;
      }

      let target = rootRow.slug as string;
      const seqRoot = (rootRow.sequence_root_slug as string | null) ?? target;
      const { data: openRow } = await supabase
        .from("public_events")
        .select("slug")
        .eq("sequence_root_slug", seqRoot)
        .eq("status", "open")
        .maybeSingle();
      if (openRow?.slug) target = openRow.slug as string;

      if (target !== activeSlugRef.current) setActiveSlugTracked(target);
      setResolvingDailyActive(false);
    }
    resolveActiveEventSlugRef.current = () => void resolveActiveEventSlug();

    setResolvingDailyActive(true);
    void resolveActiveEventSlug();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void resolveActiveEventSlug();
    }, 20_000);
    const channel = supabase
      .channel("projector-daily-active")
      .on(
        "postgres_changes",
        // Sem esse filtro, QUALQUER escrita em public_events (inclusive as
        // contagens do evento ao vivo, que mudam a cada participante que
        // entra ou responde) disparava uma consulta nova aqui — com muita
        // gente votando ao mesmo tempo isso vira uma enxurrada de consultas
        // desnecessárias e trava a aba do telão. Só importa saber quando o
        // evento marcado como "o de hoje" muda; mudanças em outros membros
        // da sequência (reset/reabertura) são pegas pelo poll de 20s e pelo
        // efeito abaixo, que reage na hora se o evento exibido virar rascunho.
        { event: "*", schema: "public", table: "public_events", filter: "is_daily_active=eq.true" },
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
  const { stats, connectionIssue: statsConnectionIssue } = useRoundStats(publicEvent?.id ?? null, publicEvent?.currentOpenRoundId ?? null);
  const connectionIssue = eventConnectionIssue || statsConnectionIssue;

  // Trava de segurança contra ciclo na sequência: se next_event_slug de
  // algum evento acabar apontando de volta pra um slug por onde o telão já
  // passou, sem essa checagem o efeito abaixo fica alternando entre os dois
  // pra sempre — troca de evento, contagem, título, tudo mudando sem parar
  // até travar a aba. Mas resetar um evento e refazer a sequência (voltar
  // pro evento 1 e avançar de novo pro 2) é uso normal e legítimo — por
  // isso a checagem é por VELOCIDADE (muitos avanços em poucos segundos só
  // acontece num loop de verdade), não por "esse slug já apareceu alguma
  // vez", que bloquearia revisitar o mesmo evento depois de um reset.
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

  // Agenda pela validade real, inclusive quando o telão é aberto tarde.
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
        const response = await fetch(`/api/events/${activeSlug}/rotate-code`, { method: "POST", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error("Falha na renovação");
        const result = await response.json();
        expiresAt = Date.parse(result.expiresAt);
        if (!Number.isFinite(expiresAt)) throw new Error("Validade inválida");
        if (!cancelled) schedule();
      } catch {
        if (!cancelled) timer = setTimeout(renew, 5_000);
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
  }, [publicEvent?.requireLiveCode, publicEvent?.status, publicEvent?.slug, publicEvent?.accessChallenge?.expiresAt, activeSlug]);

  // Se o evento exibido agora voltou a rascunho/aguardando (reset do
  // organizador), ele deixou de ser o evento certo pra mostrar — força uma
  // nova resolução na hora em vez de esperar o poll de 20s.
  useEffect(() => {
    if (rootSlug !== DAILY_ACTIVE_SLUG) return;
    if (!publicEvent || publicEvent.slug !== activeSlug) return;
    if (publicEvent.status === "draft" || publicEvent.status === "waiting") {
      resolveActiveEventSlugRef.current();
    }
  }, [publicEvent, activeSlug, rootSlug]);

  const connectedCount = publicEvent?.participantCount ?? 0;
  const isRoundOpen = publicEvent?.currentRoundStatus === "open";
  // currentRoundTitle é limpo pelo close_round no banco, então não serve
  // pra saber se "já houve uma rodada" — currentRoundStatus fica 'closed'
  // (não volta a null) até a próxima abrir, e é isso que usamos aqui.
  const hasHadRound = publicEvent?.currentRoundStatus != null;
  const isFinished = publicEvent?.status === "closed" && !publicEvent.nextEventSlug;
  const isIntermission = Boolean(publicEvent) && !isRoundOpen && hasHadRound && !isFinished;
  const total = Math.max(connectedCount, stats.registered, stats.completed + stats.answering);
  const completed = stats.completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const accessCode =
    publicEvent?.requireLiveCode && publicEvent.status === "open"
      ? publicEvent.accessChallenge?.code ?? null
      : null;

  if (!resolvingDailyActive && rootSlug === DAILY_ACTIVE_SLUG && !activeSlug) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f7" }}>
        <p style={{ fontSize: "20px", color: "#5b6b7f" }}>Nenhum evento está definido como &quot;o de hoje&quot; no momento.</p>
      </div>
    );
  }

  if (!resolvingDailyActive && !loading && !publicEvent) {
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

  const projectorTitle = publicEvent.projectorTitle || publicEvent.title || SECTOR_NAME;

  if (isFinished) {
    return (
      <ProjectorChrome lastUpdate={lastUpdate} connectionIssue={connectionIssue} accessCode={accessCode} title={projectorTitle}>
        <div>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#5b6b7f" }}>Encerrado</p>
          <p style={{ margin: "24px auto 0", fontSize: "clamp(28px,7vw,46px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-.02em", color: "#11243c", maxWidth: "24ch", textWrap: "pretty" }}>Obrigado pela participação</p>
          <p style={{ margin: "22px 0 0", fontSize: "clamp(15px,3vw,20px)", color: "#5b6b7f" }}>Este evento foi encerrado.</p>
        </div>
      </ProjectorChrome>
    );
  }

  if (!isRoundOpen) {
    return (
      <ProjectorChrome lastUpdate={lastUpdate} connectionIssue={connectionIssue} accessCode={accessCode} title={projectorTitle}>
        <div>
          <p style={{ margin: 0, fontSize: "clamp(32px,8vw,52px)", fontWeight: 800, letterSpacing: "-.02em", color: "#0B3A6E", lineHeight: 1 }}>
            {hasHadRound ? "INTERVALO" : "PARTICIPE"}
          </p>
          <p style={{ margin: "16px 0 30px", fontSize: "clamp(15px,3vw,20px)", color: "#33415c" }}>
            {hasHadRound ? "Aguarde a próxima rodada. Escaneie para entrar na sala:" : "Escaneie o QR Code para participar"}
          </p>

          <div aria-hidden="true" style={{ width: "clamp(160px,40vw,230px)", height: "clamp(160px,40vw,230px)", margin: "0 auto", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" style={{ width: "100%", height: "100%" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "repeating-linear-gradient(45deg,#e9eef5 0 10px,#fff 10px 20px)" }} />
            )}
          </div>

          <p style={{ margin: "26px 0 0", fontSize: "clamp(22px,5vw,32px)", fontWeight: 700, color: "#11243c" }}>{connectedCount} participantes conectados</p>
        </div>
      </ProjectorChrome>
    );
  }

  return (
    <ProjectorChrome lastUpdate={lastUpdate} connectionIssue={connectionIssue} accessCode={accessCode} title={projectorTitle}>
      <div>
        <p style={{ margin: "0 0 30px", fontSize: "15px", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "#5b6b7f" }}>Votação em andamento</p>
        
        <div style={{ display: "flex", gap: "clamp(12px,3vw,24px)", justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#fff", border: "1px solid #dbe4ef", borderRadius: "10px", padding: "clamp(16px,4vw,26px) clamp(20px,6vw,44px)", minWidth: "clamp(200px,42vw,280px)" }}>
            <p style={{ margin: 0, fontSize: "clamp(12px,2.5vw,15px)", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#5b6b7f" }}>Participantes até agora</p>
            <p style={{ margin: "14px 0 0", fontSize: "clamp(44px,11vw,88px)", fontWeight: 800, lineHeight: ".9", letterSpacing: "-.03em", color: "#0B3A6E" }}>{total}</p>
          </div>
          <div style={{ background: "#fff", border: "1px solid #dbe4ef", borderRadius: "10px", padding: "clamp(16px,4vw,26px) clamp(20px,6vw,44px)", minWidth: "clamp(200px,42vw,280px)" }}>
            <p style={{ margin: 0, fontSize: "clamp(12px,2.5vw,15px)", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#5b6b7f" }}>Já finalizaram</p>
            <p style={{ margin: "14px 0 0", fontSize: "clamp(44px,11vw,88px)", fontWeight: 800, lineHeight: ".9", letterSpacing: "-.03em", color: "#18754A" }}>{completed}</p>
          </div>
        </div>

        <div style={{ maxWidth: "620px", margin: "34px auto 0" }}>
          <div role="img" aria-label={`${percent}% dos participantes finalizaram`} style={{ height: "18px", background: "#e3e9f1", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${percent}%`, background: "#0B3A6E", borderRadius: "99px", transition: "width 0.5s ease-in-out" }}></div>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "clamp(14px,3vw,19px)", color: "#33415c" }}>
            {completed} de {total} finalizaram · <strong style={{ color: "#0B3A6E" }}>{percent}%</strong>
          </p>
        </div>
      </div>
    </ProjectorChrome>
  );
}
