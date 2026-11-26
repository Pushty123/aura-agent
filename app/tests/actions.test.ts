import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import { applyQueuedActions, doneToday, queueAction } from '../src/reminders/actions';
import { loadDays } from '../src/lib/store';
import { today } from '../src/lib/dates';
import { completeGoal, loadGoals, logCustom, newGoal, progressFor, saveGoal, validateGoal, type Goal } from '../src/goals/goals';
import { actionFor, newReminder, TEMPLATES } from '../src/reminders/reminders';
import { ALL_APPS, phoneLimit } from '../src/apps/appUsage';

beforeEach(async () => {
  await db.meta.clear();
  await db.records.clear();
  vault.lock();
  await vault.createVault('passphrase-123');
});

describe('notification "Done" button', () => {
  it('logs water and counts the reminder as done', async () => {
    await queueAction({ action: 'water', rid: 'r1', ts: 1 });
    await queueAction({ action: 'water', rid: 'r1', ts: 2 });
    const msg = await applyQueuedActions();
    expect(msg).toContain('+1 glass');
    expect((await loadDays()).find((d) => d.date === today())?.waterGlasses).toBe(2);
    expect((await doneToday()).r1).toBe(2);
    expect(await applyQueuedActions()).toBeNull(); // queue emptied
  });
  it('completes a custom goal or habit', async () => {
    const g = { ...newGoal('Read', 'custom', 20), unit: 'pages', log: {} };
    const h = newGoal('Pray', 'habit');
    await saveGoal(g);
    await saveGoal(h);
    await queueAction({ action: `goal:${g.id}`, ts: 1 });
    await queueAction({ action: `goal:${h.id}`, ts: 2 });
    expect(await applyQueuedActions()).toContain('Read done');
    const all = await loadGoals();
    expect(all.find((x) => x.id === g.id)!.log![today()]).toBe(20);
    expect(all.find((x) => x.id === h.id)!.done).toContain(today());
  });
  it('picks the right action for each reminder', () => {
    expect(actionFor(TEMPLATES[0].make())).toBe('water');
    expect(actionFor(newReminder({ id: 'goal-g1', title: 'Read' }))).toBe('goal:g1');
    expect(actionFor(newReminder({ title: 'Stretch' }))).toBe('done');
  });
});

describe('custom goals', () => {
  it('needs a unit and logs amounts per day', async () => {
    expect(validateGoal({ title: 'Read', metric: 'custom', target: 20 })).toMatch(/unit/);
    let g: Goal = { ...newGoal('Read', 'custom', 20), unit: 'pages', log: {} };
    expect(validateGoal(g)).toBeNull();
    await saveGoal(g);
    g = await logCustom(g, '2026-11-26', 5);
    g = await logCustom(g, '2026-11-26', 10);
    expect(progressFor(g, undefined, '2026-11-26')).toMatchObject({ value: 15, pct: 75, met: false });
    g = await logCustom(g, '2026-11-26', -100);
    expect(g.log!['2026-11-26']).toBe(0);
    g = await completeGoal(g, '2026-11-26');
    expect(progressFor(g, undefined, '2026-11-26').met).toBe(true);
  });
  it('supports "at most" custom goals', () => {
    const g = { ...newGoal('Sweets', 'custom', 1, 'atMost'), unit: 'times', log: { d: 2 } };
    expect(progressFor(g, undefined, 'd').met).toBe(false);
  });
});

describe('phone limit', () => {
  it('reads the overall limit', () => {
    expect(phoneLimit([{ pkg: 'x', label: 'X', minutes: 30 }, { pkg: ALL_APPS, label: 'Phone', minutes: 240 }])).toBe(240);
    expect(phoneLimit([])).toBeUndefined();
  });
});
