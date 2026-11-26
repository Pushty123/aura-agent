import type { DayRecord } from '../types';

/**
 * Streaks and badges from the person's own days. A streak counts back from
 * today; if today has no value yet it starts from yesterday, so a streak does
 * not look broken in the morning before anything is logged.
 */
export interface StreakDef {
  id: string;
  emoji: string;
  label: string;
  rule: string;
  /** undefined = no data that day; true/false = met or not. */
  met: (d: DayRecord) => boolean | undefined;
}

export const STREAKS: StreakDef[] = [
  { id: 'checkin', emoji: '📝', label: 'Check-in', rule: 'Log your mood', met: (d) => (d.mood !== undefined ? true : undefined) },
  { id: 'sleep', emoji: '🌙', label: 'Good sleep', rule: '7+ hours of sleep', met: (d) => (d.sleepHours === undefined ? undefined : d.sleepHours >= 7) },
  { id: 'steps', emoji: '👟', label: 'Active', rule: '8,000+ steps', met: (d) => (d.steps === undefined ? undefined : d.steps >= 8000) },
  { id: 'water', emoji: '💧', label: 'Hydrated', rule: '8+ glasses of water', met: (d) => (d.waterGlasses === undefined ? undefined : d.waterGlasses >= 8) },
  { id: 'screen', emoji: '📵', label: 'Screen smart', rule: 'Under 4 h screen time', met: (d) => (d.screenMinutes === undefined ? undefined : d.screenMinutes <= 240) },
  { id: 'nights', emoji: '🌌', label: 'Calm nights', rule: 'Under 15 min on screen after 11 pm', met: (d) => (d.lateScreenMin === undefined ? undefined : d.lateScreenMin <= 15) },
];

export const TIERS = [
  { days: 3, name: 'Bronze', color: '#d08c5b' },
  { days: 7, name: 'Silver', color: '#c0c7d6' },
  { days: 14, name: 'Gold', color: '#f5c542' },
  { days: 30, name: 'Diamond', color: '#7dd3fc' },
] as const;

export interface Streak {
  def: StreakDef;
  current: number;
  best: number;
  /** Highest tier reached by the best streak, or null. */
  tier: (typeof TIERS)[number] | null;
  /** Next tier to aim for from the current streak. */
  next: (typeof TIERS)[number] | null;
}

const shift = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function streaks(days: DayRecord[], today: string): Streak[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return STREAKS.map((def) => {
    let cur = 0;
    let date = today;
    const t = byDate.get(today);
    if (!t || def.met(t) === undefined) date = shift(today, -1);
    for (;;) {
      const d = byDate.get(date);
      if (!d || def.met(d) !== true) break;
      cur++;
      date = shift(date, -1);
    }
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of sorted) {
      const ok = def.met(d) === true;
      run = ok ? (prev && shift(prev, 1) === d.date ? run + 1 : 1) : 0;
      prev = ok ? d.date : null;
      best = Math.max(best, run);
    }
    best = Math.max(best, cur);
    const tier = [...TIERS].reverse().find((x) => best >= x.days) ?? null;
    const next = TIERS.find((x) => cur < x.days) ?? null;
    return { def, current: cur, best, tier, next };
  });
}

export const earnedCount = (s: Streak[]) => s.filter((x) => x.tier).length;
