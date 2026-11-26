import type { DayRecord } from '../types';
import { rng } from '../insights/stats';
import { addDays } from './dates';

/**
 * Pick the days with heavy caffeine (3+ cups), spread evenly through the history.
 * The effect lands on the NEXT night, so a heavy day is never the last day and
 * is never followed by a late-screen night (keeps the two patterns separate).
 */
function pickHeavyCaffeineDays(days: number, lateNightIndexes: Set<number>): Set<number> {
  const count = Math.round(days * 0.2);
  const picked = new Set<number>();
  for (let k = 0; k < count; k++) {
    let i = Math.floor(((k + 0.25) * days) / count);
    while (i < days - 1 && (picked.has(i) || lateNightIndexes.has(i + 1))) i++;
    if (i < days - 1) picked.add(i);
  }
  return picked;
}

/**
 * Seeded, clearly-labelled DEMO data (source: 'demo').
 * Two patterns are built in so the insight engine has something real to find:
 *  - Late-night screen time reduces sleep on the same night.
 *  - Heavy caffeine (3+ cups) makes the NEXT night's sleep about 30-45 minutes shorter.
 * Same seed, same output. Never present this as a real user's data.
 */
export function generateDemoData(endDate: string, days = 60, seed = 7): DayRecord[] {
  const rand = rng(seed);
  const out: DayRecord[] = [];
  const startDate = addDays(endDate, 1 - days);
  const lateNightCount = Math.min(9, Math.max(0, Math.round(days * 0.3)));
  const lateNightIndexes = new Set(
    Array.from({ length: lateNightCount }, (_, index) =>
      Math.floor(((index + 0.5) * days) / lateNightCount),
    ),
  );
  const heavyCaffeineIndexes = pickHeavyCaffeineDays(days, lateNightIndexes);

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    const isLateNight = lateNightIndexes.has(i);
    const isHeavyCaffeineDay = heavyCaffeineIndexes.has(i);
    const followsHeavyCaffeine = heavyCaffeineIndexes.has(i - 1);
    const lateScreenMin = Math.round(isLateNight ? 105 + rand() * 45 : 10 + rand() * 40);
    const baselineSleep = 7.4 + (isWeekend ? 0.3 : 0) + (rand() - 0.5) * 0.3;
    const caffeinePenalty = 0.5 + rand() * 0.25; // 30-45 minutes, drawn every day to keep the stream steady
    const sleepHours =
      baselineSleep -
      (isLateNight ? 0.75 + rand() * 0.5 : 0) -
      (followsHeavyCaffeine ? caffeinePenalty : 0);
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
      caffeineCups: isHeavyCaffeineDay ? 3 + Math.floor(rand() * 2) : Math.floor(rand() * 3),
      workout: rand() < (isWeekend ? 0.25 : 0.4),
      source: 'demo',
    });
  }
  return out;
}