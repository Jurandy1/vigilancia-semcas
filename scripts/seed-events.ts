/**
 * Recria os dois eventos reais (Avaliação + Revisão do Plano Municipal) no
 * Supabase, já com o texto revisado e a estrutura de explicação/decisão.
 * Uso: npx tsx scripts/seed-events.ts
 */
import "./load-env";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

const AVALIACAO_QUESTIONS = [
  { order: 1, type: "single_choice", title: "Como você avalia a metodologia utilizada no evento?", required: true, options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"] },
  { order: 2, type: "single_choice", title: "Como você avalia o local onde o evento foi realizado?", required: true, options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"] },
  { order: 3, type: "single_choice", title: "Como você avalia a organização geral do evento?", required: true, options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"] },
  { order: 4, type: "single_choice", title: "A duração do evento foi adequada?", required: true, options: ["Sim", "Parcialmente", "Não"] },
  { order: 5, type: "text", title: "Quais foram os principais pontos positivos do evento?", required: true, max_length: 2000 },
  { order: 6, type: "single_choice", title: "O conteúdo abordado no evento foi relevante para sua atuação profissional?", required: true, options: ["Muito relevante", "Relevante", "Pouco relevante", "Não foi relevante"] },
  { order: 7, type: "text", title: "Quais sugestões você daria para melhorar os próximos eventos?", required: true, max_length: 2000 },
];

const REVISAO_QUESTIONS = [
  {
    order: 1, type: "single_choice",
    title: "Para você, qual seria a periodicidade da ação Encontros Ampliados de Monitoramento?",
    explanation: "Esta decisão define o intervalo regular entre os encontros gerais de acompanhamento do Plano Municipal de Monitoramento.",
    required: true, options: ["Trimestral", "Quadrimestral", "Semestral", "Outra periodicidade"],
  },
  {
    order: 2, type: "multi_choice",
    title: "Quem seriam os participantes dos Encontros Ampliados de Monitoramento?",
    explanation: "Selecione todos os grupos que devem contribuir para a análise dos resultados e para as decisões de acompanhamento do plano.",
    required: true,
    options: ["Secretários (as)", "Superintendentes", "Coordenadores de Serviços e Unidades", "Diretores", "Assessorias", "Equipe técnica dos serviços", "Rede socioassistencial privada"],
  },
  {
    order: 3, type: "single_choice",
    title: "As Reuniões de Monitoramento por Superintendência devem continuar?",
    explanation: "A resposta definirá se o acompanhamento descentralizado por Superintendência permanece no Plano Municipal de Monitoramento.",
    required: true, options: ["Sim", "Não"],
  },
  {
    order: 4, type: "text",
    title: "Caso sim, qual frequência de realização? Quem seriam os envolvidos no processo?",
    explanation: "Descreva uma proposta objetiva de frequência e indique os setores ou profissionais envolvidos. Responda somente se considerar que as reuniões devem continuar.",
    required: false, max_length: 1000,
  },
  {
    order: 5, type: "single_choice",
    title: "Encontro de socialização de resultados com a rede parceira: é importante sua realização?",
    explanation: "Esta decisão avalia se os resultados do monitoramento devem ser apresentados e discutidos periodicamente com as organizações parceiras.",
    required: true, options: ["Sim", "Não"],
  },
  {
    order: 6, type: "text",
    title: "Caso sim, qual seria a frequência de realização desse encontro?",
    explanation: "Indique a periodicidade mais viável para socializar os resultados com a rede parceira. Responda somente se considerar o encontro importante.",
    required: false, max_length: 500,
  },
  {
    order: 7, type: "multi_choice",
    title: "Quem seriam os participantes?",
    explanation: "Selecione os grupos que precisam estar presentes para analisar os resultados e pactuar encaminhamentos com a rede parceira.",
    required: true, options: ["Superintendentes, Coordenadores de Serviços e Unidades", "Gestores e técnicos da rede parceira"],
  },
  {
    order: 8, type: "single_choice",
    title: "As Visitas técnicas às unidades, serviços e à rede prestadora de serviço devem continuar a ser realizadas?",
    explanation: "A resposta definirá se as visitas técnicas permanecem como estratégia de acompanhamento presencial no plano.",
    required: true, options: ["Sim", "Não"],
  },
  {
    order: 9, type: "single_choice",
    title: "Se positivo, qual periodicidade?",
    explanation: "Escolha a frequência considerada viável para as visitas técnicas. Caso escolha outra periodicidade, ela poderá ser detalhada durante a discussão.",
    required: false, options: ["Quinzenal", "Mensal", "Outra periodicidade"],
  },
  {
    order: 10, type: "single_choice",
    title: "A Reunião de Gestão vai continuar no plano?",
    explanation: "Esta decisão define a permanência da reunião gerencial como instância de acompanhamento e tomada de decisão do plano.",
    required: true, options: ["Sim", "Não"],
  },
  {
    order: 11, type: "single_choice",
    title: "Caso seja sim, qual seria a frequência de realização?",
    explanation: "Escolha o intervalo mais adequado para que a gestão acompanhe resultados e delibere sobre os ajustes necessários.",
    required: false, options: ["Mensal", "Bimestral", "Trimestral"],
  },
  {
    order: 12, type: "text",
    title: "Considerando o déficit de pessoal e recursos, como podemos reestruturar o plano de avaliação em etapas simplificadas para iniciar o monitoramento sem gerar nova carga de trabalho para as Unidades?",
    explanation: "Considere o déficit de pessoal e de recursos. Registre uma proposta prática para iniciar o monitoramento sem gerar nova sobrecarga para as Unidades.",
    required: true, max_length: 2000,
  },
];

async function createEvent(params: {
  title: string;
  slug: string;
  description: string;
  roundTitle: string;
  questions: typeof AVALIACAO_QUESTIONS | typeof REVISAO_QUESTIONS;
}) {
  const supabase = getSupabaseAdmin();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      title: params.title,
      slug: params.slug,
      description: params.description,
      status: "waiting",
      is_test: false,
      require_live_code: false,
    })
    .select("id")
    .single();
  if (eventError || !event) throw eventError;

  await supabase.from("public_events").insert({
    event_id: event.id,
    slug: params.slug,
    title: params.title,
    description: params.description,
    status: "waiting",
    require_live_code: false,
  });

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      event_id: event.id,
      title: params.roundTitle,
      order: 1,
      type: "survey",
      status: "draft",
      allow_new_participants: true,
      results_visibility: "after_close",
      question_count: params.questions.length,
    })
    .select("id")
    .single();
  if (roundError || !round) throw roundError;

  await supabase.from("questions").insert(params.questions.map((q) => ({ ...q, round_id: round.id })));

  return event.id as string;
}

async function main() {
  const supabase = getSupabaseAdmin();

  const revisaoId = await createEvent({
    title: "Revisão e Validação do Plano Municipal de Monitoramento 2026–2029",
    slug: "revisao-validacao-plano-monitoramento-2026-2029",
    description: "Consulta para revisão e validação do Plano Municipal de Monitoramento 2026-2029",
    roundTitle: "Deliberações do Plano Municipal 2026–2029",
    questions: REVISAO_QUESTIONS,
  });

  const avaliacaoId = await createEvent({
    title: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
    slug: "avaliacao-monitoramento-2026-oficial",
    description: "Avaliação do Encontro de Monitoramento do Plano Operativo 2026",
    roundTitle: "Avaliação do Evento",
    questions: AVALIACAO_QUESTIONS,
  });

  const sequenceId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data: revisaoRow } = await supabase.from("events").select("slug, title").eq("id", revisaoId).single();
  const { data: avaliacaoRow } = await supabase.from("events").select("slug, title").eq("id", avaliacaoId).single();

  const sequenceUpdates = [
    {
      id: revisaoId,
      sequence_order: 0,
      sequence_root_event_id: revisaoId,
      sequence_root_slug: revisaoRow!.slug,
      next_event_id: avaliacaoId,
      next_event_title: avaliacaoRow!.title,
      next_event_slug: avaliacaoRow!.slug,
    },
    {
      id: avaliacaoId,
      sequence_order: 1,
      sequence_root_event_id: revisaoId,
      sequence_root_slug: revisaoRow!.slug,
      next_event_id: null,
      next_event_title: null,
      next_event_slug: null,
    },
  ];

  for (const update of sequenceUpdates) {
    const { id, ...fields } = update;
    const patch = { ...fields, sequence_id: sequenceId, sequence_size: 2, updated_at: now };
    await supabase.from("events").update(patch).eq("id", id);
    await supabase.from("public_events").update(patch).eq("event_id", id);
  }

  console.log("Eventos criados:");
  console.log(`  Revisão (1/2 na sequência): /e/${revisaoRow!.slug}`);
  console.log(`  Avaliação (2/2 na sequência): /e/${avaliacaoRow!.slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
