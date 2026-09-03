/**
 * Seed do evento de teste com a primeira rodada real.
 * Uso: npm run seed
 */
import "./load-env";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

const QUESTIONS = [
  {
    order: 1,
    type: "single_choice",
    title: "Como você avalia a metodologia utilizada no evento?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    order: 2,
    type: "single_choice",
    title: "Como você avalia o local onde o evento foi realizado?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    order: 3,
    type: "single_choice",
    title: "Como você avalia a organização geral do evento?",
    required: true,
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
  },
  {
    order: 4,
    type: "single_choice",
    title: "A duração do evento foi adequada?",
    required: true,
    options: ["Sim", "Parcialmente", "Não"],
  },
  {
    order: 5,
    type: "text",
    title: "Quais foram os principais pontos positivos do evento?",
    required: true,
    max_length: 2000,
  },
  {
    order: 6,
    type: "single_choice",
    title: "O conteúdo abordado no evento foi relevante para sua atuação profissional?",
    required: true,
    options: ["Muito relevante", "Relevante", "Pouco relevante", "Não foi relevante"],
  },
  {
    order: 7,
    type: "text",
    title: "Quais sugestões você daria para melhorar os próximos eventos?",
    required: true,
    max_length: 2000,
  },
];

async function main() {
  const supabase = getSupabaseAdmin();
  const slug = "monitoramento-2026";

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      title: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
      slug,
      description: "Evento de teste para validação do sistema",
      status: "waiting",
      is_test: true,
      require_live_code: false,
    })
    .select("id")
    .single();
  if (eventError || !event) throw eventError;

  await supabase.from("public_events").insert({
    event_id: event.id,
    slug,
    title: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
    description: "Evento de teste para validação do sistema",
    status: "waiting",
    require_live_code: false,
  });

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      event_id: event.id,
      title: "Avaliação do Evento",
      order: 1,
      type: "survey",
      status: "draft",
      allow_new_participants: true,
      results_visibility: "after_close",
      question_count: QUESTIONS.length,
    })
    .select("id")
    .single();
  if (roundError || !round) throw roundError;

  await supabase.from("questions").insert(QUESTIONS.map((q) => ({ ...q, round_id: round.id })));

  console.log("Evento de teste criado:");
  console.log(`  ID: ${event.id}`);
  console.log(`  Slug: ${slug}`);
  console.log(`  URL: /e/${slug}`);
  console.log(`  Rodada ID: ${round.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
