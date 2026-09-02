import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { getParticipantDisplayName } from "@/lib/utils/participant-display";
import { formatPercent } from "@/lib/utils/format";
import { toIsoString } from "@/lib/firebase/helpers";
import { aggregateSingleChoiceCounts } from "@/lib/reports/aggregate-single-choice";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const db = getAdminDb();

  // Independent reads — fire them together instead of awaiting one at a time.
  const [roundDoc, questionsSnap, submissionsSnap, participantsSnap, eventDoc] = await Promise.all([
    db.doc(`events/${eventId}/rounds/${roundId}`).get(),
    db.collection(`events/${eventId}/rounds/${roundId}/questions`).orderBy("order").get(),
    db.collection(`events/${eventId}/submissions`).where("roundId", "==", roundId).get(),
    db.collection(`events/${eventId}/participants`).get(),
    db.doc(`events/${eventId}`).get(),
  ]);

  if (!roundDoc.exists) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  const participantMap = new Map(participantsSnap.docs.map((d) => [d.id, d.data()]));

  const totalSubmissions = submissionsSnap.size;
  const totalParticipants = eventDoc.data()?.participantCount ?? 0;
  const submissionDatas = submissionsSnap.docs.map((d) => d.data());

  const questions = questionsSnap.docs.map((qDoc) => {
    const q = qDoc.data();
    const questionReport: Record<string, unknown> = {
      id: qDoc.id,
      order: q.order,
      type: q.type,
      title: q.title,
    };

    if (q.type === "single_choice") {
      questionReport.options = aggregateSingleChoiceCounts(
        q.options as string[],
        submissionDatas,
        qDoc.id
      );
    }

    if (q.type === "text") {
      questionReport.answers = submissionsSnap.docs.map((subDoc) => {
        const p = participantMap.get(subDoc.data().participantId);
        const answer = subDoc.data().answers?.find(
          (a: { questionId: string }) => a.questionId === qDoc.id
        );
        return {
          displayName: getParticipantDisplayName({
            mode: subDoc.data().mode,
            name: p?.name ?? null,
          }),
          value: answer?.value ?? "",
        };
      });
    }

    return questionReport;
  });

  const individual = submissionsSnap.docs.map((subDoc) => {
    const p = participantMap.get(subDoc.data().participantId);
    return {
      displayName: getParticipantDisplayName({
        mode: subDoc.data().mode,
        name: p?.name ?? null,
      }),
      submittedAt: subDoc.data().submittedAt ? toIsoString(subDoc.data().submittedAt) : null,
      answers: subDoc.data().answers,
    };
  });

  return NextResponse.json({
    round: { id: roundDoc.id, ...roundDoc.data() },
    summary: {
      totalParticipants,
      totalSubmissions,
      participationRate: formatPercent(totalSubmissions, totalParticipants),
    },
    questions,
    individual,
  });
}
