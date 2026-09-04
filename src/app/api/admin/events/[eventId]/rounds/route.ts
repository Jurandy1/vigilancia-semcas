import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { createRoundSchema } from "@/lib/validation/round";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: roundRows } = await supabase
    .from("rounds")
    .select("*")
    .eq("event_id", eventId)
    .order("order", { ascending: true });

  const rounds = (roundRows ?? []).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    title: r.title,
    description: r.description,
    order: r.order,
    type: r.type,
    status: r.status,
    allowNewParticipants: r.allow_new_participants,
    resultsVisibility: r.results_visibility,
    questionCount: r.question_count,
    createdAt: r.created_at,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    submissionCount: r.completed_count ?? 0,
    registeredCount: r.registered_count ?? 0,
  }));

  return NextResponse.json({ rounds });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const body = await request.json();
  const parsed = createRoundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: lastRound } = await supabase
    .from("rounds")
    .select("order")
    .eq("event_id", eventId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (lastRound?.order ?? 0) + 1;

  const { data: round, error } = await supabase
    .from("rounds")
    .insert({
      event_id: eventId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      order: nextOrder,
      type: parsed.data.type,
      status: "draft",
      allow_new_participants: parsed.data.allowNewParticipants,
      results_visibility: parsed.data.resultsVisibility,
      question_count: parsed.data.questions.length,
    })
    .select("id")
    .single();

  if (error || !round) {
    return NextResponse.json({ error: "Não foi possível criar a rodada." }, { status: 500 });
  }

  const questions = parsed.data.questions.map((q, index) => ({
    round_id: round.id,
    order: q.order ?? index + 1,
    type: q.type,
    title: q.title,
    explanation: q.explanation ?? null,
    required: q.required ?? true,
    options: q.options ?? null,
    max_length: q.maxLength ?? (q.type === "text" ? 2000 : null),
    max_selections: q.type === "multi_choice" ? q.maxSelections ?? null : null,
  }));

  await supabase.from("questions").insert(questions);

  return NextResponse.json({ success: true, roundId: round.id });
}
