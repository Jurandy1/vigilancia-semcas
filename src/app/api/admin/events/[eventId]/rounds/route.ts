import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
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
  const db = getAdminDb();

  const roundsSnap = await db
    .collection(`events/${eventId}/rounds`)
    .orderBy("order")
    .get();

  const rounds = await Promise.all(
    roundsSnap.docs.map(async (doc) => {
      const submissionsSnap = await db
        .collection(`events/${eventId}/submissions`)
        .where("roundId", "==", doc.id)
        .count()
        .get();
      return {
        id: doc.id,
        ...doc.data(),
        submissionCount: submissionsSnap.data().count,
      };
    })
  );

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

  const db = getAdminDb();
  const existingRounds = await db
    .collection(`events/${eventId}/rounds`)
    .orderBy("order", "desc")
    .limit(1)
    .get();

  const nextOrder = existingRounds.empty ? 1 : (existingRounds.docs[0]!.data().order ?? 0) + 1;
  const now = Timestamp.now();
  const roundRef = db.collection(`events/${eventId}/rounds`).doc();

  await db.runTransaction(async (tx) => {
    tx.set(roundRef, {
      eventId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      order: nextOrder,
      type: parsed.data.type,
      status: "draft",
      allowNewParticipants: parsed.data.allowNewParticipants,
      resultsVisibility: parsed.data.resultsVisibility,
      questionCount: parsed.data.questions.length,
      createdAt: now,
      openedAt: null,
      closedAt: null,
    });

    parsed.data.questions.forEach((q, index) => {
      const qRef = db
        .collection(`events/${eventId}/rounds/${roundRef.id}/questions`)
        .doc();
      tx.set(qRef, {
        order: q.order ?? index + 1,
        type: q.type,
        title: q.title,
        required: q.required ?? true,
        options: q.options ?? null,
        maxLength: q.maxLength ?? (q.type === "text" ? 2000 : null),
      });
    });
  });

  return NextResponse.json({ success: true, roundId: roundRef.id });
}
