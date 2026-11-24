import type { DayRecord, Insight } from '../types';
import { lateScreenSleep, sleepDebt } from './detectors';

/** Run every detector, drop nothing silently, rank by score. "Not enough data" placeholders sink to the bottom. */
export function runInsights(days: DayRecord[]): Insight[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const all = [lateScreenSleep(sorted), sleepDebt(sorted)];
  return all.sort((a, b) => b.score - a.score).slice(0, 3);
}
