"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  QuestionEditorList,
  validateQuestions,
  type QuestionDraft,
} from "@/components/admin/QuestionEditor";

export default function EditarRodadaPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const roundId = params.roundId as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRound, setLoadingRound] = useState(true);
  const [editable, setEditable] = useState(true);
  const [event, setEvent] = useState<{ title: string; slug: string } | null>(null);

  useEffect(() => {
    async function load() {
      const token = await getAdminIdToken();
      if (!token) return;
      const [roundRes, eventRes] = await Promise.all([
        adminFetch(`/api/admin/events/${eventId}/rounds/${roundId}`, token),
        adminFetch(`/api/admin/events/${eventId}`, token),
      ]);
      const roundData = await roundRes.json();
      const eventData = await eventRes.json();

      if (!roundRes.ok) {
        setError(roundData.error ?? "Não foi possível carregar esta rodada.");
        setLoadingRound(false);
        return;
      }

      setTitle(roundData.round.title ?? "");
      setDescription(roundData.round.description ?? "");
      setQuestions(
        (roundData.questions as Array<Record<string, unknown>>).map((q) => ({
          id: q.id as string,
          title: q.title as string,
          explanation: (q.explanation as string | null) ?? "",
          type: q.type as QuestionDraft["type"],
          options: (q.options as string[] | null) ?? [],
          required: (q.required as boolean) ?? true,
          maxSelections: (q.maxSelections as number | null) ?? undefined,
          maxLength: (q.maxLength as number | null) ?? undefined,
        }))
      );
      setEditable(roundData.editable);
      setEvent(eventData.event ?? null);
      setLoadingRound(false);
    }
    const unsub = onAdminAuthChange((user) => {
      if (user) load();
    });
    return unsub;
  }, [eventId, roundId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validationError = validateQuestions(questions);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const token = await getAdminIdToken();
      if (!token) throw new Error("Não autenticado.");
      const res = await adminFetch(`/api/admin/events/${eventId}/rounds/${roundId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description: description || null,
          type: "survey",
          questions: questions.map((q, i) => ({
            order: i + 1,
            type: q.type,
            title: q.title,
            explanation: q.explanation?.trim() || null,
            required: q.required,
            options: q.type !== "text" ? q.options.map((o) => o.trim()).filter(Boolean) : undefined,
            maxLength: q.type === "text" ? q.maxLength ?? 2000 : undefined,
            maxSelections:
              q.type === "multi_choice" && q.maxSelections ? q.maxSelections : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar rodada.");
        return;
      }
      router.push(`/admin/eventos/${eventId}/perguntas`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar rodada.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingRound) {
    return (
      <AdminShell eventId={eventId} screenLabel="Editar perguntas">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      eventId={eventId}
      eventTitle={event?.title}
      eventSlug={event?.slug}
      screenLabel="Editar perguntas"
    >
      <form onSubmit={handleSubmit} className="max-w-[1320px]">
        <div className="flex items-start justify-between gap-5 flex-wrap mb-5">
          <div className="min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={!editable}
              className="m-0 w-full max-w-xl text-2xl font-bold tracking-[-0.01em] text-[#1a1a1a] bg-transparent border-0 outline-none disabled:opacity-60"
            />
            <p className="mt-1.5 mb-0 text-[13.5px] text-[#5b6b7f]">
              {questions.length} perguntas ·{" "}
              {editable
                ? "alterações são salvas ao clicar em Salvar rodada"
                : "rodada bloqueada após receber respostas"}
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !editable}
            className="h-10 px-[18px] text-sm font-semibold bg-[#0b3a6e] text-white rounded-md hover:bg-[#0d4a8a] disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar rodada"}
          </button>
        </div>

        {!editable && (
          <div className="mb-4 text-sm text-[#8a5a00] bg-[#fdf5e3] border border-[#f0dfae] rounded-md px-3 py-2">
            Esta rodada já recebeu respostas e não pode mais ser editada.
          </div>
        )}

        {error && (
          <div className="mb-4 text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <QuestionEditorList questions={questions} onChange={setQuestions} disabled={!editable} />
      </form>
    </AdminShell>
  );
}
