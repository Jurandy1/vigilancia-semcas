import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { getParticipantDisplayName } from "@/lib/utils/participant-display";
import { formatPercent } from "@/lib/utils/format";
import { aggregateChoiceCounts } from "@/lib/reports/aggregate-choice-counts";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const supabase = getSupabaseAdmin();

  const [{ data: round }, { data: questionRows }, { data: submissionRows }, { data: participantRows }] =
    await Promise.all([
      supabase.from("rounds").select("*").eq("id", roundId).eq("event_id", eventId).maybeSingle(),
      supabase.from("questions").select("*").eq("round_id", roundId).order("order", { ascending: true }),
      supabase.from("submissions").select("*").eq("round_id", roundId),
      supabase.from("participants").select("*").eq("event_id", eventId),
    ]);

  if (!round) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  const participantMap = new Map((participantRows ?? []).map((p) => [p.id, p]));
  const submissions = submissionRows ?? [];
  const totalSubmissions = submissions.length;
  const totalParticipants = (participantRows ?? []).length;

  const questions = (questionRows ?? []).map((q) => {
    const questionReport: Record<string, unknown> = {
      id: q.id,
      order: q.order,
      type: q.type,
      title: q.title,
      explanation: q.explanation ?? null,
    };

    if (q.type === "single_choice" || q.type === "multi_choice") {
      questionReport.options = aggregateChoiceCounts(
        (q.options as string[]) ?? [],
        submissions.map((s) => ({ answers: s.answers })),
        q.id
      );
      questionReport.allowsMultiple = q.type === "multi_choice";
      questionReport.otherAnswers = submissions
        .map((sub) => {
          const answer = (sub.answers as Array<{ questionId: string; otherText?: string }>)?.find(
            (item) => item.questionId === q.id
          );
          if (!answer?.otherText) return null;
          const participant = participantMap.get(sub.participant_id);
          return {
            displayName: getParticipantDisplayName({ mode: sub.mode, name: participant?.name ?? null }),
            value: String(answer.otherText).trim(),
          };
        })
        .filter(Boolean);
    }

    if (q.type === "text") {
      questionReport.answers = submissions
        .map((sub) => {
          const p = participantMap.get(sub.participant_id);
          const answer = (sub.answers as Array<{ questionId: string; value: unknown }>)?.find(
            (a) => a.questionId === q.id
          );
          return {
            displayName: getParticipantDisplayName({ mode: sub.mode, name: p?.name ?? null }),
            value: typeof answer?.value === "string" ? answer.value.trim() : "",
          };
        })
        .filter((answer) => answer.value.length > 0);
    }

    return questionReport;
  });

  const individual = submissions.map((sub) => {
    const p = participantMap.get(sub.participant_id);
    return {
      displayName: getParticipantDisplayName({ mode: sub.mode, name: p?.name ?? null }),
      submittedAt: sub.submitted_at,
      answers: sub.answers,
    };
  });

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
    },
    summary: {
      totalParticipants,
      totalSubmissions,
      participationRate: formatPercent(totalSubmissions, totalParticipants),
    },
    questions,
    individual,
  });
}
