import type { Participant, ParticipantMode } from "@/types/participant";

export function getParticipantDisplayName(participant: Pick<Participant, "mode" | "name">): string {
  if (participant.mode === "anonymous") {
    return "Anônimo";
  }
  return participant.name?.trim() || "Sem nome";
}

export function isAnonymousMode(mode: ParticipantMode): boolean {
  return mode === "anonymous";
}
