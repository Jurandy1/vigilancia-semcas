import { NextRequest, NextResponse } from "next/server";
import { getEventBySlugExact } from "@/lib/data/events";
import { rotateAccessChallenge } from "@/lib/security/access-code";
import { enforceRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Rota pública (sem auth de admin) chamada pelo próprio telão do projetor
 * para se auto-renovar. O código temporário só era gerado ao abrir uma
 * rodada ou por ação manual do admin em Configurações — sem ninguém rodando
 * de novo a cada 60s, o código expirava e ficava travado, mesmo com o
 * evento em andamento e a rodada aberta. Não é destrutivo (só troca o
 * código atual); o próprio access_challenge já é público via public_events.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  try {
    const { eventSlug } = await params;
    const event = await getEventBySlugExact(eventSlug);
    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const rateLimit = await enforceRateLimit("rotateCode", getClientIp(request), event.id);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    if (!event.requireLiveCode || event.status !== "open") {
      return NextResponse.json({ error: "Este evento não usa código de acesso agora." }, { status: 409 });
    }

    const challenge = await rotateAccessChallenge(event.id);
    return NextResponse.json({ success: true, ...challenge });
  } catch {
    return NextResponse.json({ error: "Não foi possível renovar o código." }, { status: 500 });
  }
}
