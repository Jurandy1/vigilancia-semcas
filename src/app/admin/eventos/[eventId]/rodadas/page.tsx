"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface RoundItem {
  id: string;
  title: string;
  status: string;
  order: number;
  questionCount?: number;
  submissionCount: number;
}

type PendingAction = { type: "open" | "close"; round: RoundItem } | null;

function RoundCard({
  round,
  participantCount,
  actions,
}: {
  round: RoundItem;
  participantCount: number;
  actions: React.ReactNode;
}) {
  const num = String(round.order).padStart(2, "0");
  const isOpen = round.status === "open";
  return (
    <div style={{ background: "#fff", border: "1px solid #dde4ee", borderRadius: "10px", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#1a1a1a" }}>
          {num} · {round.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              display: isOpen ? "inline-flex" : "inline-flex",
              alignItems: "center",
              gap: isOpen ? "6px" : undefined,
              fontSize: "12px",
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: "4px",
              ...(isOpen
                ? { color: "#1a7f4b", background: "#e8f5ee", border: "1px solid #c3e4d1" }
                : round.status === "closed"
                  ? { color: "#5b6b7f", background: "#f4f6f9", border: "1px solid #dde4ee" }
                  : { color: "#8a5a00", background: "#fdf5e3", border: "1px solid #f0dfae" })
            }}
          >
            {isOpen ? "Aberta" : round.status === "closed" ? "Encerrada" : "Rascunho"}
          </span>
          <span style={{ fontSize: "13px", color: "#5b6b7f" }}>
            {isOpen || round.status === "closed"
              ? `${round.submissionCount} de ${participantCount} respostas`
              : `${round.questionCount ?? 0} perguntas`}
            {isOpen ? ` · ${round.questionCount ?? 0} perguntas` : ""}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>{actions}</div>
    </div>
  );
}

export default function RodadasPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<
    { title: string; slug: string; status: string; participantCount: number } | null
  >(null);
  const [rounds, setRounds] = useState<RoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAdminIdToken();
    if (!token) return;
    const [roundsRes, eventRes] = await Promise.all([
      adminFetch(`/api/admin/events/${eventId}/rounds`, token),
      adminFetch(`/api/admin/events/${eventId}`, token),
    ]);
    const roundsData = await roundsRes.json();
    const eventData = await eventRes.json();
    setRounds(roundsData.rounds ?? []);
    setEvent(eventData.event ?? null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    const unsub = onAdminAuthChange((user) => {
      if (user) load();
    });
    return unsub;
  }, [load]);

  const hasOpenRound = rounds.some((r) => r.status === "open");
  const participantCount = event?.participantCount ?? 0;

  async function confirmAction() {
    if (!pending) return;
    setActionLoading(true);
    setError(null);
    try {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(
        `/api/admin/events/${eventId}/rounds/${pending.round.id}/${pending.type}`,
        token,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível concluir esta operação. Tente novamente.");
        return;
      }
      setPending(null);
      await load();
    } catch {
      setError("Não foi possível concluir esta operação. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminShell eventId={eventId} screenLabel="Perguntas do evento">
        <div className="space-y-4 max-w-[900px]">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-28 w-full" />
        </div>
      </AdminShell>
    );
  }

  const sorted = [...rounds].sort((a, b) => a.order - b.order);
  const openRounds = sorted.filter((r) => r.status === "open");
  const draftRounds = sorted.filter((r) => r.status === "draft" || r.status === "waiting");
  const closedRounds = sorted.filter((r) => r.status === "closed");

  const outlineBtn =
    "inline-flex items-center h-[38px] px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] bg-white border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] no-underline";
  const dangerBtn =
    "inline-flex items-center h-[38px] px-3.5 text-[13.5px] font-semibold text-[#b42318] bg-white border border-[#e3b3ad] rounded-md hover:bg-[#fdf2f1] hover:border-[#b42318]";

  return (
    <AdminShell
      eventId={eventId}
      eventTitle={event?.title}
      eventSlug={event?.slug}
      eventStatus={event?.status}
      screenLabel="Perguntas do evento"
    >
      <section data-screen-label="Perguntas do evento">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "1px solid #dbe4ef", marginBottom: "24px" }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#18754A" }}>Evento atual</p>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-.02em", color: "#11243c" }}>Perguntas do evento</h1>
            <p style={{ margin: "6px 0 0", fontSize: "13.5px", color: "#5b6b7f" }}>Enunciados, explicações, alternativas e campos de resposta deste evento.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {draftRounds.length === 1 && (
              <Link
                href={`/admin/eventos/${eventId}/rodadas/${draftRounds[0]!.id}/editar`}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: "38px", padding: "0 16px", fontSize: "13px", fontWeight: 600, color: "#0B3A6E", background: "#fff", border: "1px solid #c9d4e2", borderRadius: "8px", textDecoration: "none" }}
              >
                Editar perguntas
              </Link>
            )}
            <Link
              href={`/admin/eventos/${eventId}/rodadas/nova`}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: "38px", padding: "0 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "#0B3A6E", border: "1px solid #0B3A6E", borderRadius: "8px", textDecoration: "none" }}
            >
              Novo bloco de perguntas
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: "16px", fontSize: "14px", color: "#b42318", background: "#fdf2f1", border: "1px solid #e3b3ad", borderRadius: "6px", padding: "8px 12px" }}>
            {error}
          </div>
        )}

        <h2 style={{ margin: "0 0 10px 0", fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>
          Em andamento
        </h2>
        {openRounds.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #dde4ee", borderRadius: "10px", padding: "22px", textAlign: "center", marginBottom: "0" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#8a97a8" }}>Nenhuma rodada aberta no momento.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {openRounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                participantCount={participantCount}
                actions={
                  <>
                    <Link
                      href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                      className={outlineBtn}
                      style={{ height: "36px", borderRadius: "8px" }}
                    >
                      Resultados
                    </Link>
                    <Link
                      href={`/admin/eventos/${eventId}/ao-vivo`}
                      className={outlineBtn}
                      style={{ height: "36px", borderRadius: "8px" }}
                    >
                      Gerenciar
                    </Link>
                    <button
                      type="button"
                      className={dangerBtn}
                      style={{ height: "36px", borderRadius: "8px" }}
                      onClick={() => setPending({ type: "close", round })}
                    >
                      Encerrar
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}

        <h2 style={{ margin: "26px 0 10px 0", fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>
          Próximas / rascunhos
        </h2>
        {draftRounds.length === 0 ? (
          <div style={{ background: "#fafcfe", border: "1px dashed #d6dfea", borderRadius: "10px", padding: "26px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 600, color: "#33415c" }}>Nenhuma rodada em rascunho.</p>
            <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "#8a97a8" }}>
              <Link
                href={`/admin/eventos/${eventId}/rodadas/nova`}
                style={{ color: "#0b3a6e", textDecoration: "underline" }}
              >
                Criar próxima rodada
              </Link>
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {draftRounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                participantCount={participantCount}
                actions={
                  <>
                    {round.submissionCount === 0 && (
                      <Link
                        href={`/admin/eventos/${eventId}/rodadas/${round.id}/editar`}
                        className={outlineBtn}
                        style={{ height: "36px", borderRadius: "8px" }}
                      >
                        Editar perguntas
                      </Link>
                    )}
                    <button
                      type="button"
                      className={outlineBtn}
                      style={{ height: "36px", borderRadius: "8px" }}
                      disabled={hasOpenRound}
                      title={
                        hasOpenRound ? "Encerre a rodada aberta antes de abrir outra." : undefined
                      }
                      onClick={() => setPending({ type: "open", round })}
                    >
                      Abrir rodada
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}

        <h2 style={{ margin: "26px 0 10px 0", fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6b7f" }}>
          Concluídas
        </h2>
        {closedRounds.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #dde4ee", borderRadius: "10px", padding: "22px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#8a97a8" }}>Nenhuma rodada encerrada até agora.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {closedRounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                participantCount={participantCount}
                actions={
                  <Link
                    href={`/admin/eventos/${eventId}/rodadas/${round.id}/resultados`}
                    className={outlineBtn}
                    style={{ height: "36px", borderRadius: "8px" }}
                  >
                    Ver resultados
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.type === "open" ? "Abrir rodada?" : "Encerrar rodada?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.type === "open"
                ? "Todos os participantes aptos poderão responder esta etapa."
                : "Após o encerramento, novas respostas não serão aceitas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={actionLoading}>
              {actionLoading
                ? "Aguarde..."
                : pending?.type === "open"
                  ? "Abrir rodada"
                  : "Encerrar rodada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
