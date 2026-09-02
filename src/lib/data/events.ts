import { shouldUseMockData } from "@/lib/dev/config";
import { getMockEventBySlug } from "@/lib/dev/mock-store";

export interface EventSummary {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status: string;
  requireLiveCode: boolean;
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
  const doc = snap.docs[0]!;
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title as string,
    slug: data.slug as string,
    description: data.description as string | null,
    status: data.status as string,
    requireLiveCode: data.requireLiveCode as boolean,
  };
}

export async function getEventIdFromSlug(slug: string): Promise<string | null> {
  const event = await getEventBySlug(slug);
  return event?.id ?? null;
}
