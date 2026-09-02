interface LineChartPoint {
  label: string;
  value: number;
}

export function LineChart({
  points,
  maxValue,
  height = 140,
}: {
  points: LineChartPoint[];
  maxValue?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <p className="text-xs text-gray-400 py-8 text-center">Sem dados suficientes ainda.</p>;
  }

  const width = 320;
  const padding = 8;
  const max = Math.max(maxValue ?? 0, ...points.map((p) => p.value), 1);
  const stepX = (width - padding * 2) / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - p.value / max) * (height - padding * 2);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1]!.x},${height - padding} L${coords[0]!.x},${height - padding} Z`;

  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#f0f0f0"
          strokeWidth="1"
        />
        <path d={areaPath} fill="#0b3a6e" opacity="0.06" />
        <path d={path} fill="none" stroke="#0b3a6e" strokeWidth="2" />
        <circle cx={coords[coords.length - 1]!.x} cy={coords[coords.length - 1]!.y} r="3" fill="#0b3a6e" />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{first.label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
