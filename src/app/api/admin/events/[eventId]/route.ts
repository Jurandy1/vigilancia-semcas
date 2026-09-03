import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { updateEventSettingsSchema } from "@/lib/validation/event";
import { toIsoString } from "@/lib/firebase/helpers";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const db = getAdminDb();
  const doc = await db.doc(`events/${eventId}`).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const d = doc.data()!;
  const participantsCount = await db.collection(`events/${eventId}/participants`).count().get();
  return NextResponse.json({
    event: {
      id: doc.id,
      title: d.title,
      slug: d.slug,
      description: d.description ?? null,
      projectorTitle: d.projectorTitle ?? null,
      status: d.status,
      isTest: d.isTest ?? false,
      requireLiveCode: d.requireLiveCode ?? false,
      participantCount: participantsCount.data().count,
      createdAt: toIsoString(d.createdAt),
      openedAt: d.openedAt ? toIsoString(d.openedAt) : null,
      closedAt: d.closedAt ? toIsoString(d.closedAt) : null,
      sequenceId: d.sequenceId ?? null,
      sequenceOrder: d.sequenceOrder ?? null,
      sequenceSize: d.sequenceSize ?? null,
      sequenceRootEventId: d.sequenceRootEventId ?? null,
      sequenceRootSlug: d.sequenceRootSlug ?? null,
      nextEventId: d.nextEventId ?? null,
      nextEventTitle: d.nextEventTitle ?? null,
      nextEventSlug: d.nextEventSlug ?? null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const db = getAdminDb();
  const doc = await db.doc(`events/${eventId}`).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateEventSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const now = FieldValue.serverTimestamp();

  const eventUpdates: Record<string, unknown> = { updatedAt: now };
  const publicUpdates: Record<string, unknown> = { updatedAt: now };

  if (parsed.data.title !== undefined) {
    eventUpdates.title = parsed.data.title;
    publicUpdates.title = parsed.data.title;
  }
  if (parsed.data.description !== undefined) {
    eventUpdates.description = parsed.data.description;
    publicUpdates.description = parsed.data.description;
  }
  if (parsed.data.projectorTitle !== undefined) {
    eventUpdates.projectorTitle = parsed.data.projectorTitle;
    publicUpdates.projectorTitle = parsed.data.projectorTitle;
  }
  if (parsed.data.requireLiveCode !== undefined) {
    eventUpdates.requireLiveCode = parsed.data.requireLiveCode;
    publicUpdates.requireLiveCode = parsed.data.requireLiveCode;
  }

  await db.doc(`events/${eventId}`).update(eventUpdates);
  await db.doc(`publicEvents/${eventId}`).set(publicUpdates, { merge: true });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const db = getAdminDb();
  const eventRef = db.doc(`events/${eventId}`);
  const eventDoc = await eventRef.get();
  if (!eventDoc.exists) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const event = eventDoc.data()!;
  if (event.status === "open") {
    return NextResponse.json(
      { error: "Um evento em andamento não pode ser excluído. Encerre-o primeiro." },
      { status: 409 }
    );
  }

  if (event.sequenceId) {
    const sequenceSnap = await db
      .collection("events")
      .where("sequenceId", "==", event.sequenceId)
      .get();
    const remaining = sequenceSnap.docs
      .filter((doc) => doc.id !== eventId)
      .sort((a, b) => (a.data().sequenceOrder ?? 0) - (b.data().sequenceOrder ?? 0));
    const batch = db.batch();

    if (remaining.length >= 2) {
      const root = remaining[0]!;
      remaining.forEach((doc, index) => {
        const next = remaining[index + 1] ?? null;
        const sequence = {
          sequenceId: event.sequenceId,
          sequenceOrder: index,
          sequenceSize: remaining.length,
          sequenceRootEventId: root.id,
          sequenceRootSlug: root.data().slug,
          nextEventId: next?.id ?? null,
          nextEventTitle: next?.data().title ?? null,
          nextEventSlug: next?.data().slug ?? null,
          updatedAt: FieldValue.serverTimestamp(),
        };
        batch.set(doc.ref, sequence, { merge: true });
        batch.set(db.doc(`publicEvents/${doc.id}`), sequence, { merge: true });
      });
    } else {
      remaining.forEach((doc) => {
        const cleared = {
          sequenceId: null,
          sequenceOrder: null,
          sequenceSize: null,
          sequenceRootEventId: null,
          sequenceRootSlug: null,
          nextEventId: null,
          nextEventTitle: null,
          nextEventSlug: null,
          updatedAt: FieldValue.serverTimestamp(),
        };
        batch.set(doc.ref, cleared, { merge: true });
        batch.set(db.doc(`publicEvents/${doc.id}`), cleared, { merge: true });
      });
    }
    await batch.commit();
  }

  await Promise.all([
    db.recursiveDelete(eventRef),
    db.recursiveDelete(db.doc(`publicStats/${eventId}`)),
    db.doc(`publicEvents/${eventId}`).delete(),
  ]);

  return NextResponse.json({ success: true });
}
