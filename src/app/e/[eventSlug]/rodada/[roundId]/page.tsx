"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAppCheck } from "@/hooks/use-app-check";
import { apiFetch } from "@/lib/api-client";
import {
  useParticipantStore,
  buildAnswersFromDraft,
} from "@/stores/participant-store";
import type { Question } from "@/types/round";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoundPage() {
  useAppCheck();
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;
  const roundId = params.roundId as string;

  const {
    saveDraftAnswer,
    getDraftAnswers,
    clearDraft,
    setSubmissionState,
    submissionState,
  } = useParticipantStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [offline, setOffline] = useState(false);

  const draft = getDraftAnswers(roundId);
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    async function loadRound() {
      try {
        const res = await apiFetch(`/api/events/${eventSlug}/rounds/${roundId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Não foi possível carregar esta etapa.");
          return;
        }
        setQuestions(data.questions);
      } catch {
        setError("Não foi possível carregar esta etapa.");
      } finally {
        setLoading(false);
      }
    }
    loadRound();
  }, [eventSlug, roundId]);

  const reportProgress = useCallback(
    async (questionNum: number) => {
      try {
        await apiFetch(`/api/events/${eventSlug}/rounds/${roundId}/progress`, {
          method: "POST",
          body: JSON.stringify({
            currentQuestion: questionNum,
            status: "answering",
          }),
        });
      } catch {
        // non-blocking
      }
    },
    [eventSlug, roundId]
  );

  useEffect(() => {
    if (currentQuestion) {
      reportProgress(currentIndex + 1);
    }
  }, [currentIndex, currentQuestion, reportProgress]);

  function handleAnswer(value: string) {
    if (!currentQuestion) return;
    saveDraftAnswer(roundId, currentQuestion.id, value);
  }

  function handleContinue() {
    if (!currentQuestion) return;
    const answer = draft[currentQuestion.id];
    if (currentQuestion.required && !answer?.trim()) {
      setError("Esta pergunta é obrigatória.");
      return;
    }
    setError("");

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setShowReview(true);
    }
  }

  function handleBack() {
    setError("");
    if (showReview) {
      setShowReview(false);
    } else if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      router.back();
    }
  }

  async function handleSubmit() {
    if (offline) {
      setError("Sem conexão. Suas respostas continuam salvas neste aparelho.");
      return;
    }

    setSubmissionState("submitting");
    setError("");

    const answers = buildAnswersFromDraft(questions, draft);

    try {
      const res = await apiFetch(`/api/events/${eventSlug}/rounds/${roundId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();

      if (res.status === 409) {
        router.replace(`/e/${eventSlug}/aguarde`);
        return;
      }

      if (!res.ok) {
        setSubmissionState("error");
        setError(data.error ?? "Não conseguimos enviar sua resposta.");
        return;
      }

      clearDraft(roundId);
      setSubmissionState("success");
      router.replace(`/e/${eventSlug}/concluido`);
    } catch {
      setSubmissionState("error");
      setError(
        "Não conseguimos enviar sua resposta. Suas respostas continuam salvas neste aparelho."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 max-w-md mx-auto space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (error && !currentQuestion) {
    return (
      <main className="min-h-screen p-6 max-w-md mx-auto text-center">
        <Alert variant="destructive" className="mb-4">{error}</Alert>
        <Button onClick={() => router.push(`/e/${eventSlug}/aguarde`)}>Voltar</Button>
      </main>
    );
  }

  if (showReview) {
    return (
      <main className="min-h-screen p-6 max-w-md mx-auto">
        <SemcasHeader />
        <div className="text-center mb-8">
          <div className="text-3xl text-accent mb-3">✓</div>
          <h2 className="text-lg font-semibold">Revisar e enviar</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Você respondeu {totalQuestions} perguntas. Após o envio, não será possível alterar.
          </p>
        </div>

        {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
        {offline && (
          <Alert className="mb-4">Sem conexão. Suas respostas continuam salvas neste aparelho.</Alert>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleBack} disabled={submissionState === "submitting"}>
            VOLTAR
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={submissionState === "submitting"}
          >
            {submissionState === "submitting" ? "ENVIANDO..." : "ENVIAR"}
          </Button>
        </div>
      </main>
    );
  }

  if (!currentQuestion) return null;

  const currentAnswer = draft[currentQuestion.id] ?? "";

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto flex flex-col">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-4">SEMCAS</p>
        <p className="text-sm text-muted-foreground mb-2">
          Pergunta {currentIndex + 1} de {totalQuestions}
        </p>
        <Progress value={progressPercent} className="mb-6" />
        <h2 className="text-lg font-semibold leading-snug">{currentQuestion.title}</h2>
      </div>

      <div className="flex-1 mb-8">
        {currentQuestion.type === "single_choice" && (
          <RadioGroup value={currentAnswer} onValueChange={handleAnswer}>
            {currentQuestion.options?.map((option) => (
              <div
                key={option}
                className="flex items-center space-x-3 border border-border rounded-md px-4 py-3 cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem value={option} id={option} />
                <Label htmlFor={option} className="flex-1 cursor-pointer font-normal">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {currentQuestion.type === "text" && (
          <Textarea
            value={currentAnswer}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder="Digite sua resposta..."
            maxLength={currentQuestion.maxLength ?? 2000}
            rows={5}
          />
        )}
      </div>

      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
      {offline && (
        <Alert className="mb-4">Sem conexão. Suas respostas continuam salvas neste aparelho.</Alert>
      )}

      <div className="flex gap-3 mt-auto">
        <Button variant="outline" onClick={handleBack}>
          VOLTAR
        </Button>
        <Button className="flex-1" onClick={handleContinue}>
          CONTINUAR
        </Button>
      </div>
    </main>
  );
}
