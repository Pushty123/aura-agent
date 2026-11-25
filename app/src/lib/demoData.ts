import type { DayRecord } from '../types';
import { rng } from '../insights/stats';
import { addDays } from './dates';

/**
 * Seeded, clearly-labelled DEMO data (source: 'demo').
 * Late-night screen time reduces sleep in this data set, so the demo has a real
 * pattern for the insight engine to find. Never present this as a real user's data.
 */
export function generateDemoData(endDate: string, days = 30, seed = 7): DayRecord[] {
  const rand = rng(seed);
  const out: DayRecord[] = [];
  const startDate = addDays(endDate, 1 - days);
  const lateNightCount = Math.min(9, Math.max(0, Math.round(days * 0.3)));
  const lateNightIndexes = new Set(
    Array.from({ length: lateNightCount }, (_, index) =>
      Math.floor(((index + 0.5) * days) / lateNightCount),
    ),
  );

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    const isLateNight = lateNightIndexes.has(i);
    const lateScreenMin = Math.round(isLateNight ? 105 + rand() * 45 : 10 + rand() * 40);
    const baselineSleep = 7.4 + (isWeekend ? 0.3 : 0) + (rand() - 0.5) * 0.3;
    const sleepHours = baselineSleep - (isLateNight ? 0.75 + rand() * 0.5 : 0);
    const steps = Math.round((isWeekend ? 3500 : 5500) + rand() * (isWeekend ? 4000 : 4500));
    const screenMinutes = Math.round((isWeekend ? 200 : 160) + rand() * (isWeekend ? 170 : 140) + lateScreenMin);
    const mood = Math.max(1, Math.min(5, Math.round(3 + (sleepHours - 7) * 0.8 + (rand() - 0.5) * 2))) as DayRecord['mood'];
    out.push({
      date,
      sleepHours: Math.round(sleepHours * 100) / 100,
      steps,
      screenMinutes,
      lateScreenMin,
      mood,
      waterGlasses: Math.round(3 + rand() * 5),
      caffeineCups: Math.round(rand() * 3),
      workout: rand() < (isWeekend ? 0.25 : 0.4),
      source: 'demo',
    });
  }
  return out;
}
