import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { DEFAULT_LOCK_MS, getLockAfter, lockLabel, setLockAfter } from '../src/lib/security';
import { biometricStatus, biometricEnable, biometricUnlock } from '../src/native/bridge';

describe('lock-after setting', () => {
  beforeEach(async () => {
    await db.meta.clear();
  });
  it('defaults to 5 minutes and remembers a choice', async () => {
    expect(await getLockAfter()).toBe(DEFAULT_LOCK_MS);
    await setLockAfter(60_000);
    expect(await getLockAfter()).toBe(60_000);
    await setLockAfter(0);
    expect(await getLockAfter()).toBe(0);
    expect(lockLabel(0)).toBe('Only when I close the app');
  });
  it('rejects unknown values and ignores corrupted ones', async () => {
    await expect(setLockAfter(1234)).rejects.toThrow();
    await db.meta.put({ key: 'lock-after', value: 'banana' });
    expect(await getLockAfter()).toBe(DEFAULT_LOCK_MS);
  });
});

describe('fingerprint bridge on the web', () => {
  it('reports web and never pretends to unlock', async () => {
    expect(await biometricStatus()).toEqual({ state: 'web', enabled: false });
    expect((await biometricEnable('x')).ok).toBe(false);
    expect((await biometricUnlock()).ok).toBe(false);
  });
});
