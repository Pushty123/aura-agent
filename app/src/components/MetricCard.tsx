interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  accent?: 'primary' | 'blue' | 'purple' | 'coral';
  onClick?: () => void;
}

const ACCENT_MAP: Record<NonNullable<MetricCardProps['accent']>, string> = {
  primary: 'var(--aura-primary)',
  blue: 'var(--aura-blue)',
  purple: 'var(--aura-purple)',
  coral: 'var(--aura-coral)',
};

export function MetricCard({ label, value, sub, accent = 'primary', onClick }: MetricCardProps) {
  return (
    <button type="button" className="metric-card" onClick={onClick}>
      <div className="row between" style={{ width: '100%' }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          {label}
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ACCENT_MAP[accent],
          }}
        />
      </div>
      <div className="metric-value">{value}</div>
      <div className="xs muted">{sub}</div>
    </button>
  );
}
