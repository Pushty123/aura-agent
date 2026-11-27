import { db } from '../lib/db';
import { getRecord, putRecord } from '../lib/vault';
import { patchDay, loadDays } from '../lib/store';
import { today } from '../lib/dates';
import { completeGoal, loadGoals } from '../goals/goals';
import { loadRoutineItems, loadRoutineResponses, recordRoutineResponse, routineForNotificationId, routineOccurrenceDate, saveRoutineResponses } from './routine';
import { addWaterGlass, loadWaterResponses, loadWaterSettings, recordWaterResponse, saveWaterResponses, waterSlotForNotificationId } from './water';
import { isNative, REMINDER_ACTIONS, registerReminderActions, takeNativeReminderActions, testNativeReminder } from '../native/bridge';

/**
 * "Done" and "Snooze 10 min" on reminder notifications.
 * A tap can arrive while AURA is locked, so "Done" is queued (only the action
 * name, never health values) and applied right after unlock.
 */
interface Queued {
  action: string;
  rid?: string;
  /** Set for taps recorded by Android: which feature, which notification, and Done or Not now. */
  kind?: string;
  nid?: number;
  status?: 'done' | 'not-now';
  ts: number;
}

const QUEUE = 'reminder-actions';

async function readQueue(): Promise<Queued[]> {
  try {
    return JSON.parse((await db.meta.get(QUEUE))?.value ?? '[]') as Queued[];
  } catch {
    return [];
  }
}

export async function queueAction(q: Queued): Promise<void> {
  const list = [...(await readQueue()), q].slice(-50);
  await db.meta.put({ key: QUEUE, value: JSON.stringify(list) });
}

let started = false;

/** Call once at startup (before unlock) so taps on notification buttons are caught. */
export async function initNotificationActions(): Promise<void> {
  if (started || !isNative()) return;
  started = true;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await registerReminderActions();
    await LocalNotifications.addListener('localNotificationActionPerformed', async (e) => {
      const extra = (e.notification.extra ?? {}) as { aura?: boolean; rid?: string; action?: string };
      if (!extra.aura) return;
      if (e.actionId === 'snooze') {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 1_000_000_000) + 1000,
              title: e.notification.title ?? 'AURA',
              body: e.notification.body ?? '',
              schedule: { at: new Date(Date.now() + 10 * 60_000), allowWhileIdle: true },
              actionTypeId: REMINDER_ACTIONS,
              extra,
            },
          ],
        });
        window.dispatchEvent(new CustomEvent('aura-toast', { detail: 'Reminding you again in 10 minutes.' }));
        return;
      }
      if (e.actionId === 'done') {
        await queueAction({ action: extra.action ?? 'done', rid: extra.rid, ts: Date.now() });
        window.dispatchEvent(new Event('aura-actions'));
      }
    });
  } catch {
    // Notifications plugin not available: nothing to listen to.
  }
}

/** How many times each reminder was marked done today. */
export async function doneToday(): Promise<Record<string, number>> {
  const all = (await getRecord<Record<string, Record<string, number>>>('settings', 'reminder-done')) ?? {};
  return all[today()] ?? {};
}

/** Apply queued "Done" taps. Needs the vault to be unlocked. Returns a short message, or null. */
export async function applyQueuedActions(): Promise<string | null> {
  const list = [...(await readQueue()), ...(await takeNativeReminderActions())];
  if (!list.length) return null;
  await db.meta.delete(QUEUE);
  const date = today();
  const notes: string[] = [];
  const log = (await getRecord<Record<string, Record<string, number>>>('settings', 'reminder-done')) ?? {};
  const day = { ...(log[date] ?? {}) };
  for (const q of list) {
    // Routines and water reminders keep their own Done / Not now history.
    if (q.kind === 'routine' && typeof q.nid === 'number') {
      const scheduled = routineForNotificationId(await loadRoutineItems(), q.nid);
      if (scheduled) {
        const at = new Date(q.ts);
        const when = routineOccurrenceDate(scheduled.weekday, scheduled.item.time, at);
        await saveRoutineResponses(
          recordRoutineResponse(await loadRoutineResponses(), scheduled.item.id, when, q.status === 'not-now' ? 'not-now' : 'done', at.toISOString()),
        );
        notes.push(q.status === 'not-now' ? `${scheduled.item.title}: not now` : `${scheduled.item.title} done`);
      }
      continue;
    }
    if (q.kind === 'water' && typeof q.nid === 'number') {
      const slot = waterSlotForNotificationId(await loadWaterSettings(), q.nid);
      const at = new Date(q.ts);
      if (slot)
        await saveWaterResponses(
          recordWaterResponse(await loadWaterResponses(), `${slot.weekday}:${slot.hour}:${slot.minute}`, date, q.status === 'not-now' ? 'not-now' : 'drank-water', at.toISOString()),
        );
      if (q.status !== 'not-now') {
        const current = (await loadDays()).find((d) => d.date === date);
        await patchDay(date, addWaterGlass(current));
        notes.push('+1 glass of water');
      }
      continue;
    }
    if (q.status === 'not-now') continue;
    if (q.rid) day[q.rid] = (day[q.rid] ?? 0) + 1;
    if (q.action === 'water') {
      await patchDay(date, addWaterGlass((await loadDays()).find((d) => d.date === date)));
      notes.push('+1 glass of water');
    } else if (q.action.startsWith('goal:')) {
      const g = (await loadGoals()).find((x) => x.id === q.action.slice(5));
      if (g?.metric === 'waterGlasses') {
        await patchDay(date, addWaterGlass((await loadDays()).find((d) => d.date === date)));
        notes.push('+1 glass of water');
      } else if (g) {
        await completeGoal(g, date);
        notes.push(`${g.title} done`);
      }
    } else {
      notes.push('Reminder done');
    }
  }
  const keep = Object.fromEntries(Object.entries({ ...log, [date]: day }).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30));
  await putRecord('settings', 'reminder-done', keep);
  const uniq = [...new Set(notes)];
  if (!uniq.length) return null;
  return `From your notification: ${uniq.join(', ')}${notes.length > uniq.length ? ` (${notes.length} taps)` : ''}.`;
}

/** Sends this reminder's notification in 5 seconds, with its buttons, to try it out. */
export async function sendTestReminder(title: string, body: string, rid: string, action: string): Promise<string> {
  if (!isNative()) return 'Test notifications work in the Android app.';
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return 'Allow notifications for AURA in phone Settings → Apps → AURA → Notifications.';
    const id = Math.floor(Math.random() * 100_000_000) + 1000;
    if (
      await testNativeReminder({
        id, title, body: body || title, hour: 9, minute: 0, weekday: 0, at: 0, action, kind: 'reminder', rid,
        doneLabel: action === 'water' ? 'Drank water' : 'Done', second: 'snooze', plain: false,
      })
    )
      return 'Test reminder coming in 5 seconds. Tap "Done" on it: the app will not open.';
    await registerReminderActions();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1_000_000_000) + 1000,
          title,
          body: body || title,
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
          actionTypeId: REMINDER_ACTIONS,
          extra: { aura: true, rid, action },
        },
      ],
    });
    return 'Test reminder coming in 5 seconds. Pull down the notification and tap "Done".';
  } catch {
    return 'Could not send a test notification.';
  }
}
