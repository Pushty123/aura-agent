import { db } from './db';
import type { DayRecord, FoodEntry } from '../types';
import { getAll, putRecord } from './vault';

/** Thin helpers over the vault so pages don't know about storage details. */
export async function loadDays(): Promise<DayRecord[]> {
  const days = await getAll<DayRecord>('day');
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveDay(day: DayRecord): Promise<void> {
  await putRecord('day', day.date, day);
}

/** Merge a partial update into the day record for `date` (creating it if needed). */
export async function patchDay(date: string, patch: Partial<DayRecord>, source: DayRecord['source'] = 'manual'): Promise<DayRecord> {
  const existing = (await loadDays()).find((d) => d.date === date);
  const next: DayRecord = { ...(existing ?? { date, source }), ...patch };
  await saveDay(next);
  return next;
}

export async function loadFood(): Promise<FoodEntry[]> {
  return getAll<FoodEntry>('food');
}

export async function deleteFood(id: string): Promise<void> {
  await db.records.delete(`food:${id}`);
}

export async function saveFood(entry: FoodEntry): Promise<void> {
  await putRecord('food', entry.id, entry);
}
