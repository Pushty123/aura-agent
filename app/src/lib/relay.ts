import { db } from './db';
import { randomBytes, toB64 } from './crypto';
import { ledgerFetch } from './ledger';
import { audit } from './vault';

/**
 * Optional encrypted backup to the blind relay (see /relay).
 * What leaves the device is the rows exactly as stored on disk: ciphertext.
 * The relay never receives a key, a user id, or readable data.
 */
export const DEFAULT_RELAY = 'http://localhost:8787';

async function mailboxId(): Promise<string> {
  const row = await db.meta.get('mailbox');
  if (row) return row.value;
  const id = toB64(randomBytes(18)).replace(/[+/=]/g, 'x');
  await db.meta.put({ key: 'mailbox', value: id });
  return id;
}

export async function pushBackup(relayUrl = DEFAULT_RELAY): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db.records.toArray();
    const meta = await db.meta.get('salt');
    const blob = JSON.stringify({ salt: meta?.value, rows });
    const id = await mailboxId();
    const seq = Date.now();
    const res = await ledgerFetch(`${relayUrl}/v1/mailbox/${id}/blob/${seq}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: blob,
      label: 'ciphertext-blob',
    });
    if (!res.ok) return { ok: false, message: `Relay answered ${res.status}.` };
    await audit('relay.push', `Sent ${rows.length} encrypted records (${blob.length} bytes) to relay`);
    return { ok: true, message: `Sent ${rows.length} encrypted records to the relay.` };
  } catch {
    return { ok: false, message: 'Could not reach the relay. (It is optional; AURA works without it.)' };
  }
}
