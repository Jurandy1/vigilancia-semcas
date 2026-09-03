"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ParticipantOptionButton,
  ParticipantShell,
} from "@/components/participant/ParticipantShell";
import { apiFetch } from "@/lib/api-client";
import {
  useParticipantStore,
  buildAnswersFromDraft,
} from "@/stores/participant-store";
import type { Question } from "@/types/round";
import { Skeleton } from "@/components/ui/skeleton";
import { findOtherOption, getOtherDraftKey } from "@/lib/questions/other-option";

export default function RoundPage() {
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
    const otherOption = findOtherOption(currentQuestion.options);
    if (otherOption && value !== otherOption) {
      saveDraftAnswer(roundId, getOtherDraftKey(currentQuestion.id), "");
    }
  }

  function toggleMultiChoice(option: string) {
    if (!currentQuestion) return;
    const selected: string[] = draft[currentQuestion.id]
      ? (JSON.parse(draft[currentQuestion.id]!) as string[])
      : [];
    if (
      !selected.includes(option) &&
      currentQuestion.maxSelections &&
      selected.length >= currentQuestion.maxSelections
    ) {
      setError(`Selecione no máximo ${currentQuestion.maxSelections} opções.`);
      return;
    }
    setError("");
    const next = selected.includes(option)
      ? selected.filter((o) => o !== option)
      : [...selected, option];
    saveDraftAnswer(roundId, currentQuestion.id, JSON.stringify(next));
    const otherOption = findOtherOption(currentQuestion.options);
    if (option === otherOption && selected.includes(option)) {
      saveDraftAnswer(roundId, getOtherDraftKey(currentQuestion.id), "");
    }
  }

  function handleContinue() {
    if (!currentQuestion) return;
    const answer = draft[currentQuestion.id];
    const isEmpty =
      currentQuestion.type === "multi_choice"
        ? !answer || (JSON.parse(answer) as string[]).length === 0
        : !answer?.trim();
    if (currentQuestion.required && isEmpty) {
      setError("Esta pergunta é obrigatória.");
      return;
    }
    const otherOption = findOtherOption(currentQuestion.options);
    const selectedOther = otherOption
      ? currentQuestion.type === "multi_choice"
        ? Boolean(answer && (JSON.parse(answer) as string[]).includes(otherOption))
        : answer === otherOption
      : false;
    if (
      selectedOther &&
      !draft[getOtherDraftKey(currentQuestion.id)]?.trim()
    ) {
      setError("Escreva qual é a outra opção antes de continuar.");
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

  function formatAnswer(q: Question) {
    const raw = draft[q.id];
    if (!raw) return "—";
    if (q.type === "multi_choice") {
      try {
        const value = (JSON.parse(raw) as string[]).join(", ") || "—";
        const detail = draft[getOtherDraftKey(q.id)]?.trim();
        return detail ? `${value} — ${detail}` : value;
      } catch {
        return raw;
      }
    }
    const detail = draft[getOtherDraftKey(q.id)]?.trim();
    return detail ? `${raw} — ${detail}` : raw;
  }

  if (loading) {
    return (
      <ParticipantShell>
        <div className="p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </ParticipantShell>
    );
  }

  if (error && !currentQuestion) {
    return (
      <ParticipantShell>
        <div className="p-6 text-center">
          <div
            role="alert"
            className="mb-4 border border-[#e3b3ad] bg-[#fdf2f1] rounded-md px-3 py-2 text-[13.5px] text-[#b42318]"
          >
            {error}
          </div>
          <button
            type="button"
            onClick={() => router.push(`/e/${eventSlug}/aguarde`)}
            className="h-12 px-5 bg-[#0b3a6e] text-white rounded-lg font-semibold"
          >
            Voltar
          </button>
        </div>
      </ParticipantShell>
    );
  }

  if (showReview) {
    return (
      <ParticipantShell>
        <section aria-label="Revisão" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-[22px]">
            <h2 className="m-0 text-xl font-bold text-[#1a1a1a]">Revisar e enviar</h2>
            <p className="mt-2.5 mb-0 text-sm text-[#5b6b7f] leading-relaxed">
              Você respondeu {totalQuestions} perguntas. Após o envio, não será possível alterar.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-[18px]">
            {questions.map((q, idx) => (
              <div key={q.id} className="py-3 border-b border-[#f2f5f8]">
                <p className="m-0 text-[12.5px] text-[#8a97a8]">
                  {idx + 1} ·{" "}
                  {q.type === "text"
                    ? "Aberta"
                    : q.type === "multi_choice"
                      ? "Múltipla"
                      : "Única"}
                </p>
                <p className="mt-1 mb-0 text-sm text-[#33415c] leading-snug text-pretty">
                  {q.title}
                </p>
                <p className="mt-1.5 mb-0 text-[15px] font-semibold text-[#0b3a6e] leading-snug">
                  {formatAnswer(q)}
                </p>
              </div>
            ))}
          </div>
          {(error || offline) && (
            <div className="px-5 pb-2">
              <div
                role="alert"
                className="border border-[#e3b3ad] bg-[#fdf2f1] rounded-md px-3 py-2 text-[13.5px] text-[#b42318]"
              >
                {error || "Sem conexão. Suas respostas continuam salvas neste aparelho."}
              </div>
            </div>
          )}
          <div className="shrink-0 border-t border-[#eef1f5] px-5 py-3.5 flex gap-2.5 bg-white">
            <button
              type="button"
              onClick={handleBack}
              disabled={submissionState === "submitting"}
              className="h-[52px] px-[18px] bg-white text-[#33415c] border border-[#c9d4e2] rounded-lg text-base font-semibold hover:bg-[#f4f6f9] disabled:opacity-60"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submissionState === "submitting"}
              className="flex-1 h-[52px] bg-[#0b3a6e] text-white border border-[#0b3a6e] rounded-lg text-base font-semibold hover:bg-[#0d4a8a] disabled:opacity-60"
            >
              {submissionState === "submitting" ? "Enviando..." : "Enviar respostas"}
            </button>
          </div>
        </section>
      </ParticipantShell>
    );
  }

  if (!currentQuestion) return null;

  const currentAnswer = draft[currentQuestion.id] ?? "";
  const selectedOptions: string[] =
    currentQuestion.type === "multi_choice" && currentAnswer
      ? (JSON.parse(currentAnswer) as string[])
      : [];
  const otherOption = findOtherOption(currentQuestion.options);
  const otherSelected = otherOption
    ? currentQuestion.type === "multi_choice"
      ? selectedOptions.includes(otherOption)
      : currentAnswer === otherOption
    : false;
  const otherText = draft[getOtherDraftKey(currentQuestion.id)] ?? "";

  return (
    <ParticipantShell>
      <section aria-label="Pergunta" className="flex-1 flex flex-col min-h-0">
        <div className="px-5 pt-[18px]">
          <div className="flex items-center justify-between gap-2.5">
            <p className="m-0 text-[13px] font-semibold text-[#5b6b7f]">
              Pergunta {currentIndex + 1} de {totalQuestions}
            </p>
          </div>
          <div
            role="img"
            aria-label={`Progresso: pergunta ${currentIndex + 1} de ${totalQuestions}`}
            className="h-1.5 bg-[#eef1f5] rounded overflow-hidden mt-2.5"
          >
            <div
              className="h-full bg-[#0b3a6e] rounded transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <h2 className="mt-[18px] mb-0 text-xl font-bold leading-snug text-pretty text-[#1a1a1a]">
            {currentQuestion.title}
          </h2>
          {currentQuestion.explanation && (
            <div className="mt-4 rounded-xl border border-[#cfe0ef] bg-[#f0f7fc] px-4 py-3 text-sm leading-relaxed text-[#365b7a]">
              <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-[#0b4a83]">
                Entenda a decisão
              </span>
              {currentQuestion.explanation}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-[18px]">
          {currentQuestion.type === "single_choice" && (
            <div role="radiogroup" aria-label={currentQuestion.title} className="flex flex-col gap-2.5">
              {currentQuestion.options?.map((option) => (
                <ParticipantOptionButton
                  key={option}
                  label={option}
                  selected={currentAnswer === option}
                  onClick={() => handleAnswer(option)}
                />
              ))}
            </div>
          )}

          {currentQuestion.type === "multi_choice" && (
            <div>
              <div
                role="group"
                aria-label={currentQuestion.title}
                className="flex flex-col gap-2.5"
              >
                {currentQuestion.options?.map((option) => (
                  <ParticipantOptionButton
                    key={option}
                    label={option}
                    multi
                    role="checkbox"
                    selected={selectedOptions.includes(option)}
                    onClick={() => toggleMultiChoice(option)}
                  />
                ))}
              </div>
              {currentQuestion.maxSelections && (
                <p className="mt-3 mb-0 text-[12.5px] text-[#5b6b7f]">
                  Selecione até {currentQuestion.maxSelections} opções.
                </p>
              )}
            </div>
          )}

          {otherSelected && (
            <div className="mt-4 rounded-xl border border-[#b9d5ed] bg-[#f3f8fc] p-4">
              <label
                htmlFor={`other-${currentQuestion.id}`}
                className="mb-2 block text-sm font-semibold text-[#244c70]"
              >
                Qual é a outra opção?
              </label>
              <input
                id={`other-${currentQuestion.id}`}
                value={otherText}
                onChange={(event) =>
                  saveDraftAnswer(
                    roundId,
                    getOtherDraftKey(currentQuestion.id),
                    event.target.value
                  )
                }
                maxLength={500}
                autoFocus
                placeholder="Escreva aqui..."
                className="h-12 w-full rounded-lg border border-[#9fb8cf] bg-white px-3.5 text-base text-[#1a1a1a] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b3a6e] focus-visible:outline-offset-2"
              />
              <p className="mb-0 mt-2 text-xs text-[#64748b]">Até 500 caracteres.</p>
            </div>
          )}

          {currentQuestion.type === "text" && (
            <>
              <textarea
                value={currentAnswer}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Digite sua resposta..."
                aria-label={currentQuestion.title}
                maxLength={currentQuestion.maxLength ?? 2000}
                rows={7}
                className="w-full border border-[#c9d4e2] rounded-lg p-3.5 text-base leading-relaxed resize-y text-[#1a1a1a] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b3a6e] focus-visible:outline-offset-2"
              />
              <p className="mt-2 mb-0 text-xs text-[#8a97a8]">
                Até {currentQuestion.maxLength ?? 2000} caracteres.
              </p>
            </>
          )}
        </div>

        {(error || offline) && (
          <div className="px-5 pb-2">
            <div
              role="alert"
              className="border border-[#e3b3ad] bg-[#fdf2f1] rounded-md px-3 py-2 text-[13.5px] text-[#b42318]"
            >
              {error || "Sem conexão. Suas respostas continuam salvas neste aparelho."}
            </div>
          </div>
        )}

        <div className="shrink-0 border-t border-[#eef1f5] px-5 py-3.5 flex gap-2.5 bg-white">
          <button
            type="button"
            onClick={handleBack}
            className="h-[52px] px-[18px] bg-white text-[#33415c] border border-[#c9d4e2] rounded-lg text-base font-semibold hover:bg-[#f4f6f9]"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="flex-1 h-[52px] bg-[#0b3a6e] text-white border border-[#0b3a6e] rounded-lg text-base font-semibold hover:bg-[#0d4a8a]"
          >
            Continuar
          </button>
        </div>
      </section>
    </ParticipantShell>
  );
}
