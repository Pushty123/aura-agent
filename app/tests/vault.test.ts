import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';

describe('vault', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    vault.lock();
  });

  it('creates, locks and unlocks', async () => {
    await vault.createVault('passphrase-123');
    vault.lock();
    expect(await vault.unlock('nope-nope-nope')).toBe(false);
    expect(await vault.unlock('passphrase-123')).toBe(true);
  });

  it('refuses to read or write while locked', async () => {
    await vault.createVault('passphrase-123');
    vault.lock();
    await expect(vault.putRecord('day', '2026-01-01', { a: 1 })).rejects.toThrow('locked');
  });

  it('stores only ciphertext on disk', async () => {
    await vault.createVault('passphrase-123');
    await vault.putRecord('day', '2026-01-01', { sleepHours: 6.5, source: 'manual' });
    const row = await db.records.get('day:2026-01-01');
    expect(JSON.stringify(row)).not.toContain('6.5');
    expect(await vault.getRecord('day', '2026-01-01')).toMatchObject({ sleepHours: 6.5 });
  });

  it('exports plaintext for the owner', async () => {
    await vault.createVault('passphrase-123');
    await vault.putRecord('day', '2026-01-01', { sleepHours: 7, source: 'manual' });
    expect(JSON.parse(await vault.exportAll()).day).toHaveLength(1);
  });

  it('delete-all wipes everything and the vault cannot be re-opened', async () => {
    await vault.createVault('passphrase-123');
    await vault.putRecord('day', '2026-01-01', { sleepHours: 7, source: 'manual' });
    await vault.deleteAll();
    expect(await vault.vaultExists()).toBe(false);
    expect(await db.records.count()).toBe(0);
    expect(await vault.unlock('passphrase-123')).toBe(false);
  });

  it('removes records by source when a source is switched off', async () => {
    await vault.createVault('passphrase-123');
    await vault.putRecord('day', 'a', { date: 'a', source: 'demo' });
    await vault.putRecord('day', 'b', { date: 'b', source: 'manual' });
    expect(await vault.deleteRecordsBySource('demo')).toBe(1);
    expect(await vault.getAll('day')).toHaveLength(1);
  });

  it('keeps a tamper-evident audit chain', async () => {
    await vault.createVault('passphrase-123');
    await vault.setConsent('device', true);
    expect(await vault.verifyAudit()).toBe(true);
    const rows = await db.audit.toArray();
    await db.audit.update(rows[0].id!, { detail: 'edited' });
    expect(await vault.verifyAudit()).toBe(false);
  });
});
