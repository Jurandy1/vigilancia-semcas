import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getParticipantFromRequest } from "@/lib/sessions/verify";
import { submitSchema } from "@/lib/validation/submission";
import { writeAuditLog } from "@/lib/supabase/helpers";
import type { Question } from "@/types/round";
import { findOtherOption } from "@/lib/questions/other-option";

import { getEventIdFromSlug } from "@/lib/data/events";

export const runtime = "nodejs";

function validateAnswers(
  questions: Question[],
  answers: { questionId: string; type: string; value: string | string[]; otherText?: string }[]
) {
  const errors: string[] = [];
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  for (const q of questions) {
    const answer = answerMap.get(q.id);
    const isEmpty =
      !answer ||
      (Array.isArray(answer.value) ? answer.value.length === 0 : !answer.value.trim());

    if (q.required && isEmpty) {
      errors.push(`Pergunta obrigatória não respondida: ${q.title}`);
      continue;
    }
    if (!answer || isEmpty) continue;

    const otherOption = findOtherOption(q.options);
    const selectedOther = otherOption
      ? Array.isArray(answer.value)
        ? answer.value.includes(otherOption)
        : answer.value === otherOption
      : false;
    if (selectedOther && !answer.otherText?.trim()) {
      errors.push(`Informe qual é a outra opção em: ${q.title}`);
    }
    if (!selectedOther && answer.otherText) {
      errors.push(`Detalhamento de “Outro” inválido em: ${q.title}`);
    }

    if (q.type === "single_choice") {
      if (typeof answer.value !== "string" || !q.options?.includes(answer.value)) {
        errors.push(`Opção inválida para: ${q.title}`);
      }
    }
    if (q.type === "multi_choice") {
      if (!Array.isArray(answer.value) || !answer.value.every((v) => q.options?.includes(v))) {
        errors.push(`Opção inválida para: ${q.title}`);
      } else if (q.maxSelections && answer.value.length > q.maxSelections) {
        errors.push(`Número de opções excede o permitido para: ${q.title}`);
      }
    }
    if (q.type === "text") {
      const max = q.maxLength ?? 2000;
      if (typeof answer.value !== "string" || answer.value.length > max) {
        errors.push(`Resposta muito longa para: ${q.title}`);
      }
    }
  }

  return errors;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string; roundId: string }> }
) {
  try {
    const { eventSlug, roundId } = await params;
    const eventId = await getEventIdFromSlug(eventSlug);
    if (!eventId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const participant = await getParticipantFromRequest(request, eventId);
    if (!participant) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: event } = await supabase.from("events").select("status").eq("id", eventId).maybeSingle();
    if (!event || event.status === "closed") {
      return NextResponse.json({ error: "Evento encerrado." }, { status: 403 });
    }

    const { data: round } = await supabase.from("rounds").select("status").eq("id", roundId).eq("event_id", eventId).maybeSingle();
    if (!round || round.status !== "open") {
      return NextResponse.json({ error: "Esta etapa não está aberta." }, { status: 403 });
    }

    const { data: questionRows } = await supabase
      .from("questions")
      .select("*")
      .eq("round_id", roundId)
      .order("order", { ascending: true });

    const questions: Question[] = (questionRows ?? []).map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      title: q.title,
      explanation: q.explanation ?? null,
      required: q.required,
      options: q.options ?? undefined,
      maxLength: q.max_length ?? undefined,
      maxSelections: q.max_selections ?? undefined,
    }));

    const validationErrors = validateAnswers(questions, parsed.data.answers);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors[0] }, { status: 400 });
    }

    const { data: rpcResult, error } = await supabase
      .rpc("submit_answers", {
        p_event_id: eventId,
        p_round_id: roundId,
        p_participant_id: participant.id,
        p_mode: participant.mode,
        p_answers: parsed.data.answers,
      })
      .single<{ already_submitted: boolean }>();

    if (error) {
      console.error("Erro ao enviar respostas:", error);
      return NextResponse.json(
        { error: "Não foi possível concluir esta operação. Tente novamente." },
        { status: 500 }
      );
    }

    const alreadySubmitted = rpcResult?.already_submitted ?? false;

    if (!alreadySubmitted) {
      await writeAuditLog({
        eventId,
        action: "participant_completed",
        actorType: "participant",
        actorId: participant.id,
        roundId,
      });
    }

    return NextResponse.json({ success: true, alreadySubmitted });
  } catch (error) {
    console.error("Erro ao enviar respostas:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir esta operação. Tente novamente." },
      { status: 500 }
    );
  }
}
