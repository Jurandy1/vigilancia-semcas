// 32 fragmentos mantêm a contenção baixa mesmo quando centenas de pessoas
// entram ou respondem ao mesmo tempo.
export const NUM_SHARDS = 32;

export interface ShardStats {
  shardId: number;
  registered: number;
  answering: number;
  completed: number;
  updatedAt: string;
}

export interface AggregatedStats {
  registered: number;
  answering: number;
  completed: number;
}

export type AuditAction =
  | "participant_started"
  | "participant_completed"
  | "round_opened"
  | "round_closed"
  | "event_opened"
  | "event_closed"
  | "report_exported";

export interface AuditEntry {
  id: string;
  eventId: string;
  action: AuditAction;
  actorType: "participant" | "admin" | "system";
  actorId: string | null;
  roundId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "error";
