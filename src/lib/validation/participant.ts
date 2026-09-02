import { z } from "zod";

export const participantModeSchema = z.enum(["identified", "anonymous"]);

export const joinEventSchema = z
  .object({
    mode: participantModeSchema,
    name: z.string().trim().max(120).optional().nullable(),
    accessCode: z.string().trim().max(10).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "identified") {
      const name = data.name?.trim();
      if (!name || name.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe seu nome completo.",
          path: ["name"],
        });
      }
    }
    if (data.mode === "anonymous") {
      data.name = null;
    }
  });

export const accessCodeSchema = z.object({
  accessCode: z
    .string()
    .trim()
    .min(4, "Informe o código de acesso.")
    .max(10),
});

export type JoinEventInput = z.infer<typeof joinEventSchema>;
