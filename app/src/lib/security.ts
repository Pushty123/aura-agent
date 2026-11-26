import { db } from './db';

/** How long AURA may sit idle (or in the background) before it locks. 0 = only when the app is closed. */
export const LOCK_OPTIONS: { ms: number; label: string }[] = [
  { ms: 60_000, label: '1 minute' },
  { ms: 5 * 60_000, label: '5 minutes' },
  { ms: 15 * 60_000, label: '15 minutes' },
  { ms: 0, label: 'Only when I close the app' },
];

export const DEFAULT_LOCK_MS = 5 * 60_000;

export async function getLockAfter(): Promise<number> {
  const row = await db.meta.get('lock-after');
  const v = row ? Number(row.value) : DEFAULT_LOCK_MS;
  return LOCK_OPTIONS.some((o) => o.ms === v) ? v : DEFAULT_LOCK_MS;
}

export async function setLockAfter(ms: number): Promise<void> {
  if (!LOCK_OPTIONS.some((o) => o.ms === ms)) throw new Error('Unknown lock option');
  await db.meta.put({ key: 'lock-after', value: String(ms) });
}

export function lockLabel(ms: number): string {
  return LOCK_OPTIONS.find((o) => o.ms === ms)?.label ?? '5 minutes';
}
