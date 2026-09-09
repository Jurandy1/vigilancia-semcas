import { describe, expect, it } from "vitest";
import { submitSchema } from "@/lib/validation/submission";
import {
  aggregateChoiceCounts,
  findLastAnswerByQuestionId,
} from "@/lib/reports/aggregate-choice-counts";

describe("submission integrity", () => {
  it("rejects duplicate question ids", () => {
    const result = submitSchema.safeParse({
      answers: [
        { questionId: "q1", type: "single_choice", value: "A" },
        { questionId: "q1", type: "single_choice", value: "B" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("uses the last historical duplicate consistently", () => {
    const answers = [
      { questionId: "q1", value: "A" },
      { questionId: "q1", value: "B" },
    ];

    expect(findLastAnswerByQuestionId(answers, "q1")?.value).toBe("B");
    expect(aggregateChoiceCounts(["A", "B"], [{ answers }], "q1")).toEqual([
      { option: "A", count: 0, percent: "0,0%" },
      { option: "B", count: 1, percent: "100,0%" },
    ]);
  });

  it("limits a submission to the maximum round size", () => {
    const answers = Array.from({ length: 51 }, (_, index) => ({
      questionId: `q${index}`,
      type: "text" as const,
      value: "ok",
    }));

    expect(submitSchema.safeParse({ answers }).success).toBe(false);
  });
});
