"use client";

import { useState } from "react";

interface BarItem {
  label: string;
  count: number;
  percent: string;
  color?: string;
}

export function HorizontalBarChart({ items, maxCount }: { items: BarItem[]; maxCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  const max = maxCount ?? Math.max(...items.map((i) => i.count), 1);
  const visibleItems = expanded ? items : items.slice(0, 12);

  return (
    <div>
      <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
      {visibleItems.map((item) => (
        <div key={item.label}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-xs mb-1.5">
            <span className="min-w-0 break-words [overflow-wrap:anywhere] leading-snug text-gray-600">{item.label}</span>
            <span className="shrink-0 whitespace-nowrap text-gray-800 font-medium tabular-nums">
              {item.count} <span className="text-gray-400">({item.percent})</span>
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.count / max) * 100}%`,
                background: item.color ?? "#0b3a6e",
              }}
            />
          </div>
        </div>
      ))}
      </div>
      {items.length > 12 && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 h-9 rounded-lg border border-[#b9c9d9] px-3 text-xs font-semibold text-[#0b3a6e]">
          {expanded ? "Mostrar menos" : `Mostrar todas as ${items.length} opções`}
        </button>
      )}
    </div>
  );
}
