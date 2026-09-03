import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

export async function getEventBySlug(slug: string): Promise<EventSummary | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;

  let row = data;

  // Um QR Code de uma sequência sempre aponta para o evento ativo. Quando o
  // primeiro termina, o mesmo endereço passa a abrir automaticamente o próximo.
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

  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    description: row.description as string | null,
    status: row.status as string,
    requireLiveCode: row.require_live_code as boolean,
    sequenceId: (row.sequence_id as string | null) ?? null,
    sequenceOrder: (row.sequence_order as number | null) ?? null,
    sequenceRootSlug: (row.sequence_root_slug as string | null) ?? null,
  };
}

export async function getEventIdFromSlug(slug: string): Promise<string | null> {
  const event = await getEventBySlug(slug);
  return event?.id ?? null;
}
