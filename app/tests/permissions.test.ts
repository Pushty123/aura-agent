import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { getPermissions, PERMISSIONS, setPermission } from '../src/lib/permissions';
import { loadDays, saveDay } from '../src/lib/store';
import { createVault, lock } from '../src/lib/vault';

describe('encrypted data permissions', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    lock();
    await createVault('passphrase-123');
  });

  it('defaults every source off and stores permission choices encrypted', async () => {
    const defaults = await getPermissions();
    expect(PERMISSIONS).toHaveLength(10);
    expect(Object.values(defaults).every((enabled) => !enabled)).toBe(true);

    await setPermission('heartRate', true);
    expect((await getPermissions()).heartRate).toBe(true);
    expect(JSON.stringify(await db.records.get('settings:permissions'))).not.toContain('"heartRate":true');
  });

  it('removes disabled device readings without deleting unrelated or manually entered metrics', async () => {
    await saveDay({
      date: '2026-11-26',
      source: 'device',
      screenMinutes: 120,
      lateScreenMin: 20,
      sleepHours: 7,
      steps: 5000,
      exerciseMinutes: 30,
      waterGlasses: 4,
      manualFields: ['sleepHours'],
    });
    await saveDay({
      date: '2026-11-27',
      source: 'device',
      steps: 4000,
      manualFields: ['steps'],
    });
    await setPermission('usage', false);
    await setPermission('sleep', false);
    await setPermission('steps', false);

    const days = await loadDays();
    expect(days.find((day) => day.date === '2026-11-26')).toEqual({
      date: '2026-11-26',
      source: 'device',
      sleepHours: 7,
      waterGlasses: 4,
      manualFields: ['sleepHours'],
    });
    expect(days.find((day) => day.date === '2026-11-27')).toEqual({
      date: '2026-11-27',
      source: 'device',
      steps: 4000,
      manualFields: ['steps'],
    });
  });
});
