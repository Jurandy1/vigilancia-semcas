import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { createEventSchema } from "@/lib/validation/event";
import { slugify } from "@/lib/utils/format";
import { toIsoString } from "@/lib/firebase/helpers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const db = getAdminDb();
  const snapshot = await db.collection("events").orderBy("createdAt", "desc").get();

  const events = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title,
      slug: d.slug,
      status: d.status,
      isTest: d.isTest,
      participantCount: d.participantCount ?? 0,
      createdAt: d.createdAt ? toIsoString(d.createdAt) : null,
    };
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const slug = parsed.data.slug || slugify(parsed.data.title);

  const existing = await db.collection("events").where("slug", "==", slug).limit(1).get();
  if (!existing.empty) {
    return NextResponse.json({ error: "Já existe um evento com este slug." }, { status: 409 });
  }

  const now = Timestamp.now();
  const eventRef = db.collection("events").doc();

  await db.runTransaction(async (tx) => {
    tx.set(eventRef, {
      title: parsed.data.title,
      slug,
      description: parsed.data.description ?? null,
      status: "draft",
      isTest: parsed.data.isTest,
      requireLiveCode: parsed.data.requireLiveCode,
      currentOpenRoundId: null,
      participantCount: 0,
      createdAt: now,
      updatedAt: now,
      openedAt: null,
      closedAt: null,
      accessCodeHash: null,
      accessCodeExpiresAt: null,
    });

    tx.set(db.doc(`publicEvents/${eventRef.id}`), {
      id: eventRef.id,
      slug,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: "draft",
      requireLiveCode: parsed.data.requireLiveCode,
      currentOpenRoundId: null,
      currentRoundTitle: null,
      currentRoundStatus: null,
      accessChallenge: null,
      updatedAt: now,
    });
  });

  return NextResponse.json({ success: true, eventId: eventRef.id, slug });
}
