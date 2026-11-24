import { db, type AuditRow } from './db';
import { deriveVaultKey, fromB64, open, randomBytes, seal, sha256Hex, toB64 } from './crypto';
import type { DataKind, DataSource } from '../types';

/**
 * The Vault is the ONLY way data is read or written. Everything stored is
 * encrypted; consent flags and the audit log are the only plaintext, and they
 * contain no health data.
 */

let vaultKey: CryptoKey | null = null;

export const SOURCES: { id: DataSource; label: string; description: string }[] = [
  { id: 'device', label: 'Phone data', description: 'Screen time, steps and sleep from this phone' },
  { id: 'manual', label: 'Check-ins and food log', description: 'What you type or tap yourself' },
  { id: 'csv', label: 'File imports', description: 'Google Takeout / Samsung Health CSV' },
  { id: 'demo', label: 'Demo data', description: 'Labelled sample data for the demo' },
];

const CHECK_TEXT = 'aura-vault-ok';

export async function vaultExists(): Promise<boolean> {
  return !!(await db.meta.get('salt'));
}

export function isUnlocked(): boolean {
  return vaultKey !== null;
}

export function lock(): void {
  vaultKey = null;
}

export async function createVault(passphrase: string): Promise<void> {
  if (passphrase.length < 8) throw new Error('Passphrase must be at least 8 characters.');
  const salt = randomBytes(16);
  const key = await deriveVaultKey(passphrase, salt);
  const check = await seal(key, 'check', 'check', CHECK_TEXT);
  await db.meta.bulkPut([
    { key: 'salt', value: toB64(salt) },
    { key: 'check', value: JSON.stringify(check) },
  ]);
  vaultKey = key;
  await audit('vault.create', 'Vault created');
}

export async function unlock(passphrase: string): Promise<boolean> {
  const salt = await db.meta.get('salt');
  const check = await db.meta.get('check');
  if (!salt || !check) return false;
  const key = await deriveVaultKey(passphrase, fromB64(salt.value));
  try {
    const text = await open<string>(key, 'check', 'check', JSON.parse(check.value));
    if (text !== CHECK_TEXT) return false;
  } catch {
    return false;
  }
  vaultKey = key;
  await audit('vault.unlock', 'Vault unlocked');
  return true;
}

function requireKey(): CryptoKey {
  if (!vaultKey) throw new Error('Vault is locked.');
  return vaultKey;
}

export async function putRecord<T>(kind: DataKind, id: string, value: T): Promise<void> {
  const key = requireKey();
  const rowId = `${kind}:${id}`;
  const sealed = await seal(key, rowId, kind, value);
  await db.records.put({ id: rowId, kind, ...sealed });
}

export async function getRecord<T>(kind: DataKind, id: string): Promise<T | undefined> {
  const key = requireKey();
  const rowId = `${kind}:${id}`;
  const row = await db.records.get(rowId);
  return row ? open<T>(key, rowId, kind, row) : undefined;
}

export async function getAll<T>(kind: DataKind): Promise<T[]> {
  const key = requireKey();
  const rows = await db.records.where('kind').equals(kind).toArray();
  return Promise.all(rows.map((r) => open<T>(key, r.id, kind, r)));
}

export async function deleteRecordsBySource(source: DataSource): Promise<number> {
  const key = requireKey();
  const rows = await db.records.where('kind').equals('day').toArray();
  let n = 0;
  for (const r of rows) {
    const rec = await open<{ source: DataSource }>(key, r.id, 'day', r);
    if (rec.source === source) {
      await db.records.delete(r.id);
      n++;
    }
  }
  await audit('data.delete-source', `Deleted ${n} day records from source "${source}"`);
  return n;
}

/** Plaintext export so the user truly owns their data. */
export async function exportAll(): Promise<string> {
  const out = {
    exportedAt: new Date().toISOString(),
    note: 'AURA export. Wellness data, not medical records.',
    day: await getAll('day'),
    food: await getAll('food'),
    goal: await getAll('goal'),
    settings: await getAll('settings'),
  };
  await audit('data.export', 'Exported all data as JSON');
  return JSON.stringify(out, null, 2);
}

/** Crypto-shred: destroy salt + check, then wipe every row. */
export async function deleteAll(): Promise<void> {
  await db.transaction('rw', db.meta, db.records, db.audit, async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
  });
  vaultKey = null;
}

// ---- consent (plaintext, no health data) ----
export async function getConsent(): Promise<Record<DataSource, boolean>> {
  const row = await db.meta.get('consent');
  const defaults: Record<DataSource, boolean> = { device: false, manual: true, csv: false, demo: false };
  return row ? { ...defaults, ...JSON.parse(row.value) } : defaults;
}

export async function setConsent(source: DataSource, on: boolean): Promise<void> {
  const c = await getConsent();
  c[source] = on;
  await db.meta.put({ key: 'consent', value: JSON.stringify(c) });
  await audit('consent.set', `${source} = ${on ? 'on' : 'off'}`);
}

// ---- tamper-evident audit log (hash chain) ----
export async function audit(action: string, detail: string): Promise<void> {
  const last = await db.audit.orderBy('id').last();
  const prev = last?.hash ?? 'genesis';
  const ts = Date.now();
  const hash = await sha256Hex(`${prev}|${ts}|${action}|${detail}`);
  await db.audit.add({ ts, action, detail, prev, hash });
}

export async function getAudit(): Promise<AuditRow[]> {
  return db.audit.orderBy('id').toArray();
}

export async function verifyAudit(): Promise<boolean> {
  const rows = await getAudit();
  let prev = 'genesis';
  for (const r of rows) {
    if (r.prev !== prev) return false;
    if ((await sha256Hex(`${r.prev}|${r.ts}|${r.action}|${r.detail}`)) !== r.hash) return false;
    prev = r.hash;
  }
  return true;
}
