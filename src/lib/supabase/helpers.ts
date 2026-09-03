import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AuditAction } from "@/types/index";

export async function writeAuditLog(params: {
  eventId: string;
  action: AuditAction;
  actorType: "participant" | "admin" | "system";
  actorId?: string | null;
  roundId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("audit_log").insert({
    event_id: params.eventId,
    action: params.action,
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    round_id: params.roundId ?? null,
    metadata: params.metadata ?? {},
  });
}
