import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuraNotification } from '../src/native/bridge';

vi.mock('../src/native/bridge', () => ({ scheduleReminders: vi.fn(async (items: AuraNotification[]) => ({ ok: true, count: items.length, message: '' })) }));

import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import * as bridge from '../src/native/bridge';
import { deleteGoal, loadGoals, newGoal, progressFor, saveGoal, streakFor, toggleHabit, validateGoal } from '../src/goals/goals';
import { applyReminders, loadReminders, newReminder, notificationId, slotsFor, suggestFromData, TEMPLATES, validateReminder } from '../src/reminders/reminders';
import { newRoutineItem, saveRoutineItems } from '../src/reminders/routine';
import { DEFAULT_WATER_SETTINGS, saveWaterSettings } from '../src/reminders/water';
import { newPersonalGoal, savePersonalGoals } from '../src/goals/personalGoals';
import { addDays, today } from '../src/lib/dates';
import type { DayRecord } from '../src/types';

const day = (date: string, p: Partial<DayRecord>): DayRecord => ({ date, source: 'manual', ...p });

describe('custom goals', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    vault.lock();
    await vault.createVault('passphrase-123');
  });

  it('measures "at least" and "at most" goals', () => {
    const water = newGoal('Water', 'waterGlasses', 8);
    expect(progressFor(water, day('d', { waterGlasses: 6 }), 'd')).toEqual({ value: 6, pct: 75, met: false });
    const screen = newGoal('Less phone', 'screenMinutes', 120);
    expect(progressFor(screen, day('d', { screenMinutes: 90 }), 'd')).toMatchObject({ met: true, pct: 100 });
    expect(progressFor(screen, day('d', { screenMinutes: 240 }), 'd')).toMatchObject({ met: false, pct: 50 });
    expect(progressFor(water, undefined, 'd')).toEqual({ value: null, pct: 0, met: false });
  });

  it('counts streaks back from today', () => {
    const g = newGoal('Walk', 'steps', 5000);
    const days = [day('2026-11-22', { steps: 9000 }), day('2026-11-23', { steps: 6000 }), day('2026-11-24', { steps: 7000 }), day('2026-11-25', { steps: 100 })];
    expect(streakFor(g, days, '2026-11-24')).toBe(3);
    expect(streakFor(g, days, '2026-11-25')).toBe(3); // today not met yet does not break it
    expect(streakFor(g, days, '2026-11-26')).toBe(0);
  });

  it('validates, saves encrypted, ticks habits and deletes', async () => {
    expect(validateGoal({ title: ' ', metric: 'steps', target: 1 })).toContain('name');
    expect(validateGoal({ title: 'x', metric: 'steps', target: 0 })).toContain('above 0');
    const g = newGoal('Meditate', 'habit');
    await saveGoal(g);
    expect(JSON.stringify(await db.records.toArray())).not.toContain('Meditate');
    const t = await toggleHabit(g, '2026-11-26');
    expect(progressFor(t, undefined, '2026-11-26').met).toBe(true);
    expect((await loadGoals())[0].done).toEqual(['2026-11-26']);
    await deleteGoal(g.id);
    expect(await loadGoals()).toEqual([]);
  });
});

describe('reminders', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    vault.lock();
    await vault.createVault('passphrase-123');
    vi.mocked(bridge.scheduleReminders).mockClear();
  });

  it('turns an interval into times through the day', () => {
    const water = TEMPLATES.find((t) => t.key === 'water')!.make();
    expect(slotsFor(water).map((s) => `${s.hour}:${s.minute}`)).toEqual(['9:0', '11:0', '13:0', '15:0', '17:0', '19:0', '21:0']);
    expect(slotsFor(newReminder({ title: 'x', time: '22:30' }))).toEqual([{ hour: 22, minute: 30 }]);
  });

  it('validates times', () => {
    expect(validateReminder(newReminder({ title: 'x', time: '25:00' }))).toBeTruthy();
    expect(validateReminder(newReminder({ title: 'x', kind: 'interval', start: '20:00', end: '09:00' }))).toContain('after');
    expect(validateReminder(newReminder({ title: 'x', time: '07:15' }))).toBeNull();
  });

  it('gives stable, distinct notification ids', () => {
    expect(notificationId('r1', 0)).toBe(notificationId('r1', 0));
    expect(notificationId('r1', 0)).not.toBe(notificationId('r1', 1));
    expect(notificationId('r1', 0)).toBeGreaterThan(0);
  });

  it('schedules only enabled reminders and stores them encrypted', async () => {
    const a = TEMPLATES[0].make();
    const b = { ...TEMPLATES[1].make(), enabled: false };
    await applyReminders([a, b]);
    const items = vi.mocked(bridge.scheduleReminders).mock.calls[0][0];
    expect(items).toHaveLength(slotsFor(a).length);
    expect((await loadReminders()).length).toBe(2);
    expect(JSON.stringify(await db.records.toArray())).not.toContain('Drink water');
  });

  it('reschedules routine and water notifications alongside existing reminders', async () => {
    const routine = newRoutineItem({ id: 'walk', title: 'Walk', time: '10:00', days: [1, 4] });
    await saveRoutineItems([routine]);
    await saveWaterSettings({ ...DEFAULT_WATER_SETTINGS, enabled: true, start: '11:00', end: '11:01' });

    await applyReminders([]);

    const scheduled = vi.mocked(bridge.scheduleReminders).mock.calls[0][0];
    expect(scheduled).toHaveLength(2 + 7);
    expect(scheduled.filter((item) => item.extra.kind === 'routine')).toHaveLength(2);
    expect(scheduled.filter((item) => item.extra.kind === 'water')).toHaveLength(7);
  });

  it('includes optional future goal-date notifications in the existing local schedule', async () => {
    const goal = newPersonalGoal({
      id: 'walk-more',
      title: 'Walk more',
      targetDate: addDays(today(), 1),
      reminderEnabled: true,
    });
    await savePersonalGoals([goal]);

    await applyReminders([]);

    const scheduled = vi.mocked(bridge.scheduleReminders).mock.calls[0][0];
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].extra).toMatchObject({ kind: 'goal-date', goalId: goal.id });
  });

  it('suggests reminders from patterns, without repeating existing ones', () => {
    const days = Array.from({ length: 7 }, (_, i) => day(`2026-11-2${i}`, { lateScreenMin: 50, waterGlasses: 4, steps: 4000 }));
    expect(suggestFromData(days, []).map((s) => s.key).sort()).toEqual(['move', 'water', 'wind']);
    const existing = [TEMPLATES[0].make()];
    expect(suggestFromData(days, existing).map((s) => s.key)).not.toContain('water');
  });
});
