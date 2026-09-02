import { NextRequest, NextResponse } from "next/server";
import { shouldUseMockData } from "@/lib/dev/config";
import {
  getMockPublicEventBySlug,
  getMockStats,
  MOCK_ROUND_ID,
} from "@/lib/dev/mock-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  if (!shouldUseMockData()) {
    return NextResponse.json({ error: "Mock não disponível." }, { status: 404 });
  }

  const { eventSlug } = await params;
  const publicEvent = getMockPublicEventBySlug(eventSlug);
  if (!publicEvent) {
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const stats = getMockStats();

  return NextResponse.json({
    publicEvent,
    stats,
    roundId: MOCK_ROUND_ID,
  });
}
