interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export function DonutChart({
  segments,
  size = 140,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const slices = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const slice = { ...seg, dash, offset, pct };
    offset += dash;
    return slice;
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="12" />
          {slices.map((slice, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="12"
              strokeDasharray={`${slice.dash} ${circumference - slice.dash}`}
              strokeDashoffset={-slice.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-2xl font-bold text-gray-800">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-gray-500 uppercase">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
            {seg.label}
            <span className="font-semibold text-gray-800">
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
