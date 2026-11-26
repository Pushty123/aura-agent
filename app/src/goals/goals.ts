import { db } from '../lib/db';
import { getAll, putRecord } from '../lib/vault';
import type { DayRecord } from '../types';

/** Goals the person sets themselves. Stored encrypted, one record each. */
export type NumericMetric =
  | 'steps'
  | 'sleepHours'
  | 'waterGlasses'
  | 'exerciseMinutes'
  | 'screenMinutes'
  | 'caffeineCups'
  | 'kcal'
  | 'proteinG'
  | 'reps'
  | 'mood';
export type GoalMetric = NumericMetric | 'habit';

/** Everything a goal can be measured against for one date. */
export type DayValues = Partial<Record<NumericMetric, number>>;
export type Direction = 'atLeast' | 'atMost';

export interface Goal {
  id: string;
  title: string;
  metric: GoalMetric;
  target: number;
  direction: Direction;
  /** For habit goals: dates (YYYY-MM-DD) marked done. */
  done: string[];
  createdAt: number;
  /** Optional: aim for this many days a week instead of every day (1-7). */
  daysPerWeek?: number;
  /** Optional: daily reminder time (HH:MM) for this goal. */
  reminderTime?: string;
  /** Optional emoji shown on the card. */
  icon?: string;
  /** Set when the goal came from a plan (e.g. exams). */
  planId?: string;
  /** Last day the goal applies (YYYY-MM-DD); hidden after this. */
  endsOn?: string;
}

export const METRICS: Record<GoalMetric, { label: string; unit: string; target: number; direction: Direction; step: number }> = {
  steps: { label: 'Steps', unit: 'steps', target: 8000, direction: 'atLeast', step: 500 },
  sleepHours: { label: 'Sleep', unit: 'h', target: 7.5, direction: 'atLeast', step: 0.25 },
  waterGlasses: { label: 'Water', unit: 'glasses', target: 8, direction: 'atLeast', step: 1 },
  exerciseMinutes: { label: 'Exercise', unit: 'min', target: 30, direction: 'atLeast', step: 5 },
  screenMinutes: { label: 'Screen time', unit: 'min', target: 180, direction: 'atMost', step: 15 },
  caffeineCups: { label: 'Caffeine', unit: 'cups', target: 2, direction: 'atMost', step: 1 },
  kcal: { label: 'Calories (from Food log)', unit: 'kcal', target: 2000, direction: 'atMost', step: 50 },
  proteinG: { label: 'Protein (from Food log)', unit: 'g', target: 60, direction: 'atLeast', step: 5 },
  reps: { label: 'Workout reps (camera)', unit: 'reps', target: 30, direction: 'atLeast', step: 5 },
  mood: { label: 'Mood (1-5 check-in)', unit: '/ 5', target: 4, direction: 'atLeast', step: 1 },
  habit: { label: 'Daily habit (tick off)', unit: '', target: 1, direction: 'atLeast', step: 1 },
};

export function validateGoal(g: Pick<Goal, 'title' | 'metric' | 'target'> & Partial<Pick<Goal, 'daysPerWeek' | 'reminderTime'>>): string | null {
  if (!g.title.trim()) return 'Give the goal a name.';
  if (g.title.trim().length > 60) return 'Keep the name under 60 characters.';
  if (!(g.metric in METRICS)) return 'Pick what to track.';
  if (g.metric !== 'habit' && (!Number.isFinite(g.target) || g.target <= 0)) return 'The target must be a number above 0.';
  if (g.metric === 'sleepHours' && g.target > 14) return 'Sleep target must be 14 hours or less.';
  if (g.metric === 'mood' && g.target > 5) return 'Mood is rated 1 to 5.';
  if (g.daysPerWeek !== undefined && !(g.daysPerWeek >= 1 && g.daysPerWeek <= 7)) return 'Days a week must be 1 to 7.';
  if (g.reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(g.reminderTime)) return 'Pick a valid reminder time.';
  return null;
}

export function newGoal(title: string, metric: GoalMetric, target?: number, direction?: Direction): Goal {
  const m = METRICS[metric];
  return {
    id: `g${Date.now()}${Math.floor(Math.random() * 1000)}`,
    title: title.trim(),
    metric,
    target: metric === 'habit' ? 1 : target ?? m.target,
    direction: metric === 'habit' ? 'atLeast' : direction ?? m.direction,
    done: [],
    createdAt: Date.now(),
  };
}

export interface Progress {
  value: number | null;
  pct: number;
  met: boolean;
}

export function progressFor(g: Goal, day: DayValues | undefined, date: string): Progress {
  if (g.metric === 'habit') {
    const met = g.done.includes(date);
    return { value: met ? 1 : 0, pct: met ? 100 : 0, met };
  }
  const v = day?.[g.metric];
  if (typeof v !== 'number') return { value: null, pct: 0, met: false };
  if (g.direction === 'atLeast') {
    return { value: v, pct: Math.min(100, Math.round((v / g.target) * 100)), met: v >= g.target };
  }
  // "At most": full bar while under the limit, shrinking as it is exceeded.
  const met = v <= g.target;
  return { value: v, pct: met ? 100 : Math.max(0, Math.round((g.target / v) * 100)), met };
}

/** Combine day records, food log and camera workouts into per-date values. */
export function buildDayValues(
  days: DayRecord[],
  food: { date: string; kcal: number; proteinG: number }[] = [],
  workouts: { date: string; reps: number }[] = [],
): Map<string, DayValues & { date: string }> {
  const m = new Map<string, DayValues & { date: string }>();
  const get = (date: string) => {
    let v = m.get(date);
    if (!v) m.set(date, (v = { date }));
    return v;
  };
  for (const d of days) {
    const v = get(d.date);
    for (const k of ['steps', 'sleepHours', 'waterGlasses', 'exerciseMinutes', 'screenMinutes', 'caffeineCups', 'mood'] as const) {
      if (typeof d[k] === 'number') v[k] = d[k] as number;
    }
  }
  for (const f of food) {
    const v = get(f.date);
    v.kcal = (v.kcal ?? 0) + f.kcal;
    v.proteinG = Math.round(((v.proteinG ?? 0) + f.proteinG) * 10) / 10;
  }
  for (const w of workouts) {
    const v = get(w.date);
    v.reps = (v.reps ?? 0) + w.reps;
  }
  return m;
}

/** Monday-to-Sunday week containing `date`: how many days met. */
export function weekProgress(g: Goal, values: Map<string, DayValues>, date: string): { met: number; of: number } {
  const d = new Date(`${date}T12:00:00`);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  let met = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    if (key > date) break;
    if (progressFor(g, values.get(key), key).met) met++;
  }
  return { met, of: g.daysPerWeek ?? 7 };
}

/** Consecutive days met, counting back from `today` (today counts only if already met). */
export function streakFor(g: Goal, days: (DayValues & { date: string })[], today: string): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let n = 0;
  const d = new Date(`${today}T12:00:00`);
  if (!progressFor(g, byDate.get(today), today).met) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 366; i++) {
    const key = d.toISOString().slice(0, 10);
    if (!progressFor(g, byDate.get(key), key).met) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export async function loadGoals(): Promise<Goal[]> {
  return (await getAll<Goal>('goal')).sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveGoal(g: Goal): Promise<void> {
  const err = validateGoal(g);
  if (err) throw new Error(err);
  await putRecord('goal', g.id, g);
}

export async function deleteGoal(id: string): Promise<void> {
  await db.records.delete(`goal:${id}`);
}

export async function toggleHabit(g: Goal, date: string): Promise<Goal> {
  const done = g.done.includes(date) ? g.done.filter((d) => d !== date) : [...g.done, date].slice(-400);
  const next = { ...g, done };
  await saveGoal(next);
  return next;
}
