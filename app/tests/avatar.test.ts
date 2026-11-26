import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import * as vault from '../src/lib/vault';
import { avatarMood } from '../src/avatar/mood';
import { DEFAULT_CHOICE, loadAvatarChoice, saveAvatarChoice } from '../src/avatar/choice';

describe('avatarMood', () => {
  const day = (sleepHours?: number) => ({ date: '2026-11-25', source: 'manual' as const, sleepHours });

  it('is neutral with no data', () => {
    expect(avatarMood(undefined, null).tone).toBe('none');
  });
  it('looks sleepy after a short night, whatever the score', () => {
    const m = avatarMood(day(5), 90);
    expect(m).toMatchObject({ tone: 'low', eyes: 'sleepy' });
  });
  it('grins when in balance, smiles when okay, stays calm when low', () => {
    expect(avatarMood(day(8), 80)).toMatchObject({ tone: 'good', mouth: 'grin' });
    expect(avatarMood(day(7), 60)).toMatchObject({ tone: 'ok', mouth: 'smile' });
    expect(avatarMood(day(7), 30)).toMatchObject({ tone: 'low', mouth: 'calm' });
  });
});

describe('avatar choice', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    vault.lock();
    await vault.createVault('passphrase-123');
  });
  it('defaults to the first preset and remembers a new choice, encrypted', async () => {
    expect(await loadAvatarChoice()).toEqual(DEFAULT_CHOICE);
    await saveAvatarChoice({ kind: 'preset', id: '07-halo-crop' });
    expect(await loadAvatarChoice()).toEqual({ kind: 'preset', id: '07-halo-crop' });
    expect(JSON.stringify(await db.records.toArray())).not.toContain('halo-crop');
  });
  it('falls back to the default if a stored preset no longer exists', async () => {
    await vault.putRecord('settings', 'avatar', { kind: 'preset', id: 'gone' });
    expect(await loadAvatarChoice()).toEqual(DEFAULT_CHOICE);
  });
});
