/**
 * Teste de carga real via rotas HTTP públicas (Vercel).
 * Cria eventos isolados, simula participantes pela API REST e valida contadores no banco.
 *
 * Uso:
 *   LOAD_TEST_BASE_URL=https://vigilancia-semcas.vercel.app npm run load-test:http
 *   LOAD_TEST_PARTICIPANTS=250 npm run load-test:http
 */
import "./load-env";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "../src/lib/sessions/tokens";

const BASE_URL = (process.env.LOAD_TEST_BASE_URL ?? "https://vigilancia-semcas.vercel.app").replace(/\/$/, "");
const NUM_PARTICIPANTS = Number(process.env.LOAD_TEST_PARTICIPANTS ?? 200);
const MARGIN_PARTICIPANTS = Number(process.env.LOAD_TEST_MARGIN ?? 250);
const ADMIN_EMAIL = process.env.LOAD_TEST_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.LOAD_TEST_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;

type NetworkProfile =
  | "direct"
  | "slow3g"
  | "latency300-800"
  | "packetLoss"
  | "disconnect60"
  | "saturated"
  | "wifiToMobile";

interface QuestionSpec {
  order: number;
  type: "single_choice" | "multi_choice" | "text";
  title: string;
  required: boolean;
  options?: string[];
  max_length?: number;
  max_selections?: number;
}

interface TestEvent {
  eventId: string;
  slug: string;
  roundId: string;
  questionIds: string[];
  questions: QuestionSpec[];
}

interface ParticipantSession {
  index: number;
  participantId: string;
  cookie: string;
}

interface ScenarioResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details: Record<string, unknown>;
  errors: string[];
}

function percentile(values: number[], percent: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function parseSetCookie(setCookie: string | null): string {
  if (!setCookie) return "";
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : "";
}

async function getAdminToken(): Promise<string> {
  if (process.env.LOAD_TEST_ADMIN_TOKEN) return process.env.LOAD_TEST_ADMIN_TOKEN;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const client = createClient(url, key);
    const { data, error } = await client.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.session?.access_token) throw error ?? new Error("Login admin falhou.");
    return data.session.access_token;
  }

  const email = process.env.LOAD_TEST_ADMIN_EMAIL ?? "teste@gmail.com";
  const admin = getSupabaseAdmin();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw linkError ?? new Error(`Não foi possível gerar link admin para ${email}.`);
  }

  const client = createClient(url, key);
  const { data: otpData, error: otpError } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (otpError || !otpData.session?.access_token) {
    throw otpError ?? new Error("Sessão admin não obtida via magic link.");
  }

  const { data: adminRow } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", otpData.user!.id)
    .maybeSingle();
  if (!adminRow) throw new Error(`Usuário ${email} não está na tabela admins.`);

  return otpData.session.access_token;
}

async function fetchWithProfile(
  url: string,
  init: RequestInit & { cookie?: string; profile?: NetworkProfile; offline?: boolean } = {}
): Promise<Response> {
  const profile = init.profile ?? "direct";
  if (init.offline) {
    throw new Error("NETWORK_OFFLINE");
  }

  if (profile === "slow3g") await sleep(randomBetween(400, 1200));
  if (profile === "latency300-800") await sleep(randomBetween(300, 800));
  if (profile === "saturated") await sleep(randomBetween(150, 450));
  if (profile === "packetLoss" && Math.random() < 0.1) {
    throw new Error("PACKET_LOSS");
  }

  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("Cookie", init.cookie);

  const controller = new AbortController();
  const timeout = profile === "slow3g" ? 30_000 : 20_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRetry(
  url: string,
  init: RequestInit & { cookie?: string; profile?: NetworkProfile; retries?: number } = {}
) {
  const retries = init.retries ?? 3;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithProfile(url, init);
    } catch (error) {
      lastError = error;
      await sleep(200 * (attempt + 1));
    }
  }
  throw lastError;
}

async function createTestEvent(
  suffix: string,
  questions: QuestionSpec[],
  status: "open" | "waiting" = "open"
): Promise<TestEvent> {
  const supabase = getSupabaseAdmin();
  const slug = `load-http-${suffix}-${Date.now()}`;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({ title: `Teste HTTP ${suffix}`, slug, status, is_test: true })
    .select("id")
    .single();
  if (eventError || !event) throw eventError;

  const eventId = event.id as string;
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      event_id: eventId,
      title: `Rodada ${suffix}`,
      order: 1,
      status: "open",
      question_count: questions.length,
    })
    .select("id")
    .single();
  if (roundError || !round) throw roundError;

  const roundId = round.id as string;
  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .insert(questions.map((q) => ({ round_id: roundId, ...q })))
    .select("id, order")
    .order("order", { ascending: true });
  if (questionsError || !questionRows) throw questionsError;

  await supabase.from("public_events").insert({
    event_id: eventId,
    slug,
    title: `Teste HTTP ${suffix}`,
    status,
    current_open_round_id: roundId,
    current_round_status: "open",
  });
  await supabase.from("public_round_stats").insert({
    round_id: roundId,
    event_id: eventId,
    status: "open",
  });

  return {
    eventId,
    slug,
    roundId,
    questionIds: questionRows.map((q) => q.id as string),
    questions,
  };
}

async function deleteTestEvent(eventId: string) {
  await getSupabaseAdmin().from("events").delete().eq("id", eventId);
}

async function getCounts(eventId: string, roundId: string) {
  const supabase = getSupabaseAdmin();
  const [{ count: participants }, { count: submissions }, { data: round }] = await Promise.all([
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("round_id", roundId),
    supabase.from("rounds").select("registered_count, completed_count, answering_count").eq("id", roundId).single(),
  ]);
  return {
    participants: participants ?? 0,
    submissions: submissions ?? 0,
    registered: round?.registered_count ?? 0,
    completed: round?.completed_count ?? 0,
    answering: round?.answering_count ?? 0,
  };
}

function buildAnswers(
  event: TestEvent,
  index: number,
  longText = false
): Array<{ questionId: string; type: string; value: string | string[] }> {
  return event.questionIds.map((questionId, qIndex) => {
    const spec = event.questions[qIndex]!;
    if (spec.type === "text") {
      const text = longText
        ? `Resposta longa #${index + 1} `.repeat(90).slice(0, 2000)
        : `Resposta ${index + 1} pergunta ${qIndex + 1}`;
      return { questionId, type: "text", value: text };
    }
    if (spec.type === "multi_choice") {
      const opts = spec.options ?? [];
      const pick = [opts[index % opts.length]!, opts[(index + 1) % opts.length]!].filter(Boolean);
      return { questionId, type: "multi_choice", value: pick };
    }
    const opts = spec.options ?? ["A", "B", "C"];
    return {
      questionId,
      type: "single_choice",
      value: opts[(index + qIndex) % opts.length]!,
    };
  });
}

async function joinParticipant(
  event: TestEvent,
  index: number,
  profile: NetworkProfile = "direct"
): Promise<ParticipantSession> {
  const res = await fetchRetry(`${BASE_URL}/api/events/${event.slug}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: index % 3 === 0 ? "anonymous" : "identified",
      name: index % 3 === 0 ? undefined : `Participante ${index + 1}`,
    }),
    profile,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`join falhou (${res.status}): ${data.error ?? "erro"}`);
  const cookie = parseSetCookie(res.headers.get("set-cookie"));
  return { index, participantId: data.participantId as string, cookie };
}

async function loadPublicRound(event: TestEvent, cookie: string, profile: NetworkProfile = "direct") {
  const res = await fetchRetry(`${BASE_URL}/api/events/${event.slug}/rounds/${event.roundId}`, {
    cookie,
    profile,
  });
  if (!res.ok) throw new Error(`round GET falhou (${res.status})`);
  return res.json();
}

async function reportProgress(
  event: TestEvent,
  session: ParticipantSession,
  currentQuestion: number,
  profile: NetworkProfile = "direct"
) {
  await fetchRetry(`${BASE_URL}/api/events/${event.slug}/rounds/${event.roundId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cookie: session.cookie,
    body: JSON.stringify({ currentQuestion, status: "answering" }),
    profile,
  });
}

async function submitAnswers(
  event: TestEvent,
  session: ParticipantSession,
  options: { profile?: NetworkProfile; longText?: boolean; readBody?: boolean } = {}
) {
  const answers = buildAnswers(event, session.index, options.longText);
  for (let i = 0; i < answers.length; i++) {
    await reportProgress(event, session, i + 1, options.profile);
  }
  const res = await fetchWithProfile(`${BASE_URL}/api/events/${event.slug}/rounds/${event.roundId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cookie: session.cookie,
    body: JSON.stringify({ answers }),
    profile: options.profile,
  });
  if (options.readBody === false) return { status: res.status, body: null as null };
  const body = await res.json();
  if (!res.ok) throw new Error(`submit falhou (${res.status}): ${body.error ?? "erro"}`);
  return { status: res.status, body };
}

async function runObservers(
  event: TestEvent,
  adminToken: string,
  stopSignal: { stop: boolean }
) {
  const stats = {
    projectorHits: 0,
    participantPageHits: 0,
    adminDashboardHits: 0,
    projectorErrors: 0,
    adminErrors: 0,
    lastProjectorOkAt: null as string | null,
  };

  while (!stopSignal.stop) {
    try {
      const projectorRes = await fetch(`${BASE_URL}/projector/${event.slug}`);
      stats.projectorHits++;
      if (projectorRes.ok) stats.lastProjectorOkAt = new Date().toISOString();
      else stats.projectorErrors++;
    } catch {
      stats.projectorErrors++;
    }

    try {
      const pageRes = await fetch(`${BASE_URL}/e/${event.slug}`);
      stats.participantPageHits++;
      if (!pageRes.ok) stats.projectorErrors++;
    } catch {
      stats.projectorErrors++;
    }

    for (let admin = 0; admin < 2; admin++) {
      try {
        const dashRes = await fetch(`${BASE_URL}/api/admin/events/${event.eventId}/dashboard`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        stats.adminDashboardHits++;
        if (!dashRes.ok) stats.adminErrors++;
      } catch {
        stats.adminErrors++;
      }
    }

    await sleep(1500);
  }

  return stats;
}

async function runScenario(
  name: string,
  fn: () => Promise<Record<string, unknown>>
): Promise<ScenarioResult> {
  const started = performance.now();
  const errors: string[] = [];
  try {
    const details = await fn();
    return {
      name,
      passed: true,
      durationMs: Math.round(performance.now() - started),
      details,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      name,
      passed: false,
      durationMs: Math.round(performance.now() - started),
      details: {},
      errors,
    };
  }
}

async function main() {
  if (!Number.isInteger(NUM_PARTICIPANTS) || NUM_PARTICIPANTS < 1) {
    throw new Error("LOAD_TEST_PARTICIPANTS inválido.");
  }

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Participantes por cenário: ${NUM_PARTICIPANTS}`);
  const adminToken = await getAdminToken();
  const results: ScenarioResult[] = [];
  const defaultQuestions: QuestionSpec[] = [
    { order: 1, type: "single_choice", title: "Q1", required: true, options: ["A", "B", "C"] },
    { order: 2, type: "single_choice", title: "Q2", required: true, options: ["A", "B", "C"] },
    { order: 3, type: "single_choice", title: "Q3", required: true, options: ["A", "B", "C"] },
  ];

  // 1 — Entrada gradual em 2 minutos
  results.push(
    await runScenario("1. Entrada gradual (2 min)", async () => {
      const event = await createTestEvent("gradual", defaultQuestions);
      try {
        const latencies: number[] = [];
        const sessions: ParticipantSession[] = [];
        const intervalMs = Math.floor((120_000) / NUM_PARTICIPANTS);
        for (let i = 0; i < NUM_PARTICIPANTS; i++) {
          const started = performance.now();
          sessions.push(await joinParticipant(event, i, "latency300-800"));
          latencies.push(performance.now() - started);
          if (i < NUM_PARTICIPANTS - 1) await sleep(intervalMs);
        }
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.participants !== NUM_PARTICIPANTS) {
          throw new Error(`Esperado ${NUM_PARTICIPANTS} participantes, obteve ${counts.participants}`);
        }
        return {
          joined: sessions.length,
          p95JoinMs: Math.round(percentile(latencies, 95)),
          counts,
        };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 2 — Entrada em 10 segundos
  results.push(
    await runScenario("2. Entrada em rajada (10 s)", async () => {
      const event = await createTestEvent("burst-join", defaultQuestions);
      try {
        const started = performance.now();
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) =>
            joinParticipant(event, i, "saturated").catch((error) => {
              throw error;
            })
          )
        );
        const durationMs = performance.now() - started;
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.participants !== NUM_PARTICIPANTS) {
          throw new Error(`Esperado ${NUM_PARTICIPANTS} participantes, obteve ${counts.participants}`);
        }
        return { joined: sessions.length, durationMs: Math.round(durationMs), counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 3 — Envio quase simultâneo
  results.push(
    await runScenario("3. Envio simultâneo", async () => {
      const event = await createTestEvent("burst-submit", defaultQuestions);
      try {
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) => joinParticipant(event, i))
        );
        await Promise.all(sessions.map((s) => loadPublicRound(event, s.cookie)));
        const started = performance.now();
        await Promise.all(sessions.map((s) => submitAnswers(event, s, { profile: "saturated" })));
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.submissions !== NUM_PARTICIPANTS || counts.completed !== NUM_PARTICIPANTS) {
          throw new Error(`Contadores divergentes: ${JSON.stringify(counts)}`);
        }
        return { submitted: NUM_PARTICIPANTS, durationMs: Math.round(performance.now() - started), counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 4 — Reconexão após 60 s offline
  results.push(
    await runScenario("4. Reconexão após 60 s", async () => {
      const event = await createTestEvent("reconnect", defaultQuestions);
      try {
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) => joinParticipant(event, i))
        );
        await sleep(60_000);
        let resumed = 0;
        for (const session of sessions) {
          const res = await fetchRetry(`${BASE_URL}/api/events/${event.slug}/session`, {
            cookie: session.cookie,
            profile: "wifiToMobile",
          });
          const data = await res.json();
          if (data.session?.participantId === session.participantId) resumed++;
          await submitAnswers(event, session, { profile: "packetLoss" });
        }
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.submissions !== NUM_PARTICIPANTS) {
          throw new Error(`Submissões após reconexão: ${counts.submissions}/${NUM_PARTICIPANTS}`);
        }
        return { resumed, counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 5 — 20 perguntas
  results.push(
    await runScenario("5. Vinte perguntas", async () => {
      const questions = Array.from({ length: 20 }, (_, i) => ({
        order: i + 1,
        type: "single_choice" as const,
        title: `Pergunta ${i + 1}`,
        required: true,
        options: ["Sim", "Não", "Parcialmente"],
      }));
      const event = await createTestEvent("20q", questions);
      try {
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) => joinParticipant(event, i, "slow3g"))
        );
        await Promise.all(sessions.map((s) => submitAnswers(event, s, { profile: "latency300-800" })));
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.submissions !== NUM_PARTICIPANTS) throw new Error(`Faltam submissões: ${counts.submissions}`);
        return { questions: 20, counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 6 — Múltipla escolha com 30 alternativas
  results.push(
    await runScenario("6. Multi escolha (30 opções)", async () => {
      const options = Array.from({ length: 30 }, (_, i) => `Opção ${i + 1}`);
      const event = await createTestEvent("multi30", [
        {
          order: 1,
          type: "multi_choice",
          title: "Selecione alternativas",
          required: true,
          options,
          max_selections: 5,
        },
      ]);
      try {
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) => joinParticipant(event, i))
        );
        await Promise.all(sessions.map((s) => submitAnswers(event, s)));
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.submissions !== NUM_PARTICIPANTS) throw new Error(`Submissões: ${counts.submissions}`);
        return { counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 7 — Respostas abertas longas (2000 chars)
  results.push(
    await runScenario("7. Respostas abertas (2000 chars)", async () => {
      const event = await createTestEvent("longtext", [
        { order: 1, type: "text", title: "Comentário longo", required: true, max_length: 2000 },
      ]);
      try {
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) => joinParticipant(event, i, "slow3g"))
        );
        await Promise.all(sessions.map((s) => submitAnswers(event, s, { longText: true, profile: "slow3g" })));
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.submissions !== NUM_PARTICIPANTS) throw new Error(`Submissões: ${counts.submissions}`);
        return { counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 8 — Projetor + 2 admins durante carga
  results.push(
    await runScenario("8. Projetor + 2 admins em carga", async () => {
      const event = await createTestEvent("observers", defaultQuestions);
      const stopSignal = { stop: false };
      try {
        const observerPromise = runObservers(event, adminToken, stopSignal);
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) => joinParticipant(event, i, "packetLoss"))
        );
        await Promise.all(sessions.map((s) => submitAnswers(event, s, { profile: "packetLoss" })));
        stopSignal.stop = true;
        const observerStats = await observerPromise;
        const counts = await getCounts(event.eventId, event.roundId);
        if (observerStats.projectorHits < 3 || observerStats.adminDashboardHits < 4) {
          throw new Error(`Observadores insuficientes: ${JSON.stringify(observerStats)}`);
        }
        if (!observerStats.lastProjectorOkAt) throw new Error("Projetor não recuperou durante o teste.");
        if (counts.submissions !== NUM_PARTICIPANTS) throw new Error(`Submissões: ${counts.submissions}`);
        return { observerStats, counts };
      } finally {
        stopSignal.stop = true;
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 9 — Operador encerrando com respostas pendentes
  results.push(
    await runScenario("9. Encerrar rodada com respostas pendentes", async () => {
      const event = await createTestEvent("close-force", defaultQuestions);
      try {
        const sessions = await Promise.all(
          Array.from({ length: NUM_PARTICIPANTS }, (_, i) => joinParticipant(event, i))
        );
        const submitPromise = Promise.allSettled(
          sessions.map(async (s, i) => {
            await sleep(i * 15);
            return submitAnswers(event, s);
          })
        );
        await sleep(500);
        const closeRes = await fetch(`${BASE_URL}/api/admin/events/${event.eventId}/rounds/${event.roundId}/close`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const closeBody = await closeRes.json();
        if (closeRes.status !== 409) {
          throw new Error(`Encerramento deveria exigir confirmação (409), recebeu ${closeRes.status}`);
        }
        const forceRes = await fetch(`${BASE_URL}/api/admin/events/${event.eventId}/rounds/${event.roundId}/close`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }),
        });
        if (!forceRes.ok) throw new Error(`Encerramento forçado falhou (${forceRes.status})`);
        await submitPromise;
        const counts = await getCounts(event.eventId, event.roundId);
        return { closeBlocked: closeBody.code ?? "PARTICIPANTS_STILL_ANSWERING", counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // 10 — Resposta salva, HTTP perdido (idempotência)
  results.push(
    await runScenario("10. Idempotência após HTTP perdido", async () => {
      const event = await createTestEvent("idempotent", defaultQuestions);
      try {
        const sessions = await Promise.all(
          Array.from({ length: Math.min(NUM_PARTICIPANTS, 50) }, (_, i) => joinParticipant(event, i))
        );
        let duplicateBlocked = 0;
        for (const session of sessions) {
          await submitAnswers(event, session, { readBody: false });
          const second = await submitAnswers(event, session);
          if (second.body?.alreadySubmitted) duplicateBlocked++;
        }
        const counts = await getCounts(event.eventId, event.roundId);
        const expected = sessions.length;
        if (counts.submissions !== expected) {
          throw new Error(`Submissões no banco (${counts.submissions}) != esperado (${expected})`);
        }
        if (duplicateBlocked !== expected) {
          throw new Error(`Reenvios idempotentes: ${duplicateBlocked}/${expected}`);
        }
        return { participants: expected, duplicateBlocked, counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  // Margem 250–300 participantes
  results.push(
    await runScenario(`Margem ${MARGIN_PARTICIPANTS} participantes`, async () => {
      const event = await createTestEvent("margin", defaultQuestions);
      try {
        const sessions = await Promise.all(
          Array.from({ length: MARGIN_PARTICIPANTS }, (_, i) => joinParticipant(event, i, "packetLoss"))
        );
        await Promise.all(sessions.map((s) => submitAnswers(event, s, { profile: "packetLoss" })));
        const counts = await getCounts(event.eventId, event.roundId);
        if (counts.submissions !== MARGIN_PARTICIPANTS) {
          throw new Error(`Margem reprovada: ${counts.submissions}/${MARGIN_PARTICIPANTS}`);
        }
        return { counts };
      } finally {
        await deleteTestEvent(event.eventId);
      }
    })
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const report = {
    baseUrl: BASE_URL,
    participants: NUM_PARTICIPANTS,
    marginParticipants: MARGIN_PARTICIPANTS,
    passed,
    total: results.length,
    approved: failed.length === 0,
    scenarios: results,
  };

  console.log(JSON.stringify(report, null, 2));
  if (failed.length > 0) {
    console.error(
      "Cenários reprovados:",
      failed.map((f) => `${f.name}: ${f.errors.join("; ")}`)
    );
    process.exitCode = 1;
  } else {
    console.log(`Todos os ${results.length} cenários aprovados.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
