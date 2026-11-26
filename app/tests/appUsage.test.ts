import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import { demoApps, fmtMin, limitState, loadLimits, saveLimits, setLimit } from '../src/apps/appUsage';

describe('app usage', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    vault.lock();
    await vault.createVault('passphrase-123');
  });

  it('classifies usage against a limit', () => {
    expect(limitState(10)).toBe('none');
    expect(limitState(10, 60)).toBe('ok');
    expect(limitState(50, 60)).toBe('near');
    expect(limitState(60, 60)).toBe('over');
  });

  it('formats minutes in plain words', () => {
    expect(fmtMin(45)).toBe('45 min');
    expect(fmtMin(60)).toBe('1 h');
    expect(fmtMin(95)).toBe('1 h 35 min');
  });

  it('adds, replaces and removes limits, stored encrypted', async () => {
    const app = { pkg: 'com.instagram.android', label: 'Instagram' };
    let list = setLimit([], app, 30);
    list = setLimit(list, app, 45);
    expect(list).toEqual([{ ...app, minutes: 45 }]);
    await saveLimits(list);
    expect(await loadLimits()).toEqual(list);
    expect(JSON.stringify(await db.records.toArray())).not.toContain('instagram');
    expect(setLimit(list, app, null)).toEqual([]);
    await expect(saveLimits([{ ...app, minutes: 1 }])).rejects.toThrow();
  });

  it('has sample data for the browser', () => {
    const d = demoApps();
    expect(d.apps.length).toBeGreaterThan(3);
    expect(d.unlocks).toBeGreaterThan(0);
  });
});
