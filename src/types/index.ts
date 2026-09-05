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
  | "event_reset"
  | "event_deleted"
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
