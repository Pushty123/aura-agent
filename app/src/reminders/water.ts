import type { DayRecord } from '../types';
import { getRecord, putRecord } from '../lib/vault';
import { notificationId } from './notificationIds';
import type { AuraNotification } from '../native/bridge';

export type WaterUnit = 'glasses' | 'ml';
export type WaterResponseStatus = 'not-now' | 'drank-water';

export interface WaterSettings {
  goal: number;
  unit: WaterUnit;
  intervalHours: number;
  start: string;
  end: string;
  enabled: boolean;
}

export interface WaterResponse {
  id: string;
  date: string;
  status: WaterResponseStatus;
  recordedAt: string;
}

export const DEFAULT_WATER_SETTINGS: WaterSettings = {
  goal: 8,
  unit: 'glasses',
  intervalHours: 2,
  start: '09:00',
  end: '21:00',
  enabled: false,
};

export function changeWaterUnit(settings: WaterSettings, unit: WaterUnit): WaterSettings {
  if (unit === settings.unit) return settings;
  const goal = unit === 'ml'
    ? settings.goal * 250
    : Math.max(1, Math.round(settings.goal / 250));
  return { ...settings, unit, goal };
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function validateWaterSettings(settings: WaterSettings): string | null {
  if (!Number.isFinite(settings.goal) || settings.goal < 1 || settings.goal > (settings.unit === 'ml' ? 10000 : 40)) {
    return `Set a daily goal between 1 and ${settings.unit === 'ml' ? '10,000 ml' : '40 glasses'}.`;
  }
  if (settings.unit === 'ml' && !Number.isInteger(settings.goal)) return 'Enter a whole-number goal in ml.';
  if (!Number.isInteger(settings.intervalHours) || settings.intervalHours < 1 || settings.intervalHours > 12) {
    return 'Choose an interval from 1 to 12 hours.';
  }
  if (!HHMM.test(settings.start) || !HHMM.test(settings.end)) return 'Choose valid active hours.';
  if (toMinutes(settings.end) <= toMinutes(settings.start)) return 'The end of active hours must be after the start.';
  return null;
}

export function waterReminderSlots(settings: WaterSettings): { hour: number; minute: number }[] {
  if (!HHMM.test(settings.start) || !HHMM.test(settings.end) || settings.intervalHours < 1) return [];
  const slots: { hour: number; minute: number }[] = [];
  for (
    let minute = toMinutes(settings.start);
    minute <= toMinutes(settings.end) && slots.length < 24;
    minute += settings.intervalHours * 60
  ) {
    slots.push({ hour: Math.floor(minute / 60), minute: minute % 60 });
  }
  return slots;
}

export function waterNotificationItems(settings: WaterSettings): AuraNotification[] {
  if (!settings.enabled) return [];
  return waterReminderSlots(settings).flatMap(({ hour, minute }) =>
    Array.from({ length: 7 }, (_, weekday) => ({
      id: notificationId('water-reminder', weekday * 1440 + hour * 60 + minute),
      title: 'Water break',
      body: 'A little water break, if it suits your day.',
      schedule: { on: { weekday: weekday + 1, hour, minute }, allowWhileIdle: true },
      actionTypeId: 'water-response',
      extra: {
        aura: true,
        kind: 'water',
      },
    })),
  );
}

export function waterSlotForNotificationId(
  settings: WaterSettings,
  id: number,
): { weekday: number; hour: number; minute: number } | undefined {
  for (const { hour, minute } of waterReminderSlots(settings)) {
    for (let weekday = 0; weekday < 7; weekday++) {
      if (notificationId('water-reminder', weekday * 1440 + hour * 60 + minute) === id) {
        return { weekday, hour, minute };
      }
    }
  }
  return undefined;
}

export function waterProgress(
  day: Pick<DayRecord, 'waterGlasses' | 'waterMl'> | undefined,
  settings: WaterSettings,
): { current: number; goal: number; percent: number; unit: WaterUnit } {
  const glasses = day?.waterGlasses ?? 0;
  const current = settings.unit === 'glasses'
    ? glasses
    : day?.waterMl ?? glasses * 250;
  return {
    current,
    goal: settings.goal,
    percent: Math.min(100, Math.max(0, Math.round((current / settings.goal) * 100))),
    unit: settings.unit,
  };
}

export function addWaterGlass(day: Pick<DayRecord, 'waterGlasses' | 'waterMl' | 'manualFields'> | undefined): Pick<DayRecord, 'waterGlasses' | 'waterMl' | 'manualFields'> {
  const fields = new Set(day?.manualFields ?? []);
  fields.add('waterGlasses');
  fields.add('waterMl');
  return {
    waterGlasses: (day?.waterGlasses ?? 0) + 1,
    waterMl: (day?.waterMl ?? (day?.waterGlasses ?? 0) * 250) + 250,
    manualFields: [...fields],
  };
}

export function removeWaterGlass(day: Pick<DayRecord, 'waterGlasses' | 'waterMl' | 'manualFields'> | undefined): Pick<DayRecord, 'waterGlasses' | 'waterMl' | 'manualFields'> {
  const fields = new Set(day?.manualFields ?? []);
  fields.add('waterGlasses');
  fields.add('waterMl');
  const glasses = Math.max(0, (day?.waterGlasses ?? 0) - 1);
  return {
    waterGlasses: glasses,
    waterMl: Math.max(0, (day?.waterMl ?? (day?.waterGlasses ?? 0) * 250) - 250),
    manualFields: [...fields],
  };
}

export function recordWaterResponse(
  responses: WaterResponse[],
  id: string,
  date: string,
  status: WaterResponseStatus,
  recordedAt: string,
): WaterResponse[] {
  return [
    ...responses.filter((response) => response.id !== id || response.date !== date),
    { id, date, status, recordedAt },
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export async function loadWaterSettings(): Promise<WaterSettings> {
  return { ...DEFAULT_WATER_SETTINGS, ...(await getRecord<Partial<WaterSettings>>('settings', 'water-settings')) };
}

export async function saveWaterSettings(settings: WaterSettings): Promise<void> {
  const error = validateWaterSettings(settings);
  if (error) throw new Error(error);
  await putRecord('settings', 'water-settings', settings);
}

export async function loadWaterResponses(): Promise<WaterResponse[]> {
  return (await getRecord<WaterResponse[]>('settings', 'water-responses')) ?? [];
}

export async function saveWaterResponses(responses: WaterResponse[]): Promise<void> {
  await putRecord('settings', 'water-responses', responses);
}
