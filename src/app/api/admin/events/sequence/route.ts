import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";

export const runtime = "nodejs";

const sequenceSchema = z.object({
  eventIds: z
    .array(z.string().trim().min(1))
    .min(2, "Selecione pelo menos dois eventos.")
    .max(50, "Uma sequência pode ter no máximo 50 eventos.")
    .refine((ids) => new Set(ids).size === ids.length, "A sequência contém eventos repetidos."),
});

const EMPTY_SEQUENCE = {
  sequence_id: null,
  sequence_order: null,
  sequence_size: null,
  sequence_root_event_id: null,
  sequence_root_slug: null,
  next_event_id: null,
  next_event_title: null,
  next_event_slug: null,
};

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const parsed = sequenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Sequência inválida." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase.from("events").select("*").in("id", parsed.data.eventIds);
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));

  const missing = parsed.data.eventIds.find((id) => !byId.has(id));
  if (missing) {
    return NextResponse.json({ error: "Um dos eventos selecionados não existe mais." }, { status: 404 });
  }

  const docs = parsed.data.eventIds.map((id) => byId.get(id)!);
  const unavailable = docs.find((row) => row.status === "open" || row.status === "closed");
  if (unavailable) {
    return NextResponse.json(
      { error: "Organize a sequência antes de iniciar os eventos. Eventos iniciados ou encerrados não podem ser reordenados." },
      { status: 409 }
    );
  }

  const previousSequenceIds = Array.from(
    new Set(docs.map((row) => row.sequence_id as string | null).filter(Boolean))
  ) as string[];

  const previousMembers = previousSequenceIds.length
    ? ((await supabase.from("events").select("*").in("sequence_id", previousSequenceIds)).data ?? [])
    : [];

  const sequenceId = crypto.randomUUID();
  const root = docs[0]!;
  const selectedIds = new Set(parsed.data.eventIds);
  const touched = new Set<string>();

  for (const member of previousMembers) {
    if (touched.has(member.id) || selectedIds.has(member.id)) continue;
    touched.add(member.id);
    const cleared = { ...EMPTY_SEQUENCE, updated_at: new Date().toISOString() };
    await supabase.from("events").update(cleared).eq("id", member.id);
    await supabase.from("public_events").update(cleared).eq("event_id", member.id);
  }

  for (const [index, row] of docs.entries()) {
    const next = docs[index + 1] ?? null;
    const sequence = {
      sequence_id: sequenceId,
      sequence_order: index,
      sequence_size: docs.length,
      sequence_root_event_id: root.id,
      sequence_root_slug: root.slug as string,
      next_event_id: next?.id ?? null,
      next_event_title: next?.title ?? null,
      next_event_slug: next?.slug ?? null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("events").update(sequence).eq("id", row.id);
    await supabase.from("public_events").update(sequence).eq("event_id", row.id);
  }

  return NextResponse.json({
    success: true,
    sequenceId,
    rootEventId: root.id,
    rootSlug: root.slug,
    count: docs.length,
  });
}
