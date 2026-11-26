import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/native/bridge', () => ({
  getUsage: vi.fn(),
  getHealth: vi.fn(),
}));

import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import { loadDays, saveDay } from '../src/lib/store';
import * as bridge from '../src/native/bridge';
import {
  healthToPatch,
  loadLastSync,
  mergeDeviceDay,
  originLabel,
  syncPhoneData,
  unionOrigins,
  usageToPatch,
} from '../src/sync/phoneSync';
import type { DayRecord } from '../src/types';

const usage = vi.mocked(bridge.getUsage);
const health = vi.mocked(bridge.getHealth);
const noOrigins = { steps: [], sleep: [], heartRate: [], exercise: [] };

describe('pure helpers', () => {
  it('converts Health Connect days, skipping zeros and naps', () => {
    expect(healthToPatch({ date: 'd', steps: 8123.4, sleepMinutes: 431, avgHeartRate: 71.6, exerciseMinutes: 35, origins: noOrigins })).toEqual({
      steps: 8123,
      sleepHours: 7.2,
      avgHeartRate: 72,
      exerciseMinutes: 35,
    });
    expect(healthToPatch({ date: 'd', steps: 0, sleepMinutes: 45, origins: noOrigins })).toEqual({});
  });

  it('skips usage days with no data but keeps a true zero of late screen time', () => {
    expect(usageToPatch({ date: 'd', screenMinutes: 0, lateScreenMin: 0 })).toEqual({});
    expect(usageToPatch({ date: 'd', screenMinutes: 210.4, lateScreenMin: 0 })).toEqual({ screenMinutes: 210, lateScreenMin: 0 });
  });

  it('names band apps in plain words and merges origins', () => {
    expect(originLabel('com.mi.health')).toBe('Mi Fitness');
    expect(originLabel('com.unknown.app')).toBe('com.unknown.app');
    const o = unionOrigins([
      { date: 'a', origins: { ...noOrigins, steps: ['com.mi.health'] } },
      { date: 'b', origins: { ...noOrigins, steps: ['com.mi.health', 'com.google.android.apps.fitness'] } },
    ]);
    expect(o.steps).toEqual(['com.mi.health', 'com.google.android.apps.fitness']);
  });

  it('never overwrites what the person typed, but fills gaps', () => {
    const mine: DayRecord = { date: 'd', source: 'manual', sleepHours: 6 };
    const m = mergeDeviceDay('d', mine, { sleepHours: 8, steps: 5000 });
    expect(m).toMatchObject({ sleepHours: 6, steps: 5000, source: 'manual' });
  });

  it('real data replaces a demo day completely', () => {
    const demo: DayRecord = { date: 'd', source: 'demo', sleepHours: 5, mood: 3, caffeineCups: 2 };
    expect(mergeDeviceDay('d', demo, { steps: 4000 })).toEqual({ date: 'd', source: 'device', steps: 4000 });
  });

  it('updates earlier device values with newer ones', () => {
    const old: DayRecord = { date: 'd', source: 'device', steps: 1000 };
    expect(mergeDeviceDay('d', old, { steps: 7000 }).steps).toBe(7000);
  });
});

describe('syncPhoneData', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    vault.lock();
    await vault.createVault('passphrase-123');
    usage.mockReset();
    health.mockReset();
  });

  it('does nothing in the background until the person has allowed device data', async () => {
    const r = await syncPhoneData({ interactive: false });
    expect(r.screen.state).toBe('off');
    expect(usage).not.toHaveBeenCalled();
    expect(health).not.toHaveBeenCalled();
  });

  it('interactive sync turns consent on, stores merged days and remembers sources', async () => {
    usage.mockResolvedValue({ ok: true, days: [{ date: '2026-11-25', screenMinutes: 300, lateScreenMin: 40 }] });
    health.mockResolvedValue({
      ok: true,
      days: [{ date: '2026-11-25', steps: 9000, sleepMinutes: 420, avgHeartRate: 70, origins: { ...noOrigins, steps: ['com.mi.health'], sleep: ['com.mi.health'] } }],
    });
    await saveDay({ date: '2026-11-25', source: 'manual', mood: 4 });

    const r = await syncPhoneData({ interactive: true });
    expect(r.screen.state).toBe('synced');
    expect(r.health.origins.steps).toEqual(['com.mi.health']);
    expect((await vault.getConsent()).device).toBe(true);

    const day = (await loadDays()).find((d) => d.date === '2026-11-25')!;
    expect(day).toMatchObject({ mood: 4, steps: 9000, sleepHours: 7, screenMinutes: 300, lateScreenMin: 40, avgHeartRate: 70 });
    expect((await loadLastSync())?.health.state).toBe('synced');
    expect(await vault.verifyAudit()).toBe(true);
  });

  it('reports missing permission without failing, and keeps the other source working', async () => {
    usage.mockResolvedValue({ ok: false, reason: 'permission', message: 'Allow Usage access' });
    health.mockResolvedValue({ ok: true, days: [{ date: '2026-11-25', steps: 4000, origins: noOrigins }] });
    const r = await syncPhoneData({ interactive: true });
    expect(r.screen.state).toBe('needs-permission');
    expect(r.health.state).toBe('synced');
    expect((await loadDays())[0].steps).toBe(4000);
  });

  it('respects per-source switches', async () => {
    const { setSyncPrefs } = await import('../src/sync/phoneSync');
    await setSyncPrefs({ screen: false, health: true });
    health.mockResolvedValue({ ok: true, days: [] });
    const r = await syncPhoneData({ interactive: true });
    expect(usage).not.toHaveBeenCalled();
    expect(r.screen.state).toBe('off');
  });
});
