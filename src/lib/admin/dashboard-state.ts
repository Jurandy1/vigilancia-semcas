export interface DashboardRound {
  id: string;
  title: string;
  status: string;
  order: number;
  submissionCount: number;
}

export type DashboardCase =
  | "round_open" // A — rodada aberta
  | "has_next_round" // B — encerrada, existe próxima
  | "no_next_round" // C — encerrada, não existe próxima
  | "event_waiting" // D — evento draft/waiting
  | "no_rounds_yet" // E — evento aberto, nenhuma rodada criada
  | "event_closed"; // evento fechado (sem próximo evento elegível)

export interface DashboardState {
  case: DashboardCase;
  currentRound: DashboardRound | null;
  nextRound: DashboardRound | null;
  lastClosedRound: DashboardRound | null;
}

export function resolveDashboardState(
  eventStatus: string,
  rounds: DashboardRound[]
): DashboardState {
  if (eventStatus === "draft" || eventStatus === "waiting") {
    return { case: "event_waiting", currentRound: null, nextRound: null, lastClosedRound: null };
  }

  if (eventStatus === "closed") {
    return { case: "event_closed", currentRound: null, nextRound: null, lastClosedRound: null };
  }

  const currentRound = rounds.find((r) => r.status === "open") ?? null;

  const closedRounds = [...rounds]
    .filter((r) => r.status === "closed")
    .sort((a, b) => b.order - a.order);
  const lastClosedRound = closedRounds[0] ?? null;

  if (currentRound) {
    return { case: "round_open", currentRound, nextRound: null, lastClosedRound };
  }

  if (rounds.length === 0) {
    return { case: "no_rounds_yet", currentRound: null, nextRound: null, lastClosedRound: null };
  }

  const lastExecutedOrder = lastClosedRound?.order ?? -Infinity;
  const nextRound =
    [...rounds]
      .filter((r) => (r.status === "draft" || r.status === "waiting") && r.order > lastExecutedOrder)
      .sort((a, b) => a.order - b.order)[0] ?? null;

  if (nextRound) {
    return { case: "has_next_round", currentRound: null, nextRound, lastClosedRound };
  }

  return { case: "no_next_round", currentRound: null, nextRound: null, lastClosedRound };
}
