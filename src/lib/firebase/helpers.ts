import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AuditAction } from "@/types/index";

export async function writeAuditLog(params: {
  eventId: string;
  action: AuditAction;
  actorType: "participant" | "admin" | "system";
  actorId?: string | null;
  roundId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getAdminDb();
  await db.collection(`events/${params.eventId}/audit`).add({
    eventId: params.eventId,
    action: params.action,
    actorType: params.actorType,
    actorId: params.actorId ?? null,
    roundId: params.roundId ?? null,
    metadata: params.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}

export function toIsoString(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}
