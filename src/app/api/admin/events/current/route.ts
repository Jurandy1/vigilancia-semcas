import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { resolveCurrentEvent } from "@/lib/data/events";

export const runtime = "nodejs";

/**
 * Evento “ao vivo” do sistema — a mesma regra de /e/atual:
 * open → senão 1º da sequência waiting/draft → senão qualquer waiting/draft.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const event = await resolveCurrentEvent();
  if (!event) {
    return NextResponse.json(
      { event: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        status: event.status,
        sequenceId: event.sequenceId ?? null,
        sequenceOrder: event.sequenceOrder ?? null,
        sequenceRootSlug: event.sequenceRootSlug ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
