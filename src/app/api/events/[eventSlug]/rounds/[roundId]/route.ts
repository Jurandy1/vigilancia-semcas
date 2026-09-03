import { NextRequest, NextResponse } from "next/server";
import { getEventIdFromSlug } from "@/lib/data/events";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string; roundId: string }> }
) {
  try {
    const { eventSlug, roundId } = await params;

    const eventId = await getEventIdFromSlug(eventSlug);
    if (!eventId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { data: round } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", roundId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!round) {
      return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
    }

    const { data: questionRows } = await supabase
      .from("questions")
      .select("*")
      .eq("round_id", roundId)
      .order("order", { ascending: true });

    const questions = (questionRows ?? []).map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      title: q.title,
      explanation: q.explanation ?? null,
      required: q.required,
      options: q.options ?? undefined,
      maxLength: q.max_length ?? undefined,
      maxSelections: q.max_selections ?? undefined,
    }));

    return NextResponse.json({
      round: {
        id: round.id,
        title: round.title,
        status: round.status,
        order: round.order,
      },
      questions,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar esta etapa." },
      { status: 500 }
    );
  }
}
