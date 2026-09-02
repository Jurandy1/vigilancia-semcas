import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAppCheck, appCheckUnauthorized } from "@/lib/security/app-check";
import { validateAccessCode } from "@/lib/security/access-code";
import { joinEventSchema } from "@/lib/validation/participant";
import {
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry,
  SESSION_COOKIE_NAME,
} from "@/lib/sessions/tokens";
import { writeAuditLog } from "@/lib/firebase/helpers";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { getEventBySlug } from "@/lib/data/events";
import { shouldUseMockData } from "@/lib/dev/config";
import {
  createMockParticipant,
  getParticipantFromRequestMock,
} from "@/lib/data/mock-participant";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  try {
    const appCheckOk = await verifyAppCheck(request);
    if (!appCheckOk) return appCheckUnauthorized();

    const { eventSlug } = await params;
    const event = await getEventBySlug(eventSlug);
    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const eventId = event.id;
    const body = await request.json();
    const parsed = joinEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    if (shouldUseMockData()) {
      const existing = await getParticipantFromRequestMock(request, eventId);
      if (existing) {
        return NextResponse.json({
          success: true,
          participantId: existing.id,
          mode: existing.mode,
          name: existing.name,
          resumed: true,
        });
      }

      const sessionToken = generateSessionToken();
      const participant = createMockParticipant({
        eventId,
        mode: parsed.data.mode,
        name: parsed.data.mode === "identified" ? parsed.data.name?.trim() ?? null : null,
        sessionTokenHash: hashSessionToken(sessionToken),
        sessionExpiresAt: getSessionExpiry(),
      });

      const response = NextResponse.json({
        success: true,
        participantId: participant.id,
        mode: participant.mode,
        name: participant.name,
        resumed: false,
      });

      response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      return response;
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

    const db = getAdminDb();
    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const now = Timestamp.now();
    const sessionExpiresAt = Timestamp.fromDate(getSessionExpiry());

    const participantRef = db.collection(`events/${eventId}/participants`).doc();
    const participantId = participantRef.id;

    await db.runTransaction(async (tx) => {
      tx.set(participantRef, {
        eventId,
        mode: parsed.data.mode,
        name: parsed.data.mode === "identified" ? parsed.data.name?.trim() : null,
        sessionTokenHash,
        sessionExpiresAt,
        createdAt: now,
        lastActivityAt: now,
      });
      tx.update(db.doc(`events/${eventId}`), {
        participantCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await writeAuditLog({
      eventId,
      action: "participant_started",
      actorType: "participant",
      actorId: participantId,
      metadata: { mode: parsed.data.mode },
    });

    const response = NextResponse.json({
      success: true,
      participantId,
      mode: parsed.data.mode,
      name: parsed.data.mode === "identified" ? parsed.data.name : null,
      resumed: false,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
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
