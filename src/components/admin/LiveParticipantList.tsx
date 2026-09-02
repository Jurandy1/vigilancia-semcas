"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Participant {
  id: string;
  displayName: string;
  mode: string;
  status: string;
  currentQuestion: number;
  questionCount?: number;
}

const statusLabel: Record<string, string> = {
  waiting: "Cadastrado",
  answering: "Respondendo",
  completed: "Concluído",
  inactive: "Inativo",
};

interface LiveParticipantListProps {
  participants: Participant[];
}

export function LiveParticipantList({ participants }: LiveParticipantListProps) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      if (filter === "answering" && p.status !== "answering") return false;
      if (filter === "completed" && p.status !== "completed") return false;
      if (filter === "identified" && p.mode !== "identified") return false;
      if (filter === "anonymous" && p.mode !== "anonymous") return false;
      if (search && p.mode === "identified") {
        return p.displayName.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [participants, filter, search]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { key: "all", label: "Todos" },
          { key: "answering", label: "Respondendo" },
          { key: "completed", label: "Concluídos" },
          { key: "identified", label: "Identificados" },
          { key: "anonymous", label: "Anônimos" },
        ].map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Input
        placeholder="Buscar por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 max-w-xs"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Participante</th>
              <th className="py-2 pr-4 font-medium">Situação</th>
              <th className="py-2 font-medium">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-2.5 pr-4">{p.displayName}</td>
                <td className="py-2.5 pr-4">{statusLabel[p.status] ?? p.status}</td>
                <td className="py-2.5">
                  {p.status === "completed"
                    ? `${p.questionCount ?? p.currentQuestion}/${p.questionCount ?? p.currentQuestion}`
                    : p.currentQuestion > 0
                      ? `${p.currentQuestion}/${p.questionCount ?? "?"}`
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">Nenhum participante encontrado.</p>
        )}
      </div>
    </div>
  );
}
