import { describe, expect, it } from 'vitest';
import { weeklySummary } from '../src/summary/weekly';
import { generateDemoData } from '../src/lib/demoData';

describe('weeklySummary', () => {
  it('returns an honest empty state when there are no records', () => {
    const res = weeklySummary([]);
    expect(res.hasEnoughData).toBe(false);
    expect(res.avgSleepHours).toBeNull();
    expect(res.bestDay).toBeNull();
    expect(res.sentences[0]).toContain('Not enough data');
  });

  it('summarizes the last 7 days of demo data accurately', () => {
    const days = generateDemoData('2026-11-25', 14, 7);
    const res = weeklySummary(days);
    expect(res.hasEnoughData).toBe(true);
    expect(res.daysCount).toBe(7);
    expect(res.avgSleepHours).not.toBeNull();
    expect(res.bestDay).not.toBeNull();
    expect(res.highestScreenDay).not.toBeNull();
    expect(res.sentences.length).toBeGreaterThanOrEqual(3);
  });
});
