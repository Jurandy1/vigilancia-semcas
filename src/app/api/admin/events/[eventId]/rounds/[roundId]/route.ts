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

  // Uma única transação valida e grava perguntas e configurações.
  const questionsPayload = parsed.data.questions.map((q, index) => ({
    order: q.order ?? index + 1,
    type: q.type,
    title: q.title,
    explanation: q.explanation ?? null,
    required: q.required ?? true,
    options: q.options ?? null,
    maxLength: q.maxLength ?? (q.type === "text" ? 2000 : null),
    maxSelections: q.type === "multi_choice" ? q.maxSelections ?? null : null,
  }));

  const { error } = await supabase.rpc("update_round_content", {
    p_event_id: eventId,
    p_round_id: roundId,
    p_questions: questionsPayload,
    p_settings: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      allowNewParticipants: parsed.data.allowNewParticipants,
      resultsVisibility: parsed.data.resultsVisibility,
    },
  });
  if (error) {
    if (error.message === "ROUND_HAS_SUBMISSIONS") {
      return NextResponse.json({ error: ROUND_LOCKED_MESSAGE }, { status: 409 });
    }
    if (error.message === "ROUND_IS_OPEN") {
      return NextResponse.json(
        { error: "Encerre a rodada antes de editar as perguntas." },
        { status: 409 }
      );
    }
    if (error.message === "ROUND_NOT_FOUND") {
      return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
    }
    console.error("Erro ao substituir perguntas:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar as perguntas." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
