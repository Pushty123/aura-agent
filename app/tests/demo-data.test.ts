import { describe, expect, it } from 'vitest';
import { generateDemoData } from '../src/lib/demoData';
import { addDays } from '../src/lib/dates';

const meanSleep = (records: { sleepHours?: number }[]) =>
  records.reduce((total, day) => total + (day.sleepHours ?? 0), 0) / records.length;

describe('demo data', () => {
  const days = generateDemoData('2026-11-24');
  const followsHeavy = (index: number) => (days[index - 1]?.caffeineCups ?? 0) >= 3;

  it('contains 60 consecutive DEMO days by default and is deterministic', () => {
    expect(days).toHaveLength(60);
    expect(days.every((day) => day.source === 'demo')).toBe(true);
    expect(generateDemoData('2026-11-24')).toEqual(days);
    expect(generateDemoData('2026-11-24', 60, 8)).not.toEqual(days);
    expect(days[0].date).toBe(addDays('2026-11-24', -59));
    expect(days[59].date).toBe('2026-11-24');
    for (let index = 1; index < days.length; index++) {
      expect(days[index].date).toBe(addDays(days[index - 1].date, 1));
    }
  });

  it('still works with 30 days', () => {
    const month = generateDemoData('2026-11-24', 30);
    expect(month).toHaveLength(30);
    expect(month[0].date).toBe('2026-10-26');
    expect(month.every((day) => day.source === 'demo')).toBe(true);
    expect(month.filter((day) => (day.caffeineCups ?? 0) >= 3).length).toBeGreaterThanOrEqual(3);
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
    // Nights after heavy caffeine are left out so only the late-screen effect is measured.
    const clean = days.filter((_, index) => !followsHeavy(index));
    const lateNights = clean.filter((day) => (day.lateScreenMin ?? 0) > 90);
    const lighterNights = clean.filter((day) => (day.lateScreenMin ?? 0) <= 90);
    const sleepDifferenceMinutes = (meanSleep(lighterNights) - meanSleep(lateNights)) * 60;

    expect(days.filter((day) => (day.lateScreenMin ?? 0) > 90).length).toBeGreaterThanOrEqual(8);
    expect(days.filter((day) => (day.lateScreenMin ?? 0) > 90).length).toBeLessThanOrEqual(10);
    expect(sleepDifferenceMinutes).toBeGreaterThanOrEqual(45);
    expect(sleepDifferenceMinutes).toBeLessThanOrEqual(90);
  });

  it('has heavy-caffeine days followed by shorter sleep on the NEXT date', () => {
    const heavyDays = days.filter((day) => (day.caffeineCups ?? 0) >= 3);
    expect(heavyDays.length).toBeGreaterThanOrEqual(8);
    expect(heavyDays.length).toBeLessThanOrEqual(14);
    expect(days.filter((day) => (day.caffeineCups ?? 0) < 3).every((day) => (day.caffeineCups ?? 0) <= 2)).toBe(true);

    // Compare next-night sleep, leaving out late-screen nights so only caffeine differs.
    const afterHeavy = days.filter((day, index) => followsHeavy(index) && (day.lateScreenMin ?? 0) <= 90);
    const afterOther = days.filter((day, index) => index > 0 && !followsHeavy(index) && (day.lateScreenMin ?? 0) <= 90);
    const differenceMinutes = (meanSleep(afterOther) - meanSleep(afterHeavy)) * 60;

    expect(afterHeavy.length).toBeGreaterThanOrEqual(8);
    expect(differenceMinutes).toBeGreaterThanOrEqual(25);
    expect(differenceMinutes).toBeLessThanOrEqual(50);
  });
});