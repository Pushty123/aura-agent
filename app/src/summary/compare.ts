import type { DayRecord } from '../types';

/** This week (last 7 days ending `date`) compared with the 7 days before. */
export interface CompareRow {
  key: 'sleepHours' | 'steps' | 'screenMinutes' | 'lateScreenMin' | 'mood' | 'waterGlasses' | 'exerciseMinutes';
  label: string;
  emoji: string;
  now: number | null;
  prev: number | null;
  /** Percent change, rounded; null if either week has no data. */
  change: number | null;
  /** true if the change is good for the person. */
  better: boolean | null;
  fmt: (v: number) => string;
}

const DEF: { key: CompareRow['key']; label: string; emoji: string; up: boolean; fmt: (v: number) => string }[] = [
  { key: 'sleepHours', label: 'Sleep', emoji: '🌙', up: true, fmt: (v) => `${v.toFixed(1)} h` },
  { key: 'steps', label: 'Steps', emoji: '👟', up: true, fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'screenMinutes', label: 'Screen time', emoji: '📱', up: false, fmt: (v) => `${(v / 60).toFixed(1)} h` },
  { key: 'lateScreenMin', label: 'Screen after 11 pm', emoji: '🌃', up: false, fmt: (v) => `${Math.round(v)} min` },
  { key: 'mood', label: 'Mood', emoji: '🙂', up: true, fmt: (v) => `${v.toFixed(1)}/5` },
  { key: 'waterGlasses', label: 'Water', emoji: '💧', up: true, fmt: (v) => `${v.toFixed(1)} glasses` },
  { key: 'exerciseMinutes', label: 'Exercise', emoji: '💪', up: true, fmt: (v) => `${Math.round(v)} min` },
];

const shift = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function avg(days: DayRecord[], key: CompareRow['key']): number | null {
  const v = days.map((d) => d[key]).filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function compareWeeks(days: DayRecord[], date: string): CompareRow[] {
  const thisFrom = shift(date, -6);
  const prevFrom = shift(date, -13);
  const now = days.filter((d) => d.date >= thisFrom && d.date <= date);
  const prev = days.filter((d) => d.date >= prevFrom && d.date < thisFrom);
  return DEF.map(({ key, label, emoji, up, fmt }) => {
    const a = avg(now, key);
    const b = avg(prev, key);
    const change = a !== null && b !== null && b !== 0 ? Math.round(((a - b) / b) * 100) : null;
    const better = change === null || change === 0 ? null : up ? change > 0 : change < 0;
    return { key, label, emoji, now: a, prev: b, change, better, fmt };
  }).filter((r) => r.now !== null);
}

/** Best and hardest day of the last 7, by a simple score the person can understand. */
export function bestAndWorst(days: DayRecord[], date: string): { best?: DayRecord; worst?: DayRecord } {
  const week = days.filter((d) => d.date >= shift(date, -6) && d.date <= date);
  const score = (d: DayRecord) =>
    (d.sleepHours !== undefined ? Math.min(d.sleepHours / 8, 1) * 40 : 0) +
    (d.steps !== undefined ? Math.min(d.steps / 8000, 1) * 30 : 0) +
    (d.screenMinutes !== undefined ? Math.max(0, 1 - d.screenMinutes / 600) * 20 : 0) +
    (d.mood !== undefined ? (d.mood / 5) * 10 : 0);
  const scored = week.filter((d) => d.sleepHours !== undefined || d.steps !== undefined).sort((a, b) => score(b) - score(a));
  return scored.length >= 2 ? { best: scored[0], worst: scored[scored.length - 1] } : {};
}

/** Plain-text report for sharing (no raw records, just this summary). */
export function reportText(rows: CompareRow[], date: string, extra: string[] = []): string {
  const lines = [`My AURA weekly report (week ending ${date})`];
  for (const r of rows)
    lines.push(`${r.emoji} ${r.label}: ${r.fmt(r.now!)}${r.change !== null ? ` (${r.change > 0 ? '+' : ''}${r.change}% vs last week)` : ''}`);
  return [...lines, ...extra].join('\n');
}
