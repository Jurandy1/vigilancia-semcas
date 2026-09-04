/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/security/admin-auth", () => ({ verifyAdminRequest: async () => ({ uid: "admin" }), adminUnauthorized: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => {
  const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: "round" } }), update: db.update };
  return { from: () => query, rpc: db.rpc };
} }));
import { PATCH } from "@/app/api/admin/events/[eventId]/rounds/[roundId]/route";
const body = { title: "Nova rodada", questions: [{ order: 1, type: "text", title: "Pergunta nova" }] };
const request = () => new NextRequest("http://localhost/api/admin/events/event/rounds/round", { method: "PATCH", body: JSON.stringify(body) });
const params = { params: Promise.resolve({ eventId: "event", roundId: "round" }) };
beforeEach(() => vi.clearAllMocks());
describe("edição de rodada", () => {
  it("envia perguntas e configurações em uma única operação", async () => {
    db.rpc.mockResolvedValue({ error: null });
    expect((await PATCH(request(), params)).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("update_round_content", expect.objectContaining({
      p_event_id: "event", p_round_id: "round",
      p_questions: expect.arrayContaining([expect.objectContaining({ title: "Pergunta nova" })]),
      p_settings: expect.objectContaining({ title: "Nova rodada" }),
    }));
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("recusa rodada aberta sem tentar gravar configurações separadamente", async () => {
    db.rpc.mockResolvedValue({ error: { message: "ROUND_IS_OPEN" } });
    expect((await PATCH(request(), params)).status).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });
});
