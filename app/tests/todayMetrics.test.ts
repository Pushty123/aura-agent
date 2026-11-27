import { describe, expect, it } from 'vitest';
import { DEFAULT_PERMISSIONS, type Permissions } from '../src/lib/permissions';
import { todayMetrics } from '../src/home/todayMetrics';

const byKind = (metrics: ReturnType<typeof todayMetrics>, kind: string) => metrics.find((metric) => metric.kind === kind);

describe('Today metric data', () => {
  it('does not expose device readings when their permissions are off or invent missing values', () => {
    const metrics = todayMetrics({
      date: '2026-11-26',
      source: 'device',
      avgHeartRate: 72,
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      sleepHours: 7,
      steps: 8000,
      exerciseMinutes: 30,
    }, [], DEFAULT_PERMISSIONS, []);

    expect(byKind(metrics, 'heart')).toBeUndefined();
    expect(byKind(metrics, 'blood-pressure')).toBeUndefined();
    expect(byKind(metrics, 'sleep')?.value).toBe('No data yet');
    expect(byKind(metrics, 'steps')?.value).toBe('No data yet');
    expect(byKind(metrics, 'exercise')?.value).toBe('No data yet');
    expect(byKind(metrics, 'water')?.value).toBe('No data yet');
  });

  it('shows real enabled readings and clearly labels demo values', () => {
    const permissions: Permissions = { ...DEFAULT_PERMISSIONS, heartRate: true, steps: true, sleep: true };
    const metrics = todayMetrics({
      date: '2026-11-26',
      source: 'demo',
      avgHeartRate: 71,
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      sleepHours: 7.5,
      steps: 8420,
      mood: 4,
      waterGlasses: 3,
    }, [], permissions, []);

    expect(byKind(metrics, 'heart')).toMatchObject({ value: 71, demo: true });
    expect(byKind(metrics, 'blood-pressure')).toMatchObject({ value: '118/76', demo: true });
    expect(byKind(metrics, 'sleep')).toMatchObject({ value: 7.5, demo: true });
    expect(byKind(metrics, 'steps')).toMatchObject({ value: '8,420', demo: true });
    expect(byKind(metrics, 'mood')).toMatchObject({ value: 'Good', demo: true });
  });
});
