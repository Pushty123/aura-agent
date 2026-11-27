import { db } from '../lib/db';
import { getAll, putRecord } from '../lib/vault';
import { hasPermission } from '../lib/permissions';

/**
 * Period calendar. Stored encrypted; never included in AI summaries.
 * Predictions are simple averages: an estimate, not medical advice and not
 * a method of contraception.
 */
export interface Period {
  id: string;
  start: string; // YYYY-MM-DD
  end?: string; // inclusive
  flow?: 'light' | 'medium' | 'heavy';
}

const DAY = 86_400_000;
const toDate = (s: string) => new Date(`${s}T12:00:00`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
export const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);

export interface CycleStats {
  cycleLength: number | null; // average days between starts
  periodLength: number | null; // average days bleeding
  nextStart: string | null;
  nextEnd: string | null;
  fertileFrom: string | null;
  fertileTo: string | null;
  irregular: boolean;
  samples: number;
}

export function cycleStats(periods: Period[]): CycleStats {
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = diffDays(sorted[i - 1].start, sorted[i].start);
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  const recent = gaps.slice(-6);
  const lens = sorted.filter((p) => p.end).map((p) => diffDays(p.start, p.end!) + 1).filter((n) => n >= 1 && n <= 14).slice(-6);
  const cycleLength = recent.length ? Math.round(recent.reduce((s, x) => s + x, 0) / recent.length) : null;
  const periodLength = lens.length ? Math.round(lens.reduce((s, x) => s + x, 0) / lens.length) : null;
  const last = sorted[sorted.length - 1];
  const assumed = cycleLength ?? (sorted.length ? 28 : null);
  const nextStart = last && assumed ? addDays(last.start, assumed) : null;
  const nextEnd = nextStart ? addDays(nextStart, (periodLength ?? 5) - 1) : null;
  const ovulation = nextStart ? addDays(nextStart, -14) : null;
  return {
    cycleLength,
    periodLength,
    nextStart,
    nextEnd,
    fertileFrom: ovulation ? addDays(ovulation, -5) : null,
    fertileTo: ovulation ? addDays(ovulation, 1) : null,
    irregular: recent.length >= 3 && Math.max(...recent) - Math.min(...recent) > 7,
    samples: recent.length,
  };
}

export type DayMark = 'period' | 'predicted' | 'fertile' | null;

export function markFor(date: string, periods: Period[], stats: CycleStats, today: string): DayMark {
  for (const p of periods) {
    const end = p.end ?? (p.start <= today ? (diffDays(p.start, today) < 10 ? today : addDays(p.start, 4)) : p.start);
    if (date >= p.start && date <= end) return 'period';
  }
  if (stats.nextStart && stats.nextEnd && date >= stats.nextStart && date <= stats.nextEnd) return 'predicted';
  if (stats.fertileFrom && stats.fertileTo && date >= stats.fertileFrom && date <= stats.fertileTo) return 'fertile';
  return null;
}

/** The period that covers `date`, if any (an open period counts up to today). */
export function periodOn(date: string, periods: Period[], today: string): Period | undefined {
  return periods.find((p) => date >= p.start && date <= (p.end ?? today));
}

export function newPeriod(start: string, end?: string, flow?: Period['flow']): Period {
  return { id: `c${Date.now()}${Math.floor(Math.random() * 1000)}`, start, end, flow };
}

export async function loadPeriods(): Promise<Period[]> {
  if (!(await hasPermission('healthRecords'))) return [];
  return (await getAll<Period>('cycle')).sort((a, b) => a.start.localeCompare(b.start));
}

export async function savePeriod(p: Period): Promise<void> {
  if (p.end && p.end < p.start) throw new Error('The end date must be on or after the start date.');
  await putRecord('cycle', p.id, p);
}

export async function deletePeriod(id: string): Promise<void> {
  await db.records.delete(`cycle:${id}`);
}

export async function getCycleEnabled(): Promise<boolean> {
  return (await db.meta.get('cycle-enabled'))?.value === 'on';
}

export async function setCycleEnabled(on: boolean): Promise<void> {
  await db.meta.put({ key: 'cycle-enabled', value: on ? 'on' : 'off' });
}
