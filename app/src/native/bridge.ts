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

/** What the Android home-screen widget shows. All strings are ready to display. */
export interface WidgetSnapshot {
  score: number; // -1 = no score
  mood: string;
  color: string; // ring colour, #RRGGBB
  sleep: string;
  steps: string;
  screen: string;
  updated: string;
  demo: boolean;
}

export interface AppUse {
  pkg: string;
  label: string;
  minutes: number;
  opens: number;
  /** Small PNG data URL of the app icon. */
  icon?: string;
}

export interface AppLimit {
  pkg: string;
  label: string;
  minutes: number;
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
  phoneSensorStatus(): Promise<{ stepSensor: boolean; stepsAllowed: boolean; usageAllowed: boolean }>;
  requestStepPermission(): Promise<{ granted: boolean }>;
  getPhoneData(opts: { days: number }): Promise<{ days: PhoneDay[] }>;
  updateWidget(opts: WidgetSnapshot): Promise<void>;
  getAppUsage(): Promise<{ apps: AppUse[]; unlocks: number }>;
  setAppLimits(opts: { limits: AppLimit[] }): Promise<void>;
  biometricStatus(): Promise<{ state: 'ready' | 'not-enrolled' | 'unavailable'; enabled: boolean }>;
  biometricEnable(opts: { secret: string }): Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  biometricUnlock(): Promise<{ ok: boolean; secret?: string; cancelled?: boolean; reset?: boolean; message?: string }>;
  biometricDisable(): Promise<void>;
  clearWidget(): Promise<void>;
  widgetStatus(): Promise<{ supported: boolean; placed: number }>;
  scheduleNativeReminders(opts: { items: { id: number; title: string; body: string; hour: number; minute: number; rid?: string; action?: string }[] }): Promise<{ ok: boolean; count: number; exact: boolean }>;
  testNativeReminder(opts: { id: number; title: string; body: string; rid: string; action: string }): Promise<{ ok: boolean }>;
  takeReminderActions(): Promise<{ actions: { action: string; rid?: string; ts: number }[] }>;
  pinWidget(): Promise<{ supported: boolean; asked: boolean }>;
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

/** What the phone measures by itself: step counter, and sleep estimated from screen-off time. */
export interface PhoneDay {
  date: string;
  steps?: number;
  sleepMinutes?: number;
  sleepStart?: number;
  sleepEnd?: number;
}

export interface PhoneSensors {
  stepSensor: boolean;
  stepsAllowed: boolean;
  usageAllowed: boolean;
}

export async function phoneSensorStatus(): Promise<PhoneSensors | null> {
  if (!isNative()) return null;
  try {
    return await Native.phoneSensorStatus();
  } catch {
    return null; // older app build without this method
  }
}

/** Asks for "Physical activity" so AURA can count steps with the phone's own sensor. */
export async function allowPhoneSteps(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await Native.requestStepPermission()).granted;
  } catch {
    return false;
  }
}

export async function getPhoneDays(days = 7): Promise<PhoneDay[]> {
  if (!isNative()) return [];
  try {
    return (await Native.getPhoneData({ days })).days;
  } catch {
    return [];
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

/** Push the latest numbers to the home-screen widget (Android only; no-op elsewhere). */
export async function updateWidget(snap: WidgetSnapshot): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await Native.updateWidget(snap);
    return true;
  } catch {
    return false;
  }
}

export async function widgetStatus(): Promise<{ supported: boolean; placed: number } | null> {
  if (!isNative()) return null;
  try {
    return await Native.widgetStatus();
  } catch {
    return null; // older app build
  }
}

/** Opens the launcher's "Add widget" dialog. Returns false if this launcher can't do it. */
export async function pinWidget(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const r = await Native.pinWidget();
    return r.supported && r.asked;
  } catch {
    return false;
  }
}

export async function clearWidget(): Promise<void> {
  if (!isNative()) return;
  try {
    await Native.clearWidget();
  } catch {
    // Widget not installed: nothing to clear.
  }
}

export type BioState = 'web' | 'ready' | 'not-enrolled' | 'unavailable';

export async function biometricStatus(): Promise<{ state: BioState; enabled: boolean }> {
  if (!isNative()) return { state: 'web', enabled: false };
  try {
    return await Native.biometricStatus();
  } catch {
    return { state: 'unavailable', enabled: false };
  }
}

export async function biometricEnable(secret: string): Promise<{ ok: boolean; message?: string }> {
  if (!isNative()) return { ok: false, message: 'Fingerprint unlock needs the Android app.' };
  try {
    const r = await Native.biometricEnable({ secret });
    return r.ok ? { ok: true } : { ok: false, message: r.cancelled ? 'Fingerprint setup was cancelled.' : r.message };
  } catch {
    return { ok: false, message: 'Could not set up fingerprint unlock on this phone.' };
  }
}

export async function biometricUnlock(): Promise<{ ok: boolean; secret?: string; reset?: boolean; message?: string }> {
  if (!isNative()) return { ok: false };
  try {
    return await Native.biometricUnlock();
  } catch {
    return { ok: false, message: 'Fingerprint unlock failed. Use your password.' };
  }
}

export async function biometricDisable(): Promise<void> {
  if (!isNative()) return;
  try {
    await Native.biometricDisable();
  } catch {
    // Nothing stored.
  }
}

/**
 * Replace all AURA reminders on the phone with this set of daily repeating
 * notifications. Returns how many were scheduled.
 */
export const REMINDER_ACTIONS = 'aura-reminder';

/** The buttons under every AURA reminder: "✓ Done" and "⏰ 10 min". */
export async function registerReminderActions(): Promise<void> {
  if (!isNative()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: REMINDER_ACTIONS,
        actions: [
          { id: 'done', title: 'Done' },
          { id: 'snooze', title: 'Snooze 10 min' },
        ],
      },
    ],
  });
}

export async function scheduleReminders(
  items: { id: number; title: string; body: string; hour: number; minute: number; rid?: string; action?: string }[],
): Promise<{ ok: boolean; count: number; message: string }> {
  if (!isNative()) return { ok: false, count: 0, message: 'Reminders on your screen work in the Android app.' };
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => (n.extra as { aura?: boolean } | undefined)?.aura);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    if (items.length) {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted')
        return { ok: false, count: 0, message: 'Allow notifications for AURA in phone Settings → Apps → AURA → Notifications.' };
    }
    // Preferred: AURA's own alarms. "Done" and "Snooze" then work in the background without opening the app.
    try {
      await Native.scheduleNativeReminders({ items });
      return items.length
        ? { ok: true, count: items.length, message: `${items.length} reminder time${items.length === 1 ? '' : 's'} set on this phone.` }
        : { ok: true, count: 0, message: 'All reminders are off.' };
    } catch {
      // Older app build without native reminders: fall back to the notifications plugin.
    }
    if (!items.length) return { ok: true, count: 0, message: 'All reminders are off.' };
    await registerReminderActions();
    await LocalNotifications.schedule({
      notifications: items.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { on: { hour: n.hour, minute: n.minute }, allowWhileIdle: true },
        actionTypeId: REMINDER_ACTIONS,
        extra: { aura: true, rid: n.rid, action: n.action },
      })),
    });
    return { ok: true, count: items.length, message: `${items.length} reminder time${items.length === 1 ? '' : 's'} set on this phone.` };
  } catch {
    return { ok: false, count: 0, message: 'Could not set reminders on this phone.' };
  }
}

/** "Done" taps made on notifications while AURA was closed or locked. */
export async function takeNativeReminderActions(): Promise<{ action: string; rid?: string; ts: number }[]> {
  if (!isNative()) return [];
  try {
    return (await Native.takeReminderActions()).actions;
  } catch {
    return [];
  }
}

/** Shows a reminder in 5 seconds using AURA's own alarms. Returns false on older app builds. */
export async function testNativeReminder(r: { id: number; title: string; body: string; rid: string; action: string }): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await Native.testNativeReminder(r)).ok;
  } catch {
    return false;
  }
}

export async function getAppUsage(): Promise<{ ok: true; apps: AppUse[]; unlocks: number } | Failure> {
  if (!isNative()) return { ok: false, reason: 'web', message: 'Per-app usage needs the Android app.' };
  try {
    if (!(await Native.hasUsageAccess()).granted)
      return { ok: false, reason: 'permission', message: 'Allow "Usage access" for AURA first.' };
    const r = await Native.getAppUsage();
    return { ok: true, apps: r.apps, unlocks: r.unlocks };
  } catch {
    return { ok: false, reason: 'error', message: 'Could not read app usage on this phone.' };
  }
}

export async function pushAppLimits(limits: AppLimit[]): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await Native.setAppLimits({ limits });
    return true;
  } catch {
    return false;
  }
}
