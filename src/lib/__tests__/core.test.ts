import { describe, it, expect } from "vitest";
import { getShardId } from "@/lib/counters/shard";
import { getSubmissionId, getParticipantRoundId } from "@/lib/sessions/tokens";
import { aggregateShardStats } from "@/lib/counters/aggregate";
import { getParticipantDisplayName } from "@/lib/utils/participant-display";
import { NUM_SHARDS } from "@/types";
import { findOtherOption, isOtherOptionLabel } from "@/lib/questions/other-option";

describe("shard", () => {
  it("returns deterministic shard for same participant+round", () => {
    const a = getShardId("p1", "r1");
    const b = getShardId("p1", "r1");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(NUM_SHARDS);
  });

  it("returns different shards for different participants", () => {
    const shards = new Set(
      Array.from({ length: 50 }, (_, i) => getShardId(`p${i}`, "r1"))
    );
    expect(shards.size).toBeGreaterThan(1);
  });
});

describe("submission id", () => {
  it("is deterministic", () => {
    expect(getSubmissionId("round1", "part1")).toBe("round1_part1");
    expect(getParticipantRoundId("round1", "part1")).toBe("round1_part1");
  });
});

describe("aggregateShardStats", () => {
  it("sums all shards", () => {
    const result = aggregateShardStats([
      { shardId: 0, registered: 10, answering: 5, completed: 3, updatedAt: "" },
      { shardId: 1, registered: 8, answering: 2, completed: 7, updatedAt: "" },
    ]);
    expect(result).toEqual({ registered: 18, answering: 7, completed: 10 });
  });
});

describe("participant display", () => {
  it("shows only Anônimo for anonymous", () => {
    expect(getParticipantDisplayName({ mode: "anonymous", name: null })).toBe("Anônimo");
  });

  it("shows name for identified", () => {
    expect(getParticipantDisplayName({ mode: "identified", name: "Maria Silva" })).toBe(
      "Maria Silva"
    );
  });
});

describe("other option", () => {
  it("recognizes Portuguese Outro/Outra labels", () => {
    expect(isOtherOptionLabel("Outros. Qual? __________")).toBe(true);
    expect(isOtherOptionLabel("Outra periodicidade")).toBe(true);
    expect(isOtherOptionLabel("Trimestral")).toBe(false);
  });

  it("finds the option that requires a written detail", () => {
    expect(findOtherOption(["Mensal", "Outra periodicidade"])).toBe("Outra periodicidade");
  });
});
