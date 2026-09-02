import { NextRequest, NextResponse } from "next/server";
import { getEventIdFromSlug } from "@/lib/data/events";
import { shouldUseMockData } from "@/lib/dev/config";
import { getMockQuestions, getMockRound } from "@/lib/data/mock-participant";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string; roundId: string }> }
) {
  try {
    const { eventSlug, roundId } = await params;

    if (shouldUseMockData()) {
      const eventId = (await getEventIdFromSlug(eventSlug))!;
      const round = getMockRound(eventId, roundId);
      if (!round) {
        return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
      }
      return NextResponse.json({
        round,
        questions: getMockQuestions(eventId, roundId),
      });
    }

    const eventId = await getEventIdFromSlug(eventSlug);
    if (!eventId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const { getAdminDb } = await import("@/lib/firebase/admin");
    const db = getAdminDb();
    const roundDoc = await db.doc(`events/${eventId}/rounds/${roundId}`).get();
    if (!roundDoc.exists) {
      return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
    }

    const questionsSnap = await db
      .collection(`events/${eventId}/rounds/${roundId}/questions`)
      .orderBy("order")
      .get();

    const questions = questionsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      round: { id: roundDoc.id, ...roundDoc.data() },
      questions,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar esta etapa." },
      { status: 500 }
    );
  }
}
