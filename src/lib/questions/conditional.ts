export interface ConditionalQuestion {
  id: string;
  order: number;
  showIfQuestionOrder?: number | null;
  showIfValue?: string | null;
}

type AnswerValue = string | string[] | undefined;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function matches(value: AnswerValue, expected: string) {
  if (Array.isArray(value)) {
    return value.some((item) => normalize(item) === normalize(expected));
  }
  if (!value) return false;
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.some((item) => typeof item === "string" && normalize(item) === normalize(expected));
      }
    } catch {
      // Resposta simples iniciada por "["; compara normalmente abaixo.
    }
  }
  return normalize(value) === normalize(expected);
}

/** Resolve condições encadeadas e protege contra referências circulares. */
export function getVisibleQuestions<T extends ConditionalQuestion>(
  questions: T[],
  getAnswer: (questionId: string) => AnswerValue
): T[] {
  const byOrder = new Map(questions.map((question) => [question.order, question]));
  const cache = new Map<string, boolean>();

  function isVisible(question: T, visiting = new Set<string>()): boolean {
    const cached = cache.get(question.id);
    if (cached !== undefined) return cached;
    if (!question.showIfQuestionOrder || !question.showIfValue) {
      cache.set(question.id, true);
      return true;
    }
    if (visiting.has(question.id)) {
      cache.set(question.id, false);
      return false;
    }

    const parent = byOrder.get(question.showIfQuestionOrder);
    if (!parent || parent.order >= question.order) {
      cache.set(question.id, false);
      return false;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(question.id);
    const visible =
      isVisible(parent, nextVisiting) &&
      matches(getAnswer(parent.id), question.showIfValue);
    cache.set(question.id, visible);
    return visible;
  }

  return questions.filter((question) => isVisible(question));
}
