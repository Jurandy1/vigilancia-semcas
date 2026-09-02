"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { AdminShell } from "@/components/admin/AdminShell";

interface QuestionDraft {
  title: string;
  type: "single_choice" | "text";
  options: string[];
  required: boolean;
}

const DEFAULT_QUESTIONS: QuestionDraft[] = [
  {
    title: "Como você avalia a metodologia utilizada no evento?",
    type: "single_choice",
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
    required: true,
  },
  {
    title: "Como você avalia o local onde o evento foi realizado?",
    type: "single_choice",
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
    required: true,
  },
  {
    title: "Como você avalia a organização geral do evento?",
    type: "single_choice",
    options: ["Excelente", "Bom", "Regular", "Ruim", "Péssimo"],
    required: true,
  },
  {
    title: "A duração do evento foi adequada?",
    type: "single_choice",
    options: ["Sim", "Parcialmente", "Não"],
    required: true,
  },
  {
    title: "Quais foram os principais pontos positivos do evento?",
    type: "text",
    options: [],
    required: true,
  },
  {
    title: "O conteúdo abordado no evento foi relevante para sua atuação profissional?",
    type: "single_choice",
    options: ["Muito relevante", "Relevante", "Pouco relevante", "Não foi relevante"],
    required: true,
  },
  {
    title: "Quais sugestões você daria para melhorar os próximos eventos?",
    type: "text",
    options: [],
    required: true,
  },
];

export default function NovaRodadaPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [title, setTitle] = useState("Avaliação do Evento");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>(DEFAULT_QUESTIONS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useDefault, setUseDefault] = useState(true);
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
            required: q.required,
            options: q.type === "single_choice" ? q.options : undefined,
            maxLength: q.type === "text" ? 2000 : undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar rodada.");
        return;
      }

      router.push(`/admin/eventos/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar rodada.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell eventId={eventId} eventTitle={event?.title} eventSlug={event?.slug}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Nova rodada</h1>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useDefault}
              onChange={(e) => {
                setUseDefault(e.target.checked);
                if (e.target.checked) setQuestions(DEFAULT_QUESTIONS);
              }}
            />
            Usar perguntas padrão da avaliação do evento
          </label>

          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="border border-border rounded-md p-4 space-y-2">
                <p className="text-xs text-muted-foreground">Pergunta {i + 1}</p>
                <p className="text-sm font-medium">{q.title}</p>
                <p className="text-xs text-muted-foreground">
                  {q.type === "single_choice" ? "Escolha única" : "Texto aberto"}
                </p>
              </div>
            ))}
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar como rascunho"}
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
