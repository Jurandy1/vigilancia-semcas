import { formatPercent } from "@/lib/utils/format";

interface AnswerLike {
  questionId: string;
  value: string;
}

interface SubmissionLike {
  answers?: AnswerLike[];
}

export function aggregateSingleChoiceCounts(
  options: string[],
  submissions: SubmissionLike[],
  questionId: string
): Array<{ option: string; count: number; percent: string }> {
  const counts: Record<string, number> = {};
  options.forEach((opt) => {
    counts[opt] = 0;
  });

  submissions.forEach((sub) => {
    const answer = sub.answers?.find((a) => a.questionId === questionId);
    if (answer && counts[answer.value] !== undefined) {
      counts[answer.value]++;
    }
  });

  const total = submissions.length;
  return Object.entries(counts).map(([option, count]) => ({
    option,
    count,
    percent: formatPercent(count, total),
  }));
}
