"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  QuestionEditorList,
  blankQuestion,
  validateQuestions,
  type QuestionDraft,
} from "@/components/admin/QuestionEditor";

export default function NovaRodadaPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<{ title: string; slug: string } | null>(null);

  useEffect(() => {
    async function loadEvent() {
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch(`/api/admin/events/${eventId}`, token);
      const data = await res.json();
      setEvent(data.event ?? null);
    }
    const unsub = onAdminAuthChange((user) => {
      if (user) loadEvent();
    });
    return unsub;
  }, [eventId]);

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
      const res = await adminFetch(`/api/admin/events/${eventId}/rounds`, token, {
        method: "POST",
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
        setError(data.error ?? "Erro ao criar rodada.");
        return;
      }
      router.push(`/admin/eventos/${eventId}/perguntas`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar rodada.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell
      eventId={eventId}
      eventTitle={event?.title}
      eventSlug={event?.slug}
      screenLabel="Rodadas"
    >
      <form onSubmit={handleSubmit} className="max-w-[1320px]">
        <div className="flex items-start justify-between gap-5 flex-wrap mb-5">
          <div className="min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="m-0 w-full max-w-xl text-2xl font-bold tracking-[-0.01em] text-[#1a1a1a] bg-transparent border-0 border-b border-transparent focus:border-[#c9d4e2] outline-none"
              placeholder="Título da rodada"
            />
            <p className="mt-1.5 mb-0 text-[13.5px] text-[#5b6b7f]">
              {questions.length} perguntas · alterações são salvas ao clicar em Salvar rodada
            </p>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              className="mt-2 w-full max-w-xl text-sm text-[#5b6b7f] bg-transparent border-0 outline-none"
            />
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setQuestions([blankQuestion()])}
              disabled={questions.length > 0}
              className="h-10 px-3.5 text-[13.5px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9]"
            >
              + Primeira pergunta
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-[18px] text-sm font-semibold bg-[#0b3a6e] text-white rounded-md hover:bg-[#0d4a8a] disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar rodada"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <QuestionEditorList questions={questions} onChange={setQuestions} />
      </form>
    </AdminShell>
  );
}
