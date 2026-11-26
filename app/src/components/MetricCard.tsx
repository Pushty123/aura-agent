import type { ReactNode } from 'react';
import { ChevronRightIcon } from './Icons';

interface MetricCardProps {
  label: string;
  dateLabel?: string;
  value?: string;
  unit?: string;
  sub: string;
  emptyAction?: string;
  accent?: 'primary' | 'blue' | 'purple' | 'coral';
  icon: ReactNode;
  series?: number[];
  onClick?: () => void;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const w = 64;
  const h = 22;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - 3 - ((v - min) / span) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

const ACCENT_COLOR: Record<NonNullable<MetricCardProps['accent']>, string> = {
  primary: 'var(--aura-primary)',
  blue: 'var(--aura-blue)',
  purple: 'var(--aura-purple)',
  coral: 'var(--aura-coral)',
};

export function MetricCard({
  label,
  dateLabel,
  value,
  unit,
  sub,
  emptyAction = 'Log now',
  accent = 'primary',
  icon,
  series,
  onClick,
}: MetricCardProps) {
  const hasValue = value !== undefined && value !== '';

  return (
    <button type="button" className="metric-card" onClick={onClick}>
      <div className="metric-card-top">
        <div className={`metric-icon-tile accent-${accent}`} aria-hidden="true">
          {icon}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="metric-title">{label}</div>
          {dateLabel && <div className="xs muted">{dateLabel}</div>}
        </div>
        <ChevronRightIcon size={16} className="muted" aria-hidden="true" />
      </div>

      <div className="row between center-v" style={{ width: '100%', gap: 8, marginTop: 'auto' }}>
        <div style={{ minWidth: 0 }}>
          {hasValue ? (
            <div className="metric-value">
              {value}
              {unit && <span className="metric-unit"> {unit}</span>}
            </div>
          ) : (
            <div className="metric-empty-cta">{emptyAction}</div>
          )}
          <div className="xs muted" style={{ marginTop: 2 }}>{sub}</div>
        </div>
        {hasValue && series && series.length >= 2 && (
          <Sparkline data={series} color={ACCENT_COLOR[accent]} />
        )}
      </div>
    </button>
  );
}
