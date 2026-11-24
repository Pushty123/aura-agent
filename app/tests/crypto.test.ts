import { describe, expect, it } from 'vitest';
import { deriveVaultKey, open, randomBytes, seal } from '../src/lib/crypto';

describe('crypto', () => {
  it('round-trips a value', async () => {
    const key = await deriveVaultKey('correct horse battery', randomBytes(16), 1000);
    const sealed = await seal(key, 'day:2026-01-01', 'day', { steps: 1234 });
    expect(await open(key, 'day:2026-01-01', 'day', sealed)).toEqual({ steps: 1234 });
  });

  it('does not leak plaintext in the ciphertext', async () => {
    const key = await deriveVaultKey('correct horse battery', randomBytes(16), 1000);
    const sealed = await seal(key, 'x', 'day', { secret: 'sleep-5h' });
    expect(atob(sealed.ct)).not.toContain('sleep-5h');
  });

  it('fails with the wrong passphrase', async () => {
    const salt = randomBytes(16);
    const good = await deriveVaultKey('right passphrase', salt, 1000);
    const bad = await deriveVaultKey('wrong passphrase', salt, 1000);
    const sealed = await seal(good, 'id', 'day', { a: 1 });
    await expect(open(bad, 'id', 'day', sealed)).rejects.toBeTruthy();
  });

  it('binds ciphertext to its record id (tamper-proof)', async () => {
    const key = await deriveVaultKey('correct horse battery', randomBytes(16), 1000);
    const sealed = await seal(key, 'day:A', 'day', { a: 1 });
    await expect(open(key, 'day:B', 'day', sealed)).rejects.toBeTruthy();
  });
});
