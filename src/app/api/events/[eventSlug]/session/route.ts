import { NextRequest, NextResponse } from "next/server";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { getEventBySlug } from "@/lib/data/events";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  try {
    const { eventSlug } = await params;
    const event = await getEventBySlug(eventSlug);
    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const eventId = event.id;
    const participant = await getParticipantFromRequest(request, eventId);

    if (!participant) {
      return NextResponse.json({ session: null });
    }

    const supabase = getSupabaseAdmin();

    const { data: prRows } = await supabase
      .from("participant_rounds")
      .select("*")
      .eq("participant_id", participant.id);

    const participantRounds = (prRows ?? []).map((pr) => ({
      id: `${pr.round_id}_${pr.participant_id}`,
      roundId: pr.round_id,
      status: pr.status,
      currentQuestion: pr.current_question,
      completedAt: pr.completed_at ?? null,
    }));

    const { data: publicEvent } = await supabase
      .from("public_events")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    return NextResponse.json({
      session: {
        participantId: participant.id,
        mode: participant.mode,
        name: participant.name,
        eventId,
        eventSlug: event.slug,
        participantRounds,
        currentOpenRoundId: publicEvent?.current_open_round_id ?? null,
        currentRoundTitle: publicEvent?.current_round_title ?? null,
        currentRoundStatus: publicEvent?.current_round_status ?? null,
      },
    });  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Tente novamente." },
      { status: 500 }
    );
  }
}
