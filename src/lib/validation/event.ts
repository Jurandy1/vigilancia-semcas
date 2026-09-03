import { z } from "zod";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";

export const eventStatusSchema = z.enum(["draft", "waiting", "open", "closed"]);

export const createEventSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido.")
    .refine((s) => s !== DAILY_ACTIVE_SLUG, `"${DAILY_ACTIVE_SLUG}" é reservado pelo sistema.`),
  description: z.string().trim().max(500).optional().nullable(),
  projectorTitle: z.string().trim().max(200).optional().nullable(),
  isTest: z.boolean().default(false),
  requireLiveCode: z.boolean().default(false),
});

export const updateEventStatusSchema = z.object({
  status: eventStatusSchema,
});

export const updateEventSettingsSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  projectorTitle: z.string().trim().max(200).optional().nullable(),
  requireLiveCode: z.boolean().optional(),
  isTest: z.boolean().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
