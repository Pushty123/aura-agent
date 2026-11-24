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

interface AuraNativePlugin {
  hasUsageAccess(): Promise<{ granted: boolean }>;
  openUsageAccessSettings(): Promise<void>;
  getUsageStats(opts: { days: number }): Promise<{ days: UsageDay[] }>;
  setAlarm(opts: { hour: number; minute: number; label: string }): Promise<void>;
  addCalendarEvent(opts: { title: string; startMillis: number }): Promise<void>;
}

const Native = registerPlugin<AuraNativePlugin>('AuraNative');

export const isNative = (): boolean => Capacitor.isNativePlatform();

export type NativeResult = { ok: true; message: string } | { ok: false; message: string };

export async function getUsage(days = 7): Promise<{ ok: true; days: UsageDay[] } | { ok: false; message: string }> {
  if (!isNative()) return { ok: false, message: 'Real screen time needs the Android app. Using demo data or CSV import instead.' };
  try {
    const { granted } = await Native.hasUsageAccess();
    if (!granted) {
      await Native.openUsageAccessSettings();
      return { ok: false, message: 'Please allow "Usage access" for AURA in Settings, then come back.' };
    }
    return { ok: true, days: (await Native.getUsageStats({ days })).days };
  } catch {
    return { ok: false, message: 'Could not read screen time on this device. Using demo data or CSV import instead.' };
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
