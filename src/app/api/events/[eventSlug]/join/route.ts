import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateAccessCode } from "@/lib/security/access-code";
import { joinEventSchema } from "@/lib/validation/participant";
import {
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry,
  getSessionCookieName,
} from "@/lib/sessions/tokens";
import { writeAuditLog } from "@/lib/supabase/helpers";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { getEventBySlug } from "@/lib/data/events";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  try {
    const { eventSlug } = await params;
    const [event, body] = await Promise.all([getEventBySlug(eventSlug), request.json()]);
    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const eventId = event.id;
    const parsed = joinEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const existing = await getParticipantFromRequest(request, eventId);
    if (existing) {
      return NextResponse.json({
        success: true,
        participantId: existing.id,
        mode: existing.mode,
        name: existing.name,
        resumed: true,
      });
    }

    if (event.requireLiveCode) {
      const codeValid = await validateAccessCode(eventId, parsed.data.accessCode ?? "");
      if (!codeValid) {
        return NextResponse.json(
          { error: "Código de acesso inválido ou expirado." },
          { status: 403 }
        );
      }
    }

    if (event.status === "closed") {
      return NextResponse.json({ error: "Este evento foi encerrado." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const sessionExpiresAt = getSessionExpiry();
    const name = parsed.data.mode === "identified" ? parsed.data.name?.trim() ?? null : null;

    const { data: participantId, error } = await supabase.rpc("join_event_participant", {
      p_event_id: eventId,
      p_mode: parsed.data.mode,
      p_name: name,
      p_session_token_hash: sessionTokenHash,
      p_session_expires_at: sessionExpiresAt.toISOString(),
      p_client_token: parsed.data.clientToken ?? null,
    });

    if (error || !participantId) {
      if (error?.message === "EVENT_NOT_OPEN") {
        return NextResponse.json(
          { error: "Este evento ainda não foi iniciado pelo organizador." },
          { status: 409 }
        );
      }
      if (error?.message === "EVENT_NOT_FOUND") {
        return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Não foi possível concluir esta operação. Tente novamente." },
        { status: 500 }
      );
    }

    await writeAuditLog({
      eventId,
      action: "participant_started",
      actorType: "participant",
      actorId: participantId as string,
      metadata: { mode: parsed.data.mode },
    });

    const response = NextResponse.json({
      success: true,
      participantId,
      mode: parsed.data.mode,
      name,
      resumed: false,
    });

    response.cookies.set(getSessionCookieName(eventId), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Tente novamente." },
      { status: 500 }
    );
  }
}
