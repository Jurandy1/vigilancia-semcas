/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessCodeRenewalDelay } from "@/lib/projector/access-code-timing";

const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  states: [] as unknown[],
  index: 0,
  rootSlug: "atual",
  openSlug: null as string | null,
  waitingSlug: "primeiro",
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
  useRef: (initial: unknown) => ({ current: initial }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ eventSlug: harness.rootSlug }) }));
vi.mock("@/hooks/use-public-event", () => ({ usePublicEvent: () => ({ publicEvent: harness.event }) }));
vi.mock("@/hooks/use-round-stats", () => ({ useRoundStats: () => ({ stats: { registered: 0, answering: 0, completed: 0 } }) }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => {
    let statusEq: string | null = null;
    let statusIn: string[] | null = null;
    const query: any = {
      select: () => query,
      eq: (col: string, val: string) => {
        if (col === "status") statusEq = val;
        return query;
      },
      in: (col: string, vals: string[]) => {
        if (col === "status") statusIn = vals;
        return query;
      },
      not: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => {
        if (harness.queryError) return { data: null, error: harness.queryError };
        if (statusEq === "open") {
          return { data: harness.openSlug ? { slug: harness.openSlug } : null, error: null };
        }
        if (statusIn) {
          return { data: harness.waitingSlug ? { slug: harness.waitingSlug } : null, error: null };
        }
        return { data: null, error: null };
      },
    };
    const channel: any = {
      on: (_: unknown, __: unknown, callback: () => void) => { harness.realtime = callback; return channel; },
      subscribe: () => channel,
    };
    return {
      from: () => {
        statusEq = null;
        statusIn = null;
        return query;
      },
      channel: () => channel,
      removeChannel: vi.fn(),
    };
  },
}));
import ProjectorPage from "@/app/projector/[eventSlug]/page";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  Object.assign(harness, {
    effects: [],
    states: [],
    index: 0,
    rootSlug: "atual",
    openSlug: null,
    waitingSlug: "primeiro",
    event: null,
    queryError: null,
  });
  vi.stubGlobal("window", { setInterval, clearInterval, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("projetor", () => {
  it("usa a fila quando não há evento aberto e reage ao abrir", async () => {
    ProjectorPage();
    const cleanup = harness.effects[0]!();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.states[0]).toBe("primeiro");
    harness.openSlug = "outro-evento";
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
    harness.waitingSlug = "";
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
    expect(getAccessCodeRenewalDelay(Number.NaN)).toBe(0);
    expect(getAccessCodeRenewalDelay(Date.now() - 1_000)).toBe(0);
    expect(getAccessCodeRenewalDelay(Date.now() + 60_000)).toBeGreaterThan(0);
  });
});
