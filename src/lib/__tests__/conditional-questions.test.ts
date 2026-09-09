import { describe, expect, it } from "vitest";
import { getVisibleQuestions } from "@/lib/questions/conditional";

const questions = [
  { id: "q5", order: 5 },
  { id: "q6", order: 6, showIfQuestionOrder: 5, showIfValue: "Sim" },
  { id: "q7", order: 7, showIfQuestionOrder: 5, showIfValue: "Sim" },
  { id: "q8", order: 8 },
];

describe("conditional questions", () => {
  it("shows dependent questions when the expected answer is selected", () => {
    const answers = { q5: "Sim" };
    expect(getVisibleQuestions(questions, (id) => answers[id as keyof typeof answers]))
      .toHaveLength(4);
  });

  it("hides every dependent question when the answer does not match", () => {
    const answers = { q5: "Não" };
    expect(getVisibleQuestions(questions, (id) => answers[id as keyof typeof answers])
      .map((question) => question.id))
      .toEqual(["q5", "q8"]);
  });

  it("supports conditions based on multiple-choice answers", () => {
    const answers = { q5: JSON.stringify(["Sim", "Outro"]) };
    expect(getVisibleQuestions(questions, (id) => answers[id as keyof typeof answers]))
      .toHaveLength(4);
  });
});
