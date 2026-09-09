import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";

export const runtime = "nodejs";

const sequenceSchema = z.object({
  eventIds: z
    .array(z.string().uuid("Identificador de evento inválido."))
    .min(2, "Selecione pelo menos dois eventos.")
    .max(50, "Uma sequência pode ter no máximo 50 eventos.")
    .refine((ids) => new Set(ids).size === ids.length, "A sequência contém eventos repetidos."),
});

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  INVALID_SEQUENCE_SIZE: { status: 400, message: "A sequência deve ter entre 2 e 50 eventos." },
  DUPLICATE_EVENT: { status: 400, message: "A sequência contém eventos repetidos." },
  EVENT_NOT_FOUND: { status: 404, message: "Um dos eventos selecionados não existe mais." },
  MULTIPLE_LOCKED_SEQUENCES: {
    status: 409,
    message: "Não é possível unir eventos já iniciados de sequências diferentes.",
  },
};

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const parsed = sequenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Sequência inválida." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("save_event_sequence_atomic", {
    p_event_ids: parsed.data.eventIds,
  });

  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? {
      status: 500,
      message: "Não foi possível salvar a sequência.",
    };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const result = (data ?? {}) as {
    sequenceId?: string;
    rootEventId?: string;
    rootSlug?: string;
    count?: number;
  };
  return NextResponse.json({ success: true, ...result });
}
