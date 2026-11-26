import type { MetricKind } from '../components/design-system';
import { addDays, isoDate, today } from '../lib/dates';
import { getRecord, putRecord } from '../lib/vault';
import { notificationId } from './notificationIds';
import type { AuraNotification } from '../native/bridge';

export type RoutineResponseStatus = 'done' | 'not-now' | 'no-response';

export interface RoutineItem {
  id: string;
  title: string;
  time: string;
  days: number[];
  icon?: MetricKind;
  activeFrom: string;
}

export interface RoutineResponse {
  routineId: string;
  date: string;
  status: RoutineResponseStatus;
  recordedAt: string;
}

export interface RoutineDraft {
  title: string;
  time: string;
  days: number[];
  icon?: MetricKind;
}

export type RoutineStatus = RoutineResponseStatus | 'pending';

export const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateRoutineItem(item: RoutineDraft): string | null {
  if (!item.title.trim()) return 'Add a title for this routine.';
  if (item.title.trim().length > 60) return 'Keep the routine title under 60 characters.';
  if (!HHMM.test(item.time)) return 'Choose a valid routine time.';
  if (!item.days.length || item.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return 'Choose at least one day of the week.';
  }
  return null;
}

export function newRoutineItem(over: Partial<RoutineItem> = {}): RoutineItem {
  return {
    id: `routine-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: '',
    time: '09:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    activeFrom: today(),
    ...over,
  };
}

export function routineWeekday(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12).getDay();
}

export function routineOccurrenceDate(weekday: number, time: string, at: Date): string {
  const currentDate = isoDate(at);
  const daysBack = (at.getDay() - weekday + 7) % 7;
  const scheduledMinute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const currentMinute = at.getHours() * 60 + at.getMinutes();
  const offset = daysBack || (currentMinute >= scheduledMinute ? 0 : 7);
  return addDays(currentDate, -offset);
}

export function routineNotificationItems(items: RoutineItem[]): AuraNotification[] {
  return items.flatMap((item) =>
    item.days.map((weekday) => ({
      id: notificationId(`routine:${item.id}:${item.time}`, weekday),
      title: item.title,
      body: 'A gentle reminder for your routine.',
      schedule: {
        on: {
          weekday: weekday + 1,
          hour: Number(item.time.slice(0, 2)),
          minute: Number(item.time.slice(3, 5)),
        },
        allowWhileIdle: true,
      },
      actionTypeId: 'routine-response',
      extra: {
        aura: true,
        kind: 'routine',
      },
    })),
  );
}

export function routineForNotificationId(
  items: RoutineItem[],
  id: number,
): { item: RoutineItem; weekday: number } | undefined {
  for (const item of items) {
    for (const weekday of item.days) {
      if (notificationId(`routine:${item.id}:${item.time}`, weekday) === id) return { item, weekday };
    }
  }
  return undefined;
}

export function routineStatus(
  item: RoutineItem,
  responses: RoutineResponse[],
  date: string,
): RoutineStatus {
  return responses.find((response) => response.routineId === item.id && response.date === date)?.status ?? 'pending';
}

export function routineDailyProgress(
  items: RoutineItem[],
  responses: RoutineResponse[],
  date: string,
): { done: number; total: number; percent: number } {
  const activeItems = items.filter((item) => item.days.includes(routineWeekday(date)) && item.activeFrom <= date);
  const done = activeItems.filter((item) => routineStatus(item, responses, date) === 'done').length;
  return {
    done,
    total: activeItems.length,
    percent: activeItems.length ? Math.round((done / activeItems.length) * 100) : 0,
  };
}

export function routineStreak(responses: RoutineResponse[], date: string): number {
  const doneDates = new Set(responses.filter((response) => response.status === 'done').map((response) => response.date));
  let cursor = doneDates.has(date) ? date : addDays(date, -1);
  let streak = 0;
  while (doneDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function recordRoutineResponse(
  responses: RoutineResponse[],
  routineId: string,
  date: string,
  status: Exclude<RoutineResponseStatus, 'no-response'>,
  recordedAt: string,
): RoutineResponse[] {
  const response: RoutineResponse = { routineId, date, status, recordedAt };
  return [
    ...responses.filter((entry) => entry.routineId !== routineId || entry.date !== date),
    response,
  ].sort((a, b) => a.date.localeCompare(b.date) || a.routineId.localeCompare(b.routineId));
}

export function addMissedRoutineResponses(
  items: RoutineItem[],
  responses: RoutineResponse[],
  now: Date,
): RoutineResponse[] {
  const currentDate = isoDate(now);
  const recorded = [...responses];
  for (const item of items) {
    for (let date = item.activeFrom; date <= currentDate; date = addDays(date, 1)) {
      if (!item.days.includes(routineWeekday(date))) continue;
      if (recorded.some((entry) => entry.routineId === item.id && entry.date === date)) continue;
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = item.time.split(':').map(Number);
      if (new Date(year, month - 1, day, hour, minute).getTime() > now.getTime()) continue;
      recorded.push({
        routineId: item.id,
        date,
        status: 'no-response',
        recordedAt: now.toISOString(),
      });
    }
  }
  return recorded.sort((a, b) => a.date.localeCompare(b.date) || a.routineId.localeCompare(b.routineId));
}

export async function loadRoutineItems(): Promise<RoutineItem[]> {
  return (await getRecord<RoutineItem[]>('settings', 'routine-items')) ?? [];
}

export async function saveRoutineItems(items: RoutineItem[]): Promise<void> {
  const ids = new Set<string>();
  for (const item of items) {
    const error = validateRoutineItem(item);
    if (error) throw new Error(error);
    if (ids.has(item.id)) throw new Error('Routine items must have unique identifiers.');
    ids.add(item.id);
  }
  await putRecord('settings', 'routine-items', items);
}

export async function loadRoutineResponses(): Promise<RoutineResponse[]> {
  return (await getRecord<RoutineResponse[]>('settings', 'routine-responses')) ?? [];
}

export async function saveRoutineResponses(responses: RoutineResponse[]): Promise<void> {
  await putRecord('settings', 'routine-responses', responses);
}

export async function recordDueRoutineMisses(items: RoutineItem[], now = new Date()): Promise<RoutineResponse[]> {
  const existing = await loadRoutineResponses();
  const next = addMissedRoutineResponses(items, existing, now);
  if (next.length !== existing.length) await saveRoutineResponses(next);
  return next;
}
