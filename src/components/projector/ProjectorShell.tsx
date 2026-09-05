import type { ReactNode } from "react";
import { ORG_SHORT, SECRETARIAT_NAME, SECTOR_NAME } from "@/lib/branding";
import { formatAccessCode } from "@/lib/utils/format";

const MASK_LEFT =
  "linear-gradient(90deg,rgba(0,0,0,.95) 0%,rgba(0,0,0,.82) 22%,rgba(0,0,0,.5) 48%,rgba(0,0,0,.22) 70%,rgba(0,0,0,.06) 86%,rgba(0,0,0,0) 100%),linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,1) 22%,rgba(0,0,0,1) 74%,rgba(0,0,0,.4) 100%)";
const MASK_RIGHT =
  "linear-gradient(270deg,rgba(0,0,0,.95) 0%,rgba(0,0,0,.82) 22%,rgba(0,0,0,.5) 48%,rgba(0,0,0,.22) 70%,rgba(0,0,0,.06) 86%,rgba(0,0,0,0) 100%),linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,1) 22%,rgba(0,0,0,1) 74%,rgba(0,0,0,.4) 100%)";

export function ProjectorShell({
  title,
  accessCode,
  connectionIssue,
  codeRenewIssue,
  lastUpdate,
  children,
}: {
  title: string;
  accessCode?: string | null;
  connectionIssue?: boolean;
  codeRenewIssue?: boolean;
  lastUpdate: Date;
  children: ReactNode;
}) {
  const lastUpdateLabel = lastUpdate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="projector-root"
      style={{
        height: "100svh",
        minHeight: 420,
        width: "100%",
        display: "grid",
        gridTemplateRows: "auto minmax(0,1fr) auto",
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
          boxShadow: "inset 0 -4px 0 0 rgba(11,58,110,.06)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/projector/brasao-sao-luis.png"
          alt="Brasão de São Luís"
          style={{
            height: "clamp(46px,7.2vh,96px)",
            width: "auto",
            display: "block",
            flex: "none",
            mixBlendMode: "multiply",
          }}
        />
        <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: "clamp(1px,.3vh,4px)" }}>
          <span
            style={{
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: "clamp(9px,1.05vh,15px)",
              fontWeight: 600,
              letterSpacing: ".34em",
              textTransform: "uppercase",
              color: "#4a6280",
            }}
          >
            Prefeitura de
          </span>
          <span
            style={{
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: "clamp(20px,3.1vh,44px)",
              fontWeight: 800,
              letterSpacing: ".02em",
              lineHeight: 0.95,
              color: "#0B3A6E",
            }}
          >
            SÃO LUÍS
          </span>
        </div>
        <span
          aria-hidden="true"
          style={{
            flex: "none",
            width: 2,
            alignSelf: "stretch",
            margin: "clamp(2px,.6vh,10px) 0",
            background:
              "linear-gradient(180deg,rgba(11,58,110,0) 0%,rgba(11,58,110,.22) 35%,rgba(11,58,110,.22) 65%,rgba(11,58,110,0) 100%)",
          }}
        />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "clamp(1px,.35vh,5px)" }}>
          <span
            style={{
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: "clamp(17px,2.7vh,40px)",
              fontWeight: 800,
              letterSpacing: ".03em",
              lineHeight: 1,
              color: "#0B3A6E",
            }}
          >
            {ORG_SHORT}
          </span>
          <span style={{ fontSize: "clamp(11px,1.55vh,23px)", fontWeight: 500, lineHeight: 1.2, color: "#2c4568" }}>
            {SECRETARIAT_NAME}
          </span>
          <span
            style={{
              fontSize: "clamp(10px,1.4vh,21px)",
              fontWeight: 600,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              lineHeight: 1.3,
              color: "#4a6280",
            }}
          >
            {SECTOR_NAME}
          </span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: "clamp(10px,1.4vw,24px)",
          }}
        >
          {accessCode ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "clamp(8px,.9vw,16px)",
                border: "1px solid #b9d5ed",
                background: "#edf6fd",
                borderRadius: 10,
                padding: "clamp(6px,.9vh,14px) clamp(12px,1.2vw,24px)",
              }}
            >
              <span
                style={{
                  fontSize: "clamp(9px,1.05vh,15px)",
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "#0b4a83",
                }}
              >
                Código de acesso
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace,Consolas,monospace",
                  fontSize: "clamp(18px,2.4vh,36px)",
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  color: "#0b3a6e",
                }}
              >
                {formatAccessCode(accessCode)}
              </span>
            </div>
          ) : null}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "clamp(7px,.7vw,12px)",
              fontSize: "clamp(11px,1.35vh,20px)",
              fontWeight: 600,
              color: codeRenewIssue || connectionIssue ? "#9a6700" : "#18754A",
              whiteSpace: "nowrap",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "clamp(9px,1.1vh,15px)",
                height: "clamp(9px,1.1vh,15px)",
                borderRadius: 99,
                background: codeRenewIssue || connectionIssue ? "#dba514" : "#1a7f4b",
                animation: codeRenewIssue || connectionIssue ? "none" : "semcasPulse 2.4s ease-in-out infinite",
              }}
            />
            {codeRenewIssue
              ? "Falha ao renovar o código — tentando de novo"
              : connectionIssue
                ? "Conexão instável"
                : "Atualização em tempo real"}
          </span>
        </div>
      </header>

      <main
        style={{
          position: "relative",
          minHeight: 0,
          display: "block",
          padding: "clamp(12px,2vh,44px) clamp(16px,3vw,72px) clamp(14px,2.4vh,52px)",
          background: "radial-gradient(120% 90% at 50% 40%,#ffffff 0%,#ffffff 46%,#eef4fb 100%)",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/projector/palacio-la-ravardiere.jpg"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: "clamp(0px,22vw,460px)",
            objectFit: "cover",
            objectPosition: "60% 50%",
            opacity: 0.55,
            filter: "saturate(.85) contrast(.92)",
            maskImage: MASK_LEFT,
            WebkitMaskImage: MASK_LEFT,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
            pointerEvents: "none",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/projector/sao-luis-azulejos.jpg"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            height: "100%",
            width: "clamp(0px,22vw,460px)",
            objectFit: "cover",
            objectPosition: "40% 50%",
            opacity: 0.55,
            filter: "saturate(.85) contrast(.92)",
            maskImage: MASK_RIGHT,
            WebkitMaskImage: MASK_RIGHT,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            maxWidth: "min(1600px,84vw)",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "clamp(10px,1.8vh,38px)",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-archivo), sans-serif",
              fontSize: "clamp(24px,min(3.1vw,5.2vh),78px)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-.015em",
              textTransform: "uppercase",
              color: "#0B3A6E",
              textWrap: "pretty",
              maxWidth: "min(44ch,100%)",
            }}
          >
            {title}
          </h1>
          {children}
        </div>
      </main>

      <footer
        style={{
          borderTop: "clamp(3px,.5vh,7px) solid #F4B223",
          background: "#0B3A6E",
          color: "#fff",
          padding: "clamp(10px,1.7vh,30px) clamp(18px,2.4vw,56px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "clamp(14px,2vw,48px)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "clamp(11px,min(1.1vw,1.6vh),22px)",
            lineHeight: 1.45,
            color: "rgba(255,255,255,.86)",
            maxWidth: "78ch",
          }}
        >
          O telão exibe apenas contagens. Perguntas e resultados nunca aparecem para a plateia — permanecem no
          painel administrativo e nos relatórios.
        </p>
        <p
          style={{
            margin: 0,
            flex: "none",
            fontSize: "clamp(11px,min(1.1vw,1.6vh),22px)",
            fontWeight: 600,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.92)",
            whiteSpace: "nowrap",
          }}
        >
          Última atualização: {lastUpdateLabel}
        </p>
      </footer>
    </div>
  );
}

export function ProjectorStatusLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(10px,1.4vw,28px)",
        width: "100%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          height: "clamp(3px,.45vh,6px)",
          width: "clamp(28px,5vw,110px)",
          background: "#F4B223",
          borderRadius: 99,
        }}
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "clamp(8px,.9vw,16px)",
          fontFamily: "var(--font-archivo), sans-serif",
          fontSize: "clamp(12px,min(1.55vw,2.4vh),32px)",
          fontWeight: 700,
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: "#33507a",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        style={{
          height: "clamp(3px,.45vh,6px)",
          width: "clamp(28px,5vw,110px)",
          background: "#F4B223",
          borderRadius: 99,
        }}
      />
    </div>
  );
}
