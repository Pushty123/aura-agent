import type { ReactNode } from 'react';
import { ChevronRight, Footprints, Lock, Moon, Pause, Smartphone, Smile, Volume2 } from 'lucide-react';
import './AuraWidget.css';

type Section = 'sleep' | 'steps' | 'screen' | 'mood' | 'week';

export interface AuraWidgetProps {
  sleepHours?: number;
  steps?: number;
  screenMinutes?: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  balanceScore?: number;
  weekScores?: number[];
  isDemo?: boolean;
  onOpen?: (section: Section) => void;
  onSettings?: () => void;
  /** Person's name for the greeting. */
  name?: string;
  /** Shown inside the score ring instead of the number (e.g. the avatar). */
  ringContent?: ReactNode;
  onRingClick?: () => void;
  /** Short mood line under the score, e.g. "In balance today". */
  moodLabel?: string;
  /** Line under the greeting. */
  subline?: string;
  /** Thought for today, shown under the greeting. */
  thought?: string;
  onListen?: () => void;
  listening?: boolean;
  /** Daily phone limit in minutes, shown on the screen-time tile. */
  screenLimit?: number;
}

const MOODS = ['Low', 'Tired', 'Okay', 'Good', 'Great'];
const R = 52;
const C = 2 * Math.PI * R;

const fmtMinutes = (m?: number) => {
  if (typeof m !== 'number') return '—';
  const t = Math.round(m);
  return `${Math.floor(t / 60)}h ${t % 60}m`;
};

function greeting(name?: string) {
  const h = new Date().getHours();
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const n = name?.trim().split(' ')[0];
  return n ? `${base}, ${n}` : base;
}

function Tile(props: { icon: ReactNode; tone: string; value: string; label: string; onClick?: () => void }) {
  return (
    <button type="button" className="aw-tile" onClick={props.onClick} aria-label={`${props.label}: ${props.value}`}>
      <span className={`aw-icon tone-${props.tone}`} aria-hidden="true">{props.icon}</span>
      <span className="aw-tile-text">
        <span className="aw-label">{props.label}</span>
        <span className="aw-value">{props.value}</span>
      </span>
      <ChevronRight className="aw-chev" size={16} aria-hidden="true" />
    </button>
  );
}

/** Home hero: greeting, thought for today, today's numbers and the Balance Score. */
export function AuraWidget(p: AuraWidgetProps) {
  const open = (s: Section) => () => p.onOpen?.(s);
  const score = typeof p.balanceScore === 'number' ? Math.max(0, Math.min(100, p.balanceScore)) : undefined;
  const offset = C * (1 - (score ?? 0) / 100);
  const bars = (p.weekScores ?? []).slice(-7);
  const status =
    score === undefined ? 'Not enough data yet' : score >= 70 ? "You're on track" : score >= 40 ? 'Room to improve' : 'Keep logging';
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section className="aw" aria-label="Today overview">
      <div className="aw-top">
        <span className="aw-date">{date}</span>
        <span className="aw-badges">
          <span className="aw-badge" title="Your data is encrypted on this device">
            <Lock size={12} aria-hidden="true" /> Private
          </span>
        </span>
      </div>

      <h3 className="aw-hello">{greeting(p.name)}</h3>
      <p className="aw-sub">{p.subline ?? "Here's your day at a glance."}</p>

      {p.thought && (
        <div className="aw-thought">
          <span className="aw-thought-text">
            <span className="aw-thought-label">Thought for today</span>
            <q>{p.thought}</q>
          </span>
          {p.onListen && (
            <button type="button" className="aw-listen" onClick={p.onListen} aria-label={p.listening ? 'Stop' : 'Listen to your daily brief'}>
              {p.listening ? <Pause size={18} /> : <Volume2 size={18} />}
            </button>
          )}
        </div>
      )}

      <div className="aw-tiles">
        <Tile icon={<Moon size={18} />} tone="sleep" value={fmtMinutes(typeof p.sleepHours === 'number' ? p.sleepHours * 60 : undefined)} label="Sleep" onClick={open('sleep')} />
        <Tile icon={<Footprints size={18} />} tone="steps" value={typeof p.steps === 'number' ? p.steps.toLocaleString() : '—'} label="Steps" onClick={open('steps')} />
        <Tile
          icon={<Smartphone size={18} />}
          tone="screen"
          value={fmtMinutes(p.screenMinutes)}
          label={p.screenLimit ? `Screen · limit ${fmtMinutes(p.screenLimit)}` : 'Screen time'}
          onClick={open('screen')}
        />
        <Tile icon={<Smile size={18} />} tone="mood" value={p.mood ? MOODS[p.mood - 1] : '—'} label="Mood" onClick={open('mood')} />
      </div>

      <div className="aw-score">
        <div
          className={`aw-ring ${p.ringContent ? 'has-content' : ''}`}
          onClick={p.onRingClick}
          role={p.onRingClick ? 'button' : undefined}
          tabIndex={p.onRingClick ? 0 : undefined}
          aria-label={p.onRingClick ? 'Open your character' : undefined}
        >
          <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
            <circle className="aw-ring-track" cx="60" cy="60" r={R} fill="none" strokeWidth="9" />
            <circle
              className="aw-ring-fill"
              cx="60" cy="60" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 60 60)"
            />
          </svg>
          {p.ringContent ? (
            <div className="aw-ring-content">{p.ringContent}</div>
          ) : (
            <div className="aw-ring-text">
              <strong>{score ?? '—'}</strong>
            </div>
          )}
        </div>
        <div className="aw-score-info">
          <span className="aw-label">Balance Score</span>
          <div className="aw-score-num">
            {score ?? '—'}
            <span>/100</span>
          </div>
          <p>{p.moodLabel ?? status}</p>
        </div>
        <button type="button" className="aw-week" onClick={open('week')} aria-label="This week">
          <span className="aw-bars" aria-hidden="true">
            {bars.map((s, i) => (
              <i key={i} className={i === bars.length - 1 ? 'today' : ''} style={{ height: `${Math.max(10, Math.min(100, s))}%` }} />
            ))}
          </span>
          <span className="aw-week-title">
            This week <ChevronRight size={14} aria-hidden="true" />
          </span>
        </button>
      </div>
    </section>
  );
}
