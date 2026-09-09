import { z } from "zod";

export const roundStatusSchema = z.enum(["draft", "waiting", "open", "closed"]);
export const roundTypeSchema = z.enum(["survey", "poll"]);
export const resultsVisibilitySchema = z.enum(["hidden", "after_close", "admin_only"]);

export const questionSchema = z.object({
  id: z.string().optional(),
  order: z.number().int().min(1),
  type: z.enum(["single_choice", "multi_choice", "text"]),
  title: z.string().trim().min(3).max(500),
  explanation: z.string().trim().max(1000).optional().nullable(),
  required: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(200)).optional(),
  maxLength: z.number().int().min(1).max(5000).optional(),
  maxSelections: z.number().int().min(1).optional(),
  showIfQuestionOrder: z.number().int().min(1).optional().nullable(),
  showIfValue: z.string().trim().min(1).max(200).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.type === "single_choice" || data.type === "multi_choice") {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Adicione pelo menos 2 alternativas.",
        path: ["options"],
      });
    }
  }
});

export const createRoundSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(500).optional().nullable(),
  type: roundTypeSchema.default("survey"),
  allowNewParticipants: z.boolean().default(true),
  resultsVisibility: resultsVisibilitySchema.default("after_close"),
  questions: z.array(questionSchema).min(1).max(50),
}).superRefine((data, ctx) => {
  const byOrder = new Map(data.questions.map((question) => [question.order, question]));
  data.questions.forEach((question, index) => {
    const hasParent = Boolean(question.showIfQuestionOrder);
    const hasValue = Boolean(question.showIfValue);
    if (hasParent !== hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A condição precisa informar a pergunta e a resposta esperada.",
        path: ["questions", index],
      });
      return;
    }
    if (!question.showIfQuestionOrder || !question.showIfValue) return;

    const parent = byOrder.get(question.showIfQuestionOrder);
    if (
      !parent ||
      parent.order >= question.order ||
      parent.type === "text" ||
      !parent.options?.includes(question.showIfValue)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A condição deve apontar para uma alternativa de uma pergunta anterior.",
        path: ["questions", index],
      });
    }
  });
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
