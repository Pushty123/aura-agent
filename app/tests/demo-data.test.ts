import { describe, expect, it } from 'vitest';
import { generateDemoData } from '../src/lib/demoData';
import { addDays } from '../src/lib/dates';

describe('demo data', () => {
  const days = generateDemoData('2026-11-24');

  it('contains exactly 30 consecutive DEMO days', () => {
    expect(days).toHaveLength(30);
    expect(days.every((day) => day.source === 'demo')).toBe(true);
    expect(generateDemoData('2026-11-24')).toEqual(days);
    expect(days[0].date).toBe('2026-10-26');
    for (let index = 1; index < days.length; index++) {
      expect(days[index].date).toBe(addDays(days[index - 1].date, 1));
    }
  });

  it('provides complete daily wellness values in sensible ranges', () => {
    const expectInRange = (value: number | undefined, minimum: number, maximum: number) => {
      expect(value).toBeDefined();
      expect(value ?? Number.NaN).toBeGreaterThanOrEqual(minimum);
      expect(value ?? Number.NaN).toBeLessThanOrEqual(maximum);
    };

    for (const day of days) {
      expectInRange(day.sleepHours, 4, 10);
      expectInRange(day.steps, 0, 40000);
      expectInRange(day.screenMinutes, 0, 1440);
      expectInRange(day.lateScreenMin, 0, 1440);
      expect(day.lateScreenMin ?? Number.NaN).toBeLessThanOrEqual(day.screenMinutes ?? Number.NaN);
      expectInRange(day.mood, 1, 5);
      expectInRange(day.waterGlasses, 0, 20);
      expectInRange(day.caffeineCups, 0, 10);
      expect(typeof day.workout).toBe('boolean');
    }
    expect(new Set(days.map((day) => day.mood)).size).toBeGreaterThan(1);
    expect(new Set(days.map((day) => day.steps)).size).toBeGreaterThan(1);
  });

  it('contains the late-screen and shorter-sleep pattern', () => {
    const lateNights = days.filter((day) => (day.lateScreenMin ?? 0) > 90);
    const lighterNights = days.filter((day) => (day.lateScreenMin ?? 0) <= 90);
    const meanSleep = (records: typeof days) =>
      records.reduce((total, day) => total + (day.sleepHours ?? 0), 0) / records.length;
    const sleepDifferenceMinutes = (meanSleep(lighterNights) - meanSleep(lateNights)) * 60;

    expect(lateNights.length).toBeGreaterThanOrEqual(8);
    expect(lateNights.length).toBeLessThanOrEqual(10);
    expect(sleepDifferenceMinutes).toBeGreaterThanOrEqual(45);
    expect(sleepDifferenceMinutes).toBeLessThanOrEqual(90);
  });
});
