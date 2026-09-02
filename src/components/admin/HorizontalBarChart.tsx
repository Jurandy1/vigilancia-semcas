interface BarItem {
  label: string;
  count: number;
  percent: string;
  color?: string;
}

export function HorizontalBarChart({ items, maxCount }: { items: BarItem[]; maxCount?: number }) {
  const max = maxCount ?? Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">{item.label}</span>
            <span className="text-gray-800 font-medium">
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
  );
}
