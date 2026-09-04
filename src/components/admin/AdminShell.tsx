"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  LayoutDashboard,
  Layers3,
  ListChecks,
  LogOut,
  Menu,
  Monitor,
  Settings2,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/lib/supabase/auth-client";
import { SemcasBrand } from "@/components/branding/SemcasBrand";
import { ORG_TAGLINE } from "@/lib/branding";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";

interface AdminShellProps {
  children: React.ReactNode;
  eventId?: string;
  eventSlug?: string;
  eventTitle?: string;
  eventStatus?: string;
  screenLabel?: string;
}

interface RememberedEvent {
  id: string;
  slug?: string;
  title: string;
  status?: string;
}

const SELECTED_EVENT_KEY = "semcas-admin-selected-event";

const eventStatusIndicator: Record<
  string,
  { label: string; dotClassName: string; textClassName: string }
> = {
  open: {
    label: "Em andamento",
    dotClassName: "bg-[#1a7f4b] animate-pulse",
    textClassName: "text-[#1a7f4b]",
  },
  waiting: {
    label: "Aguardando início",
    dotClassName: "bg-[#8a97a8]",
    textClassName: "text-[#5b6b7f]",
  },
  draft: {
    label: "Rascunho",
    dotClassName: "bg-[#8a97a8]",
    textClassName: "text-[#5b6b7f]",
  },
  closed: {
    label: "Encerrado",
    dotClassName: "bg-[#8a97a8]",
    textClassName: "text-[#5b6b7f]",
  },
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
};

function resolveScreenLabel(pathname: string, eventId?: string, override?: string) {
  if (override) return override;
  if (!eventId) return "Eventos";
  const base = `/admin/eventos/${eventId}`;
  if (pathname === base || pathname.startsWith(`${base}/ao-vivo`)) return "Painel do evento";
  if (pathname.includes("/resultados")) return "Resultados";
  if (pathname.startsWith(`${base}/perguntas`)) return "Editar perguntas";
  if (pathname.startsWith(`${base}/rodadas`)) return "Editar perguntas";
  if (pathname.startsWith(`${base}/participantes`)) return "Participantes";
  if (pathname.startsWith(`${base}/relatorios`)) return "Relatório";
  if (pathname.startsWith(`${base}/configuracoes`)) return "Configurações";
  return "Evento";
}

export function AdminShell({
  children,
  eventId,
  eventSlug,
  eventTitle,
  eventStatus,
  screenLabel,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rememberedEvent, setRememberedEvent] = useState<RememberedEvent | null>(null);

  useEffect(() => {
    if (eventId && eventTitle) {
      const selected = { id: eventId, slug: eventSlug, title: eventTitle, status: eventStatus };
      setRememberedEvent(selected);
      window.localStorage.setItem(SELECTED_EVENT_KEY, JSON.stringify(selected));
      return;
    }

    try {
      const stored = window.localStorage.getItem(SELECTED_EVENT_KEY);
      if (stored) setRememberedEvent(JSON.parse(stored) as RememberedEvent);
    } catch {
      window.localStorage.removeItem(SELECTED_EVENT_KEY);
    }
  }, [eventId, eventSlug, eventStatus, eventTitle]);

  async function handleLogout() {
    await adminLogout();
    window.localStorage.removeItem(SELECTED_EVENT_KEY);
    router.push("/admin/login");
  }

  const selectedEvent = eventId
    ? { id: eventId, slug: eventSlug, title: eventTitle ?? "Evento", status: eventStatus }
    : rememberedEvent;
  const selectedEventId = selectedEvent?.id;
  const base = selectedEventId ? `/admin/eventos/${selectedEventId}` : "/admin/eventos";
  const label = resolveScreenLabel(pathname, eventId, screenLabel);

  const navGroups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: "Geral",
      items: [
        { href: "/admin/eventos", label: "Eventos", icon: CalendarDays, match: "exact" },
      ],
    },
    ...(selectedEventId
      ? [
          {
            label: "Evento atual",
            items: [
              { href: base, label: "Painel do evento", icon: LayoutDashboard, match: "exact" as const },
              { href: "/admin/eventos/sequencia", label: "Sequência de eventos", icon: Layers3 },
              { href: `${base}/participantes`, label: "Participantes", icon: UsersRound },
              { href: `${base}/perguntas`, label: "Perguntas do evento", icon: ListChecks },
              { href: `${base}/relatorios`, label: "Resultados e relatórios", icon: BarChart3 },
              { href: `${base}/configuracoes`, label: "Configurações", icon: Settings2 },
            ],
          },
        ]
      : []),
  ];

  function isActive(item: NavItem) {
    if (item.match === "exact") {
      return pathname === item.href;
    }
    if (item.href === "/admin/eventos") {
      return pathname === "/admin/eventos";
    }
    if (item.href === base) {
      return pathname === base;
    }
    if (item.label === "Resultados e relatórios") {
      return (
        pathname === `${base}/relatorios` ||
        pathname.includes("/resultados") ||
        pathname.includes("/relatorios/imprimir")
      );
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const aside = (
    <>
      <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
        <p style={{ margin: 0, fontSize: "9.5px", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>Prefeitura de São Luís</p>
        <p style={{ margin: "6px 0 0", fontSize: "20px", fontWeight: 700, letterSpacing: ".14em", lineHeight: 1 }}>SEMCAS</p>
        <p style={{ margin: "7px 0 0", fontSize: "10.5px", lineHeight: 1.45, color: "rgba(255,255,255,.6)" }}>Secretaria Municipal da Criança e Assistência Social</p>
      </div>

      {selectedEventId && selectedEvent?.title && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
          <p style={{ margin: "0 0 6px", fontSize: "9.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.45)" }}>
            Evento atual
          </p>
          <p
            title={selectedEvent.title}
            style={{ margin: 0, fontSize: "12.5px", fontWeight: 600, lineHeight: 1.35, color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {selectedEvent.title}
          </p>
          {selectedEvent.status && eventStatusIndicator[selectedEvent.status] && (
            <p
              style={{ margin: "8px 0 0", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: selectedEvent.status === "open" ? "#7fdcaa" : "rgba(255,255,255,.55)" }}
            >
              <span
                style={{ width: "6px", height: "6px", borderRadius: "99px", background: selectedEvent.status === "open" ? "#65d49b" : "rgba(255,255,255,.40)" }}
                className={selectedEvent.status === "open" ? "animate-pulse" : ""}
              />
              {eventStatusIndicator[selectedEvent.status]!.label}
            </p>
          )}
        </div>
      )}

      <nav aria-label="Navegação principal" style={{ flex: 1, overflowY: "auto", padding: "14px 10px" }}>
        {navGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: "16px" }}>
            <p style={{ margin: "0 0 6px", padding: "0 8px", fontSize: "9.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.38)" }}>
              {group.label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={`${group.label}-${item.label}`}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      minHeight: "38px",
                      padding: "0 10px",
                      borderRadius: "7px",
                      fontSize: "13px",
                      background: active ? "rgba(255,255,255,.13)" : "transparent",
                      color: active ? "#fff" : "rgba(255,255,255,.72)",
                      fontWeight: active ? 600 : 400,
                      textDecoration: "none"
                    }}
                    onMouseOver={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(255,255,255,.09)";
                        e.currentTarget.style.color = "#fff";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(255,255,255,.72)";
                      }
                    }}
                  >
                    <span
                      style={{
                        width: "2px",
                        height: "16px",
                        borderRadius: "2px",
                        background: active ? "#65d49b" : "transparent",
                        flexShrink: 0
                      }}
                    />
                    <item.icon style={{ width: "16px", height: "16px", flexShrink: 0, opacity: 0.9 }} />
                    <span style={{ minWidth: 0, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: "0 0 6px", padding: "0 8px", fontSize: "9.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.38)" }}>
            Sistema
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "38px", padding: "0 12px 0 22px", borderRadius: "7px", fontSize: "13px", color: "rgba(255,255,255,.72)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.09)"; e.currentTarget.style.color = "#fff"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.72)"; }}
            >
              <CircleHelp style={{ width: "16px", height: "16px", opacity: 0.9 }} />
              Ajuda
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "38px", padding: "0 12px 0 22px", borderRadius: "7px", fontSize: "13px", color: "rgba(255,255,255,.72)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.09)"; e.currentTarget.style.color = "#fff"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.72)"; }}
            >
              <LogOut style={{ width: "16px", height: "16px", opacity: 0.9 }} />
              Sair
            </button>
          </div>
        </div>
      </nav>

      <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,.12)", fontSize: "10px", lineHeight: 1.6, color: "rgba(255,255,255,.42)" }}>
        {ORG_TAGLINE.split(" · ").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f7fb" }}>
      {drawerOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="lg:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(11,26,42,.5)", border: "none", cursor: "pointer", width: "100%", height: "100%" }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 transition-transform lg:sticky lg:top-0 lg:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: "244px", flexShrink: 0, background: "#082F57", color: "#fff", display: "flex", flexDirection: "column", height: "100vh", zIndex: 50 }}
      >
        <div className="lg:hidden flex justify-end p-3">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
            style={{ width: "36px", height: "36px", borderRadius: "6px", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "#fff", cursor: "pointer" }}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
        {aside}
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ background: "#fff", borderBottom: "1px solid #dbe4ef", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "0 18px", position: "sticky", top: 0, zIndex: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden"
              style={{ width: "38px", height: "38px", border: "1px solid #dde4ee", background: "#fff", borderRadius: "6px", color: "#0B3A6E", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            >
              <Menu style={{ width: "16px", height: "16px" }} />
            </button>
            <img src="/logo-prefeitura-saoluis.jpg" alt="Prefeitura de São Luís" className="hidden sm:block" style={{ height: "30px", width: "auto" }} />
            <span aria-hidden="true" className="hidden sm:block" style={{ width: "1px", height: "26px", background: "#e2e8f0" }}></span>
            <nav aria-label="Trilha de navegação" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#5b6b7f", minWidth: 0 }}>
              <Link href="/admin/eventos" style={{ color: "#5b6b7f", textDecoration: "none", flexShrink: 0 }} onMouseOver={(e) => e.currentTarget.style.color = "#0B3A6E"} onMouseOut={(e) => e.currentTarget.style.color = "#5b6b7f"}>
                Eventos
              </Link>
              {eventId && (
                <>
                  <span aria-hidden="true" style={{ color: "#c3ccd8" }}>/</span>
                  <span title={eventTitle ?? "Evento"} className="hidden md:inline" style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {eventTitle ?? "Evento"}
                  </span>
                  <span aria-hidden="true" className="hidden md:inline" style={{ color: "#c3ccd8" }}>/</span>
                  <span style={{ fontWeight: 600, color: "#11243c", whiteSpace: "nowrap" }}>{label}</span>
                </>
              )}
            </nav>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
            {eventStatus && eventStatusIndicator[eventStatus] && (
              <span
                className="hidden sm:inline-flex"
                style={{ alignItems: "center", gap: "7px", fontSize: "12.5px", fontWeight: 600, color: eventStatus === "open" ? "#18754A" : "#5b6b7f" }}
              >
                <span
                  style={{ width: "7px", height: "7px", borderRadius: "99px", background: eventStatus === "open" ? "#1a7f4b" : "#8a97a8" }}
                  className={eventStatus === "open" ? "animate-pulse" : ""}
                />
                {eventStatusIndicator[eventStatus]!.label}
              </span>
            )}
            <span aria-hidden="true" className="hidden sm:block" style={{ width: "1px", height: "26px", background: "#e2e8f0" }}></span>
            <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <span aria-hidden="true" style={{ width: "28px", height: "28px", borderRadius: "99px", background: "#0B3A6E", color: "#fff", fontSize: "10.5px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                AD
              </span>
              <span className="hidden sm:inline" style={{ fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
                Administrador
              </span>
            </span>
          </div>
        </header>

        <main className="pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-11" style={{ flex: 1, paddingTop: "26px", paddingLeft: "22px", paddingRight: "22px" }}>
          <div style={{ maxWidth: "1320px", margin: "0 auto" }}>
            {children}
          </div>
        </main>
      </div>

      {selectedEventId && (
        <nav
          aria-label="Navegação do evento"
          className="lg:hidden fixed inset-x-0 bottom-0 z-30 flex items-stretch bg-white border-t border-[#dde4ee]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {(
            [
              { href: base, label: "Painel", icon: LayoutDashboard, active: pathname === base },
              { href: `${base}/participantes`, label: "Participantes", icon: UsersRound, active: pathname.startsWith(`${base}/participantes`) },
              { href: `/projector/${DAILY_ACTIVE_SLUG}`, label: "Projetor", icon: Monitor, active: false, external: true },
              { href: "#menu", label: "Menu", icon: Menu, active: drawerOpen, onClick: () => setDrawerOpen(true) },
            ] as const
          ).map((item) => {
            const content = (
              <>
                <item.icon size={20} strokeWidth={2} />
                <span style={{ fontSize: "11px", fontWeight: 600 }}>{item.label}</span>
              </>
            );
            const className = cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2",
              item.active ? "text-[#0b3a6e]" : "text-[#8a97a8]"
            );
            if ("onClick" in item && item.onClick) {
              return (
                <button key={item.label} type="button" onClick={item.onClick} className={className}>
                  {content}
                </button>
              );
            }
            if ("external" in item && item.external) {
              return (
                <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className={className}>
                  {content}
                </a>
              );
            }
            return (
              <Link key={item.label} href={item.href} className={className}>
                {content}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
