import { shouldUseMockData } from "@/lib/dev/config";
import { getMockEventBySlug } from "@/lib/dev/mock-store";

export interface EventSummary {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status: string;
  requireLiveCode: boolean;
  sequenceId?: string | null;
  sequenceOrder?: number | null;
  sequenceRootSlug?: string | null;
}

export async function getEventBySlug(slug: string): Promise<EventSummary | null> {
  if (shouldUseMockData()) {
    const mock = getMockEventBySlug(slug);
    if (!mock) return null;
    return {
      id: mock.id,
      title: mock.title,
      slug: mock.slug,
      description: mock.description,
      status: mock.status,
      requireLiveCode: mock.requireLiveCode,
    };
  }

  const { getAdminDb } = await import("@/lib/firebase/admin");
  const db = getAdminDb();
  const snap = await db.collection("events").where("slug", "==", slug).limit(1).get();
  if (snap.empty) return null;
  let doc = snap.docs[0]!;
  let data = doc.data();

  // Um QR Code de uma sequência sempre aponta para o evento ativo. Quando o
  // primeiro termina, o mesmo endereço passa a abrir automaticamente o próximo.
  if (data.sequenceId && data.status !== "open") {
    const sequenceSnap = await db
      .collection("events")
      .where("sequenceId", "==", data.sequenceId)
      .get();
    const ordered = sequenceSnap.docs.sort(
      (a, b) => (a.data().sequenceOrder ?? 0) - (b.data().sequenceOrder ?? 0)
    );
    const active =
      ordered.find((item) => item.data().status === "open") ??
      ordered.find((item) => item.data().status !== "closed") ??
      ordered[ordered.length - 1];
    if (active) {
      doc = active;
      data = active.data();
    }
  }

  return {
    id: doc.id,
    title: data.title as string,
    slug: data.slug as string,
    description: data.description as string | null,
    status: data.status as string,
    requireLiveCode: data.requireLiveCode as boolean,
    sequenceId: (data.sequenceId as string | null) ?? null,
    sequenceOrder: (data.sequenceOrder as number | null) ?? null,
    sequenceRootSlug: (data.sequenceRootSlug as string | null) ?? null,
  };
}

export async function getEventIdFromSlug(slug: string): Promise<string | null> {
  const event = await getEventBySlug(slug);
  return event?.id ?? null;
}
