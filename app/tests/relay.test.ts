import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db';
import { deriveVaultKey, open, randomBytes, seal, toB64 } from '../src/lib/crypto';
import { pushBackup } from '../src/lib/relay';
import { resetLedger } from '../src/lib/ledger';

const relayUrl = 'http://relay.test';
const storedBlobs = new Map<string, Uint8Array>();

describe('encrypted relay backup', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    storedBlobs.clear();
    resetLedger();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(input.toString()).pathname;
        if (init?.method === 'PUT') {
          storedBlobs.set(path, new TextEncoder().encode(String(init.body ?? '')));
          return new Response(JSON.stringify({ stored: true }), { status: 200 });
        }
        const blob = storedBlobs.get(path);
        return blob
          ? new Response(blob.slice(), { status: 200 })
          : new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('encrypts on the client, uploads, downloads, and decrypts without exposing plaintext', async () => {
    const salt = randomBytes(16);
    const key = await deriveVaultKey('backup-passphrase', salt, 1000);
    const sample = { date: '2026-11-25', sleepHours: 7.25, mood: 4, source: 'manual' };
    const sealed = await seal(key, 'day:2026-11-25', 'day', sample);
    await db.meta.put({ key: 'salt', value: toB64(salt) });
    await db.records.put({ id: 'day:2026-11-25', kind: 'day', ...sealed });

    expect(await pushBackup(relayUrl)).toMatchObject({ ok: true });

    const [path, stored] = [...storedBlobs.entries()][0];
    expect(stored).toBeDefined();
    const storedText = new TextDecoder().decode(stored);
    expect(storedText).not.toContain('7.25');
    expect(storedText).not.toContain('sleepHours');

    const downloaded = await fetch(`${relayUrl}${path}`);
    expect(downloaded.status).toBe(200);
    const backup = await downloaded.json();
    expect(backup.rows).toHaveLength(1);
    await expect(
      open(key, backup.rows[0].id, backup.rows[0].kind, backup.rows[0]),
    ).resolves.toEqual(sample);
  });

  it('rejects a wrong key when decrypting the downloaded backup', async () => {
    const salt = randomBytes(16);
    const key = await deriveVaultKey('backup-passphrase', salt, 1000);
    const sealed = await seal(key, 'day:2026-11-25', 'day', { sleepHours: 7.25 });
    await db.meta.put({ key: 'salt', value: toB64(salt) });
    await db.records.put({ id: 'day:2026-11-25', kind: 'day', ...sealed });
    await pushBackup(relayUrl);

    const [path] = [...storedBlobs.keys()];
    const backup = await (await fetch(`${relayUrl}${path}`)).json();
    const wrongKey = await deriveVaultKey('different-passphrase', salt, 1000);
    await expect(
      open(wrongKey, backup.rows[0].id, backup.rows[0].kind, backup.rows[0]),
    ).rejects.toBeTruthy();
  });

  it('returns a not-found response for a missing backup', async () => {
    const response = await fetch(`${relayUrl}/v1/mailbox/unknownmailbox123/blob/missing`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ detail: 'not found' });
  });
});
