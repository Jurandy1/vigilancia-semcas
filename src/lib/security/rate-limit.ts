import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

interface RateLimitTier {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS: Record<string, { burst: RateLimitTier; sustained: RateLimitTier }> = {
  join: { burst: { limit: 20, windowSeconds: 60 }, sustained: { limit: 60, windowSeconds: 600 } },
  submit: { burst: { limit: 30, windowSeconds: 60 }, sustained: { limit: 100, windowSeconds: 600 } },
  rotateCode: { burst: { limit: 6, windowSeconds: 60 }, sustained: { limit: 20, windowSeconds: 600 } },
};

async function checkRateLimit(bucket: string, key: string, limit: number, windowSeconds: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc("check_rate_limit", { p_bucket: bucket, p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
    .single<{ allowed: boolean; retry_after_seconds: number }>();

  if (error) {
    console.error("Erro ao checar rate limit:", error);
    // Fail-open: é um sistema de votação pública ao vivo — uma falha no
    // limitador não pode derrubar a votação real.
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: data?.allowed ?? true, retryAfterSeconds: data?.retry_after_seconds ?? 0 };
}

export async function enforceRateLimit(
  bucketName: keyof typeof RATE_LIMITS,
  ip: string,
  eventKey: string
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const key = `${ip}:${eventKey}`;
  const tiers = RATE_LIMITS[bucketName];
  // Cada nível (rajada/sustentado) precisa da sua própria linha — usar o
  // mesmo bucket para os dois faria a checagem do segundo nível incrementar
  // (e ler) o mesmo contador que o primeiro acabou de tocar, dobrando a
  // contagem por requisição em vez de aplicar dois limites independentes.
  for (const [tierName, tier] of [["burst", tiers.burst], ["sustained", tiers.sustained]] as const) {
    const result = await checkRateLimit(`${bucketName}_${tierName}`, key, tier.limit, tier.windowSeconds);
    if (!result.allowed) return result;
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  const response = NextResponse.json(
    { error: "Muitas tentativas. Aguarde um momento e tente novamente." },
    { status: 429 }
  );
  if (retryAfterSeconds > 0) response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}
