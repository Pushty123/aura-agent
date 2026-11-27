import { getRecord, putRecord, audit } from './vault';
import { loadDays, saveDay } from './store';

export type PermissionKey =
  | 'usage'
  | 'sleep'
  | 'steps'
  | 'heartRate'
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'location'
  | 'healthRecords'
  | 'familySharing';

export type Permissions = Record<PermissionKey, boolean>;

export const PERMISSIONS: { id: PermissionKey; label: string; description: string }[] = [
  { id: 'usage', label: 'Usage', description: 'Read app usage and screen time from this phone.' },
  { id: 'sleep', label: 'Sleep', description: 'Read sleep duration from this phone or connected health apps.' },
  { id: 'steps', label: 'Steps', description: 'Read steps and exercise sessions from this phone or connected health apps.' },
  { id: 'heartRate', label: 'Heart rate', description: 'Read heart rate and blood pressure from connected health apps.' },
  { id: 'camera', label: 'Camera', description: 'Use the camera for exercise tracking and profile or meal photos.' },
  { id: 'microphone', label: 'Microphone', description: 'Use voice input in Ask AURA.' },
  { id: 'notifications', label: 'Notifications', description: 'Show reminders and app-limit alerts on this device.' },
  { id: 'location', label: 'Location', description: 'Location-aware features; AURA does not currently request location.' },
  { id: 'healthRecords', label: 'Health records', description: 'Read your AURA symptom and cycle logs for insights.' },
  { id: 'familySharing', label: 'Family sharing', description: 'Allow you to share a report using your device share sheet.' },
];

export const DEFAULT_PERMISSIONS: Permissions = {
  usage: false,
  sleep: false,
  steps: false,
  heartRate: false,
  camera: false,
  microphone: false,
  notifications: false,
  location: false,
  healthRecords: false,
  familySharing: false,
};

const DEVICE_FIELDS: Partial<Record<PermissionKey, (keyof import('../types').DayRecord)[]>> = {
  usage: ['screenMinutes', 'lateScreenMin'],
  sleep: ['sleepHours'],
  steps: ['steps', 'exerciseMinutes'],
  heartRate: ['avgHeartRate', 'bloodPressureSystolic', 'bloodPressureDiastolic'],
};

export async function getPermissions(): Promise<Permissions> {
  const saved = await getRecord<Partial<Permissions>>('settings', 'permissions');
  return { ...DEFAULT_PERMISSIONS, ...saved };
}

export async function hasPermission(permission: PermissionKey): Promise<boolean> {
  return (await getPermissions())[permission];
}

export async function setPermission(permission: PermissionKey, enabled: boolean): Promise<void> {
  const permissions = await getPermissions();
  permissions[permission] = enabled;
  await putRecord('settings', 'permissions', permissions);
  await audit('permission.set', `${permission} = ${enabled ? 'on' : 'off'}`);

  if (!enabled) await removeDisabledDeviceFields(permission);
}

async function removeDisabledDeviceFields(permission: PermissionKey): Promise<void> {
  const fields = DEVICE_FIELDS[permission];
  if (!fields) return;

  for (const day of await loadDays()) {
    if (day.source !== 'device') continue;
    let changed = false;
    for (const field of fields) {
      if (day.manualFields?.includes(field)) continue;
      if (day[field] !== undefined) {
        delete day[field];
        changed = true;
      }
    }
    if (changed) await saveDay(day);
  }
}
