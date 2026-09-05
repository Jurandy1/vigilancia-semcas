/**
 * Probe rápido: cookie por evento, rate-limit de join e submit.
 * Uso: LOAD_TEST_BASE_URL=http://localhost:3000 npx tsx scripts/probe-system-bugs.ts
 */
import "./load-env";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { getSessionCookieName } from "../src/lib/sessions/tokens";

const BASE_URL = (process.env.LOAD_TEST_BASE_URL ?? "https://vigilancia-semcas.vercel.app").replace(/\/$/, "");

async function getAdminToken(): Promise<string> {
  if (process.env.LOAD_TEST_ADMIN_TOKEN) return process.env.LOAD_TEST_ADMIN_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const email = process.env.LOAD_TEST_ADMIN_EMAIL ?? "teste@gmail.com";
  const admin = getSupabaseAdmin();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) throw linkError ?? new Error("generateLink failed");
  const client = createClient(url, key);
  const { data: otpData, error: otpError } = await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (otpError || !otpData.session?.access_token) throw otpError ?? new Error("verifyOtp failed");
  return otpData.session.access_token;
}

async function main() {
  console.log(`Probe against ${BASE_URL}`);
  const adminToken = await getAdminToken();
  const supabase = getSupabaseAdmin();
  const { data: openTests } = await supabase
    .from("events")
    .select("id")
    .eq("status", "open")
    .eq("is_test", true);
  if (openTests?.length) {
    for (const row of openTests) {
      await supabase.from("events").delete().eq("id", row.id);
    }
  }

  const slug = `probe-bugs-${Date.now()}`;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({ title: "Probe bugs", slug, status: "open", is_test: true })
    .select("id")
    .single();
  if (eventError || !event) throw eventError;

  const eventId = event.id as string;
  try {
    const { data: round } = await supabase
      .from("rounds")
      .insert({ event_id: eventId, title: "R1", order: 1, status: "open", question_count: 1 })
      .select("id")
      .single();
    const roundId = round!.id as string;
    const { data: questions } = await supabase
      .from("questions")
      .insert({
        round_id: roundId,
        order: 1,
        type: "single_choice",
        title: "Q1",
        required: true,
        options: ["A", "B", "C"],
      })
      .select("id")
      .single();
    await supabase.from("public_events").insert({
      event_id: eventId,
      slug,
      title: "Probe bugs",
      status: "open",
      current_open_round_id: roundId,
      current_round_status: "open",
    });
    await supabase.from("public_round_stats").insert({
      round_id: roundId,
      event_id: eventId,
      status: "open",
    });

    const expectedCookieName = getSessionCookieName(eventId);
    let firstCookie = "";
    let rateLimitedAt: number | null = null;
    const joinStatuses: number[] = [];

    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${BASE_URL}/api/events/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "identified", name: `Probe ${i + 1}` }),
      });
      joinStatuses.push(res.status);
      const body = await res.json().catch(() => ({}));
      const headers = res.headers as Headers & { getSetCookie?: () => string[] };
      const rawList =
        typeof headers.getSetCookie === "function"
          ? headers.getSetCookie()
          : [res.headers.get("set-cookie")].filter((v): v is string => Boolean(v));
      const matched = rawList.find((c) => c.startsWith(`${expectedCookieName}=`)) ?? null;
      if (i === 0 && matched) firstCookie = matched.split(";")[0]!;
      if (res.status === 429 && rateLimitedAt === null) rateLimitedAt = i + 1;
      if (!res.ok && res.status !== 429) {
        throw new Error(`join falhou (${res.status}): ${(body as { error?: string }).error ?? "erro"}`);
      }
    }

    let submitStatus: number | null = null;
    if (firstCookie) {
      const submitRes = await fetch(`${BASE_URL}/api/events/${slug}/rounds/${roundId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: firstCookie },
        body: JSON.stringify({
          answers: [{ questionId: questions!.id, type: "single_choice", value: "A" }],
        }),
      });
      submitStatus = submitRes.status;
    }

    const dashRes = await fetch(`${BASE_URL}/api/admin/events/${eventId}/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const report = {
      rateLimitedAt,
      joinStatuses,
      cookieCaptured: Boolean(firstCookie),
      expectedCookieName,
      submitStatus,
      dashboardStatus: dashRes.status,
      approved: rateLimitedAt === null && Boolean(firstCookie) && submitStatus === 200 && dashRes.ok,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.approved) process.exitCode = 1;
  } finally {
    await supabase.from("events").delete().eq("id", eventId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
