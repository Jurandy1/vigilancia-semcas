"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ParticipantOptionButton,
  ParticipantShell,
} from "@/components/participant/ParticipantShell";
import { reliableApiFetch } from "@/lib/api-client";
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
  const answeredCount = questions.filter((q) => {
    const raw = draft[q.id];
    if (!raw) return false;
    if (q.type === "multi_choice") {
      try {
        return (JSON.parse(raw) as string[]).length > 0;
      } catch {
        return false;
      }
    }
    return raw.trim().length > 0;
  }).length;

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
        const res = await reliableApiFetch(`/api/events/${eventSlug}/rounds/${roundId}`, {}, { retries: 2, timeoutMs: 12_000 });
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

  useEffect(() => {
    if (loading || error || questions.length === 0) return;
    void reliableApiFetch(
      `/api/events/${eventSlug}/rounds/${roundId}/progress`,
      {
        method: "POST",
        body: JSON.stringify({ currentQuestion: currentIndex + 1, status: "answering" }),
      },
      { retries: 1, timeoutMs: 8_000 }
    ).catch(() => {
      /* progresso é best-effort — não bloqueia o participante */
    });
  }, [loading, error, questions.length, currentIndex, eventSlug, roundId]);

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
      setError(`Selecione no máximo ${currentQuestion.maxSelections} ${currentQuestion.maxSelections === 1 ? "opção" : "opções"}.`);
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
      // router.back() podia sair do app inteiro quando não havia histórico
      // no navegador (comum vindo direto de um QR Code) — volta pra sala de
      // espera, que é sempre um destino válido a partir daqui.
      router.push(`/e/${eventSlug}/aguarde`);
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
      const res = await reliableApiFetch(
        `/api/events/${eventSlug}/rounds/${roundId}/submit`,
        { method: "POST", body: JSON.stringify({ answers }) },
        { retries: 2, timeoutMs: 15_000 }
      );

      const data = await res.json();

      if (res.status === 401) {
        // Sessão perdida (cookie expirado ou evento resetado pelo organizador,
        // que apaga participants). Devolvemos para a entrada para o
        // participante reidentificar-se e não fica olhando erro genérico.
        setSubmissionState("error");
        setError(
          "Sua sessão foi encerrada pelo organizador. Recarregue a página para participar de novo."
        );
        setTimeout(() => router.replace(`/e/${eventSlug}`), 3500);
        return;
      }

      if (res.status === 403) {
        // Rodada foi encerrada enquanto o participante clicava enviar.
        setSubmissionState("error");
        setError(
          data.error ??
            "Esta etapa foi encerrada pelo organizador. Suas respostas não foram registradas."
        );
        setTimeout(() => router.replace(`/e/${eventSlug}/aguarde`), 3500);
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
        <div style={{ padding: "24px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
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
        <div style={{ padding: "24px 18px", textAlign: "center" }}>
          <div
            role="alert"
            style={{ marginBottom: "16px", border: "1px solid #e3b3ad", background: "#fdf2f1", borderRadius: "8px", padding: "12px 14px", fontSize: "13.5px", color: "#b42318" }}
          >
            {error}
          </div>
          <button
            type="button"
            onClick={() => router.push(`/e/${eventSlug}/aguarde`)}
            style={{ height: "46px", padding: "0 20px", background: "#0b3a6e", color: "#fff", borderRadius: "8px", fontWeight: 600, border: "none" }}
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
        <section aria-label="Revisão" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "20px 18px 0" }}>
            <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#11243c" }}>Revisar e enviar</h2>
            <p style={{ margin: "9px 0 0", fontSize: "13px", lineHeight: 1.55, color: "#5b6b7f" }}>
              Você respondeu {answeredCount} de {totalQuestions} perguntas. Após o envio, não será possível alterar.
            </p>
          </div>
          <div style={{ padding: "14px 18px", overflowY: "auto", flex: 1 }}>
            {questions.map((q, idx) => (
              <div key={q.id} style={{ padding: "12px 0", borderBottom: "1px solid #f2f5f8" }}>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#8a97a8" }}>
                  {idx + 1} · {q.type === "text" ? "Aberta" : q.type === "multi_choice" ? "Múltipla" : "Única"}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "13px", lineHeight: 1.45, color: "#33415c" }}>
                  {q.title}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: "14px", fontWeight: 600, lineHeight: 1.45, color: "#0B3A6E" }}>
                  {formatAnswer(q)}
                </p>
              </div>
            ))}
          </div>
          {(error || offline) && (
            <div style={{ padding: "0 18px 12px" }}>
              <div
                role="alert"
                style={{ border: "1px solid #e3b3ad", background: "#fdf2f1", borderRadius: "8px", padding: "12px 14px", fontSize: "13.5px", color: "#b42318" }}
              >
                {error || "Sem conexão. Suas respostas continuam salvas neste aparelho."}
              </div>
            </div>
          )}
          <div style={{ padding: "12px 18px", borderTop: "1px solid #eef1f5", display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleBack}
              disabled={submissionState === "submitting"}
              style={{ flex: 1, height: "46px", border: "1px solid #c9d4e2", background: "#fff", borderRadius: "8px", fontSize: "14.5px", fontWeight: 600, color: "#33415c", cursor: submissionState === "submitting" ? "not-allowed" : "pointer", opacity: submissionState === "submitting" ? 0.6 : 1 }}
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submissionState === "submitting"}
              style={{ flex: 2, height: "46px", border: "1px solid #18754A", background: "#18754A", borderRadius: "8px", fontSize: "14.5px", fontWeight: 600, color: "#fff", cursor: submissionState === "submitting" ? "not-allowed" : "pointer", opacity: submissionState === "submitting" ? 0.6 : 1 }}
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
      <section aria-label="Pergunta" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "16px 18px 0" }}>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#5b6b7f" }}>
            Pergunta {currentIndex + 1} de {totalQuestions}
          </p>
          <div
            role="img"
            aria-label={`Progresso: pergunta ${currentIndex + 1} de ${totalQuestions}`}
            style={{ height: "5px", background: "#eef1f5", borderRadius: "99px", overflow: "hidden", marginTop: "9px" }}
          >
            <div
              style={{ height: "100%", width: `${progressPercent}%`, background: "#0B3A6E", borderRadius: "99px", transition: "width 0.3s ease" }}
            />
          </div>
          <h2 style={{ margin: "16px 0 0", fontSize: "18px", fontWeight: 700, lineHeight: 1.35, color: "#11243c" }}>
            {currentQuestion.title}
          </h2>
          {currentQuestion.explanation && (
            <div style={{ marginTop: "14px", border: "1px solid #cfe0ef", borderLeft: "3px solid #0B3A6E", background: "#f4f8fc", borderRadius: "8px", padding: "12px", fontSize: "12.5px", lineHeight: 1.55, color: "#365b7a" }}>
              <span style={{ display: "block", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#0B3A6E", marginBottom: "3px" }}>
                Entenda a decisão
              </span>
              {currentQuestion.explanation}
            </div>
          )}
          {currentQuestion.type === "multi_choice" && currentQuestion.maxSelections && (
            <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: "#5b6b7f" }}>
              Selecione até {currentQuestion.maxSelections} {currentQuestion.maxSelections === 1 ? "opção" : "opções"}.
            </p>
          )}
        </div>

        <div style={{ padding: "16px 18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          {currentQuestion.type === "single_choice" && (
            <div role="radiogroup" aria-label={currentQuestion.title} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
            <div role="group" aria-label={currentQuestion.title} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
          )}

          {otherSelected && (
            <div style={{ border: "1px solid #b9d5ed", background: "#f4f8fc", borderRadius: "10px", padding: "14px" }}>
              <label
                htmlFor={`other-${currentQuestion.id}`}
                style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#244c70", marginBottom: "8px" }}
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
                style={{ width: "100%", height: "42px", border: "1px solid #9fb8cf", borderRadius: "8px", padding: "0 12px", fontSize: "16px", background: "#fff", color: "#11243c", outline: "none" }}
              />
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
                style={{ width: "100%", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "12px", fontSize: "16px", lineHeight: 1.5, resize: "vertical", color: "#11243c", outline: "none" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#8a97a8" }}>
                Até {currentQuestion.maxLength ?? 2000} caracteres.
              </p>
            </>
          )}
        </div>

        {(error || offline) && (
          <div style={{ padding: "0 18px 12px" }}>
            <div
              role="alert"
              style={{ border: "1px solid #e3b3ad", background: "#fdf2f1", borderRadius: "8px", padding: "12px 14px", fontSize: "13.5px", color: "#b42318" }}
            >
              {error || "Sem conexão. Suas respostas continuam salvas neste aparelho."}
            </div>
          </div>
        )}

        <div style={{ padding: "12px 18px", borderTop: "1px solid #eef1f5", display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={handleBack}
            style={{ flex: 1, height: "46px", border: "1px solid #c9d4e2", background: "#fff", borderRadius: "8px", fontSize: "14.5px", fontWeight: 600, color: "#33415c", cursor: "pointer" }}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleContinue}
            style={{ flex: 2, height: "46px", border: "1px solid #0B3A6E", background: "#0B3A6E", borderRadius: "8px", fontSize: "14.5px", fontWeight: 600, color: "#fff", cursor: "pointer" }}
          >
            Continuar
          </button>
        </div>
      </section>
    </ParticipantShell>
  );
}
