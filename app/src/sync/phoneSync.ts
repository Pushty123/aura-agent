import { db } from '../lib/db';
import { getConsent, putRecord, getRecord, setConsent, audit } from '../lib/vault';
import { loadDays, saveDay } from '../lib/store';
import { getHealth, getUsage, type HealthDay, type UsageDay } from '../native/bridge';
import type { DayRecord } from '../types';

/**
 * Pulls phone and band data (screen time via Android usage stats, steps/sleep/
 * heart rate/exercise via Health Connect) into encrypted day records.
 *
 * Rules: your own manual entries are never overwritten; real data replaces a
 * demo day; empty values are skipped instead of stored as zeros.
 */
export type SyncPrefs = { screen: boolean; health: boolean };
export type OriginKind = 'steps' | 'sleep' | 'heartRate' | 'exercise';
export type Origins = Record<OriginKind, string[]>;

export interface SourceReport {
  state: 'synced' | 'needs-permission' | 'unavailable' | 'off' | 'error';
  days: number;
  message?: string;
}

export interface SyncReport {
  at: number;
  screen: SourceReport;
  health: SourceReport & { origins: Origins };
}

const NO_ORIGINS: Origins = { steps: [], sleep: [], heartRate: [], exercise: [] };

const LABELS: Record<string, string> = {
  'com.mi.health': 'Mi Fitness',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.noisefit': 'NoiseFit',
  'com.oneplus.health': 'OnePlus Health',
  'com.heytap.health': 'HeyTap Health',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.android.healthconnect.controller': 'Health Connect',
};

export function originLabel(pkg: string): string {
  return LABELS[pkg] ?? pkg;
}

const round = (n: number, dp = 0) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Health Connect day -> day-record fields. Zeros are skipped; sleep under 2 h is treated as a nap. */
export function healthToPatch(h: HealthDay): Partial<DayRecord> {
  const p: Partial<DayRecord> = {};
  if (h.steps && h.steps > 0) p.steps = Math.round(h.steps);
  if (h.sleepMinutes && h.sleepMinutes >= 120) p.sleepHours = round(h.sleepMinutes / 60, 1);
  if (h.avgHeartRate && h.avgHeartRate > 0) p.avgHeartRate = Math.round(h.avgHeartRate);
  if (h.exerciseMinutes && h.exerciseMinutes > 0) p.exerciseMinutes = Math.round(h.exerciseMinutes);
  return p;
}

export function usageToPatch(u: UsageDay): Partial<DayRecord> {
  if (!(u.screenMinutes > 0)) return {};
  return { screenMinutes: Math.round(u.screenMinutes), lateScreenMin: Math.max(0, Math.round(u.lateScreenMin)) };
}

export function unionOrigins(days: HealthDay[]): Origins {
  const out: Origins = { steps: [], sleep: [], heartRate: [], exercise: [] };
  for (const d of days)
    for (const k of Object.keys(out) as OriginKind[])
      for (const pkg of d.origins?.[k] ?? []) if (!out[k].includes(pkg)) out[k].push(pkg);
  return out;
}

/** Merge new device values into a day without touching the person's own entries. */
export function mergeDeviceDay(date: string, existing: DayRecord | undefined, patch: Partial<DayRecord>): DayRecord {
  if (!existing || existing.source === 'demo') return { ...patch, date, source: 'device' };
  const out: DayRecord = { ...existing };
  const keepOwn = existing.source === 'manual';
  for (const [k, v] of Object.entries(patch) as [keyof DayRecord, never][]) {
    if (v === undefined || k === 'date' || k === 'source') continue;
    if (keepOwn && existing[k] !== undefined) continue;
    (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

export async function getSyncPrefs(): Promise<SyncPrefs> {
  const row = await db.meta.get('sync-prefs');
  return { screen: true, health: true, ...(row ? JSON.parse(row.value) : {}) };
}

export async function setSyncPrefs(p: SyncPrefs): Promise<void> {
  await db.meta.put({ key: 'sync-prefs', value: JSON.stringify(p) });
}

export async function loadLastSync(): Promise<SyncReport | null> {
  return (await getRecord<SyncReport>('settings', 'sync-summary')) ?? null;
}

const off = (): SourceReport => ({ state: 'off', days: 0 });

export async function syncPhoneData(opts: { days?: number; interactive?: boolean } = {}): Promise<SyncReport> {
  const days = opts.days ?? 7;
  const interactive = opts.interactive ?? false;
  const consent = await getConsent();
  if (!consent.device && !interactive) {
    return { at: Date.now(), screen: off(), health: { ...off(), origins: NO_ORIGINS } };
  }
  if (interactive && !consent.device) await setConsent('device', true);

  const prefs = await getSyncPrefs();
  const patches = new Map<string, Partial<DayRecord>>();
  const add = (date: string, p: Partial<DayRecord>) => {
    if (Object.keys(p).length) patches.set(date, { ...(patches.get(date) ?? {}), ...p });
  };

  let screen: SourceReport = off();
  if (prefs.screen) {
    const r = await getUsage(days, interactive);
    if (r.ok) {
      for (const u of r.days) add(u.date, usageToPatch(u));
      screen = { state: 'synced', days: r.days.length };
    } else {
      screen = { state: r.reason === 'permission' ? 'needs-permission' : r.reason === 'error' ? 'error' : 'unavailable', days: 0, message: r.message };
    }
  }

  let health: SourceReport & { origins: Origins } = { ...off(), origins: NO_ORIGINS };
  if (prefs.health) {
    const r = await getHealth(days);
    if (r.ok) {
      for (const h of r.days) add(h.date, healthToPatch(h));
      health = { state: 'synced', days: r.days.length, origins: unionOrigins(r.days) };
    } else {
      health = {
        state: r.reason === 'permission' ? 'needs-permission' : r.reason === 'error' ? 'error' : 'unavailable',
        days: 0,
        message: r.message,
        origins: NO_ORIGINS,
      };
    }
  }

  if (patches.size) {
    const existing = new Map((await loadDays()).map((d) => [d.date, d]));
    for (const [date, p] of patches) await saveDay(mergeDeviceDay(date, existing.get(date), p));
  }

  const report: SyncReport = { at: Date.now(), screen, health };
  if (screen.state === 'synced' || health.state === 'synced' || interactive) {
    await putRecord('settings', 'sync-summary', report);
    await audit('device.sync', `screen ${screen.state} (${screen.days} d), health ${health.state} (${health.days} d)`);
  }
  return report;
}
