/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessCodeRenewalDelay } from "@/lib/projector/access-code-timing";

const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  states: [] as unknown[],
  index: 0,
  rootSlug: "atual",
  dailySlug: "primeiro",
  event: null as any,
  queryError: null as any,
  realtime: null as null | (() => void),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.index++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: any) => {
      harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value;
    }];
  },
  useEffect: (effect: () => void) => harness.effects.push(effect),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ eventSlug: harness.rootSlug }) }));
vi.mock("@/hooks/use-public-event", () => ({ usePublicEvent: () => ({ publicEvent: harness.event }) }));
vi.mock("@/hooks/use-round-stats", () => ({ useRoundStats: () => ({ stats: { registered: 0, answering: 0, completed: 0 } }) }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => {
    const query: any = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: { slug: harness.dailySlug }, error: harness.queryError }),
    };
    const channel: any = {
      on: (_: unknown, __: unknown, callback: () => void) => { harness.realtime = callback; return channel; },
      subscribe: () => channel,
    };
    return { from: () => query, channel: () => channel, removeChannel: vi.fn() };
  },
}));
import ProjectorPage from "@/app/projector/[eventSlug]/page";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  Object.assign(harness, { effects: [], states: [], index: 0, rootSlug: "atual", dailySlug: "primeiro", event: null, queryError: null });
  vi.stubGlobal("window", { setInterval, clearInterval, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("projetor", () => {
  it("preserva o avanço na sequência e reage apenas à troca da raiz", async () => {
    ProjectorPage();
    const cleanup = harness.effects[0]!();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.states[0]).toBe("primeiro");
    // O efeito de avanço já levou o telão para o segundo evento.
    harness.states[0] = "segundo";
    await vi.advanceTimersByTimeAsync(20_000);
    expect(harness.states[0]).toBe("segundo");
    harness.dailySlug = "outro-evento";
    harness.realtime!();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.states[0]).toBe("outro-evento");
    if (cleanup) cleanup();
  });

  it("mantém o evento atual durante falha da consulta", async () => {
    ProjectorPage();
    const cleanup = harness.effects[0]!();
    await vi.advanceTimersByTimeAsync(0);
    harness.queryError = { message: "offline" };
    harness.dailySlug = "";
    await vi.advanceTimersByTimeAsync(20_000);
    expect(harness.states[0]).toBe("primeiro");
    if (cleanup) cleanup();
  });

  it("renova imediatamente ao abrir perto da expiração e agenda pela nova validade", async () => {
    harness.rootSlug = "primeiro";
    harness.event = { slug: "primeiro", status: "open", requireLiveCode: true, accessChallenge: { expiresAt: new Date(5_000).toISOString() } };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ expiresAt: new Date(Date.now() + 60_000).toISOString() }) }));
    vi.stubGlobal("fetch", fetchMock);
    ProjectorPage();
    const cleanup = harness.effects[4]!();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(44_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    if (cleanup) cleanup();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("trata código ausente, vencido e recém-gerado", () => {
    expect(getAccessCodeRenewalDelay(NaN, 0)).toBe(0);
    expect(getAccessCodeRenewalDelay(-1, 0)).toBe(0);
    expect(getAccessCodeRenewalDelay(60_000, 0)).toBe(45_000);
  });
});
