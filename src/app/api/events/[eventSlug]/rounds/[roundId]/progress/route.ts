import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { progressSchema } from "@/lib/validation/submission";
import { getEventIdFromSlugExact } from "@/lib/data/events";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string; roundId: string }> }
) {
  try {
    const { eventSlug, roundId } = await params;
    const [eventId, body] = await Promise.all([getEventIdFromSlugExact(eventSlug), request.json()]);
    if (!eventId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const parsed = progressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const [participant, roundResult] = await Promise.all([
      getParticipantFromRequest(request, eventId),
      supabase.from("rounds").select("status").eq("id", roundId).eq("event_id", eventId).maybeSingle(),
    ]);

    if (!participant) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const round = roundResult.data;
    if (!round || round.status !== "open") {
      return NextResponse.json({ error: "Esta etapa não está aberta." }, { status: 403 });
    }

    const { data: pr } = await supabase
      .from("participant_rounds")
      .select("status")
      .eq("round_id", roundId)
      .eq("participant_id", participant.id)
      .maybeSingle();

    if (pr?.status === "completed") {
      return NextResponse.json({ error: "Participação já registrada." }, { status: 409 });
    }

    await supabase.rpc("update_progress", {
      p_event_id: eventId,
      p_round_id: roundId,
      p_participant_id: participant.id,
      p_current_question: parsed.data.currentQuestion,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao registrar progresso:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Tente novamente." },
      { status: 500 }
    );
  }
}
