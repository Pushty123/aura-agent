import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/native/bridge', () => ({ updateWidget: vi.fn(async () => true), clearWidget: vi.fn(async () => undefined) }));

import { db } from '../src/lib/db';
import * as bridge from '../src/native/bridge';
import { buildSnapshot, getWidgetPrefs, setWidgetPrefs, syncWidget, turnWidgetOff } from '../src/widget/widget';
import type { DayRecord } from '../src/types';
import { createVault, lock } from '../src/lib/vault';
import { setPermission } from '../src/lib/permissions';

const days: DayRecord[] = [
  { date: '2026-11-24', source: 'manual', sleepHours: 7, steps: 6000, screenMinutes: 200 },
  { date: '2026-11-25', source: 'device', sleepHours: 7.6, steps: 9120, screenMinutes: 186 },
];
const at = new Date(2026, 10, 25, 9, 5);

describe('widget snapshot', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    lock();
    await createVault('widget-test-passphrase');
    vi.mocked(bridge.updateWidget).mockClear();
    vi.mocked(bridge.clearWidget).mockClear();
  });

  it('shows the latest score, mood and numbers', () => {
    const s = buildSnapshot(days, { enabled: true, showNumbers: true }, at);
    expect(s.score).toBeGreaterThan(0);
    expect(s).toMatchObject({ sleep: '7.6 h', steps: '9,120', screen: '3.1 h', updated: 'Updated 09:05', demo: false });
    expect(s.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('hides the numbers in score-only mode', () => {
    const s = buildSnapshot(days, { enabled: true, showNumbers: false }, at);
    expect([s.sleep, s.steps, s.screen]).toEqual(['–', '–', '–']);
    expect(s.score).toBeGreaterThan(0);
  });

  it('handles no data and flags demo data', () => {
    expect(buildSnapshot([], { enabled: true, showNumbers: true }, at)).toMatchObject({ score: -1, mood: 'Open AURA to start' });
    expect(buildSnapshot([{ date: 'd', source: 'demo', sleepHours: 7 }], { enabled: true, showNumbers: true }, at).demo).toBe(true);
  });

  it('is on by default so a placed widget shows data, and does not push when turned off', async () => {
    expect((await getWidgetPrefs()).enabled).toBe(true);
    await setPermission('usage', true);
    await setPermission('sleep', true);
    await setPermission('steps', true);
    await syncWidget(days);
    expect(bridge.updateWidget).toHaveBeenCalledTimes(1);
    await setWidgetPrefs({ enabled: false, showNumbers: true });
    expect(await syncWidget(days)).toBeNull();
    expect(bridge.updateWidget).toHaveBeenCalledTimes(1);
  });

  it('does not expose device metrics to the widget when their permissions are off', async () => {
    const snapshot = await syncWidget(days);
    expect(snapshot).toMatchObject({ sleep: '–', steps: '–', screen: '–' });
  });

  it('turning off clears the widget', async () => {
    await setWidgetPrefs({ enabled: true, showNumbers: true });
    await turnWidgetOff();
    expect((await getWidgetPrefs()).enabled).toBe(false);
    expect(bridge.clearWidget).toHaveBeenCalled();
  });
});
