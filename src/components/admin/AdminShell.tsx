"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Download,
  Calendar,
  HelpCircle,
  LogOut,
  Monitor,
  Home,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/lib/firebase/auth-client";
import { useRouter } from "next/navigation";

interface AdminShellProps {
  children: React.ReactNode;
  eventId?: string;
  eventSlug?: string;
  eventTitle?: string;
}

const navItems = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "participantes", label: "Participantes", icon: Users },
  { href: "rodadas", label: "Rodadas", icon: FileText },
  { href: "relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "relatorios/imprimir", label: "Exportações", icon: Download },
  { href: "configuracoes", label: "Configurações", icon: Settings },
];

export function AdminShell({ children, eventId, eventSlug, eventTitle }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await adminLogout();
    router.push("/admin/login");
  }

  const base = eventId ? `/admin/eventos/${eventId}` : "/admin/eventos";

  const activeItem = eventId
    ? navItems.find((item) => {
        const href = item.href === "dashboard" ? base : `${base}/${item.href}`;
        return pathname === href || (item.href === "dashboard" && pathname === base);
      })
    : null;
  const breadcrumbLabel = activeItem?.label ?? (eventId ? "Dashboard" : "Eventos");

  return (
    <div className="min-h-screen flex bg-[#f4f6f9]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0b3a6e] text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-wide">SEMCAS</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="pb-1 px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Menu</p>
          </div>
          {eventId ? (
            navItems.map((item) => {
              const href = item.href === "dashboard" ? base : `${base}/${item.href}`;
              const isActive = pathname === href || (item.href === "dashboard" && pathname === base);
              return (
                <Link
                  key={item.label}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-[#1a5a9e] text-white font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })
          ) : (
            <Link
              href="/admin/eventos"
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm bg-[#1a5a9e] text-white font-medium"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          )}

          <div className="pt-4 pb-1 px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Eventos</p>
          </div>
          <Link
            href="/admin/eventos"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-white/70 hover:bg-white/10"
          >
            <Calendar className="w-4 h-4" />
            Meus eventos
          </Link>

          <div className="pt-4 pb-1 px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Suporte</p>
          </div>
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-white/70 hover:bg-white/10 w-full">
            <HelpCircle className="w-4 h-4" />
            Ajuda
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-white/70 hover:bg-white/10 w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
            <Home className="w-4 h-4 shrink-0" />
            <span>/</span>
            {eventTitle && (
              <>
                <span className="truncate max-w-[220px]">{eventTitle}</span>
                <span>/</span>
              </>
            )}
            <span className="text-gray-800 font-medium shrink-0">{breadcrumbLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            {eventSlug && (
              <Link
                href={`/projector/${eventSlug}`}
                target="_blank"
                className="flex items-center gap-2 text-sm text-[#0b3a6e] border border-[#0b3a6e]/30 rounded-md px-3 py-1.5 hover:bg-[#0b3a6e]/5 transition-colors"
              >
                <Monitor className="w-4 h-4" />
                Abrir tela do projetor
              </Link>
            )}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-600 font-medium">Evento ao vivo</span>
            </div>
            <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-[#0b3a6e] text-white text-xs font-bold flex items-center justify-center">
                AD
              </div>
              <span className="text-sm font-medium text-gray-700">Administrador</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
