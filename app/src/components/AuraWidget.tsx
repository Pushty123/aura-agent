import type { ReactNode } from 'react';
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
}

const MOODS = ['Low', 'Tired', 'Okay', 'Good', 'Great'];
const MOOD_EMOJI = ['😞', '🙁', '😐', '🙂', '😄'];
const R = 52;
const C = 2 * Math.PI * R;

const fmtMinutes = (m?: number) => {
  if (typeof m !== 'number') return '—';
  const t = Math.round(m);
  return `${Math.floor(t / 60)}h ${t % 60}m`;
};

function greeting(name?: string) {
  const h = new Date().getHours();
  const base = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const n = name?.trim().split(' ')[0];
  return n ? `${base}, ${n}!` : `${base}!`;
}

function Tile(props: { icon: string; value: string; label: string; onClick?: () => void }) {
  return (
    <button type="button" className="aw-tile" onClick={props.onClick} aria-label={`${props.label}: ${props.value}`}>
      <span className="aw-chev" aria-hidden="true">›</span>
      <span className="aw-icon" aria-hidden="true">{props.icon}</span>
      <span className="aw-value">{props.value}</span>
      <span className="aw-label">{props.label}</span>
    </button>
  );
}

export function AuraWidget(p: AuraWidgetProps) {
  const open = (s: Section) => () => p.onOpen?.(s);
  const score = typeof p.balanceScore === 'number' ? Math.max(0, Math.min(100, p.balanceScore)) : undefined;
  const offset = C * (1 - (score ?? 0) / 100);
  const bars = (p.weekScores ?? []).slice(-7);
  const status =
    score === undefined ? 'Not enough data yet' : score >= 70 ? "You're on track!" : score >= 40 ? 'Room to improve' : 'Keep logging';

  return (
    <section className="aw" aria-label="AURA daily overview">
      <svg className="aw-art" viewBox="0 0 240 120" aria-hidden="true">
        <circle cx="170" cy="40" r="26" fill="#fcd9a8" />
        <polygon points="0,120 70,50 110,85 150,45 240,120" fill="#3b3590" />
        <polygon points="60,120 130,70 175,100 215,65 240,85 240,120" fill="#272262" />
      </svg>

      <div className="aw-top">
        <div className="aw-brand">
          <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
            <defs>
              <linearGradient id="aw-logo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#a78bfa" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <path d="M24 4 L44 42 H32 L24 26 L16 42 H4 Z" fill="url(#aw-logo)" />
          </svg>
          <div>
            <h2 className="aw-name">AURA</h2>
            <p className="aw-tag">Your Health. Your Data. 🛡️</p>
          </div>
        </div>
        <span className="aw-badge">🔒 Encrypted on this device</span>
        {p.isDemo && <span className="aw-demo">DEMO</span>}
        {p.onSettings && <button type="button" className="aw-gear" onClick={p.onSettings} aria-label="Settings">⚙️</button>}
      </div>

      <h3 className="aw-hello">{greeting(p.name)}</h3>
      <p className="aw-sub">{p.subline ?? "Let's check your wellness today"}</p>
      {p.thought && (
        <div className="aw-thought">
          <span className="aw-thought-text">
            <span className="aw-thought-label">💭 Thought for today</span>
            <q>{p.thought}</q>
          </span>
          {p.onListen && (
            <button type="button" className="aw-listen" onClick={p.onListen} aria-label={p.listening ? 'Stop' : 'Listen to your daily brief'}>
              {p.listening ? '⏹' : '🔊'}
            </button>
          )}
        </div>
      )}

      <div className="aw-tiles">
        <Tile icon="🌙" value={fmtMinutes(typeof p.sleepHours === 'number' ? p.sleepHours * 60 : undefined)} label="Sleep" onClick={open('sleep')} />
        <Tile icon="👟" value={typeof p.steps === 'number' ? p.steps.toLocaleString() : '—'} label="Steps" onClick={open('steps')} />
        <Tile icon="📱" value={fmtMinutes(p.screenMinutes)} label="Screen Time" onClick={open('screen')} />
        <Tile icon={p.mood ? MOOD_EMOJI[p.mood - 1] : '😶'} value={p.mood ? MOODS[p.mood - 1] : '—'} label="Mood" onClick={open('mood')} />
      </div>

      <div className="aw-score">
        <div className={`aw-ring ${p.ringContent ? 'has-content' : ''}`} onClick={p.onRingClick} role={p.onRingClick ? 'button' : undefined} tabIndex={p.onRingClick ? 0 : undefined} aria-label={p.onRingClick ? 'Open your character' : undefined}>
          <svg viewBox="0 0 120 120" width="110" height="110" aria-hidden="true">
            <defs>
              <linearGradient id="aw-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c084fc" />
                <stop offset="1" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={R} fill="none" stroke="url(#aw-ring)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 60 60)"
            />
          </svg>
          {p.ringContent ? (
            <div className="aw-ring-content">{p.ringContent}</div>
          ) : (
            <div className="aw-ring-text">
              <strong>{score ?? '—'}</strong>
              <span>/100</span>
            </div>
          )}
        </div>
        <div className="aw-score-info">
          <h4>Balance Score</h4>
          {p.ringContent && <div className="aw-score-num">{score ?? '—'}<span>/100</span></div>}
          <p>{p.moodLabel ?? status}{score !== undefined && score >= 70 ? <span className="aw-up"> ↗</span> : null}</p>
        </div>
        <button type="button" className="aw-week" onClick={open('week')} aria-label="This week">
          <span className="aw-week-title">This Week ›</span>
          <span className="aw-bars" aria-hidden="true">
            {bars.map((s, i) => (
              <i key={i} style={{ height: `${Math.max(10, Math.min(100, s))}%` }} />
            ))}
          </span>
        </button>
      </div>
    </section>
  );
}