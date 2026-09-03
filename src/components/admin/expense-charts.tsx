// Slice 4 (phase-12.md): SVG-only charts, no chart library — Non-Goals explicitly rule out
// Recharts/Chart.js.
const CATEGORY_COLOR: Record<string, string> = {
  EQUIPMENT: '#0F766E',
  MATERIAL: '#2DD4BF',
  ACCESSORIES: '#D97706',
  UTILITIES: '#F59E0B',
  LOGISTICS: '#6366F1',
  MARKETING: '#EC4899',
  OTHER: '#94A3B8',
};

export function ExpenseDonutChart({ data }: { data: { category: string; total: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.total, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = total > 0
    ? data.filter((d) => d.total > 0).map((d) => {
      const fraction = d.total / total;
      const dash = fraction * circumference;
      const segment = { ...d, dash, offset, color: CATEGORY_COLOR[d.category] ?? '#94A3B8' };
      offset += dash;
      return segment;
    })
    : [];

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label="Phân bổ chi phí theo nhóm">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--muted)" strokeWidth="20" />
        {segments.map((segment) => (
          <circle
            key={segment.category}
            cx="80" cy="80" r={radius} fill="none"
            stroke={segment.color} strokeWidth="20"
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 80 80)"
          />
        ))}
        <text x="80" y="84" textAnchor="middle" className="fill-foreground text-sm font-semibold">
          {total > 0 ? `${total.toLocaleString('vi-VN')}đ` : 'Chưa có'}
        </text>
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {data.filter((d) => d.total > 0).map((d) => (
          <li key={d.category} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[d.category] ?? '#94A3B8' }} />
            <span>{d.category}</span>
            <span className="text-muted-foreground">
              {total > 0 ? Math.round((d.total / total) * 100) : 0}% — {d.total.toLocaleString('vi-VN')}đ
            </span>
          </li>
        ))}
        {!data.some((d) => d.total > 0) ? <li className="text-muted-foreground">Chưa có chi tiêu nào</li> : null}
      </ul>
    </div>
  );
}

export function ExpenseMonthlyBarChart({ data }: { data: { month: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const width = 480;
  const height = 160;
  const barWidth = width / data.length - 8;

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full" role="img" aria-label="Chi tiêu theo tháng">
      {data.map((d, index) => {
        const barHeight = (d.total / max) * height;
        const x = index * (width / data.length) + 4;
        const y = height - barHeight;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={3} fill="#0F766E" />
            <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {d.month.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
