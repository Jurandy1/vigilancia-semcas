import { adminFetch } from "@/lib/api-client";

/**
 * Após o login, manda o admin para o mesmo evento que /e/atual aponta
 * (open → 1º da sequência waiting/draft → qualquer waiting/draft).
 */
export async function resolvePostLoginDestination(idToken: string): Promise<string> {
  try {
    const currentRes = await adminFetch("/api/admin/events/current", idToken, { cache: "no-store" });
    if (currentRes.ok) {
      const current = (await currentRes.json()) as { event: { id: string } | null };
      if (current.event?.id) return `/admin/eventos/${current.event.id}`;
    }

    const res = await adminFetch("/api/admin/events", idToken);
    if (!res.ok) return "/admin/eventos";
    const data = await res.json();
    const events = (data.events ?? []) as Array<{ id: string }>;
    return events[0] ? `/admin/eventos/${events[0].id}` : "/admin/eventos";
  } catch {
    return "/admin/eventos";
  }
}
