import type { Streak } from '../goals/badges';
import { Award, Droplet, Flame, Footprints, Moon, NotebookPen, Smartphone, Sparkles, type LucideIcon } from 'lucide-react';

const ICON: Record<string, LucideIcon> = { checkin: NotebookPen, sleep: Moon, steps: Footprints, water: Droplet, screen: Smartphone, nights: Sparkles };
const Ico = ({ id, size = 16 }: { id: string; size?: number }) => {
  const I = ICON[id] ?? Flame;
  return <I size={size} aria-hidden="true" />;
};
import { TIERS } from '../goals/badges';

/** Compact row for Home: only streaks that are running or earned. */
export function StreakRow({ list, onOpen }: { list: Streak[]; onOpen?: () => void }) {
  const show = list.filter((s) => s.current > 0 || s.tier).sort((a, b) => b.current - a.current);
  return (
    <button type="button" className="card streak-row" onClick={onOpen} aria-label="Your streaks and badges">
      <div className="row between center-v">
        <strong className="row gap-sm center-v"><Flame size={18} className="flame" aria-hidden="true" /> Streaks</strong>
        <span className="xs muted">See all badges ›</span>
      </div>
      {show.length ? (
        <div className="streak-chips">
          {show.map((s) => (
            <span key={s.def.id} className="streak-chip" style={s.tier ? { borderColor: s.tier.color } : undefined}>
              <Ico id={s.def.id} />
              <strong>{s.current}</strong>
              <span className="xs muted">{s.def.label}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="xs muted" style={{ margin: 0 }}>Log your mood, sleep or water today to start a streak.</p>
      )}
    </button>
  );
}

/** Full badge wall for the Report tab. */
export function BadgeWall({ list }: { list: Streak[] }) {
  return (
    <div className="card stack-md">
      <div>
        <h3 className="row gap-sm center-v" style={{ margin: 0 }}><Award size={20} aria-hidden="true" /> Badges</h3>
        <p className="xs muted">Earn Bronze at 3 days in a row, Silver at 7, Gold at 14 and Diamond at 30.</p>
      </div>
      <div className="badge-grid">
        {list.map((s) => {
          const pct = s.next ? Math.round((s.current / s.next.days) * 100) : 100;
          return (
            <div key={s.def.id} className={`badge-card ${s.tier ? 'earned' : ''}`} style={s.tier ? { borderColor: s.tier.color } : undefined}>
              <div className="badge-medal" style={{ background: s.tier ? s.tier.color : 'var(--aura-surface-2)' }} aria-hidden="true">
                <Ico id={s.def.id} size={20} />
              </div>
              <strong className="small">{s.def.label}</strong>
              <span className="xs muted">{s.def.rule}</span>
              <span className="xs">{s.tier ? `${s.tier.name} · best ${s.best} days` : 'Not earned yet'}</span>
              <span className="xs muted">{s.current} days now{s.next ? ` · ${s.next.days - s.current} to ${s.next.name}` : ' · top tier!'}</span>
              <div className="bar" aria-hidden="true"><div style={{ width: `${pct}%`, background: s.next ? undefined : TIERS[3].color }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
