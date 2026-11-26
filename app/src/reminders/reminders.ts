import { scheduleReminders } from '../native/bridge';
import { getRecord, putRecord } from '../lib/vault';
import type { DayRecord } from '../types';
import { mean } from '../insights/stats';
import { today as todayISO } from '../lib/dates';

/**
 * Reminders that repeat every day, scheduled by the phone itself (no server).
 * "daily": once at `time`. "interval": every `everyHours` from `start` to `end`.
 */
export interface Reminder {
  id: string;
  title: string;
  body: string;
  kind: 'daily' | 'interval';
  time: string; // HH:MM for daily
  everyHours: number; // for interval
  start: string; // HH:MM
  end: string; // HH:MM
  enabled: boolean;
  /** Set when the reminder came from a plan. */
  planId?: string;
  /** Stop after this date (YYYY-MM-DD). */
  until?: string;
  /** What the notification's "Done" button does: 'water', 'goal:<id>' or 'done'. */
  action?: string;
}

export interface Slot {
  hour: number;
  minute: number;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function validateReminder(r: Reminder): string | null {
  if (!r.title.trim()) return 'Give the reminder a name.';
  if (r.title.length > 60 || r.body.length > 140) return 'Keep the text short.';
  if (r.kind === 'daily' && !HHMM.test(r.time)) return 'Pick a time.';
  if (r.kind === 'interval') {
    if (!HHMM.test(r.start) || !HHMM.test(r.end)) return 'Pick a start and end time.';
    if (toMin(r.end) <= toMin(r.start)) return 'The end time must be after the start time.';
    if (!(r.everyHours >= 1 && r.everyHours <= 12)) return 'Repeat every 1 to 12 hours.';
  }
  return null;
}

/** All the times in a day this reminder fires (max 24). */
export function slotsFor(r: Reminder): Slot[] {
  if (r.kind === 'daily') return [{ hour: Number(r.time.slice(0, 2)), minute: Number(r.time.slice(3, 5)) }];
  const out: Slot[] = [];
  for (let m = toMin(r.start); m <= toMin(r.end) && out.length < 24; m += Math.round(r.everyHours * 60)) {
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

/** Stable positive 31-bit notification id per reminder and slot. */
export function notificationId(reminderId: string, slot: number): number {
  let h = 2166136261;
  for (const c of `${reminderId}#${slot}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 1) % 2_000_000_000 + 1000;
}

const blank = (over: Partial<Reminder>): Reminder => ({
  id: `r${Date.now()}${Math.floor(Math.random() * 1000)}`,
  title: '',
  body: '',
  kind: 'daily',
  time: '09:00',
  everyHours: 2,
  start: '09:00',
  end: '21:00',
  enabled: true,
  ...over,
});

export const TEMPLATES: { key: string; label: string; make: () => Reminder }[] = [
  { key: 'water', label: '💧 Drink water every 2 hours', make: () => blank({ title: 'Drink water', body: 'Time for a glass of water.', kind: 'interval', everyHours: 2, start: '09:00', end: '21:00', action: 'water' }) },
  { key: 'wind', label: '🌙 Wind down at 10:30 pm', make: () => blank({ title: 'Wind down', body: 'Screens off soon for better sleep.', time: '22:30' }) },
  { key: 'move', label: '🚶 Move break at 3 pm', make: () => blank({ title: 'Move break', body: 'Stand up and walk for 5 minutes.', time: '15:00' }) },
  { key: 'checkin', label: '📝 Evening check-in at 9 pm', make: () => blank({ title: 'Daily check-in', body: 'How was your day? Log it in AURA.', time: '21:00' }) },
  { key: 'stretch', label: '🧘 Stretch every 3 hours', make: () => blank({ title: 'Stretch', body: 'A short stretch for your back and neck.', kind: 'interval', everyHours: 3, start: '10:00', end: '19:00' }) },
];

export function newReminder(over: Partial<Reminder> = {}): Reminder {
  return blank(over);
}

export interface Suggestion {
  key: string;
  why: string;
}

/** Reminders suggested from the person's own data (timely nudges). */
export function suggestFromData(days: DayRecord[], existing: Reminder[]): Suggestion[] {
  const week = days.slice(-7);
  const avg = (f: (d: DayRecord) => number | undefined) => {
    const v = week.map(f).filter((x): x is number => typeof x === 'number');
    return v.length >= 3 ? mean(v) : null;
  };
  const has = (title: string) => existing.some((r) => r.title === title);
  const out: Suggestion[] = [];
  const late = avg((d) => d.lateScreenMin);
  if (late !== null && late >= 30 && !has('Wind down'))
    out.push({ key: 'wind', why: `You average ${Math.round(late)} min of screen time after 11 pm.` });
  const water = avg((d) => d.waterGlasses);
  if (water !== null && water < 6 && !has('Drink water'))
    out.push({ key: 'water', why: `You average ${water.toFixed(1)} glasses of water a day.` });
  const steps = avg((d) => d.steps);
  if (steps !== null && steps < 6000 && !has('Move break'))
    out.push({ key: 'move', why: `You average ${Math.round(steps).toLocaleString()} steps a day.` });
  return out;
}

export async function loadReminders(): Promise<Reminder[]> {
  return (await getRecord<Reminder[]>('settings', 'reminders')) ?? [];
}

export async function saveReminders(list: Reminder[]): Promise<void> {
  for (const r of list) {
    const e = validateReminder(r);
    if (e) throw new Error(e);
  }
  await putRecord('settings', 'reminders', list);
}

/** What tapping "Done" on this reminder's notification should do. */
export function actionFor(r: Reminder): string {
  if (r.action) return r.action;
  if (r.id.startsWith('goal-')) return `goal:${r.id.slice(5)}`;
  if (/water/i.test(r.title)) return 'water';
  return 'done';
}

/** Save and (re)schedule every enabled reminder on the phone. */
export async function applyReminders(list: Reminder[]) {
  await saveReminders(list);
  const items = list
    .filter((r) => r.enabled && (!r.until || r.until >= todayISO()))
    .flatMap((r) =>
      slotsFor(r).map((s, i) => ({ id: notificationId(r.id, i), title: r.title, body: r.body || r.title, rid: r.id, action: actionFor(r), ...s })),
    );
  return scheduleReminders(items);
}
