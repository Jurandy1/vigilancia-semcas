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
  const [{ data: rows }, { data: roundRows }] = await Promise.all([
    supabase
      .from("events")
      .select("id,title,slug,status,is_test,order,participant_count,created_at,current_open_round_id,sequence_id,sequence_order,sequence_size,sequence_root_event_id,sequence_root_slug,next_event_id,next_event_title,next_event_slug")
      .order("created_at", { ascending: false }),
    supabase.from("rounds").select("id,event_id,title,completed_count"),
  ]);

  const roundTitleById = new Map((roundRows ?? []).map((round) => [round.id, round.title]));
  const submissionsByEvent = new Map<string, number>();
  for (const round of roundRows ?? []) {
    submissionsByEvent.set(
      round.event_id,
      (submissionsByEvent.get(round.event_id) ?? 0) + (round.completed_count ?? 0)
    );
  }

  const events = (rows ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        status: d.status,
        isTest: d.is_test,
        order: d.order ?? 0,
        participantCount: d.participant_count ?? 0,
        submissionCount: submissionsByEvent.get(d.id) ?? 0,
        currentRoundTitle: d.current_open_round_id
          ? roundTitleById.get(d.current_open_round_id) ?? null
          : null,
        createdAt: d.created_at,
        sequenceId: d.sequence_id ?? null,
        sequenceOrder: d.sequence_order ?? null,
        sequenceSize: d.sequence_size ?? null,
        sequenceRootEventId: d.sequence_root_event_id ?? null,
        sequenceRootSlug: d.sequence_root_slug ?? null,
        nextEventId: d.next_event_id ?? null,
        nextEventTitle: d.next_event_title ?? null,
        nextEventSlug: d.next_event_slug ?? null,
      }));

  return NextResponse.json(
    { events },
    { headers: { "Cache-Control": "no-store" } }
  );
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
