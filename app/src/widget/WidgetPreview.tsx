import type { WidgetSnapshot } from '../native/bridge';

/** In-app picture of the Android widget, so it can be shown in demos and the browser. */
export function WidgetPreview({ snap, compact = false }: { snap: WidgetSnapshot; compact?: boolean }) {
  const size = 84;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = snap.score < 0 ? 0 : snap.score / 100;
  return (
    <div
      role="img"
      aria-label={`Widget preview: Balance Score ${snap.score < 0 ? 'not available' : snap.score}, ${snap.mood}`}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: 14,
        borderRadius: 24,
        background: '#1F212C',
        border: '1px solid #454B5C',
        color: '#F4F5F7',
        maxWidth: compact ? 170 : 340,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
        <svg width={size} height={size} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#323848" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={snap.color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * filled} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 700 }}>
          {snap.score < 0 ? '–' : snap.score}
        </div>
      </div>
      {!compact && (
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <strong style={{ fontSize: 14 }}>{snap.mood}</strong>
            {snap.demo && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#E8A33D', color: '#1F212C', fontWeight: 700 }}>
                DEMO
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
            {[
              ['Sleep', snap.sleep],
              ['Steps', snap.steps],
              ['Screen', snap.screen],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: '#9AA0B2' }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#9AA0B2', marginTop: 8 }}>AURA · {snap.updated}</div>
        </div>
      )}
    </div>
  );
}
