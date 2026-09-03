import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { getParticipantDisplayName } from "@/lib/utils/participant-display";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const requestedRoundId = searchParams.get("roundId");

  const supabase = getSupabaseAdmin();
  const { data: eventData } = await supabase
    .from("events")
    .select("id,title,slug,status,participant_count,opened_at,closed_at,created_at,current_open_round_id,sequence_id,sequence_order,sequence_size,sequence_root_event_id,sequence_root_slug,next_event_id,next_event_title,next_event_slug")
    .eq("id", eventId)
    .maybeSingle();
  if (!eventData) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const event = {
    id: eventData.id,
    title: eventData.title,
    slug: eventData.slug,
    status: eventData.status,
    participantCount: eventData.participant_count ?? 0,
    openedAt: eventData.opened_at ?? null,
    closedAt: eventData.closed_at ?? null,
    createdAt: eventData.created_at,
    sequenceId: eventData.sequence_id ?? null,
    sequenceOrder: eventData.sequence_order ?? null,
    sequenceSize: eventData.sequence_size ?? null,
    sequenceRootEventId: eventData.sequence_root_event_id ?? null,
    sequenceRootSlug: eventData.sequence_root_slug ?? null,
    nextEventId: eventData.next_event_id ?? null,
    nextEventTitle: eventData.next_event_title ?? null,
    nextEventSlug: eventData.next_event_slug ?? null,
  };

  const roundId = requestedRoundId ?? eventData.current_open_round_id ?? null;

  const [participantsResult, roundResult, roundsResult, prResult] = await Promise.all([
    supabase
      .from("participants")
      .select("id,mode,name,last_activity_at,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    roundId
      ? supabase
          .from("rounds")
          .select("id,question_count,registered_count,answering_count,completed_count")
          .eq("id", roundId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("rounds")
      .select("id,title,status,order,completed_count")
      .eq("event_id", eventId)
      .order("order", { ascending: true }),
    roundId
      ? supabase
          .from("participant_rounds")
          .select("participant_id,status,current_question,started_at,completed_at")
          .eq("round_id", roundId)
      : Promise.resolve({ data: [] }),
  ]);

  const participantRows = participantsResult.data ?? [];
  const prRows = prResult.data ?? [];
  const prMap = new Map(prRows.map((pr) => [pr.participant_id, pr]));
  const questionCount = roundResult.data?.question_count ?? 0;

  const participants = participantRows.map((p) => {
    const pr = prMap.get(p.id);
    const status = pr?.status ?? "waiting";
    return {
      id: p.id,
      displayName: getParticipantDisplayName({ mode: p.mode, name: p.name }),
      mode: p.mode,
      status,
      currentQuestion: pr?.current_question ?? 0,
      questionCount,
      startedAt: pr?.started_at ?? null,
      completedAt: pr?.completed_at ?? null,
      lastActivityAt: p.last_activity_at,
    };
  });

  const rounds = (roundsResult.data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    order: r.order,
    submissionCount: r.completed_count ?? 0,
  }));

  const currentRoundRow = roundResult.data;
  const stats = {
    registered: currentRoundRow?.registered_count ?? 0,
    answering: currentRoundRow?.answering_count ?? 0,
    completed: currentRoundRow?.completed_count ?? 0,
  };

  let timeline: Array<{ time: string; count: number }> = [];
  const completionTimestamps = prRows
    .map((pr) => pr.completed_at)
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime())
    .sort((a, b) => a - b);

  if (completionTimestamps.length > 0) {
    const startMs = eventData.opened_at ? new Date(eventData.opened_at).getTime() : completionTimestamps[0]!;
    const endMs = Math.max(Date.now(), completionTimestamps[completionTimestamps.length - 1]!);
    const BUCKETS = 8;
    const span = Math.max(endMs - startMs, 60_000);
    const bucketMs = span / BUCKETS;

    timeline = Array.from({ length: BUCKETS + 1 }, (_, i) => {
      const bucketEnd = startMs + i * bucketMs;
      const count = completionTimestamps.filter((t) => t <= bucketEnd).length;
      return { time: new Date(bucketEnd).toISOString(), count };
    });
  }

  const recentCompletions = participants
    .filter((p) => p.status === "completed" && p.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 5)
    .map((p) => ({ displayName: p.displayName, completedAt: p.completedAt }));

  return NextResponse.json({
    event,
    participants,
    rounds,
    stats,
    recentCompletions,
    questionCount,
    timeline,
  });
}
