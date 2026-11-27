import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { loadThemePreference, saveThemePreference } from '../src/lib/theme';
import { createVault, lock } from '../src/lib/vault';

describe('vault-backed theme preference', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    lock();
    await createVault('passphrase-123');
  });

  it('loads the saved theme from encrypted settings and defaults when absent', async () => {
    expect(await loadThemePreference()).toBeUndefined();
    await saveThemePreference('light');
    expect(await loadThemePreference()).toBe('light');
    expect(JSON.stringify(await db.records.get('settings:theme'))).not.toContain('light');
    await saveThemePreference('system');
    expect(await loadThemePreference()).toBe('system');
  });

  it('rejects theme access while the vault is locked', async () => {
    lock();
    await expect(saveThemePreference('dark')).rejects.toThrow('locked');
  });
});
