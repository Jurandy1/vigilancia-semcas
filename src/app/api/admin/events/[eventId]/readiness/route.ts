import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAdminRequest, adminUnauthorized } from "@/lib/security/admin-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return adminUnauthorized();

  const { eventId } = await params;
  const supabase = getSupabaseAdmin();
  const [{ data: event }, { data: rounds }] = await Promise.all([
    supabase.from("events").select("id,title,status,participant_count,current_open_round_id,next_event_id,next_event_title").eq("id", eventId).maybeSingle(),
    supabase.from("rounds").select("id,title,status,order,question_count,registered_count,answering_count,completed_count").eq("event_id", eventId).order("order", { ascending: true }),
  ]);
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  const ordered = rounds ?? [];
  const currentRound = ordered.find((round) => round.id === event.current_open_round_id || round.status === "open") ?? null;
  const lastClosed = [...ordered].filter((round) => round.status === "closed").sort((a, b) => b.order - a.order)[0] ?? null;
  const reference = currentRound ?? lastClosed;
  const nextRound = ordered.find((round) => (round.status === "draft" || round.status === "waiting") && round.order > (lastClosed?.order ?? -1)) ?? null;
  const registered = reference?.registered_count ?? 0;
  const answering = reference?.answering_count ?? 0;
  const completed = reference?.completed_count ?? 0;

  return NextResponse.json({
    event: { id: event.id, title: event.title, status: event.status, participantCount: event.participant_count ?? 0 },
    round: reference ? { id: reference.id, title: reference.title, status: reference.status, questionCount: reference.question_count ?? 0 } : null,
    stats: { registered, answering, completed, notStarted: Math.max(0, (event.participant_count ?? 0) - registered) },
    nextRound: nextRound ? { id: nextRound.id, title: nextRound.title, questionCount: nextRound.question_count ?? 0 } : null,
    nextEvent: event.next_event_id ? { id: event.next_event_id, title: event.next_event_title } : null,
    checkedAt: new Date().toISOString(),
  });
}
