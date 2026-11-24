export function Ring({ value, size = 140 }: { value: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Balance score ${pct} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6dcc6" strokeWidth="12" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e8832a"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size / 3.2} fontWeight="800" fill="#1a1a6e">
        {pct}
      </text>
    </svg>
  );
}
