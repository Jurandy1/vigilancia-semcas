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
  return NextResponse.json({
    event: {
      id: doc.id,
      title: d.title,
      slug: d.slug,
      description: d.description ?? null,
      status: d.status,
      isTest: d.isTest ?? false,
      requireLiveCode: d.requireLiveCode ?? false,
      participantCount: d.participantCount ?? 0,
      createdAt: toIsoString(d.createdAt),
      openedAt: d.openedAt ? toIsoString(d.openedAt) : null,
      closedAt: d.closedAt ? toIsoString(d.closedAt) : null,
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

  await db.doc(`events/${eventId}`).update({
    requireLiveCode: parsed.data.requireLiveCode,
    updatedAt: now,
  });

  await db.doc(`publicEvents/${eventId}`).set(
    { requireLiveCode: parsed.data.requireLiveCode, updatedAt: now },
    { merge: true }
  );

  return NextResponse.json({ success: true, requireLiveCode: parsed.data.requireLiveCode });
}
