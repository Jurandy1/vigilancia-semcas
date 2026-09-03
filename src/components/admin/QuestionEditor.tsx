"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isOtherOptionLabel } from "@/lib/questions/other-option";

export type QuestionType = "single_choice" | "multi_choice" | "text";

export interface QuestionDraft {
  id?: string;
  title: string;
  explanation?: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  maxSelections?: number;
  maxLength?: number;
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Escolha única",
  multi_choice: "Múltipla escolha",
  text: "Resposta aberta",
};

export function blankQuestion(): QuestionDraft {
  return { title: "", type: "single_choice", options: ["", ""], required: true };
}

export function cloneQuestions(source: QuestionDraft[]): QuestionDraft[] {
  return source.map((q) => ({ ...q, options: [...q.options] }));
}

export function validateQuestions(questions: QuestionDraft[]): string | null {
  if (questions.length === 0) return "Adicione ao menos uma pergunta.";
  for (const q of questions) {
    if (q.title.trim().length < 3)
      return "Toda pergunta precisa de um título com pelo menos 3 caracteres.";
    if (q.type !== "text") {
      const filled = q.options.map((o) => o.trim()).filter(Boolean);
      if (filled.length < 2)
        return `Adicione pelo menos 2 alternativas em: ${q.title || "pergunta sem título"}`;
    }
  }
  return null;
}

interface QuestionEditorListProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
  disabled?: boolean;
}

export function QuestionEditorList({ questions, onChange, disabled }: QuestionEditorListProps) {
  const [selected, setSelected] = useState(0);
  const safeIndex = Math.min(selected, Math.max(questions.length - 1, 0));
  const q = questions[safeIndex];

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    onChange(questions.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function changeType(index: number, type: QuestionType) {
    onChange(
      questions.map((item, i) => {
        if (i !== index) return item;
        if (type === "text") return { ...item, type, options: [] };
        return { ...item, type, options: item.options.length >= 2 ? item.options : ["", ""] };
      })
    );
  }

  function updateOption(optIndex: number, value: string) {
    if (!q) return;
    const options = [...q.options];
    options[optIndex] = value;
    updateQuestion(safeIndex, { options });
  }

  function addOption() {
    if (!q) return;
    updateQuestion(safeIndex, { options: [...q.options, ""] });
  }

  function removeOption(optIndex: number) {
    if (!q) return;
    updateQuestion(safeIndex, { options: q.options.filter((_, oi) => oi !== optIndex) });
  }

  function addQuestion() {
    onChange([...questions, blankQuestion()]);
    setSelected(questions.length);
  }

  function duplicateQuestion(index: number) {
    const copy = { ...questions[index]!, id: undefined, options: [...questions[index]!.options] };
    const next = [...questions];
    next.splice(index + 1, 0, copy);
    onChange(next);
    setSelected(index + 1);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    onChange(questions.filter((_, i) => i !== index));
    setSelected(Math.max(0, index - 1));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
    setSelected(target);
  }

  if (!q) {
    return (
      <div className="bg-white border border-[#dde4ee] rounded-lg p-5 text-center">
        <p className="text-sm text-[#5b6b7f] mb-3">Nenhuma pergunta nesta rodada.</p>
        <button
          type="button"
          onClick={addQuestion}
          disabled={disabled}
          className="h-[38px] px-4 text-[13.5px] font-semibold text-[#0b3a6e] border border-dashed border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9]"
        >
          + Pergunta
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)_280px] gap-5">
      {/* Structure */}
      <div className="bg-white border border-[#dde4ee] rounded-lg p-4 min-w-0">
        <h2 className="m-0 mb-3 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
          Estrutura da rodada
        </h2>
        <div className="flex flex-col gap-1">
          {questions.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-current={i === safeIndex ? "true" : undefined}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left",
                i === safeIndex ? "bg-[#eef3f9]" : "hover:bg-[#f7f9fc]"
              )}
            >
              <span className="text-[11.5px] font-bold text-[#8a97a8] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[13px] leading-snug line-clamp-2 text-[#33415c]">
                {item.title || "Sem título"}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addQuestion}
          disabled={disabled}
          className="w-full mt-3 h-[38px] text-[13.5px] font-semibold text-[#0b3a6e] border border-dashed border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] disabled:opacity-50"
        >
          + Pergunta
        </button>
        <p className="mt-3 mb-0 text-[11.5px] text-[#8a97a8] leading-relaxed">
          Use as setas de cada pergunta para reordenar, duplicar ou remover.
        </p>
      </div>

      {/* Editor */}
      <div className="bg-white border border-[#dde4ee] rounded-lg p-5 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="m-0 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
            Pergunta {String(safeIndex + 1).padStart(2, "0")}
          </h2>
          <div className="flex gap-1.5">
            <IconBtn
              label="Mover para cima"
              onClick={() => moveQuestion(safeIndex, -1)}
              disabled={disabled || safeIndex === 0}
            >
              <ChevronUp className="w-4 h-4" />
            </IconBtn>
            <IconBtn
              label="Mover para baixo"
              onClick={() => moveQuestion(safeIndex, 1)}
              disabled={disabled || safeIndex === questions.length - 1}
            >
              <ChevronDown className="w-4 h-4" />
            </IconBtn>
            <IconBtn
              label="Duplicar pergunta"
              onClick={() => duplicateQuestion(safeIndex)}
              disabled={disabled}
            >
              <Copy className="w-4 h-4" />
            </IconBtn>
            <IconBtn
              label="Remover pergunta"
              onClick={() => removeQuestion(safeIndex)}
              disabled={disabled || questions.length <= 1}
              danger
            >
              <Trash2 className="w-4 h-4" />
            </IconBtn>
          </div>
        </div>

        <label className="block mt-4 mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
          Título da pergunta
        </label>
        <textarea
          rows={2}
          value={q.title}
          disabled={disabled}
          onChange={(e) => updateQuestion(safeIndex, { title: e.target.value })}
          className="w-full border border-[#c9d4e2] rounded-md px-3 py-2.5 text-sm leading-snug resize-y font-inherit disabled:opacity-60"
        />

        <label className="block mt-4 mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
          Explicação para os participantes <span className="font-normal text-[#8a97a8]">(opcional)</span>
        </label>
        <textarea
          rows={3}
          value={q.explanation ?? ""}
          disabled={disabled}
          placeholder="Contextualize o que está sendo decidido antes da pessoa responder."
          onChange={(e) => updateQuestion(safeIndex, { explanation: e.target.value })}
          className="w-full border border-[#c9d4e2] rounded-md px-3 py-2.5 text-sm leading-relaxed resize-y font-inherit disabled:opacity-60"
        />

        <label className="block mt-4 mb-1.5 text-[12.5px] font-semibold text-[#33415c]">Tipo</label>
        <select
          value={q.type}
          disabled={disabled}
          onChange={(e) => changeType(safeIndex, e.target.value as QuestionType)}
          className="w-full h-[42px] border border-[#c9d4e2] rounded-md px-2.5 text-sm bg-white disabled:opacity-60"
        >
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {q.type !== "text" ? (
          <>
            <p className="mt-[18px] mb-2 text-[12.5px] font-semibold text-[#33415c]">Alternativas</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    value={opt}
                    disabled={disabled}
                    aria-label={`Alternativa ${oi + 1}`}
                    onChange={(e) => updateOption(oi, e.target.value)}
                    className="flex-1 h-10 border border-[#c9d4e2] rounded-md px-3 text-sm min-w-0 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    aria-label="Remover alternativa"
                    disabled={disabled || q.options.length <= 2}
                    onClick={() => removeOption(oi)}
                    className="w-9 h-9 shrink-0 border border-[#dde4ee] rounded-md text-[#5b6b7f] hover:bg-[#f4f6f9] disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              disabled={disabled}
              className="mt-2.5 h-9 px-3 text-[13px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9] hover:border-[#0b3a6e] disabled:opacity-50"
            >
              + Alternativa
            </button>
            <div className="mt-3 rounded-lg border border-[#cfe0ef] bg-[#f0f7fc] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#365b7a]">
              Uma alternativa iniciada por <strong>“Outro”</strong> ou <strong>“Outra”</strong>
              abre automaticamente um campo para o participante escrever a resposta.
            </div>
            {q.type === "multi_choice" && (
              <div className="mt-4">
                <label className="block mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                  Máximo de seleções (opcional)
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={disabled}
                  value={q.maxSelections ?? ""}
                  onChange={(e) =>
                    updateQuestion(safeIndex, {
                      maxSelections: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-40 h-10 border border-[#c9d4e2] rounded-md px-3 text-sm disabled:opacity-60"
                />
              </div>
            )}
          </>
        ) : (
          <div className="mt-[18px]">
            <label className="block mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
              Limite de caracteres
            </label>
            <input
              type="number"
              disabled={disabled}
              value={q.maxLength ?? 2000}
              onChange={(e) =>
                updateQuestion(safeIndex, { maxLength: Number(e.target.value) || 2000 })
              }
              className="w-40 h-10 border border-[#c9d4e2] rounded-md px-3 text-sm disabled:opacity-60"
            />
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-[#eef1f5]">
          <label className="flex items-center gap-2.5 text-sm text-[#33415c] cursor-pointer">
            <input
              type="checkbox"
              checked={q.required}
              disabled={disabled}
              onChange={(e) => updateQuestion(safeIndex, { required: e.target.checked })}
              className="w-[18px] h-[18px] accent-[#0b3a6e]"
            />
            Resposta obrigatória
          </label>
        </div>
      </div>

      {/* Mobile preview */}
      <div className="bg-[#f7f9fc] border border-[#dde4ee] rounded-lg p-4 min-w-0">
        <h2 className="m-0 mb-3 text-xs font-bold tracking-[0.09em] uppercase text-[#8a97a8]">
          Prévia no celular
        </h2>
        <div className="bg-white border border-[#d6dde6] rounded-2xl p-4">
          <p className="m-0 text-[11.5px] font-bold tracking-[0.07em] text-[#0b3a6e]">SEMCAS</p>
          <p className="mt-3 mb-0 text-xs text-[#5b6b7f]">
            Pergunta {safeIndex + 1} de {questions.length}
          </p>
          <div className="h-[5px] bg-[#eef1f5] rounded overflow-hidden mt-2">
            <div
              className="h-full bg-[#0b3a6e] rounded"
              style={{ width: `${((safeIndex + 1) / Math.max(questions.length, 1)) * 100}%` }}
            />
          </div>
          <h3 className="mt-3.5 mb-0 text-[15px] font-bold leading-snug text-pretty">
            {q.title || "Título da pergunta"}
          </h3>
          {q.explanation && (
            <p className="mb-0 mt-2 rounded-lg bg-[#edf5fc] px-3 py-2 text-xs leading-relaxed text-[#365b7a]">
              {q.explanation}
            </p>
          )}
          <div className="flex flex-col gap-2 mt-3.5">
            {q.type === "text" ? (
              <div className="border border-[#c9d4e2] rounded-lg p-3 min-h-24 text-sm text-[#8a97a8]">
                Digite sua resposta...
              </div>
            ) : (
              (q.options.filter(Boolean).length ? q.options.filter(Boolean) : ["Alternativa"]).map(
                (opt) => (
                  <div key={opt}>
                    <div className="flex items-center gap-2.5 border border-[#c9d4e2] rounded-lg px-3 py-2.5 min-h-11">
                      <span
                        className={cn(
                          "w-[18px] h-[18px] border border-[#b9c5d4] shrink-0",
                          q.type === "multi_choice" ? "rounded-[4px]" : "rounded-full"
                        )}
                      />
                      <span className="text-sm">{opt}</span>
                    </div>
                    {isOtherOptionLabel(opt) && (
                      <div className="mt-1.5 rounded-lg border border-dashed border-[#9fb8cf] px-3 py-2 text-xs text-[#718198]">
                        Campo “Qual?” aparece quando esta opção for selecionada.
                      </div>
                    )}
                  </div>
                )
              )
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <span className="h-10 inline-flex items-center px-3.5 border border-[#c9d4e2] rounded-lg text-sm font-semibold text-[#33415c]">
              Voltar
            </span>
            <span className="flex-1 h-10 inline-flex items-center justify-center bg-[#0b3a6e] text-white rounded-lg text-sm font-semibold">
              Continuar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-8 h-8 border rounded-md flex items-center justify-center disabled:opacity-40",
        danger
          ? "border-[#e3b3ad] text-[#b42318] hover:bg-[#fdf2f1]"
          : "border-[#dde4ee] text-[#5b6b7f] hover:bg-[#f4f6f9]"
      )}
    >
      {children}
    </button>
  );
}

/** Kept for compatibility with older call sites that opened a dialog preview. */
export function QuestionPreviewDialog({
  trigger,
}: {
  questions: QuestionDraft[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  return trigger ? <>{trigger}</> : null;
}
