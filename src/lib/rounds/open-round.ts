import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rotateAccessCode } from "@/lib/security/access-code";

export type OpenRoundResult =
  | { ok: true; roundId: string; roundTitle: string }
  | { ok: false; status: number; error: string };

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  EVENT_NOT_FOUND: { status: 404, message: "Evento não encontrado." },
  EVENT_NOT_OPEN: { status: 409, message: "O evento precisa estar em andamento antes de iniciar uma rodada." },
  ROUND_NOT_FOUND: { status: 404, message: "Rodada não encontrada." },
  ROUND_ALREADY_OPEN: { status: 409, message: "Esta rodada já está aberta." },
  ROUND_ALREADY_CLOSED: { status: 409, message: "Esta rodada já foi encerrada e não pode ser reaberta." },
  ANOTHER_ROUND_OPEN: { status: 409, message: "Já existe uma rodada em andamento. Encerre-a antes de abrir outra." },
};

/**
 * Abre uma rodada dentro de um evento, via a funcao Postgres open_round (atomica).
 */
export async function openRoundTransaction(
  eventId: string,
  roundId: string
): Promise<OpenRoundResult> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.rpc("open_round", { p_event_id: eventId, p_round_id: roundId });
  if (error) {
    const mapped = ERROR_MESSAGES[error.message] ?? { status: 500, message: "Não foi possível abrir a rodada." };
    return { ok: false, status: mapped.status, error: mapped.message };
  }

  const { data: round } = await supabase.from("rounds").select("title").eq("id", roundId).maybeSingle();
  const { data: event } = await supabase
    .from("events")
    .select("require_live_code")
    .eq("id", eventId)
    .maybeSingle();

  if (event?.require_live_code) {
    await rotateAccessCode(eventId);
  }

  return { ok: true, roundId, roundTitle: round?.title ?? "" };
}
