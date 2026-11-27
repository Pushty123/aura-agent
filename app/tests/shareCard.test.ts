import { describe, expect, it } from 'vitest';
import { buildPrivacySafeSummary } from '../src/summary/shareCard';

describe('privacy-safe summary card', () => {
  it('keeps only aggregate weekly metrics, score, trend, streak, and top win', () => {
    const summary = buildPrivacySafeSummary({
      score: 84.6,
      statusLabel: 'In balance',
      weekScores: [60, 68, 72, 75, 78, 82, 85],
      avgSleepHours: 7.34,
      avgSteps: 6420.4,
      avgScreenHours: 3.46,
      avgMood: 4.12,
      goalsMet: 2,
      goalsTotal: 3,
      streakLabel: 'Water goal',
      streakDays: 9,
      topWin: 'Sleep (+14% vs last week)',
      date: '2026-11-26',
      isDemo: true,
    });
    expect(summary).toEqual({
      score: 85,
      statusLabel: 'In balance',
      weekScores: [60, 68, 72, 75, 78, 82, 85],
      avgSleepHours: 7.3,
      avgSteps: 6420,
      avgScreenHours: 3.5,
      avgMood: 4.1,
      goalsMet: 2,
      goalsTotal: 3,
      streakLabel: 'Water goal',
      streakDays: 9,
      topWin: 'Sleep (+14% vs last week)',
      date: '2026-11-26',
      isDemo: true,
    });
  });

  it('provides calm defaults when score or streak are missing', () => {
    const summary = buildPrivacySafeSummary({ date: '2026-11-26' });
    expect(summary.score).toBeNull();
    expect(summary.statusLabel).toBe('Building baseline');
    expect(summary.weekScores).toEqual([]);
    expect(summary.streakDays).toBe(0);
    expect(summary.topWin).toBe('Consistent wellness tracking');
    expect(summary.isDemo).toBe(false);
  });
});
