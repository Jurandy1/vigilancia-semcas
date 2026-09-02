import { z } from "zod";

export const answerSchema = z.object({
  questionId: z.string().min(1),
  type: z.enum(["single_choice", "text"]),
  value: z.string().trim().min(1).max(5000),
});

export const progressSchema = z.object({
  currentQuestion: z.number().int().min(0),
  status: z.enum(["waiting", "answering"]).optional(),
});

export const submitSchema = z.object({
  answers: z.array(answerSchema).min(1),
});

export type SubmitInput = z.infer<typeof submitSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
