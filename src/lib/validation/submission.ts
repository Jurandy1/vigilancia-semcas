import { z } from "zod";

export const answerSchema = z.object({
  questionId: z.string().min(1),
  type: z.enum(["single_choice", "multi_choice", "text"]),
  // Arrays e strings vazios são estruturalmente válidos aqui — representam
  // "pergunta opcional deixada em branco" (ex.: múltipla escolha marcada e
  // depois desmarcada por completo). A obrigatoriedade real é decidida por
  // pergunta em validateAnswers (submit/route.ts), que já sabe qual pergunta
  // é required. Antes esses `.min(1)` rejeitavam o payload inteiro com
  // "Dados inválidos." mesmo quando só uma pergunta opcional ficou vazia.
  value: z.union([
    z.string().trim().max(5000),
    z.array(z.string().trim().min(1).max(200)).max(50),
  ]),
  otherText: z.string().trim().min(1).max(500).optional(),
});

export const progressSchema = z.object({
  currentQuestion: z.number().int().min(0),
  status: z.enum(["waiting", "answering"]).optional(),
});

// Sem .min(1): uma rodada onde toda pergunta é opcional e o participante não
// marcou nada precisa poder ser enviada com answers = [].
export const submitSchema = z.object({
  answers: z.array(answerSchema),
});

export type SubmitInput = z.infer<typeof submitSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
