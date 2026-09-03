import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { createEventSchema } from "@/lib/validation/event";
import { slugify } from "@/lib/utils/format";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  const events = await Promise.all(
    (rows ?? []).map(async (d) => {
      const [{ count: submissionCount }, currentRound] = await Promise.all([
        supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("event_id", d.id),
        d.current_open_round_id
          ? supabase.from("rounds").select("title").eq("id", d.current_open_round_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        id: d.id,
        title: d.title,
        slug: d.slug,
        status: d.status,
        isTest: d.is_test,
        order: d.order ?? 0,
        participantCount: d.participant_count ?? 0,
        submissionCount: submissionCount ?? 0,
        currentRoundTitle: currentRound.data?.title ?? null,
        createdAt: d.created_at,
        sequenceId: d.sequence_id ?? null,
        sequenceOrder: d.sequence_order ?? null,
        sequenceSize: d.sequence_size ?? null,
        sequenceRootEventId: d.sequence_root_event_id ?? null,
        sequenceRootSlug: d.sequence_root_slug ?? null,
        nextEventId: d.next_event_id ?? null,
        nextEventTitle: d.next_event_title ?? null,
        nextEventSlug: d.next_event_slug ?? null,
      };
    })
  );

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const slug = parsed.data.slug || slugify(parsed.data.title);

  const { data: existing } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Já existe um evento com este slug." }, { status: 409 });
  }

  const { data: lastEvent } = await supabase
    .from("events")
    .select("order")
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (lastEvent?.order ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("events")
    .insert({
      title: parsed.data.title,
      slug,
      description: parsed.data.description ?? null,
      projector_title: parsed.data.projectorTitle ?? null,
      order: nextOrder,
      status: "draft",
      is_test: parsed.data.isTest,
      require_live_code: parsed.data.requireLiveCode,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "Não foi possível criar o evento." }, { status: 500 });
  }

  await supabase.from("public_events").insert({
    event_id: inserted.id,
    slug,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    projector_title: parsed.data.projectorTitle ?? null,
    status: "draft",
    require_live_code: parsed.data.requireLiveCode,
  });

  return NextResponse.json({ success: true, eventId: inserted.id, slug });
}
