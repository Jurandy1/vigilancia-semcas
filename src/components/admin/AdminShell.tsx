"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Radio,
  Settings2,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/lib/firebase/auth-client";

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
  if (pathname === base) return "Visão geral";
  if (pathname.startsWith(`${base}/ao-vivo`)) return "Ao vivo";
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
              { href: base, label: "Visão geral", icon: LayoutDashboard, match: "exact" as const },
              { href: `${base}/ao-vivo`, label: "Ao vivo", icon: Radio },
              { href: "/admin/eventos/sequencia", label: "Sequência de eventos", icon: Layers3 },
              { href: `${base}/participantes`, label: "Participantes", icon: UsersRound },
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
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="h-9 w-1 rounded-full bg-[#65d49b]" />
          <div>
            <div className="text-xl font-bold tracking-[0.15em] text-white">SEMCAS</div>
            <div className="mt-0.5 text-xs text-white/55">Participação e avaliação</div>
          </div>
        </div>
      </div>

      {selectedEventId && selectedEvent?.title && (
        <div className="mx-3 mt-4 rounded-xl border border-white/10 bg-white/[0.07] p-3.5">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[#77d6a7]">
            Evento selecionado
          </p>
          <p className="mt-1.5 mb-0 line-clamp-2 text-[13px] font-semibold leading-snug text-white">
            {selectedEvent.title}
          </p>
        </div>
      )}

      <nav aria-label="Navegação principal" className="flex-1 px-3 py-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-[18px]">
            <p className="m-0 mb-1.5 px-2.5 text-[10px] font-bold tracking-[0.1em] uppercase text-white/40">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={`${group.label}-${item.label}`}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-all",
                      active
                        ? "bg-white text-[#0b3a6e] font-semibold shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-[#18754a]")} />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {active && <ChevronRight className="h-4 w-4 shrink-0 text-[#8aa0b8]" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mb-[18px]">
          <p className="m-0 mb-1.5 px-2.5 text-[10px] font-bold tracking-[0.1em] uppercase text-white/40">
            Sistema
          </p>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-white/70 hover:bg-white/10 hover:text-white"
            >
              <CircleHelp className="h-[18px] w-[18px]" />
              Ajuda
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sair
            </button>
          </div>
        </div>
      </nav>

      <div className="px-5 py-3.5 border-t border-white/14 text-[11px] text-white/45 leading-relaxed">
        Prefeitura de São Luís
        <br />
        Plataforma de participação
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#f4f7fb] text-[#11243c]">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-[rgba(11,26,42,.5)] lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={cn(
          "w-[272px] bg-[linear-gradient(180deg,#0a3b6d_0%,#082f57_65%,#072847_100%)] text-white flex flex-col shrink-0 z-50 shadow-[8px_0_30px_rgba(9,42,75,.08)]",
          "fixed inset-y-0 left-0 transition-transform lg:static lg:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="lg:hidden flex justify-end p-3">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
            className="w-9 h-9 rounded-md border border-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {aside}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white/95 backdrop-blur border-b border-[#dfe7f0] px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden shrink-0 w-[38px] h-[38px] border border-[#dde4ee] bg-white rounded-md text-[#0b3a6e] flex items-center justify-center hover:bg-[#f4f6f9]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <nav
              aria-label="Trilha de navegação"
              className="flex items-center gap-2 text-[13px] text-[#64748b] min-w-0"
            >
              <Link href="/admin/eventos" className="hover:text-[#0b3a6e] hover:underline shrink-0">
                Eventos
              </Link>
              {eventId && (
                <>
                  <span aria-hidden className="text-[#c3ccd8]">
                    /
                  </span>
                  <span className="hidden md:inline max-w-[220px] xl:max-w-[340px] truncate">
                    {eventTitle ?? "Evento"}
                  </span>
                  <span aria-hidden className="hidden md:inline text-[#c3ccd8]">
                    /
                  </span>
                  <span className="text-[#11243c] font-semibold whitespace-nowrap">{label}</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-[18px] shrink-0">
            {eventStatus && eventStatusIndicator[eventStatus] && (
              <span
                className={cn(
                  "hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold",
                  eventStatusIndicator[eventStatus]!.textClassName
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    eventStatusIndicator[eventStatus]!.dotClassName
                  )}
                />
                {eventStatusIndicator[eventStatus]!.label}
              </span>
            )}
            <div className="flex items-center gap-2 pl-[18px] border-l border-[#e2e8f0]">
              <span className="w-[30px] h-[30px] rounded-full bg-[#0b3a6e] text-white text-[11px] font-bold flex items-center justify-center">
                AD
              </span>
              <span className="hidden sm:inline text-[13px] font-semibold text-[#33415c]">
                Administrador
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
          <div className="mx-auto w-full max-w-[1320px] [&>*]:mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
