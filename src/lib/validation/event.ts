import { z } from "zod";

export const eventStatusSchema = z.enum(["draft", "waiting", "open", "closed"]);

export const createEventSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido."),
  description: z.string().trim().max(500).optional().nullable(),
  projectorTitle: z.string().trim().max(200).optional().nullable(),
  isTest: z.boolean().default(false),
  requireLiveCode: z.boolean().default(false),
});

export const updateEventStatusSchema = z.object({
  status: eventStatusSchema,
});

export const updateEventSettingsSchema = z.object({
  requireLiveCode: z.boolean(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
