/**
 * Teste de carga isolado.
 * Cria seus próprios dados, simula os votos e remove tudo ao terminar.
 */
import "./load-env";
import { performance } from "node:perf_hooks";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { generateSessionToken, getSessionExpiry, hashSessionToken } from "../src/lib/sessions/tokens";

const NUM_PARTICIPANTS = Number(process.env.LOAD_TEST_PARTICIPANTS ?? 200);
const ANSWER_OPTIONS = ["Aprovo", "Aprovo com ressalvas", "Não aprovo"];

function percentile(values: number[], percent: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

async function main() {
  if (!Number.isInteger(NUM_PARTICIPANTS) || NUM_PARTICIPANTS < 1) {
    throw new Error("LOAD_TEST_PARTICIPANTS deve ser um número inteiro positivo.");
  }

  const supabase = getSupabaseAdmin();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventSlug = `load-test-${suffix}`;
  const latencies: number[] = [];
  const startedAt = performance.now();

  console.log(`Preparando teste isolado com ${NUM_PARTICIPANTS} votantes...`);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({ title: "Teste isolado de carga", slug: eventSlug, status: "open", is_test: true })
    .select("id")
    .single();
  if (eventError || !event) throw eventError;
  const eventId = event.id as string;

  try {
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .insert({
        event_id: eventId,
        title: "Rodada de validação",
        order: 1,
        status: "open",
        question_count: 3,
      })
      .select("id")
      .single();
    if (roundError || !round) throw roundError;
    const roundId = round.id as string;

    const { data: questionRows, error: questionsError } = await supabase
      .from("questions")
      .insert(
        Array.from({ length: 3 }, (_, i) => ({
          round_id: roundId,
          order: i + 1,
          type: "single_choice",
          title: `Questão ${i + 1}`,
          required: true,
          options: ANSWER_OPTIONS,
        }))
      )
      .select("id, order");
    if (questionsError || !questionRows) throw questionsError;

    const questionIds = questionRows.sort((a, b) => a.order - b.order).map((q) => q.id as string);

    await supabase.from("public_events").insert({
      event_id: eventId,
      slug: eventSlug,
      title: "Teste isolado de carga",
      status: "open",
      current_open_round_id: roundId,
      current_round_status: "open",
    });
    await supabase.from("public_round_stats").insert({
      round_id: roundId,
      event_id: eventId,
      status: "open",
    });

    const results = await Promise.allSettled(
      Array.from({ length: NUM_PARTICIPANTS }, async (_, index) => {
        const operationStartedAt = performance.now();
        const mode = index % 3 === 0 ? "anonymous" : "identified";
        const sessionToken = generateSessionToken();

        const { data: participantId, error: joinError } = await supabase.rpc("join_event_participant", {
          p_event_id: eventId,
          p_mode: mode,
          p_name: mode === "identified" ? `Participante ${index + 1}` : null,
          p_session_token_hash: hashSessionToken(sessionToken),
          p_session_expires_at: getSessionExpiry().toISOString(),
        });
        if (joinError || !participantId) throw joinError ?? new Error("join falhou");

        const answers = questionIds.map((questionId, questionIndex) => ({
          questionId,
          type: "single_choice",
          value: ANSWER_OPTIONS[(index + questionIndex) % ANSWER_OPTIONS.length]!,
        }));

        const { error: submitError } = await supabase.rpc("submit_answers", {
          p_event_id: eventId,
          p_round_id: roundId,
          p_participant_id: participantId,
          p_mode: mode,
          p_answers: answers,
        });
        if (submitError) throw submitError;

        latencies.push(performance.now() - operationStartedAt);
        return participantId as string;
      })
    );

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    const [{ count: participantsCount }, { count: submissionsCount }, { data: roundRow }] = await Promise.all([
      supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("round_id", roundId),
      supabase.from("rounds").select("registered_count, completed_count").eq("id", roundId).single(),
    ]);

    const durationMs = performance.now() - startedAt;

    const summary = {
      requested: NUM_PARTICIPANTS,
      succeeded: results.length - failures.length,
      failed: failures.length,
      participants: participantsCount ?? 0,
      submissions: submissionsCount ?? 0,
      participantCounter: roundRow?.registered_count ?? 0,
      completedCounter: roundRow?.completed_count ?? 0,
      durationMs: Math.round(durationMs),
      throughputPerSecond: Number(((results.length - failures.length) / (durationMs / 1000)).toFixed(2)),
      latencyMs: {
        p50: Math.round(percentile(latencies, 50)),
        p95: Math.round(percentile(latencies, 95)),
        max: Math.round(Math.max(0, ...latencies)),
      },
    };

    console.log(JSON.stringify(summary, null, 2));
    if (failures.length > 0) {
      console.error("Primeiras falhas:", failures.slice(0, 5).map((failure) => failure.reason));
    }

    const countsAreExact = [
      participantsCount ?? 0,
      submissionsCount ?? 0,
      roundRow?.registered_count ?? 0,
      roundRow?.completed_count ?? 0,
    ].every((count) => count === NUM_PARTICIPANTS);
    if (failures.length > 0 || !countsAreExact) {
      throw new Error("Teste reprovado: houve falha ou divergência nos contadores.");
    }

    console.log(
      `Teste aprovado: ${NUM_PARTICIPANTS} votantes processados sem perda ou divergência.`
    );
  } finally {
    await supabase.from("events").delete().eq("id", eventId);
    console.log("Dados isolados do teste removidos.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
