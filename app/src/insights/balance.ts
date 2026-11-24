import type { DayRecord } from '../types';
import { median } from './stats';

export interface Balance {
  score: number; // 0-100
  reasons: { label: string; points: number; max: number; note: string }[];
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/**
 * Balance Score (0-100) for one day, compared with YOUR recent baseline where possible.
 *   sleep 40 pts · movement 30 pts · screen time 20 pts · check-in habits 10 pts
 */
export function balanceScore(day: DayRecord, history: DayRecord[]): Balance {
  const reasons: Balance['reasons'] = [];

  const sleep = day.sleepHours;
  const sleepPts = sleep === undefined ? 0 : 40 * clamp(1 - Math.abs(sleep - 8) / 3);
  reasons.push({
    label: 'Sleep',
    points: Math.round(sleepPts),
    max: 40,
    note: sleep === undefined ? 'No sleep data' : `${sleep.toFixed(1)} h (best near 7–9 h)`,
  });

  const stepHist = history.map((h) => h.steps).filter((x): x is number => x !== undefined);
  const stepTarget = Math.max(6000, Math.min(10000, stepHist.length >= 7 ? median(stepHist) * 1.1 : 8000));
  const stepPts = day.steps === undefined ? 0 : 30 * clamp(day.steps / stepTarget);
  reasons.push({
    label: 'Movement',
    points: Math.round(stepPts),
    max: 30,
    note: day.steps === undefined ? 'No step data' : `${day.steps.toLocaleString()} steps (target ${Math.round(stepTarget).toLocaleString()})`,
  });

  const screenHist = history.map((h) => h.screenMinutes).filter((x): x is number => x !== undefined);
  const screenBase = screenHist.length >= 7 ? median(screenHist) : 300;
  const screenPts = day.screenMinutes === undefined ? 0 : 20 * clamp(1 - (day.screenMinutes - screenBase) / screenBase);
  reasons.push({
    label: 'Screen time',
    points: Math.round(screenPts),
    max: 20,
    note: day.screenMinutes === undefined ? 'No screen-time data' : `${Math.round(day.screenMinutes)} min (your usual ${Math.round(screenBase)} min)`,
  });

  const habits = [day.mood !== undefined, day.waterGlasses !== undefined, day.workout !== undefined].filter(Boolean).length;
  const habitPts = (habits / 3) * 10;
  reasons.push({ label: 'Check-in', points: Math.round(habitPts), max: 10, note: `${habits} of 3 logged` });

  const score = Math.round(sleepPts + stepPts + screenPts + habitPts);
  return { score: clamp(score, 0, 100), reasons };
}
