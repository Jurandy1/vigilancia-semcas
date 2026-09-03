import "./load-env";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { generateSessionToken, getSessionExpiry, hashSessionToken } from "../src/lib/sessions/tokens";

const eventId = "55b39411-e722-466c-aa59-15344c5b2e1c";
const roundId = "3a97a2cf-9b8c-47da-a778-5503ba75b9c1";
const NUM_PARTICIPANTS = 10;
const ANSWER_OPTIONS = ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"];

async function main() {
  const supabase = getSupabaseAdmin();
  
  // 1. Open event
  await supabase.from("events").update({ status: "open" }).eq("id", eventId);
  await supabase.from("public_events").update({ status: "open", current_open_round_id: roundId, current_round_status: "open" }).eq("event_id", eventId);
  
  // 2. Open round
  await supabase.from("rounds").update({ status: "open" }).eq("id", roundId);
  
  const { data: stats } = await supabase.from("public_round_stats").select("round_id").eq("round_id", roundId);
  if (!stats || stats.length === 0) {
    await supabase.from("public_round_stats").insert({ round_id: roundId, event_id: eventId, status: "open" });
  } else {
    await supabase.from("public_round_stats").update({ status: "open" }).eq("round_id", roundId);
  }
  
  // 3. Fetch questions
  const { data: questions } = await supabase.from("questions").select("id, type").eq("round_id", roundId).order("order");
  if (!questions) throw new Error("No questions");

  for (let i = 0; i < NUM_PARTICIPANTS; i++) {
    const sessionToken = generateSessionToken();
    const mode = i % 2 === 0 ? "anonymous" : "identified";
    const name = mode === "identified" ? `Participante Teste ${i + 1}` : null;

    const { data: participantId, error: joinError } = await supabase.rpc("join_event_participant", {
      p_event_id: eventId,
      p_mode: mode,
      p_name: name,
      p_session_token_hash: hashSessionToken(sessionToken),
      p_session_expires_at: getSessionExpiry().toISOString(),
    });
    if (joinError) throw joinError;

    const answers = questions.map((q, idx) => {
      let value = ANSWER_OPTIONS[(i + idx) % ANSWER_OPTIONS.length]!;
      if (q.type === "text") {
         value = "Muito boa iniciativa. Espero que os próximos eventos sejam tão bons quanto esse.";
      }
      return {
        questionId: q.id,
        type: q.type,
        value,
      };
    });

    const { error: submitError } = await supabase.rpc("submit_answers", {
      p_event_id: eventId,
      p_round_id: roundId,
      p_participant_id: participantId,
      p_mode: mode,
      p_answers: answers,
    });
    if (submitError) throw submitError;
  }
  
  console.log(`10 votos computados para o evento ${eventId}`);
}

main().catch(console.error);
