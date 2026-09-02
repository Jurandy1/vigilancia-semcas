import { NextRequest, NextResponse } from "next/server";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { getEventBySlug } from "@/lib/data/events";
import { shouldUseMockData } from "@/lib/dev/config";
import {
  getMockParticipantRounds,
  getMockPublicEvent,
  getParticipantFromRequestMock,
} from "@/lib/data/mock-participant";

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

    if (shouldUseMockData()) {
      const participant = await getParticipantFromRequestMock(request, eventId);
      if (!participant) {
        return NextResponse.json({ session: null });
      }

      const participantRounds = getMockParticipantRounds(participant.id).map((pr) => ({
        id: pr.id,
        roundId: pr.roundId,
        status: pr.status,
        currentQuestion: pr.currentQuestion,
        completedAt: pr.completedAt,
      }));

      const publicEvent = getMockPublicEvent();

      return NextResponse.json({
        session: {
          participantId: participant.id,
          mode: participant.mode,
          name: participant.name,
          eventId,
          participantRounds,
          currentOpenRoundId: publicEvent.currentOpenRoundId,
          currentRoundTitle: publicEvent.currentRoundTitle,
          currentRoundStatus: publicEvent.currentRoundStatus,
        },
      });
    }

    const participant = await getParticipantFromRequest(request, eventId);

    if (!participant) {
      return NextResponse.json({ session: null });
    }

    const { getAdminDb } = await import("@/lib/firebase/admin");
    const { toIsoString } = await import("@/lib/firebase/helpers");
    const db = getAdminDb();

    const participantRoundsSnap = await db
      .collection(`events/${eventId}/participantRounds`)
      .where("participantId", "==", participant.id)
      .get();

    const participantRounds = participantRoundsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        roundId: d.roundId,
        status: d.status,
        currentQuestion: d.currentQuestion,
        completedAt: d.completedAt ? toIsoString(d.completedAt) : null,
      };
    });

    const publicEventDoc = await db.doc(`publicEvents/${eventId}`).get();
    const publicEvent = publicEventDoc.exists ? publicEventDoc.data() : null;

    return NextResponse.json({
      session: {
        participantId: participant.id,
        mode: participant.mode,
        name: participant.name,
        eventId,
        participantRounds,
        currentOpenRoundId: publicEvent?.currentOpenRoundId ?? null,
        currentRoundTitle: publicEvent?.currentRoundTitle ?? null,
        currentRoundStatus: publicEvent?.currentRoundStatus ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Tente novamente." },
      { status: 500 }
    );
  }
}
