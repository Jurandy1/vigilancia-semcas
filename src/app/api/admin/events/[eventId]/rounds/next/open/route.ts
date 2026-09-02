import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { writeAuditLog } from "@/lib/firebase/helpers";
import { openRoundTransaction } from "@/lib/rounds/open-round";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const db = getAdminDb();

  const roundsSnap = await db.collection(`events/${eventId}/rounds`).orderBy("order").get();
  const rounds = roundsSnap.docs.map((d) => ({
    id: d.id,
    order: d.data().order as number,
    status: d.data().status as string,
  }));

  // Referência: order da última rodada executada (a de maior `order` já encerrada).
  // Se nenhuma foi encerrada ainda, qualquer rodada elegível conta a partir do início.
  const lastExecutedOrder = rounds
    .filter((r) => r.status === "closed")
    .reduce((max, r) => Math.max(max, r.order), -Infinity);

  const next = rounds
    .filter((r) => (r.status === "draft" || r.status === "waiting") && r.order > lastExecutedOrder)
    .sort((a, b) => a.order - b.order)[0];

  if (!next) {
    return NextResponse.json(
      { error: "Não há próxima rodada disponível para iniciar." },
      { status: 404 }
    );
  }

  const result = await openRoundTransaction(eventId, next.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    eventId,
    action: "round_opened",
    actorType: "admin",
    actorId: admin.uid,
    roundId: next.id,
  });

  return NextResponse.json({ success: true, roundId: result.roundId, roundTitle: result.roundTitle });
}
