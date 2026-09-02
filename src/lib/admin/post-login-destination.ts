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
  createdAt: string | null;
}

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
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });

    return best ? `/admin/eventos/${best.id}` : "/admin/eventos";
  } catch {
    return "/admin/eventos";
  }
}
