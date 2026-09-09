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
  const { data: roundId, error } = await supabase.rpc("create_round_content", {
    p_event_id: eventId,
    p_settings: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      allowNewParticipants: parsed.data.allowNewParticipants,
      resultsVisibility: parsed.data.resultsVisibility,
    },
    p_questions: parsed.data.questions.map((q, index) => ({
      order: q.order ?? index + 1,
      type: q.type,
      title: q.title,
      explanation: q.explanation ?? null,
      required: q.required ?? true,
      options: q.options ?? null,
      maxLength: q.maxLength ?? (q.type === "text" ? 2000 : null),
      maxSelections: q.type === "multi_choice" ? q.maxSelections ?? null : null,
      showIfQuestionOrder: q.showIfQuestionOrder ?? null,
      showIfValue: q.showIfValue ?? null,
    })),
  });

  if (error || !roundId) {
    const status = error?.message === "EVENT_NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Evento não encontrado."
            : "Não foi possível criar a rodada e suas perguntas.",
      },
      { status }
    );
  }

  return NextResponse.json({ success: true, roundId });
}
