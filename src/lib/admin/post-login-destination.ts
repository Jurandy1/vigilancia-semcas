import { adminFetch } from "@/lib/api-client";

const STATUS_PRIORITY: Record<string, number> = {
  open: 0,
  waiting: 1,
  draft: 2,
  closed: 3,
};

interface LoginEventItem {
  id: string;
  status: string;
  order?: number;
  createdAt: string | null;
}

// Evento atual = escolhido só por event.status (nunca pelo status de uma rodada
// dentro dele — um evento "open" com todas as rodadas fechadas continua sendo o
// evento atual). Desempate por `order` (determinístico), com createdAt como
// último recurso para eventos antigos sem `order`.
export async function resolvePostLoginDestination(idToken: string): Promise<string> {
  try {
    const res = await adminFetch("/api/admin/events", idToken);
    if (!res.ok) return "/admin/eventos";
    const data = await res.json();
    const events = (data.events ?? []) as LoginEventItem[];
    if (events.length === 0) return "/admin/eventos";

    const [best] = [...events].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 9;
      const pb = STATUS_PRIORITY[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      const oa = a.order ?? 0;
      const ob = b.order ?? 0;
      if (oa !== ob) return oa - ob;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });

    return best ? `/admin/eventos/${best.id}` : "/admin/eventos";
  } catch {
    return "/admin/eventos";
  }
}
