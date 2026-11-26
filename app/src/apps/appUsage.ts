import { getRecord, putRecord } from '../lib/vault';
import type { AppLimit, AppUse } from '../native/bridge';

/** Daily per-app limits, stored encrypted; the phone checks them in the background. */
export async function loadLimits(): Promise<AppLimit[]> {
  return (await getRecord<AppLimit[]>('settings', 'app-limits')) ?? [];
}

export async function saveLimits(list: AppLimit[]): Promise<void> {
  for (const l of list) {
    if (!l.pkg || !(l.minutes >= 5 && l.minutes <= 24 * 60)) throw new Error('A limit must be between 5 minutes and 24 hours.');
  }
  await putRecord('settings', 'app-limits', list);
}

export function setLimit(list: AppLimit[], app: Pick<AppUse, 'pkg' | 'label'>, minutes: number | null): AppLimit[] {
  const rest = list.filter((l) => l.pkg !== app.pkg);
  return minutes === null ? rest : [...rest, { pkg: app.pkg, label: app.label, minutes }];
}

/** Pseudo-package for the overall daily phone limit (all apps together). */
export const ALL_APPS = '__all__';

export const phoneLimit = (limits: AppLimit[]) => limits.find((l) => l.pkg === ALL_APPS)?.minutes;

export type LimitState = 'none' | 'ok' | 'near' | 'over';

export function limitState(used: number, limit?: number): LimitState {
  if (!limit) return 'none';
  if (used >= limit) return 'over';
  if (used >= limit * 0.8) return 'near';
  return 'ok';
}

export function fmtMin(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Clearly labelled sample data so the screen can be shown in the browser. */
export function demoApps(): { apps: AppUse[]; unlocks: number } {
  const apps: [string, string, number, number][] = [
    ['com.instagram.android', 'Instagram', 96, 41],
    ['com.google.android.youtube', 'YouTube', 74, 12],
    ['com.whatsapp', 'WhatsApp', 58, 63],
    ['com.android.chrome', 'Chrome', 35, 18],
    ['com.spotify.music', 'Spotify', 22, 6],
    ['com.google.android.gm', 'Gmail', 9, 8],
  ];
  return {
    apps: apps.map(([pkg, label, minutes, opens]) => ({ pkg, label, minutes, opens })),
    unlocks: 74,
  };
}
