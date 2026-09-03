import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { getParticipantDisplayName } from "@/lib/utils/participant-display";
import { toIsoString } from "@/lib/firebase/helpers";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("roundId");

  const db = getAdminDb();
  const eventDoc = await db.doc(`events/${eventId}`).get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const eventData = eventDoc.data()!;
  const event = {
    id: eventDoc.id,
    title: eventData.title,
    slug: eventData.slug,
    status: eventData.status,
    participantCount: eventData.participantCount ?? 0,
    openedAt: eventData.openedAt ? toIsoString(eventData.openedAt) : null,
    createdAt: toIsoString(eventData.createdAt),
    sequenceId: eventData.sequenceId ?? null,
    sequenceOrder: eventData.sequenceOrder ?? null,
    sequenceSize: eventData.sequenceSize ?? null,
    sequenceRootEventId: eventData.sequenceRootEventId ?? null,
    sequenceRootSlug: eventData.sequenceRootSlug ?? null,
    nextEventId: eventData.nextEventId ?? null,
    nextEventTitle: eventData.nextEventTitle ?? null,
    nextEventSlug: eventData.nextEventSlug ?? null,
  };

  let participantRoundsQuery = db.collection(`events/${eventId}/participantRounds`);
  if (roundId) {
    participantRoundsQuery = participantRoundsQuery.where(
      "roundId",
      "==",
      roundId
    ) as typeof participantRoundsQuery;
  }

  // Independent reads — fire them together instead of awaiting one at a time.
  const [roundDoc, participantsSnap, prSnap, roundsSnap, shardsSnap, roundSubmissionsSnap] =
    await Promise.all([
      roundId ? db.doc(`events/${eventId}/rounds/${roundId}`).get() : Promise.resolve(null),
      db.collection(`events/${eventId}/participants`).orderBy("createdAt", "desc").get(),
      participantRoundsQuery.get(),
      db.collection(`events/${eventId}/rounds`).orderBy("order").get(),
      roundId
        ? db.collection(`publicStats/${eventId}/rounds/${roundId}/shards`).get()
        : Promise.resolve(null),
      roundId
        ? db.collection(`events/${eventId}/submissions`).where("roundId", "==", roundId).get()
        : Promise.resolve(null),
    ]);

  event.participantCount = participantsSnap.size;

  const questionCount = roundDoc?.data()?.questionCount ?? 0;

  const prMap = new Map(prSnap.docs.map((d) => [d.data().participantId, d.data()]));

  const participants = participantsSnap.docs.map((doc) => {
    const d = doc.data();
    const pr = roundId ? prMap.get(doc.id) : null;
    const status = pr?.status ?? "waiting";
    return {
      id: doc.id,
      displayName: getParticipantDisplayName({ mode: d.mode, name: d.name }),
      mode: d.mode,
      status,
      currentQuestion: pr?.currentQuestion ?? 0,
      questionCount,
      startedAt: pr?.startedAt ? toIsoString(pr.startedAt) : null,
      completedAt: pr?.completedAt ? toIsoString(pr.completedAt) : null,
      lastActivityAt: toIsoString(d.lastActivityAt),
    };
  });

  // Per-round submission counts — reuse the round's docs we already fetched instead of a redundant count() query.
  const rounds = await Promise.all(
    roundsSnap.docs.map(async (doc) => {
      const submissionCount =
        doc.id === roundId && roundSubmissionsSnap
          ? roundSubmissionsSnap.size
          : (
              await db
                .collection(`events/${eventId}/submissions`)
                .where("roundId", "==", doc.id)
                .count()
                .get()
            ).data().count;

      return {
        id: doc.id,
        title: doc.data().title,
        status: doc.data().status,
        order: doc.data().order,
        submissionCount,
      };
    })
  );

  const stats = { registered: 0, answering: 0, completed: 0 };
  if (shardsSnap) {
    shardsSnap.docs.forEach((doc) => {
      const d = doc.data();
      stats.registered += d.registered ?? 0;
      stats.answering += d.answering ?? 0;
      stats.completed += d.completed ?? 0;
    });
  }

  let timeline: Array<{ time: string; count: number }> = [];
  const completionTimestamps = prSnap.docs
    .map((d) => d.data().completedAt)
    .filter((v): v is FirebaseFirestore.Timestamp => Boolean(v))
    .map((ts) => ts.toDate().getTime())
    .sort((a, b) => a - b);

  if (completionTimestamps.length > 0) {
    const startMs = eventData.openedAt
      ? eventData.openedAt.toDate().getTime()
      : completionTimestamps[0]!;
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
    .map((p) => ({
      displayName: p.displayName,
      completedAt: p.completedAt,
    }));

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
