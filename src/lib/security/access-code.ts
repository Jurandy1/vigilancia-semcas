import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  generateAccessCode,
  hashAccessCode,
} from "@/lib/sessions/tokens";

const ROTATION_SECONDS = 60;

export async function rotateAccessCode(eventId: string): Promise<string> {
  const db = getAdminDb();
  const code = generateAccessCode();
  const hash = hashAccessCode(code);
  const expiresAt = new Date(Date.now() + ROTATION_SECONDS * 1000);

  await db.doc(`events/${eventId}`).update({
    accessCodeHash: hash,
    accessCodeExpiresAt: Timestamp.fromDate(expiresAt),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`publicEvents/${eventId}`).set(
    {
      accessChallenge: {
        code,
        expiresAt: expiresAt.toISOString(),
        rotationSeconds: ROTATION_SECONDS,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return code;
}

export async function validateAccessCode(
  eventId: string,
  inputCode: string
): Promise<boolean> {
  const db = getAdminDb();
  const eventDoc = await db.doc(`events/${eventId}`).get();
  if (!eventDoc.exists) return false;

  const data = eventDoc.data()!;
  if (!data.requireLiveCode) return true;
  if (!data.accessCodeHash || !data.accessCodeExpiresAt) return false;

  const expiresAt = data.accessCodeExpiresAt.toDate?.() ?? new Date(data.accessCodeExpiresAt);
  if (expiresAt < new Date()) return false;

  const inputHash = hashAccessCode(inputCode);
  return inputHash === data.accessCodeHash;
}
