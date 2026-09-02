import type { AggregatedStats, ShardStats } from "@/types/index";

export function aggregateShardStats(shards: ShardStats[]): AggregatedStats {
  return shards.reduce(
    (acc, shard) => ({
      registered: acc.registered + (shard.registered ?? 0),
      answering: acc.answering + (shard.answering ?? 0),
      completed: acc.completed + (shard.completed ?? 0),
    }),
    { registered: 0, answering: 0, completed: 0 }
  );
}
