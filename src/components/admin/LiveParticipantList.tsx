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
    <div style={{ marginTop: "18px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "14px" }}>
        <label style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <span style={{ position: "absolute", left: 0, top: "-18px", fontSize: 0 }}>Buscar participante</span>
          <input
            type="search"
            placeholder="Buscar participante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", height: "38px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "0 12px", fontSize: "13.5px", background: "#fff", color: "#11243c" }}
          />
        </label>
        <div role="tablist" aria-label="Filtrar participantes" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {filters.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.key)}
                style={{
                  height: "38px",
                  padding: "0 14px",
                  border: selected ? "1px solid #0B3A6E" : "1px solid #c9d4e2",
                  background: selected ? "#0B3A6E" : "#fff",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: selected ? 600 : 500,
                  color: selected ? "#fff" : "#5b6b7f",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = "#a8b8cc";
                    e.currentTarget.style.background = "#f8fafd";
                    e.currentTarget.style.color = "#33415c";
                  }
                }}
                onMouseOut={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = "#c9d4e2";
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.color = "#5b6b7f";
                  }
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ border: "1px solid #dbe4ef", borderRadius: "10px", background: "#fff", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f7f9fc" }}>
                {["Participante", "Tipo", "Situação", "Progresso", "Última atividade"].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      textAlign: i === 4 ? "right" : "left",
                      padding: "11px 16px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "#5b6b7f",
                      borderBottom: "1px solid #dbe4ef",
                      position: "sticky",
                      top: 0,
                      background: "#f7f9fc"
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isCompleted = p.status === "completed";
                const isAnswering = p.status === "answering";
                const isWaiting = p.status === "waiting";
                
                let badgeStyle = "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#5b6b7f;background:#f4f6f9;border:1px solid #dde4ee;border-radius:4px;padding:2px 6px;";
                let dotColor = "#8a97a8";
                
                if (isCompleted) {
                  badgeStyle = "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#1a7f4b;background:#e8f5ee;border:1px solid #c3e4d1;border-radius:4px;padding:2px 6px;";
                  dotColor = "#1a7f4b";
                } else if (isAnswering) {
                  badgeStyle = "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#8a5a00;background:#fdf5e3;border:1px solid #f0dfae;border-radius:4px;padding:2px 6px;";
                  dotColor = "#dba514";
                }

                return (
                  <tr key={p.id}>
                    <td title={p.displayName} style={{ padding: "12px 16px", borderBottom: "1px solid #f2f5f8", fontSize: "13.5px", color: "#11243c", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.displayName}
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #f2f5f8", fontSize: "13px", color: "#5b6b7f" }}>
                      {p.mode === "anonymous" ? "Anônimo" : "Identificado"}
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #f2f5f8", fontSize: "13px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 600, color: isCompleted ? "#1a7f4b" : isAnswering ? "#8a5a00" : "#5b6b7f", background: isCompleted ? "#e8f5ee" : isAnswering ? "#fdf5e3" : "#f4f6f9", border: isCompleted ? "1px solid #c3e4d1" : isAnswering ? "1px solid #f0dfae" : "1px solid #dde4ee", borderRadius: "4px", padding: "2px 6px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "99px", background: dotColor }} />
                        {statusLabel[p.status] ?? p.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #f2f5f8", fontSize: "13px", color: "#5b6b7f", fontFamily: "ui-monospace,Consolas,monospace" }}>
                      {p.status === "completed"
                        ? `${p.questionCount ?? p.currentQuestion}/${p.questionCount ?? p.currentQuestion}`
                        : p.currentQuestion > 0
                          ? `${p.currentQuestion}/${p.questionCount ?? "?"}`
                          : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #f2f5f8", fontSize: "13px", color: "#8a97a8", textAlign: "right", fontFamily: "ui-monospace,Consolas,monospace" }}>
                      {p.lastActivityAt
                        ? new Date(p.lastActivityAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p style={{ margin: 0, fontSize: "13px", color: "#8a97a8", padding: "24px 16px" }}>
            Nenhum participante encontrado.
          </p>
        )}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: "12px", lineHeight: 1.6, color: "#8a97a8" }}>
        Participantes identificados aparecem com o nome informado; anônimos aparecem como
        “Anônimo”. Exibindo {filtered.length} de {participants.length} registros no momento.
      </p>
    </div>
  );
}
