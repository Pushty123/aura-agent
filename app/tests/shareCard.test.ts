import { describe, expect, it } from 'vitest';
import { buildPrivacySafeSummary } from '../src/summary/shareCard';

describe('privacy-safe summary card', () => {
  it('keeps only score, streak, top win and date with clamped values', () => {
    const summary = buildPrivacySafeSummary({
      score: 84.6,
      streakLabel: 'Water goal',
      streakDays: 9,
      topWin: 'Sleep (+14% vs last week)',
      date: '2026-11-26',
      isDemo: true,
    });
    expect(summary).toEqual({
      score: 85,
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
    expect(summary.streakDays).toBe(0);
    expect(summary.topWin).toBe('Consistent wellness tracking');
    expect(summary.isDemo).toBe(false);
  });
});
