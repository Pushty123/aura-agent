import { describe, expect, it } from 'vitest';
import { generateDemoData } from '../src/lib/demoData';
import { lateScreenSleep, sleepDebt } from '../src/insights/detectors';
import { runInsights } from '../src/insights/engine';
import { balanceScore } from '../src/insights/balance';
import { mad, median, permutationP, robustZ, spearman } from '../src/insights/stats';
import type { DayRecord } from '../src/types';

describe('stats', () => {
  it('median / MAD / robust z', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(mad([1, 2, 3, 4, 100])).toBe(1);
    expect(robustZ(100, [1, 2, 3, 4, 5, 6, 7])).toBeGreaterThan(5);
  });
  it('spearman handles perfect and inverse relationships and ties', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
    expect(Math.abs(spearman([1, 1, 2, 2], [1, 2, 1, 2]))).toBeLessThan(0.01);
  });
  it('permutation test is small for a strong link and large for noise', () => {
    const x = Array.from({ length: 20 }, (_, i) => i);
    expect(permutationP(x, x.map((v) => v * 2))).toBeLessThan(0.01);
    const noise = [5, 1, 9, 3, 7, 2, 8, 4, 6, 0, 5, 1, 9, 3, 7, 2, 8, 4, 6, 0];
    expect(permutationP(x, noise)).toBeGreaterThan(0.1);
  });
});

describe('detectors on demo data', () => {
  const days = generateDemoData('2026-11-24', 30);
  it('demo data is labelled as demo', () => {
    expect(days.every((d) => d.source === 'demo')).toBe(true);
  });
  it('finds the late-screen -> sleep pattern', () => {
    const i = lateScreenSleep(days);
    expect(i.notEnoughData).toBeUndefined();
    expect(i.evidence!.effect).toBeLessThan(0);
    expect(i.evidence!.p!).toBeLessThan(0.05);
    expect(i.suggestion).toBeTruthy();
  });
  it('says "not enough data" with fewer than 14 days', () => {
    const i = lateScreenSleep(days.slice(-10));
    expect(i.notEnoughData).toBe(true);
    expect(i.detail).toMatch(/Not enough data/);
  });
  it('flags a sleep debt and stays quiet when sleep is fine', () => {
    const base: DayRecord[] = Array.from({ length: 10 }, (_, i) => ({ date: `2026-11-${10 + i}`, sleepHours: 5.5, source: 'manual' as const }));
    expect(sleepDebt(base).title).toMatch(/debt/);
    const fine = base.map((d) => ({ ...d, sleepHours: 7.6 }));
    expect(sleepDebt(fine).title).toMatch(/on track/);
  });
  it('ranks and returns at most 3 insights', () => {
    const r = runInsights(days);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r[0].score).toBeGreaterThanOrEqual(r[r.length - 1].score);
  });
});

describe('balance score', () => {
  it('is between 0 and 100 and explains itself', () => {
    const days = generateDemoData('2026-11-24', 30);
    const b = balanceScore(days[days.length - 1], days.slice(0, -1));
    expect(b.score).toBeGreaterThanOrEqual(0);
    expect(b.score).toBeLessThanOrEqual(100);
    expect(b.reasons).toHaveLength(4);
  });
  it('scores an empty day low rather than crashing', () => {
    expect(balanceScore({ date: '2026-11-24', source: 'manual' }, []).score).toBe(0);
  });
});
