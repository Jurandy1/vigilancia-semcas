/** Renova com margem para latência; códigos ausentes/vencidos são imediatos. */
export function getAccessCodeRenewalDelay(expiresAt: number, now = Date.now()): number {
  return Number.isFinite(expiresAt) ? Math.max(0, expiresAt - now - 15_000) : 0;
}
