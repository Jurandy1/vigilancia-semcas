import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";
import { createRoundSchema } from "@/lib/validation/round";

export const runtime = "nodejs";

const ROUND_LOCKED_MESSAGE =
  "Esta rodada já recebeu respostas e não pode mais ser editada.";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const db = getAdminDb();

  const [roundDoc, questionsSnap, submissionsCountSnap] = await Promise.all([
    db.doc(`events/${eventId}/rounds/${roundId}`).get(),
    db.collection(`events/${eventId}/rounds/${roundId}/questions`).orderBy("order").get(),
    db
      .collection(`events/${eventId}/submissions`)
      .where("roundId", "==", roundId)
      .count()
      .get(),
  ]);

  if (!roundDoc.exists) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  const questions = questionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const submissionCount = submissionsCountSnap.data().count;

  return NextResponse.json({
    round: { id: roundDoc.id, ...roundDoc.data() },
    questions,
    submissionCount,
    editable: submissionCount === 0,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; roundId: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId, roundId } = await params;
  const body = await request.json();
  const parsed = createRoundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const roundRef = db.doc(`events/${eventId}/rounds/${roundId}`);
  const questionsRef = db.collection(`events/${eventId}/rounds/${roundId}/questions`);

  const [roundDoc, submissionsCountSnap, questionsSnap] = await Promise.all([
    roundRef.get(),
    db.collection(`events/${eventId}/submissions`).where("roundId", "==", roundId).count().get(),
    questionsRef.get(),
  ]);

  if (!roundDoc.exists) {
    return NextResponse.json({ error: "Rodada não encontrada." }, { status: 404 });
  }

  if (submissionsCountSnap.data().count > 0) {
    return NextResponse.json({ error: ROUND_LOCKED_MESSAGE }, { status: 409 });
  }

  await db.runTransaction(async (tx) => {
    // Nenhuma leitura extra necessária aqui — já lemos tudo acima antes de escrever.
    tx.update(roundRef, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      allowNewParticipants: parsed.data.allowNewParticipants,
      resultsVisibility: parsed.data.resultsVisibility,
      questionCount: parsed.data.questions.length,
    });

    questionsSnap.docs.forEach((doc) => tx.delete(doc.ref));

    parsed.data.questions.forEach((q, index) => {
      const qRef = questionsRef.doc();
      tx.set(qRef, {
        order: q.order ?? index + 1,
        type: q.type,
        title: q.title,
        required: q.required ?? true,
        options: q.options ?? null,
        maxLength: q.maxLength ?? (q.type === "text" ? 2000 : null),
        maxSelections: q.type === "multi_choice" ? q.maxSelections ?? null : null,
      });
    });
  });

  return NextResponse.json({ success: true });
}
