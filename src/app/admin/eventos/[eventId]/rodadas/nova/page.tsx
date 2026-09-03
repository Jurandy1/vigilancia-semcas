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
      <form onSubmit={handleSubmit} style={{ maxWidth: "1320px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "1px solid #dbe4ef", marginBottom: "24px" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: "0 0 6px", fontSize: "10.5px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#18754A" }}>Nova rodada de perguntas</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ margin: 0, width: "100%", maxWidth: "600px", fontSize: "26px", fontWeight: 700, letterSpacing: "-.02em", color: "#11243c", background: "transparent", border: "none", borderBottom: "1px solid transparent", outline: "none" }}
              placeholder="Título da rodada"
              onFocus={(e) => e.target.style.borderBottom = "1px solid #c9d4e2"}
              onBlur={(e) => e.target.style.borderBottom = "1px solid transparent"}
            />
            <p style={{ margin: "6px 0 0", fontSize: "13.5px", color: "#5b6b7f" }}>
              {questions.length} perguntas · alterações são salvas ao clicar em Salvar rodada
            </p>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              style={{ marginTop: "8px", width: "100%", maxWidth: "600px", fontSize: "14px", color: "#5b6b7f", background: "transparent", border: "none", outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setQuestions([blankQuestion()])}
              disabled={questions.length > 0}
              style={{ height: "38px", padding: "0 14px", fontSize: "13.5px", fontWeight: 600, color: "#0B3A6E", background: "transparent", border: "1px solid #c9d4e2", borderRadius: "8px", cursor: questions.length > 0 ? "not-allowed" : "pointer", opacity: questions.length > 0 ? 0.5 : 1 }}
            >
              + Primeira pergunta
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ height: "38px", padding: "0 16px", fontSize: "13.5px", fontWeight: 600, color: "#fff", background: "#0B3A6E", border: "1px solid #0B3A6E", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Salvando..." : "Salvar rodada"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: "16px", fontSize: "14px", color: "#b42318", background: "#fdf2f1", border: "1px solid #e3b3ad", borderRadius: "6px", padding: "8px 12px" }}>
            {error}
          </div>
        )}

        <QuestionEditorList questions={questions} onChange={setQuestions} />
      </form>
    </AdminShell>
  );
}
