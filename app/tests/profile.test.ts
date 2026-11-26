import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import { computeTargets, loadProfile, saveProfile, validateProfile, type Profile } from '../src/profile/profile';

const base: Profile = {
  name: 'Asha',
  age: 30,
  sex: 'female',
  heightCm: 165,
  weightKg: 60,
  bloodGroup: 'O+',
  allergies: 'peanuts',
  activity: 'moderate',
  goal: 'maintain',
  updatedAt: 0,
};

describe('profile', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    vault.lock();
  });

  it('computes BMI and targets with the Mifflin-St Jeor formula', () => {
    const t = computeTargets(base);
    expect(t.bmi).toBe(22);
    expect(t.bmr).toBe(1320); // 600 + 1031.25 - 150 - 161 = 1320.25
    expect(t.kcal).toBe(2050); // 1320 * 1.55 = 2046 -> 2050
    expect(t.proteinG).toBe(60);
    expect(t.bmiBand).toBe('In the usual range');
  });

  it('adjusts for goal and never goes under 1200 kcal', () => {
    expect(computeTargets({ ...base, goal: 'lose' }).kcal).toBeLessThan(computeTargets(base).kcal);
    expect(computeTargets({ ...base, goal: 'gain' }).kcal).toBeGreaterThan(computeTargets(base).kcal);
    expect(computeTargets({ ...base, weightKg: 30, heightCm: 140, age: 80, activity: 'low', goal: 'lose' }).kcal).toBe(1200);
  });

  it('rejects impossible values with plain messages', () => {
    expect(validateProfile({ ...base, name: ' ' })).toContain('name');
    expect(validateProfile({ ...base, heightCm: 20 })).toContain('Height');
    expect(validateProfile({ ...base, weightKg: 900 })).toContain('Weight');
    expect(validateProfile({ ...base, age: 3 })).toContain('Age');
    expect(validateProfile(base)).toBeNull();
  });

  it('stores the profile encrypted, readable only when unlocked', async () => {
    await vault.createVault('passphrase-123');
    await saveProfile(base);
    const raw = JSON.stringify(await db.records.toArray());
    expect(raw).not.toContain('Asha');
    expect(raw).not.toContain('peanuts');
    expect((await loadProfile())?.bloodGroup).toBe('O+');
    vault.lock();
    await expect(loadProfile()).rejects.toThrow();
  });
});
