import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("events")
    .select("id,title,slug")
    .eq("is_daily_active", true)
    .maybeSingle();

  return NextResponse.json({ event: data ?? null });
}

const setSchema = z.object({ eventId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const parsed = setSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: rootId, error } = await supabase.rpc("set_daily_active_event", {
    p_event_id: parsed.data.eventId,
  });
  if (error) {
    const message =
      error.message === "EVENT_NOT_FOUND" ? "Evento não encontrado." : "Não foi possível definir o evento do dia.";
    return NextResponse.json({ error: message }, { status: error.message === "EVENT_NOT_FOUND" ? 404 : 500 });
  }

  return NextResponse.json({ success: true, rootEventId: rootId });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("clear_daily_active_event");
  if (error) {
    return NextResponse.json({ error: "Não foi possível limpar o evento do dia." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
