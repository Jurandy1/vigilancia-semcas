import { describe, it, expect } from "vitest";
import { getSubmissionId, getParticipantRoundId } from "@/lib/sessions/tokens";
import { getParticipantDisplayName } from "@/lib/utils/participant-display";
import { findOtherOption, isOtherOptionLabel } from "@/lib/questions/other-option";

describe("submission id", () => {
  it("is deterministic", () => {
    expect(getSubmissionId("round1", "part1")).toBe("round1_part1");
    expect(getParticipantRoundId("round1", "part1")).toBe("round1_part1");
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
