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
      <div style={{ background: "#fff", border: "1px solid #dde4ee", borderRadius: "10px", padding: "20px", textAlign: "center" }}>
        <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#5b6b7f" }}>Nenhuma pergunta nesta rodada.</p>
        <button
          type="button"
          onClick={addQuestion}
          disabled={disabled}
          style={{ height: "38px", padding: "0 16px", fontSize: "13.5px", fontWeight: 600, color: "#0B3A6E", background: "transparent", border: "1px dashed #c9d4e2", borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
        >
          + Pergunta
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1280px) {
          .editor-grid { grid-template-columns: 240px minmax(0, 1fr) 280px !important; }
        }
      `}} />
      <div className="editor-grid" style={{ display: "grid", gap: "20px", gridTemplateColumns: "1fr" }}>
        {/* Structure */}
        <div style={{ background: "#fff", border: "1px solid #dde4ee", borderRadius: "10px", padding: "16px", minWidth: 0 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: "#8a97a8" }}>
            Estrutura da rodada
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {questions.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                aria-current={i === safeIndex ? "true" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  textAlign: "left",
                  background: i === safeIndex ? "#eef3f9" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => {
                  if (i !== safeIndex) e.currentTarget.style.background = "#f7f9fc";
                }}
                onMouseOut={(e) => {
                  if (i !== safeIndex) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#8a97a8", fontFamily: "ui-monospace,Consolas,monospace" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ flex: 1, fontSize: "13px", lineHeight: 1.4, color: "#33415c", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {item.title || "Sem título"}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={addQuestion}
            disabled={disabled}
            style={{ width: "100%", marginTop: "12px", height: "38px", fontSize: "13.5px", fontWeight: 600, color: "#0B3A6E", background: "transparent", border: "1px dashed #c9d4e2", borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
          >
            + Pergunta
          </button>
          <p style={{ margin: "12px 0 0", fontSize: "11.5px", color: "#8a97a8", lineHeight: 1.6 }}>
            Use as setas de cada pergunta para reordenar, duplicar ou remover.
          </p>
        </div>

        {/* Editor */}
        <div style={{ background: "#fff", border: "1px solid #dde4ee", borderRadius: "10px", padding: "20px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: "#8a97a8" }}>
              Pergunta {String(safeIndex + 1).padStart(2, "0")}
            </h2>
            <div style={{ display: "flex", gap: "6px" }}>
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

          <label style={{ display: "block", marginTop: "16px", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
            Título da pergunta
          </label>
          <textarea
            rows={2}
            value={q.title}
            disabled={disabled}
            onChange={(e) => updateQuestion(safeIndex, { title: e.target.value })}
            style={{ width: "100%", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", resize: "vertical", fontFamily: "inherit" }}
          />

          <label style={{ display: "block", marginTop: "16px", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
            Explicação para os participantes <span style={{ fontWeight: 400, color: "#8a97a8" }}>(opcional)</span>
          </label>
          <textarea
            rows={3}
            value={q.explanation ?? ""}
            disabled={disabled}
            placeholder="Contextualize o que está sendo decidido antes da pessoa responder."
            onChange={(e) => updateQuestion(safeIndex, { explanation: e.target.value })}
            style={{ width: "100%", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", resize: "vertical", fontFamily: "inherit" }}
          />

          <label style={{ display: "block", marginTop: "16px", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>Tipo</label>
          <select
            value={q.type}
            disabled={disabled}
            onChange={(e) => changeType(safeIndex, e.target.value as QuestionType)}
            style={{ width: "100%", height: "42px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "0 10px", fontSize: "14px", background: "#fff" }}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {q.type !== "text" ? (
            <>
              <p style={{ marginTop: "18px", marginBottom: "8px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>Alternativas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      value={opt}
                      disabled={disabled}
                      aria-label={`Alternativa ${oi + 1}`}
                      onChange={(e) => updateOption(oi, e.target.value)}
                      style={{ flex: 1, minWidth: 0, height: "40px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "0 12px", fontSize: "14px" }}
                    />
                    <button
                      type="button"
                      aria-label="Remover alternativa"
                      disabled={disabled || q.options.length <= 2}
                      onClick={() => removeOption(oi)}
                      style={{ width: "36px", height: "36px", flexShrink: 0, border: "1px solid #dde4ee", borderRadius: "8px", color: "#5b6b7f", background: "transparent", cursor: (disabled || q.options.length <= 2) ? "not-allowed" : "pointer", opacity: (disabled || q.options.length <= 2) ? 0.4 : 1 }}
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
                style={{ marginTop: "10px", height: "36px", padding: "0 12px", fontSize: "13px", fontWeight: 600, color: "#0B3A6E", background: "transparent", border: "1px solid #c9d4e2", borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer" }}
              >
                + Alternativa
              </button>
              <div style={{ marginTop: "12px", borderRadius: "8px", border: "1px solid #cfe0ef", background: "#f0f7fc", padding: "12px 14px", fontSize: "12.5px", lineHeight: 1.6, color: "#365b7a" }}>
                Uma alternativa iniciada por <strong>“Outro”</strong> ou <strong>“Outra”</strong>
                abre automaticamente um campo para o participante escrever a resposta.
              </div>
              {q.type === "multi_choice" && (
                <div style={{ marginTop: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
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
                    style={{ width: "160px", height: "40px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "0 12px", fontSize: "14px" }}
                  />
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: "18px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>
                Limite de caracteres
              </label>
              <input
                type="number"
                disabled={disabled}
                value={q.maxLength ?? 2000}
                onChange={(e) =>
                  updateQuestion(safeIndex, { maxLength: Number(e.target.value) || 2000 })
                }
                style={{ width: "160px", height: "40px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "0 12px", fontSize: "14px" }}
              />
            </div>
          )}

          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #eef1f5" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#33415c", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={q.required}
                disabled={disabled}
                onChange={(e) => updateQuestion(safeIndex, { required: e.target.checked })}
                style={{ width: "18px", height: "18px", accentColor: "#0b3a6e" }}
              />
              Resposta obrigatória
            </label>
          </div>
        </div>

        {/* Mobile preview */}
        <div style={{ background: "#f7f9fc", border: "1px solid #dde4ee", borderRadius: "10px", padding: "16px", minWidth: 0 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: "#8a97a8" }}>
            Prévia no celular
          </h2>
          <div style={{ background: "#fff", border: "1px solid #d6dde6", borderRadius: "16px", padding: "16px" }}>
            <p style={{ margin: 0, fontSize: "11.5px", fontWeight: 700, letterSpacing: ".07em", color: "#0b3a6e" }}>SEMCAS</p>
            <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#5b6b7f" }}>
              Pergunta {safeIndex + 1} de {questions.length}
            </p>
            <div style={{ height: "5px", background: "#eef1f5", borderRadius: "4px", overflow: "hidden", marginTop: "8px" }}>
              <div
                style={{ height: "100%", background: "#0b3a6e", borderRadius: "4px", width: `${((safeIndex + 1) / Math.max(questions.length, 1)) * 100}%` }}
              />
            </div>
            <h3 style={{ margin: "14px 0 0", fontSize: "15px", fontWeight: 700, lineHeight: 1.4 }}>
              {q.title || "Título da pergunta"}
            </h3>
            {q.explanation && (
              <p style={{ margin: "8px 0 0", borderRadius: "8px", background: "#edf5fc", padding: "8px 12px", fontSize: "12px", lineHeight: 1.6, color: "#365b7a" }}>
                {q.explanation}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "14px" }}>
              {q.type === "text" ? (
                <div style={{ border: "1px solid #c9d4e2", borderRadius: "8px", padding: "12px", minHeight: "96px", fontSize: "14px", color: "#8a97a8" }}>
                  Digite sua resposta...
                </div>
              ) : (
                (q.options.filter(Boolean).length ? q.options.filter(Boolean) : ["Alternativa"]).map(
                  (opt) => (
                    <div key={opt}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "10px 12px", minHeight: "44px" }}>
                        <span
                          style={{
                            width: "18px", height: "18px", border: "1px solid #b9c5d4", flexShrink: 0,
                            borderRadius: q.type === "multi_choice" ? "4px" : "99px"
                          }}
                        />
                        <span style={{ fontSize: "14px" }}>{opt}</span>
                      </div>
                      {isOtherOptionLabel(opt) && (
                        <div style={{ marginTop: "6px", borderRadius: "8px", border: "1px dashed #9fb8cf", padding: "8px 12px", fontSize: "12px", color: "#718198" }}>
                          Campo “Qual?” aparece quando esta opção for selecionada.
                        </div>
                      )}
                    </div>
                  )
                )
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <span style={{ height: "40px", display: "inline-flex", alignItems: "center", padding: "0 14px", border: "1px solid #c9d4e2", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#33415c" }}>
                Voltar
              </span>
              <span style={{ flex: 1, height: "40px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#0b3a6e", color: "#fff", borderRadius: "8px", fontSize: "14px", fontWeight: 600 }}>
                Continuar
              </span>
            </div>
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
      style={{
        width: "32px", height: "32px", border: "1px solid", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        ...(danger
          ? { borderColor: "#e3b3ad", color: "#b42318", background: "transparent" }
          : { borderColor: "#dde4ee", color: "#5b6b7f", background: "transparent" }
        )
      }}
      onMouseOver={(e) => {
        if (!disabled) e.currentTarget.style.background = danger ? "#fdf2f1" : "#f4f6f9";
      }}
      onMouseOut={(e) => {
        if (!disabled) e.currentTarget.style.background = "transparent";
      }}
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
