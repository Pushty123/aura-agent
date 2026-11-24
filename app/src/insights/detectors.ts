import type { DayRecord, Insight } from '../types';
import { mean, median, permutationP, robustZ, spearman } from './stats';

/** Minimum days of data before a pattern insight is shown. */
export const MIN_DAYS = 14;

const fmtMin = (m: number) => {
  const a = Math.abs(Math.round(m));
  const h = Math.floor(a / 60);
  const r = a % 60;
  return h ? `${h} h ${r} min` : `${r} min`;
};

function confidenceFrom(p: number, n: number): Insight['confidence'] {
  if (p < 0.01 && n >= 21) return 'high';
  if (p < 0.05) return 'medium';
  return 'low';
}

/**
 * Detector 1 – late-night screen time vs sleep.
 * Compares nights with heavy late screen use against your own lighter nights.
 */
export function lateScreenSleep(days: DayRecord[]): Insight {
  const rows = days.filter((d) => d.sleepHours !== undefined && d.lateScreenMin !== undefined);
  if (rows.length < MIN_DAYS) {
    return {
      id: 'late-screen-sleep',
      title: 'Late screen time vs sleep',
      detail: `Not enough data yet: ${rows.length} of ${MIN_DAYS} days needed.`,
      confidence: 'low',
      score: 0,
      notEnoughData: true,
    };
  }
  const late = rows.map((r) => r.lateScreenMin as number);
  const sleep = rows.map((r) => r.sleepHours as number);
  const threshold = 60; // minutes of screen time after 23:00 that counts as "heavy"
  const heavy = rows.filter((r) => (r.lateScreenMin as number) >= threshold);
  const light = rows.filter((r) => (r.lateScreenMin as number) < threshold);
  if (heavy.length < 3 || light.length < 3) {
    return {
      id: 'late-screen-sleep',
      title: 'Late screen time vs sleep',
      detail: 'Not enough variety yet: need at least 3 heavy and 3 light screen nights.',
      confidence: 'low',
      score: 0,
      notEnoughData: true,
    };
  }
  const effectMin = (mean(heavy.map((r) => r.sleepHours as number)) - mean(light.map((r) => r.sleepHours as number))) * 60;
  const rho = spearman(late, sleep);
  const p = permutationP(late, sleep);
  const lightMean = mean(light.map((r) => r.sleepHours as number));
  const matched = heavy.filter((r) => (r.sleepHours as number) < lightMean).length;
  const worse = effectMin < 0 && p < 0.05;
  return {
    id: 'late-screen-sleep',
    title: worse ? 'Late screen time is costing you sleep' : 'Late screen time vs sleep',
    detail: worse
      ? `On nights with ${threshold}+ min of screen time after 11 pm you slept ${fmtMin(effectMin)} less than on your lighter nights (${matched} of ${heavy.length} heavy nights were below your usual).`
      : 'No clear link between late screen time and your sleep in this period.',
    evidence: { n: rows.length, effect: Math.round(effectMin), unit: 'min of sleep', rho: Math.round(rho * 100) / 100, p: Math.round(p * 1000) / 1000, matched },
    confidence: confidenceFrom(p, rows.length),
    suggestion: worse ? 'Try putting the phone down by 11 pm for a week and compare.' : undefined,
    score: worse ? Math.abs(rho) * (1 - p) * 100 : 5,
  };
}

/**
 * Detector 2 – sleep debt.
 * Last 7 days vs a 7.5 h target, plus how unusual the latest night is for YOU (robust z-score).
 */
export function sleepDebt(days: DayRecord[], targetHours = 7.5): Insight {
  const sleeps = days.filter((d) => d.sleepHours !== undefined).map((d) => d.sleepHours as number);
  if (sleeps.length < 7) {
    return {
      id: 'sleep-debt',
      title: 'Sleep debt',
      detail: `Not enough data yet: ${sleeps.length} of 7 nights needed.`,
      confidence: 'low',
      score: 0,
      notEnoughData: true,
    };
  }
  const last7 = sleeps.slice(-7);
  const avg = mean(last7);
  const debtMin = (targetHours - avg) * 60 * 7;
  const baseline = sleeps.slice(0, -1);
  const z = baseline.length >= 7 ? robustZ(sleeps[sleeps.length - 1], baseline) : 0;
  const inDebt = debtMin >= 7 * 20; // average more than 20 min short per night
  return {
    id: 'sleep-debt',
    title: inDebt ? 'You are running a sleep debt' : 'Sleep is on track',
    detail: inDebt
      ? `Over the last 7 nights you averaged ${avg.toFixed(1)} h against a ${targetHours} h target: about ${fmtMin(debtMin)} short in total.`
      : `Over the last 7 nights you averaged ${avg.toFixed(1)} h, close to your ${targetHours} h target.`,
    evidence: { n: last7.length, effect: -Math.round(debtMin), unit: 'min short in 7 nights' },
    confidence: last7.length >= 7 ? 'medium' : 'low',
    suggestion: inDebt ? 'Move bedtime 20–30 minutes earlier for the next 3 nights.' : undefined,
    score: inDebt ? Math.min(100, debtMin / 4) + Math.abs(z) : 3,
  };
}

/** Median helper re-exported for goal setting. */
export { median };
