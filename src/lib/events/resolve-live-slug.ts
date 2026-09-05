import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve o evento “ao vivo” para o alias /atual e o projetor fixo:
 * 1) evento `open` (só existe um no sistema);
 * 2) senão, o primeiro `waiting`/`draft` de uma sequência (ordem da fila);
 * 3) senão, qualquer `waiting`/`draft` avulso.
 *
 * Substitui a marca manual `is_daily_active` — todos os eventos não iniciados
 * da sequência já são “do dia”.
 */
export async function resolveLivePublicEventSlug(
  supabase: Pick<SupabaseClient, "from">
): Promise<{ slug: string; via: "open" | "sequence" | "waiting" } | null> {
  const { data: openRow, error: openError } = await supabase
    .from("public_events")
    .select("slug")
    .eq("status", "open")
    .maybeSingle();
  if (openError) throw openError;
  if (openRow?.slug) {
    return { slug: openRow.slug as string, via: "open" };
  }

  const { data: sequenced, error: sequencedError } = await supabase
    .from("public_events")
    .select("slug")
    .in("status", ["waiting", "draft"])
    .not("sequence_id", "is", null)
    .order("sequence_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (sequencedError) throw sequencedError;
  if (sequenced?.slug) {
    return { slug: sequenced.slug as string, via: "sequence" };
  }

  const { data: solo, error: soloError } = await supabase
    .from("public_events")
    .select("slug")
    .in("status", ["waiting", "draft"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (soloError) throw soloError;
  if (solo?.slug) {
    return { slug: solo.slug as string, via: "waiting" };
  }

  return null;
}
