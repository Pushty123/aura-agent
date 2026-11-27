import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { createVault, lock } from '../src/lib/vault';
import {
  addMissedRoutineResponses,
  newRoutineItem,
  recordRoutineResponse,
  routineDailyProgress,
  routineNotificationItems,
  routineOccurrenceDate,
  routineForNotificationId,
  routineStreak,
  saveRoutineItems,
  saveRoutineResponses,
  loadRoutineItems,
  loadRoutineResponses,
} from '../src/reminders/routine';
import {
  addWaterGlass,
  changeWaterUnit,
  DEFAULT_WATER_SETTINGS,
  recordWaterResponse,
  removeWaterGlass,
  waterNotificationItems,
  waterProgress,
  waterReminderSlots,
  waterSlotForNotificationId,
  saveWaterSettings,
  loadWaterSettings,
  saveWaterResponses,
  loadWaterResponses,
} from '../src/reminders/water';

describe('routine reminders', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    lock();
    await createVault('passphrase-123');
  });

  it('creates weekday schedules and maps a button response to its scheduled day', () => {
    const item = newRoutineItem({
      id: 'walk',
      title: 'Walk',
      time: '09:30',
      days: [1, 3],
      activeFrom: '2026-11-26',
    });
    const notifications = routineNotificationItems([item]);
    expect(notifications.map((notification) => notification.schedule.on)).toEqual([
      { weekday: 2, hour: 9, minute: 30 },
      { weekday: 4, hour: 9, minute: 30 },
    ]);
    expect(routineForNotificationId([item], notifications[1].id)).toEqual({ item, weekday: 3 });
    expect(routineOccurrenceDate(4, '09:30', new Date(2026, 10, 26, 10, 0))).toBe('2026-11-26');
    expect(routineOccurrenceDate(4, '09:30', new Date(2026, 10, 26, 9, 0))).toBe('2026-11-19');
  });

  it('records missed items without counting them as completed', () => {
    const item = newRoutineItem({
      id: 'stretch',
      title: 'Stretch',
      time: '09:00',
      days: [4],
      activeFrom: '2026-11-26',
    });
    const now = new Date(2026, 10, 26, 10, 0);
    const missed = addMissedRoutineResponses([item], [], now);
    expect(missed).toMatchObject([{ routineId: 'stretch', date: '2026-11-26', status: 'no-response' }]);
    expect(routineDailyProgress([item], missed, '2026-11-26')).toEqual({ done: 0, total: 1, percent: 0 });
    const done = recordRoutineResponse(missed, 'stretch', '2026-11-26', 'done', now.toISOString());
    expect(routineDailyProgress([item], done, '2026-11-26')).toEqual({ done: 1, total: 1, percent: 100 });
    expect(routineStreak(done, '2026-11-26')).toBe(1);
  });

  it('saves routine settings and action responses encrypted in the vault', async () => {
    const item = newRoutineItem({ id: 'read', title: 'Read', time: '20:00', days: [1, 2] });
    await saveRoutineItems([item]);
    const responses = recordRoutineResponse([], item.id, '2026-11-26', 'not-now', '2026-11-26T20:01:00.000Z');
    await saveRoutineResponses(responses);
    expect(await loadRoutineItems()).toEqual([item]);
    expect(await loadRoutineResponses()).toEqual(responses);
    expect(JSON.stringify(await db.records.toArray())).not.toContain('Read');
  });
});

describe('water reminders', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    lock();
    await createVault('passphrase-123');
  });

  it('generates slots only inside active hours and schedules buttons for every weekday', () => {
    const settings = { ...DEFAULT_WATER_SETTINGS, enabled: true, intervalHours: 3, start: '08:00', end: '17:00' };
    expect(waterReminderSlots(settings)).toEqual([
      { hour: 8, minute: 0 },
      { hour: 11, minute: 0 },
      { hour: 14, minute: 0 },
      { hour: 17, minute: 0 },
    ]);
    const notifications = waterNotificationItems(settings);
    expect(notifications).toHaveLength(28);
    expect(notifications[0].actionTypeId).toBe('water-response');
    expect(notifications[0].schedule.on).toEqual({ weekday: 1, hour: 8, minute: 0 });
    expect(waterSlotForNotificationId(settings, notifications[0].id)).toEqual({ weekday: 0, hour: 8, minute: 0 });
  });

  it('calculates progress and adds a glass in both supported units', () => {
    const day = addWaterGlass({ waterGlasses: 2 });
    expect(day).toMatchObject({ waterGlasses: 3, waterMl: 750 });
    expect(removeWaterGlass(day)).toMatchObject({ waterGlasses: 2, waterMl: 500 });
    expect(waterProgress(day, { ...DEFAULT_WATER_SETTINGS, goal: 6 })).toMatchObject({ current: 3, percent: 50 });
    expect(waterProgress(day, { ...DEFAULT_WATER_SETTINGS, unit: 'ml', goal: 1000 })).toMatchObject({ current: 750, percent: 75 });
    expect(waterProgress({ waterGlasses: 10 }, { ...DEFAULT_WATER_SETTINGS, goal: 8 }).percent).toBe(100);
    expect(changeWaterUnit(DEFAULT_WATER_SETTINGS, 'ml')).toMatchObject({ goal: 2000, unit: 'ml' });
  });

  it('saves settings and water responses encrypted in the vault', async () => {
    const settings = { ...DEFAULT_WATER_SETTINGS, unit: 'ml' as const, goal: 1800, enabled: true };
    await saveWaterSettings(settings);
    const responses = recordWaterResponse([], '1:9:0', '2026-11-26', 'drank-water', '2026-11-26T09:00:00.000Z');
    await saveWaterResponses(responses);
    expect(await loadWaterSettings()).toEqual(settings);
    expect(await loadWaterResponses()).toEqual(responses);
    expect(JSON.stringify(await db.records.toArray())).not.toContain('1800');
  });
});
