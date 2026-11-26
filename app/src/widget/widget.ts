import { db } from '../lib/db';
import { balanceScore } from '../insights/balance';
import { avatarMood } from '../avatar/mood';
import { clearWidget, updateWidget, type WidgetSnapshot } from '../native/bridge';
import type { DayRecord } from '../types';
import { getPermissions } from '../lib/permissions';

/**
 * Home-screen widget (Android). Off by default because the home screen can be
 * seen without unlocking AURA. When on, only these display strings are stored
 * (in the app's private storage) for the widget; "score only" hides the numbers.
 */
export interface WidgetPrefs {
  enabled: boolean;
  showNumbers: boolean;
}

const DEFAULT: WidgetPrefs = { enabled: true, showNumbers: true };

export async function getWidgetPrefs(): Promise<WidgetPrefs> {
  const row = await db.meta.get('widget-prefs');
  return { ...DEFAULT, ...(row ? JSON.parse(row.value) : {}) };
}

export async function setWidgetPrefs(p: WidgetPrefs): Promise<void> {
  await db.meta.put({ key: 'widget-prefs', value: JSON.stringify(p) });
}

const dash = '–';

export function buildSnapshot(days: DayRecord[], prefs: WidgetPrefs, now = new Date()): WidgetSnapshot {
  const latest = days[days.length - 1];
  const score = latest ? balanceScore(latest, days.slice(0, -1)).score : null;
  const mood = avatarMood(latest, score);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const show = prefs.showNumbers && !!latest;
  return {
    score: score ?? -1,
    mood: latest ? mood.label : 'Open AURA to start',
    color: mood.color,
    sleep: show && latest.sleepHours !== undefined ? `${latest.sleepHours.toFixed(1)} h` : dash,
    steps: show && latest.steps !== undefined ? latest.steps.toLocaleString('en-IN') : dash,
    screen: show && latest.screenMinutes !== undefined ? `${(latest.screenMinutes / 60).toFixed(1)} h` : dash,
    updated: `Updated ${hhmm}`,
    demo: latest?.source === 'demo',
  };
}

/** Send the latest snapshot to the widget if the person turned it on. */
export async function syncWidget(days: DayRecord[]): Promise<WidgetSnapshot | null> {
  const prefs = await getWidgetPrefs();
  if (!prefs.enabled) return null;
  const permissions = await getPermissions();
  const filtered = days.map((day) => {
    if (day.source !== 'device') return day;
    const next = { ...day };
    if (!permissions.sleep) delete next.sleepHours;
    if (!permissions.steps) delete next.steps;
    if (!permissions.usage) {
      delete next.screenMinutes;
      delete next.lateScreenMin;
    }
    return next;
  });
  const snap = buildSnapshot(filtered, prefs);
  await updateWidget(snap);
  return snap;
}

export async function turnWidgetOff(): Promise<void> {
  await setWidgetPrefs({ ...(await getWidgetPrefs()), enabled: false });
  await clearWidget();
}
