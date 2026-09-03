import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";

export const runtime = "nodejs";

const sequenceSchema = z.object({
  eventIds: z
    .array(z.string().trim().min(1))
    .min(2, "Selecione pelo menos dois eventos.")
    .max(50, "Uma sequência pode ter no máximo 50 eventos.")
    .refine((ids) => new Set(ids).size === ids.length, "A sequência contém eventos repetidos."),
});

const EMPTY_SEQUENCE = {
  sequenceId: null,
  sequenceOrder: null,
  sequenceSize: null,
  sequenceRootEventId: null,
  sequenceRootSlug: null,
  nextEventId: null,
  nextEventTitle: null,
  nextEventSlug: null,
};

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const parsed = sequenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Sequência inválida." },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const docs = await Promise.all(parsed.data.eventIds.map((id) => db.doc(`events/${id}`).get()));
  const missing = docs.find((doc) => !doc.exists);
  if (missing) {
    return NextResponse.json({ error: "Um dos eventos selecionados não existe mais." }, { status: 404 });
  }

  const unavailable = docs.find((doc) => {
    const status = doc.data()!.status;
    return status === "open" || status === "closed";
  });
  if (unavailable) {
    return NextResponse.json(
      { error: "Organize a sequência antes de iniciar os eventos. Eventos iniciados ou encerrados não podem ser reordenados." },
      { status: 409 }
    );
  }

  const previousSequenceIds = Array.from(
    new Set(docs.map((doc) => doc.data()!.sequenceId as string | undefined).filter(Boolean))
  ) as string[];
  const previousMembers = (
    await Promise.all(
      previousSequenceIds.map((sequenceId) =>
        db.collection("events").where("sequenceId", "==", sequenceId).get()
      )
    )
  ).flatMap((snapshot) => snapshot.docs);

  const sequenceId = crypto.randomUUID();
  const root = docs[0]!;
  const rootData = root.data()!;
  const batch = db.batch();
  const touched = new Set<string>();
  const selectedIds = new Set(parsed.data.eventIds);

  for (const member of previousMembers) {
    if (touched.has(member.id) || selectedIds.has(member.id)) continue;
    touched.add(member.id);
    batch.set(member.ref, { ...EMPTY_SEQUENCE, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(
      db.doc(`publicEvents/${member.id}`),
      { ...EMPTY_SEQUENCE, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  docs.forEach((doc, index) => {
    const next = docs[index + 1] ?? null;
    const nextData = next?.data();
    const sequence = {
      sequenceId,
      sequenceOrder: index,
      sequenceSize: docs.length,
      sequenceRootEventId: root.id,
      sequenceRootSlug: rootData.slug as string,
      nextEventId: next?.id ?? null,
      nextEventTitle: (nextData?.title as string | undefined) ?? null,
      nextEventSlug: (nextData?.slug as string | undefined) ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(doc.ref, sequence, { merge: true });
    batch.set(db.doc(`publicEvents/${doc.id}`), sequence, { merge: true });
  });

  await batch.commit();

  return NextResponse.json({
    success: true,
    sequenceId,
    rootEventId: root.id,
    rootSlug: rootData.slug,
    count: docs.length,
  });
}
