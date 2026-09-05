import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "semcas_session";
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

// Cookie por evento (não um único cookie global) — sem isso, entrar num
// evento sobrescrevia o cookie de qualquer outro evento aberto antes no
// mesmo navegador (ex.: sequência com vários eventos, ou voltar a um evento
// antigo depois de participar de um novo), perdendo a sessão anterior sem
// aviso.
export function getSessionCookieName(eventId: string): string {
  return `${SESSION_COOKIE_NAME}_${eventId}`;
}

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
