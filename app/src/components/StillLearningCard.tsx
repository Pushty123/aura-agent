import type { Insight } from '../types';

function parseProgress(detail: string): { current: number; target: number; label: string } | null {
  const m = detail.match(/(\d+)\s+of\s+(\d+)\s+(days|nights|pairs)/i);
  if (!m) return null;
  const current = Number(m[1]);
  const target = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return null;
  return { current, target, label: `${current}/${target} ${m[3].toLowerCase()}` };
}

export function StillLearningCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <article className="card stack-sm" aria-label="Not enough data yet">
      <div className="row between wrap">
        <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700 }}>Still learning</h4>
        <span className="pill">Not enough data yet</span>
      </div>
      <p className="xs muted">
        AURA only reports patterns backed by enough days of your own data:
      </p>
      <ul className="still-learning-list">
        {insights.map((insight) => {
          const prog = parseProgress(insight.detail);
          const pct = prog ? Math.min(100, Math.round((prog.current / prog.target) * 100)) : 0;
          return (
            <li key={insight.id} className="still-learning-row">
              <div className="row between small" style={{ gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{insight.title}</span>
                <span className="xs muted" style={{ whiteSpace: 'nowrap' }}>
                  {prog ? prog.label : 'Need more days'}
                </span>
              </div>
              {prog ? (
                <div className="bar" style={{ height: 6 }} aria-hidden="true">
                  <div style={{ width: `${pct}%` }} />
                </div>
              ) : (
                <span className="xs muted">{insight.detail}</span>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
