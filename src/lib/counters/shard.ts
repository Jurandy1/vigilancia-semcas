import { NUM_SHARDS } from "@/types/index";
import { createHash } from "crypto";

export function getShardId(participantId: string, roundId: string): number {
  const hash = createHash("sha256").update(`${participantId}:${roundId}`).digest();
  return hash.readUInt32BE(0) % NUM_SHARDS;
}

export function getShardPath(eventId: string, roundId: string, shardId: number): string {
  return `publicStats/${eventId}/rounds/${roundId}/shards/${shardId}`;
}

export type CounterField = "registered" | "answering" | "completed";
