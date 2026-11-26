import { db } from '../lib/db';
import { getAll, putRecord } from '../lib/vault';
import type { DayRecord } from '../types';

/** Goals the person sets themselves. Stored encrypted, one record each. */
export type GoalMetric = 'steps' | 'sleepHours' | 'waterGlasses' | 'exerciseMinutes' | 'screenMinutes' | 'caffeineCups' | 'habit';
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
}

export const METRICS: Record<GoalMetric, { label: string; unit: string; target: number; direction: Direction; step: number }> = {
  steps: { label: 'Steps', unit: 'steps', target: 8000, direction: 'atLeast', step: 500 },
  sleepHours: { label: 'Sleep', unit: 'h', target: 7.5, direction: 'atLeast', step: 0.25 },
  waterGlasses: { label: 'Water', unit: 'glasses', target: 8, direction: 'atLeast', step: 1 },
  exerciseMinutes: { label: 'Exercise', unit: 'min', target: 30, direction: 'atLeast', step: 5 },
  screenMinutes: { label: 'Screen time', unit: 'min', target: 180, direction: 'atMost', step: 15 },
  caffeineCups: { label: 'Caffeine', unit: 'cups', target: 2, direction: 'atMost', step: 1 },
  habit: { label: 'Daily habit (tick off)', unit: '', target: 1, direction: 'atLeast', step: 1 },
};

export function validateGoal(g: Pick<Goal, 'title' | 'metric' | 'target'>): string | null {
  if (!g.title.trim()) return 'Give the goal a name.';
  if (g.title.trim().length > 60) return 'Keep the name under 60 characters.';
  if (!(g.metric in METRICS)) return 'Pick what to track.';
  if (g.metric !== 'habit' && (!Number.isFinite(g.target) || g.target <= 0)) return 'The target must be a number above 0.';
  if (g.metric === 'sleepHours' && g.target > 14) return 'Sleep target must be 14 hours or less.';
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

export function progressFor(g: Goal, day: DayRecord | undefined, date: string): Progress {
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

/** Consecutive days met, counting back from `today` (today counts only if already met). */
export function streakFor(g: Goal, days: DayRecord[], today: string): number {
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
