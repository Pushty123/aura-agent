import type { DayRecord } from '../types';
import { balanceScore } from '../insights/balance';
import { mean } from '../insights/stats';

export interface WeeklySummaryResult {
  hasEnoughData: boolean;
  daysCount: number;
  avgSleepHours: number | null;
  bestDay: { date: string; score: number } | null;
  highestScreenDay: { date: string; minutes: number } | null;
  sentences: string[];
  suggestion: string;
}

/**
 * Pure 7-day summary from the user's own recent records.
 * Never invents numbers when fields are missing.
 */
export function weeklySummary(days: DayRecord[]): WeeklySummaryResult {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-7);

  if (recent.length === 0) {
    return {
      hasEnoughData: false,
      daysCount: 0,
      avgSleepHours: null,
      bestDay: null,
      highestScreenDay: null,
      sentences: ['Not enough data yet for a 7-day summary. Log a check-in or load demo data to get started.'],
      suggestion: 'Complete a 10-second check-in today to begin tracking your week.',
    };
  }

  const sleepVals = recent.map((d) => d.sleepHours).filter((v): v is number => v !== undefined);
  const avgSleepHours = sleepVals.length > 0 ? Math.round(mean(sleepVals) * 10) / 10 : null;

  let bestDay: { date: string; score: number } | null = null;
  for (let i = 0; i < recent.length; i++) {
    const score = balanceScore(recent[i], sorted).score;
    if (!bestDay || score > bestDay.score) {
      bestDay = { date: recent[i].date, score };
    }
  }

  let highestScreenDay: { date: string; minutes: number } | null = null;
  for (const d of recent) {
    if (d.screenMinutes !== undefined && (!highestScreenDay || d.screenMinutes > highestScreenDay.minutes)) {
      highestScreenDay = { date: d.date, minutes: d.screenMinutes };
    }
  }

  const sentences: string[] = [];
  if (avgSleepHours !== null) {
    sentences.push(`You averaged ${avgSleepHours.toFixed(1)} h of sleep across ${sleepVals.length} night${sleepVals.length === 1 ? '' : 's'}.`);
  } else {
    sentences.push('Sleep was not logged in the last 7 days.');
  }

  if (bestDay) {
    sentences.push(`Your strongest day was ${bestDay.date} with a Balance Score of ${bestDay.score}/100.`);
  }

  if (highestScreenDay) {
    const hrs = (highestScreenDay.minutes / 60).toFixed(1);
    sentences.push(`Your highest screen time was ${hrs} h (${Math.round(highestScreenDay.minutes)} min) on ${highestScreenDay.date}.`);
  }

  let suggestion = 'Keep logging consistently so AURA can spot clearer weekly patterns.';
  const lateNights = recent.filter((d) => (d.lateScreenMin ?? 0) >= 60).length;
  if (lateNights >= 2) {
    suggestion = `You had ${lateNights} nights with 60+ min of late screen time—try winding down earlier tonight.`;
  } else if (avgSleepHours !== null && avgSleepHours < 7) {
    suggestion = 'Your 7-day sleep average is under 7 h. Aiming for 30 minutes earlier to bed could help.';
  } else if (recent.some((d) => d.steps !== undefined)) {
    const stepVals = recent.map((d) => d.steps).filter((v): v is number => v !== undefined);
    if (stepVals.length > 0 && mean(stepVals) < 6000) {
      suggestion = 'A short 15-minute walk today would lift your weekly movement baseline.';
    }
  }

  return {
    hasEnoughData: recent.length >= 3,
    daysCount: recent.length,
    avgSleepHours,
    bestDay,
    highestScreenDay,
    sentences,
    suggestion,
  };
}
