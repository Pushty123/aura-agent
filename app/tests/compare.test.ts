import { describe, expect, it } from 'vitest';
import { bestAndWorst, compareWeeks, reportText } from '../src/summary/compare';
import type { DayRecord } from '../src/types';

const mk = (date: string, sleepHours: number, steps: number, screenMinutes: number): DayRecord => ({ date, source: 'manual', sleepHours, steps, screenMinutes });
const days: DayRecord[] = [];
for (let i = 1; i <= 14; i++) {
  const date = `2026-11-${String(12 + i).padStart(2, '0')}`;
  days.push(i <= 7 ? mk(date, 6, 5000, 360) : mk(date, 7, 6000, 300));
}

describe('weekly comparison', () => {
  it('compares this week with last week and marks what is better', () => {
    const r = compareWeeks(days, '2026-11-26');
    const sleep = r.find((x) => x.key === 'sleepHours')!;
    expect(sleep.now).toBe(7);
    expect(sleep.prev).toBe(6);
    expect(sleep.change).toBe(17);
    expect(sleep.better).toBe(true);
    const screen = r.find((x) => x.key === 'screenMinutes')!;
    expect(screen.change).toBe(-17);
    expect(screen.better).toBe(true); // less screen time is better
    expect(r.some((x) => x.key === 'mood')).toBe(false); // no data -> not shown
  });
  it('finds best and hardest day and builds share text', () => {
    const d = [...days];
    d[13] = mk('2026-11-26', 8.5, 11000, 120);
    d[12] = mk('2026-11-25', 4, 1000, 600);
    const bw = bestAndWorst(d, '2026-11-26');
    expect(bw.best?.date).toBe('2026-11-26');
    expect(bw.worst?.date).toBe('2026-11-25');
    expect(reportText(compareWeeks(d, '2026-11-26'), '2026-11-26')).toContain('vs last week');
  });
});
