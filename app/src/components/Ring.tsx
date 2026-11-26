import { useEffect, useState } from 'react';

interface RingProps {
  value: number;
  size?: number;
  label?: string;
  onClick?: () => void;
}

export function Ring({ value, size = 148, label = 'Balance Score', onClick }: RingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const strokeWidth = 12;
  const r = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - animatedPct / 100);

  const content = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label} ${pct} out of 100`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--aura-border)"
        strokeOpacity={0.45}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--aura-primary)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.65s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size / 3.1}
        fontWeight="800"
        fill="var(--aura-text)"
      >
        {pct}
      </text>
      <text
        x="50%"
        y="67%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="600"
        fill="var(--aura-muted)"
      >
        / 100
      </text>
    </svg>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="btn ghost"
        style={{ padding: 4, borderRadius: '50%' }}
        aria-label={`Inspect ${label} details (${pct} out of 100)`}
      >
        {content}
      </button>
    );
  }

  return content;
}
