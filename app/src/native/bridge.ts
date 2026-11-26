import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Command } from '../commands/parse';

/**
 * One interface for everything that needs Android. On the web (or if a native
 * plugin is missing) each method degrades gracefully so the app always works.
 *
 * Native side: see docs/ANDROID_PLUGIN.md for the Kotlin `AuraNative` plugin
 * (usage stats, alarm and calendar intents).
 */
export interface UsageDay {
  date: string;
  screenMinutes: number;
  lateScreenMin: number;
}

export interface HealthDay {
  date: string;
  steps?: number;
  sleepMinutes?: number;
  avgHeartRate?: number;
  exerciseMinutes?: number;
  /** Android package names of the apps that wrote each kind of data (e.g. a band's app). */
  origins: { steps: string[]; sleep: string[]; heartRate: string[]; exercise: string[] };
}

export type HealthState = 'web' | 'unavailable' | 'needs-update' | 'needs-permission' | 'ready';
export type UsageState = 'web' | 'needs-permission' | 'ready';

interface AuraNativePlugin {
  hasUsageAccess(): Promise<{ granted: boolean }>;
  openUsageAccessSettings(): Promise<void>;
  getUsageStats(opts: { days: number }): Promise<{ days: UsageDay[] }>;
  healthStatus(): Promise<{ status: 'available' | 'needs-update' | 'unavailable'; granted: boolean }>;
  requestHealthPermissions(): Promise<{ granted: boolean }>;
  openHealthConnect(): Promise<void>;
  getHealthData(opts: { days: number }): Promise<{ days: HealthDay[] }>;
  setAlarm(opts: { hour: number; minute: number; label: string }): Promise<void>;
  addCalendarEvent(opts: { title: string; startMillis: number }): Promise<void>;
}

const Native = registerPlugin<AuraNativePlugin>('AuraNative');

export const isNative = (): boolean => Capacitor.isNativePlatform();

export type NativeResult = { ok: true; message: string } | { ok: false; message: string };

export type Failure = { ok: false; reason: 'web' | 'permission' | 'unavailable' | 'error'; message: string };

export async function getUsageState(): Promise<UsageState> {
  if (!isNative()) return 'web';
  try {
    return (await Native.hasUsageAccess()).granted ? 'ready' : 'needs-permission';
  } catch {
    return 'needs-permission';
  }
}

/** Screen time. With `interactive`, opens Android's Usage access screen if permission is missing. */
export async function getUsage(days = 7, interactive = true): Promise<{ ok: true; days: UsageDay[] } | Failure> {
  if (!isNative())
    return { ok: false, reason: 'web', message: 'Real screen time needs the Android app. Using demo data or CSV import instead.' };
  try {
    const { granted } = await Native.hasUsageAccess();
    if (!granted) {
      if (interactive) await Native.openUsageAccessSettings();
      return { ok: false, reason: 'permission', message: 'Please allow "Usage access" for AURA in Settings, then come back and sync again.' };
    }
    return { ok: true, days: (await Native.getUsageStats({ days })).days };
  } catch {
    return { ok: false, reason: 'error', message: 'Could not read screen time on this device.' };
  }
}

export async function getHealthState(): Promise<HealthState> {
  if (!isNative()) return 'web';
  try {
    const { status, granted } = await Native.healthStatus();
    if (status === 'unavailable') return 'unavailable';
    if (status === 'needs-update') return 'needs-update';
    return granted ? 'ready' : 'needs-permission';
  } catch {
    return 'unavailable';
  }
}

/** Opens Android's permission sheet for Health Connect (steps, sleep, heart rate, exercise: read only). */
export async function connectHealth(): Promise<NativeResult> {
  if (!isNative()) return { ok: false, message: 'Fitness band data needs the Android app.' };
  try {
    const state = await getHealthState();
    if (state === 'unavailable' || state === 'needs-update') {
      await Native.openHealthConnect();
      return { ok: false, message: 'Install or update Health Connect, then come back and connect again.' };
    }
    if (state === 'ready') return { ok: true, message: 'Health Connect is already connected.' };
    const { granted } = await Native.requestHealthPermissions();
    return granted
      ? { ok: true, message: 'Health Connect connected.' }
      : { ok: false, message: 'Permission was not given. You can allow it from the Phone data screen any time.' };
  } catch {
    return { ok: false, message: 'Could not open the Health Connect permission screen.' };
  }
}

export async function getHealth(days = 7): Promise<{ ok: true; days: HealthDay[] } | Failure> {
  if (!isNative())
    return { ok: false, reason: 'web', message: 'Fitness band data needs the Android app.' };
  const state = await getHealthState();
  if (state === 'unavailable' || state === 'needs-update')
    return { ok: false, reason: 'unavailable', message: 'Health Connect is not installed or needs an update.' };
  if (state === 'needs-permission')
    return { ok: false, reason: 'permission', message: 'Allow AURA to read Health Connect first.' };
  try {
    return { ok: true, days: (await Native.getHealthData({ days })).days };
  } catch {
    return { ok: false, reason: 'error', message: 'Could not read Health Connect data.' };
  }
}

export async function runCommand(cmd: Command): Promise<NativeResult> {
  if (cmd.type === 'unknown') return { ok: false, message: cmd.summary };
  if (!isNative()) {
    return { ok: false, message: `Preview only (web): on Android this would — ${cmd.summary.toLowerCase()}.` };
  }
  try {
    if (cmd.type === 'alarm') {
      await Native.setAlarm({ hour: cmd.hour, minute: cmd.minute, label: cmd.label });
      return { ok: true, message: 'Alarm set. Check your Clock app.' };
    }
    const [y, m, d] = cmd.date.split('-').map(Number);
    const startMillis = new Date(y, m - 1, d, cmd.hour, cmd.minute).getTime();
    await Native.addCalendarEvent({ title: cmd.title, startMillis });
    return { ok: true, message: 'Calendar event opened for you to save.' };
  } catch {
    return { ok: false, message: 'Android could not complete that action.' };
  }
}

/** Local notification via @capacitor/local-notifications (loaded lazily so the web build stays light). */
export async function notify(title: string, body: string, inSeconds = 5): Promise<NativeResult> {
  if (!isNative()) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
      return { ok: true, message: 'Notification shown.' };
    }
    return { ok: false, message: 'Notifications work in the Android app (or allow them in your browser).' };
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return { ok: false, message: 'Notification permission was not granted.' };
    await LocalNotifications.schedule({
      notifications: [{ id: Date.now() % 2147483000, title, body, schedule: { at: new Date(Date.now() + inSeconds * 1000) } }],
    });
    return { ok: true, message: `Notification scheduled in ${inSeconds} seconds.` };
  } catch {
    return { ok: false, message: 'Could not schedule the notification.' };
  }
}
