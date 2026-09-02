import { formatPercent } from "@/lib/utils/format";

interface AnswerLike {
  questionId: string;
  value: string | string[];
}

interface SubmissionLike {
  answers?: AnswerLike[];
}

/**
 * Conta seleções por opção para perguntas de escolha única ou múltipla.
 * Para múltipla escolha, um mesmo respondente pode contribuir para várias
 * opções ao mesmo tempo — a soma dos percentuais pode passar de 100%,
 * o que é esperado (percentual = respondentes que marcaram a opção ÷
 * total de respondentes da pergunta).
 */
export function aggregateChoiceCounts(
  options: string[],
  submissions: SubmissionLike[],
  questionId: string
): Array<{ option: string; count: number; percent: string }> {
  const counts: Record<string, number> = {};
  options.forEach((opt) => {
    counts[opt] = 0;
  });

  let respondents = 0;

  submissions.forEach((sub) => {
    const answer = sub.answers?.find((a) => a.questionId === questionId);
    if (!answer) return;

    if (Array.isArray(answer.value)) {
      if (answer.value.length === 0) return;
      respondents++;
      const seen = new Set(answer.value);
      seen.forEach((v) => {
        if (counts[v] !== undefined) counts[v]++;
      });
    } else {
      if (!answer.value) return;
      respondents++;
      if (counts[answer.value] !== undefined) counts[answer.value]++;
    }
  });

  return Object.entries(counts).map(([option, count]) => ({
    option,
    count,
    percent: formatPercent(count, respondents),
  }));
}
