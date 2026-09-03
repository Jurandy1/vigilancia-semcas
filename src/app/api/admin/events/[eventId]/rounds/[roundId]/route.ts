import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { createRoundSchema } from "@/lib/validation/round";

export const runtime = "nodejs";

const ROUND_LOCKED_MESSAGE = "Esta rodada já recebeu respostas e não pode mais ser editada.";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const supabase = getSupabaseAdmin();

  const [{ data: round }, { data: questionRows }, { count: submissionCount }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).eq("event_id", eventId).maybeSingle(),
    supabase.from("questions").select("*").eq("round_id", roundId).order("order", { ascending: true }),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("round_id", roundId),
  ]);

  if (!round) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  const questions = (questionRows ?? []).map((q) => ({
    id: q.id,
    order: q.order,
    type: q.type,
    title: q.title,
    explanation: q.explanation,
    required: q.required,
    options: q.options,
    maxLength: q.max_length,
    maxSelections: q.max_selections,
  }));

  return NextResponse.json({
    round: {
      id: round.id,
      eventId: round.event_id,
      title: round.title,
      description: round.description,
      order: round.order,
      type: round.type,
      status: round.status,
      allowNewParticipants: round.allow_new_participants,
      resultsVisibility: round.results_visibility,
      questionCount: round.question_count,
      createdAt: round.created_at,
      openedAt: round.opened_at,
      closedAt: round.closed_at,
    },
    questions,
    submissionCount: submissionCount ?? 0,
    editable: (submissionCount ?? 0) === 0,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const body = await request.json();
  const parsed = createRoundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: round } = await supabase
    .from("rounds")
    .select("id")
    .eq("id", roundId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!round) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  const { count: submissionCount } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId);
  if ((submissionCount ?? 0) > 0) {
    return NextResponse.json({ error: ROUND_LOCKED_MESSAGE }, { status: 409 });
  }

  await supabase
    .from("rounds")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      allow_new_participants: parsed.data.allowNewParticipants,
      results_visibility: parsed.data.resultsVisibility,
      question_count: parsed.data.questions.length,
    })
    .eq("id", roundId);

  await supabase.from("questions").delete().eq("round_id", roundId);

  const questions = parsed.data.questions.map((q, index) => ({
    round_id: roundId,
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

  return NextResponse.json({ success: true });
}
