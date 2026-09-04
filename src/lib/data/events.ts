import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";

export { DAILY_ACTIVE_SLUG };

export interface EventSummary {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status: string;
  requireLiveCode: boolean;
  sequenceId?: string | null;
  sequenceOrder?: number | null;
  sequenceRootSlug?: string | null;
}

function mapRow(row: Record<string, unknown>): EventSummary {
  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    status: row.status as string,
    requireLiveCode: row.require_live_code as boolean,
    sequenceId: (row.sequence_id as string | null) ?? null,
    sequenceOrder: (row.sequence_order as number | null) ?? null,
    sequenceRootSlug: (row.sequence_root_slug as string | null) ?? null,
  };
}

/**
 * Resolve slug considerando o alias `atual` e o fallback de sequência: se o
 * evento pedido pertence a uma sequência mas não está `open`, retorna o
 * evento efetivamente ativo (ou o mais próximo). Use apenas em pontos de
 * ENTRADA do participante — a página `/e/<slug>` e o `/api/events/<slug>/session`.
 * NÃO use em rotas que recebem um `roundId` amarrado ao slug: no exato
 * momento em que o admin avança a sequência, este fallback resolveria para o
 * evento seguinte e as queries com `event_id + round_id` voltariam vazias,
 * bloqueando o submit do participante que estava terminando.
 */
export async function getEventBySlug(slug: string): Promise<EventSummary | null> {
  const supabase = getSupabaseAdmin();
  const { data } =
    slug === DAILY_ACTIVE_SLUG
      ? await supabase.from("events").select("*").eq("is_daily_active", true).maybeSingle()
      : await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;

  let row = data;

  if (row.sequence_id && row.status !== "open") {
    const { data: sequenceRows } = await supabase
      .from("events")
      .select("*")
      .eq("sequence_id", row.sequence_id)
      .order("sequence_order", { ascending: true });

    const ordered = sequenceRows ?? [];
    const active =
      ordered.find((item) => item.status === "open") ??
      ordered.find((item) => item.status !== "closed") ??
      ordered[ordered.length - 1];
    if (active) row = active;
  }

  return mapRow(row);
}

/**
 * Resolve slug SEM aplicar fallback de sequência. Use em rotas que trabalham
 * com identificadores derivados do evento (`roundId`, `participantId`),
 * onde retornar outro evento quebra a integridade da requisição.
 * Aceita também o alias `atual`, mas nesse caso resolve para o evento
 * marcado como do dia (sem seguir a sequência para frente).
 */
export async function getEventBySlugExact(slug: string): Promise<EventSummary | null> {
  const supabase = getSupabaseAdmin();
  const { data } =
    slug === DAILY_ACTIVE_SLUG
      ? await supabase.from("events").select("*").eq("is_daily_active", true).maybeSingle()
      : await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  return mapRow(data);
}

export async function getEventIdFromSlug(slug: string): Promise<string | null> {
  const event = await getEventBySlug(slug);
  return event?.id ?? null;
}

/** Variante exata (sem fallback) — use em rotas com roundId/participantId. */
export async function getEventIdFromSlugExact(slug: string): Promise<string | null> {
  const event = await getEventBySlugExact(slug);
  return event?.id ?? null;
}
