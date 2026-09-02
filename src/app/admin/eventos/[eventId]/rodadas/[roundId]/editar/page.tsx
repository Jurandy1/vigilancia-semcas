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
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  QuestionEditorList,
  QuestionPreviewDialog,
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
  const [previewOpen, setPreviewOpen] = useState(false);

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
          type: q.type as QuestionDraft["type"],
          options: (q.options as string[] | null) ?? [],
          required: (q.required as boolean) ?? true,
          maxSelections: (q.maxSelections as number | null) ?? undefined,
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
            required: q.required,
            options: q.type !== "text" ? q.options.map((o) => o.trim()).filter(Boolean) : undefined,
            maxLength: q.type === "text" ? 2000 : undefined,
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

      router.push(`/admin/eventos/${eventId}/rodadas`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar rodada.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingRound) {
    return (
      <AdminShell eventId={eventId}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell eventId={eventId} eventTitle={event?.title} eventSlug={event?.slug}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Editar rodada</h1>
        <QuestionPreviewDialog
          questions={questions}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          trigger={
            <Button type="button" variant="outline" size="sm">
              Visualizar como participante
            </Button>
          }
        />
      </div>

      {!editable && (
        <Alert className="max-w-2xl mb-4">
          Esta rodada já recebeu respostas e não pode mais ser editada. Os campos abaixo estão bloqueados.
        </Alert>
      )}

      <div className="max-w-2xl">
        <fieldset disabled={!editable} className="space-y-6 disabled:opacity-60">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <QuestionEditorList questions={questions} onChange={setQuestions} />

            {error && <Alert variant="destructive">{error}</Alert>}

            <Button type="submit" disabled={loading || !editable}>
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </fieldset>
      </div>
    </AdminShell>
  );
}
