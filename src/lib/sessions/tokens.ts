import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "semcas_session";
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashAccessCode(code: string): string {
  const normalized = code.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export function generateAccessCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

export function verifyAccessCode(input: string, storedHash: string): boolean {
  const inputHash = hashAccessCode(input);
  try {
    return timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export function getParticipantRoundId(roundId: string, participantId: string): string {
  return `${roundId}_${participantId}`;
}

export function getSubmissionId(roundId: string, participantId: string): string {
  return `${roundId}_${participantId}`;
}

export function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}
