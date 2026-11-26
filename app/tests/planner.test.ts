import { describe, expect, it } from 'vitest';
import { buildPlan, distractingApps, mergeLimits, parseDate, parseGoal } from '../src/goals/planner';
import type { DayRecord } from '../src/types';

const T = '2026-11-26';
const days: DayRecord[] = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-11-${String(19 + i).padStart(2, '0')}`,
  source: 'manual',
  screenMinutes: 300,
  steps: 5000,
  sleepHours: 6,
}));
const apps = [
  { pkg: 'com.instagram.android', label: 'Instagram', minutes: 96, opens: 40 },
  { pkg: 'com.google.android.youtube', label: 'YouTube', minutes: 70, opens: 12 },
  { pkg: 'com.whatsapp', label: 'WhatsApp', minutes: 60, opens: 50 },
  { pkg: 'com.google.android.apps.docs', label: 'Docs', minutes: 30, opens: 3 },
];

describe('date parsing', () => {
  it('understands common formats and rolls to the next year', () => {
    expect(parseDate('exams on 15 Dec', T)).toBe('2026-12-15');
    expect(parseDate('Dec 15th', T)).toBe('2026-12-15');
    expect(parseDate('15/12', T)).toBe('2026-12-15');
    expect(parseDate('boards on 2 March', T)).toBe('2027-03-02');
    expect(parseDate('2027-01-10', T)).toBe('2027-01-10');
    expect(parseDate('in 3 weeks', T)).toBe('2026-12-17');
    expect(parseDate('31/02', T)).toBeNull();
    expect(parseDate('get fit', T)).toBeNull();
  });
});

describe('goal parsing', () => {
  it('detects exams with subjects and hours', () => {
    const g = parseGoal('Exams on 15 Dec: Maths, Physics, Chemistry and English, 5 hours a day', T);
    expect(g.kind).toBe('exam');
    expect(g.subjects).toEqual(['Maths', 'Physics', 'Chemistry', 'English']);
    expect(g.hours).toBe(5);
    expect(parseGoal('Semester exams in 3 weeks, 4 subjects', T).subjects).toHaveLength(4);
  });
  it('detects other kinds', () => {
    expect(parseGoal('Reduce Instagram reels', T).kind).toBe('screen');
    expect(parseGoal('sleep better', T).kind).toBe('sleep');
    expect(parseGoal('lose 5 kg', T).kind).toBe('fitness');
    expect(parseGoal('read 20 pages daily', T).kind).toBe('habit');
  });
});

describe('plan builder', () => {
  it('builds an exam plan from the person’s own data', () => {
    const plan = buildPlan(parseGoal('Exams on 15 Dec: Maths, Physics, Chemistry', T), { today: T, days, apps });
    expect(plan.daysLeft).toBe(19);
    const screen = plan.goals.find((g) => g.metric === 'screenMinutes')!;
    expect(screen.target).toBe(195); // 300 * 0.65 -> 195
    expect(screen.endsOn).toBe('2026-12-15');
    expect(plan.goals.every((g) => g.planId === plan.id)).toBe(true);
    expect(plan.reminders.filter((r) => r.title.includes('Study block')).length).toBeGreaterThanOrEqual(2);
    expect(plan.reminders.every((r) => r.until === '2026-12-15')).toBe(true);
    expect(plan.limits.map((l) => l.label)).toEqual(['Instagram', 'YouTube']); // WhatsApp and Docs are not limited
    expect(plan.limits[0].minutes).toBe(45); // 96 * 0.5 = 48 -> capped at 45
    expect(plan.phases.map((p) => p.label)).toEqual(['Learn', 'Revise', 'Practice papers']);
    expect(plan.phases[plan.phases.length - 1].to).toBe('2026-12-14');
    expect(plan.timetable[0].task).toContain('Maths');
  });
  it('cuts harder close to the exam and needs a future date', () => {
    const near = buildPlan(parseGoal('test on 3 Dec', T), { today: T, days, apps });
    expect(near.goals.find((g) => g.metric === 'screenMinutes')!.target).toBe(150);
    expect(near.goals[0].title).toBe('Study 6 h');
    expect(() => buildPlan(parseGoal('exam', T), { today: T, days, apps })).toThrow(/date/);
    expect(() => buildPlan(parseGoal('exam on 2026-11-20', T), { today: T, days, apps })).toThrow(/past/);
  });
  it('works without any history', () => {
    const plan = buildPlan(parseGoal('get fit', T), { today: T, days: [], apps: [] });
    expect(plan.goals.find((g) => g.metric === 'steps')!.target).toBe(7000);
    expect(plan.until).toBe('2026-12-24');
  });
  it('keeps the stricter limit when merging', () => {
    expect(distractingApps(apps)).toHaveLength(2);
    const m = mergeLimits([{ pkg: 'a', label: 'A', minutes: 20 }], [{ pkg: 'a', label: 'A', minutes: 30 }, { pkg: 'b', label: 'B', minutes: 15 }]);
    expect(m).toEqual([{ pkg: 'a', label: 'A', minutes: 20 }, { pkg: 'b', label: 'B', minutes: 15 }]);
  });
});
