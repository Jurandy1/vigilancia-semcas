"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  displayName: string;
  mode: string;
  status: string;
  currentQuestion: number;
  questionCount?: number;
  lastActivityAt?: string | null;
}

const statusLabel: Record<string, string> = {
  waiting: "Não iniciou",
  answering: "Respondendo",
  completed: "Concluído",
  inactive: "Inativo",
};

const statusStyle: Record<string, string> = {
  waiting: "text-[#5b6b7f] bg-[#f4f6f9] border-[#dde4ee]",
  answering: "text-[#8a5a00] bg-[#fdf5e3] border-[#f0dfae]",
  completed: "text-[#1a7f4b] bg-[#e8f5ee] border-[#c3e4d1]",
  inactive: "text-[#8a97a8] bg-[#f4f6f9] border-[#dde4ee]",
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
      if (filter === "waiting" && p.status !== "waiting") return false;
      if (filter === "identified" && p.mode !== "identified") return false;
      if (filter === "anonymous" && p.mode !== "anonymous") return false;
      if (search.trim()) {
        return p.displayName.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [participants, filter, search]);

  const filters = [
    { key: "all", label: "Todos" },
    { key: "answering", label: "Respondendo" },
    { key: "completed", label: "Concluídos" },
    { key: "waiting", label: "Não iniciaram" },
    { key: "identified", label: "Identificados" },
    { key: "anonymous", label: "Anônimos" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3.5 flex-wrap">
        <input
          aria-label="Buscar por nome"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-[260px] max-w-full border border-[#c9d4e2] rounded-md px-3 text-sm"
        />
        <div role="tablist" aria-label="Filtrar participantes" className="flex gap-1.5 flex-wrap">
          {filters.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "h-9 px-3 text-[13px] font-semibold rounded-md border",
                  selected
                    ? "bg-[#eef3f9] border-[#0b3a6e] text-[#0b3a6e]"
                    : "bg-white border-[#dde4ee] text-[#5b6b7f] hover:border-[#0b3a6e]"
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-[#dde4ee] rounded-lg overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px] min-w-[640px]">
          <thead>
            <tr>
              {["Participante", "Tipo", "Situação", "Progresso", "Última atividade"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="text-left px-4 py-3 text-[11.5px] font-bold tracking-[0.06em] uppercase text-[#8a97a8] border-b border-[#dde4ee]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 border-b border-[#f2f5f8] text-[#1a1a1a]">
                  {p.displayName}
                </td>
                <td className="px-4 py-3 border-b border-[#f2f5f8] text-[#5b6b7f]">
                  {p.mode === "anonymous" ? "Anônimo" : "Identificado"}
                </td>
                <td className="px-4 py-3 border-b border-[#f2f5f8]">
                  <span
                    className={cn(
                      "inline-flex text-xs font-semibold border rounded px-2 py-0.5",
                      statusStyle[p.status] ?? statusStyle.waiting
                    )}
                  >
                    {statusLabel[p.status] ?? p.status}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-[#f2f5f8] text-[#5b6b7f] tabular-nums">
                  {p.status === "completed"
                    ? `${p.questionCount ?? p.currentQuestion}/${p.questionCount ?? p.currentQuestion}`
                    : p.currentQuestion > 0
                      ? `${p.currentQuestion}/${p.questionCount ?? "?"}`
                      : "—"}
                </td>
                <td className="px-4 py-3 border-b border-[#f2f5f8] text-[#8a97a8]">
                  {p.lastActivityAt
                    ? new Date(p.lastActivityAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-[#8a97a8] py-6 px-4">Nenhum participante encontrado.</p>
        )}
      </div>
      <p className="mt-3 mb-0 text-[12.5px] text-[#8a97a8] leading-relaxed">
        Participantes identificados aparecem com o nome informado; anônimos aparecem como
        “Anônimo”. Exibindo {filtered.length} de {participants.length} linhas.
      </p>
    </div>
  );
}
