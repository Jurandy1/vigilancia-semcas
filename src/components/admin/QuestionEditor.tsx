"use client";

import { ChevronUp, ChevronDown, Copy, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type QuestionType = "single_choice" | "multi_choice" | "text";

export interface QuestionDraft {
  id?: string;
  title: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  maxSelections?: number;
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

const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface QuestionEditorListProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
}

export function QuestionEditorList({ questions, onChange }: QuestionEditorListProps) {
  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function changeType(index: number, type: QuestionType) {
    onChange(
      questions.map((q, i) => {
        if (i !== index) return q;
        if (type === "text") return { ...q, type, options: [] };
        return { ...q, type, options: q.options.length >= 2 ? q.options : ["", ""] };
      })
    );
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    onChange(
      questions.map((q, i) => {
        if (i !== qIndex) return q;
        const options = [...q.options];
        options[optIndex] = value;
        return { ...q, options };
      })
    );
  }

  function addOption(qIndex: number) {
    onChange(questions.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ""] } : q)));
  }

  function removeOption(qIndex: number, optIndex: number) {
    onChange(
      questions.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.filter((_, oi) => oi !== optIndex) } : q
      )
    );
  }

  function addQuestion() {
    onChange([...questions, blankQuestion()]);
  }

  function duplicateQuestion(index: number) {
    const copy = { ...questions[index]!, id: undefined, options: [...questions[index]!.options] };
    const next = [...questions];
    next.splice(index + 1, 0, copy);
    onChange(next);
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={i} className="border border-border rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Pergunta {i + 1}</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveQuestion(i, -1)}
                disabled={i === 0}
                aria-label="Mover para cima"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => moveQuestion(i, 1)}
                disabled={i === questions.length - 1}
                aria-label="Mover para baixo"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => duplicateQuestion(i)}
                aria-label="Duplicar pergunta"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => removeQuestion(i)}
                disabled={questions.length === 1}
                aria-label="Remover pergunta"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Input
            value={q.title}
            onChange={(e) => updateQuestion(i, { title: e.target.value })}
            placeholder="Título da pergunta"
          />

          <select
            className={selectClassName}
            value={q.type}
            onChange={(e) => changeType(i, e.target.value as QuestionType)}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {q.type !== "text" && (
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, oi, e.target.value)}
                    placeholder={`Alternativa ${oi + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeOption(i, oi)}
                    disabled={q.options.length <= 2}
                    aria-label="Remover alternativa"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addOption(i)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar alternativa
              </Button>
            </div>
          )}

          {q.type === "multi_choice" && (
            <div className="space-y-1">
              <Label htmlFor={`max-sel-${i}`} className="text-xs">
                Máximo de seleções (opcional)
              </Label>
              <Input
                id={`max-sel-${i}`}
                type="number"
                min={1}
                value={q.maxSelections ?? ""}
                onChange={(e) =>
                  updateQuestion(i, {
                    maxSelections: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="max-w-[140px]"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => updateQuestion(i, { required: e.target.checked })}
            />
            Resposta obrigatória
          </label>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addQuestion}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
      </Button>
    </div>
  );
}

interface QuestionPreviewDialogProps {
  questions: QuestionDraft[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function QuestionPreviewDialog({
  questions,
  open,
  onOpenChange,
  trigger,
}: QuestionPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Prévia — como o participante vê</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto space-y-6 pr-1">
          {questions.map((q, i) => (
            <div key={i} className="border-b border-gray-100 pb-4 last:border-0">
              <p className="text-xs text-muted-foreground mb-2">
                Pergunta {i + 1} de {questions.length}
              </p>
              <h3 className="text-sm font-semibold mb-3">{q.title || "(sem título)"}</h3>
              {q.type === "single_choice" && (
                <RadioGroup>
                  {q.options.filter(Boolean).map((opt) => (
                    <div
                      key={opt}
                      className="flex items-center space-x-3 border border-border rounded-md px-3 py-2 mb-2"
                    >
                      <RadioGroupItem value={opt} id={`preview-${i}-${opt}`} disabled />
                      <Label htmlFor={`preview-${i}-${opt}`} className="flex-1 font-normal text-sm">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {q.type === "multi_choice" && (
                <div className="space-y-2">
                  {q.options.filter(Boolean).map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center space-x-3 border border-border rounded-md px-3 py-2"
                    >
                      <input type="checkbox" disabled className="h-4 w-4" />
                      <span className="flex-1 text-sm font-normal">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === "text" && <Textarea disabled placeholder="Digite sua resposta..." rows={3} />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
