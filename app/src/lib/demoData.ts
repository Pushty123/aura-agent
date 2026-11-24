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
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(endDate, -i);
    const lateScreenMin = Math.round(rand() < 0.45 ? 60 + rand() * 90 : rand() * 30);
    const sleepHours = Math.max(4.5, Math.min(9, 7.7 - 0.012 * lateScreenMin + (rand() - 0.5) * 0.8));
    const steps = Math.round(4500 + rand() * 6500);
    const screenMinutes = Math.round(200 + rand() * 220 + lateScreenMin * 0.5);
    const mood = Math.max(1, Math.min(5, Math.round(3 + (sleepHours - 7) * 0.8 + (rand() - 0.5)))) as DayRecord['mood'];
    out.push({
      date,
      sleepHours: Math.round(sleepHours * 100) / 100,
      steps,
      screenMinutes,
      lateScreenMin,
      mood,
      waterGlasses: Math.round(3 + rand() * 5),
      caffeineCups: Math.round(rand() * 3),
      workout: rand() < 0.35,
      source: 'demo',
    });
  }
  return out;
}
