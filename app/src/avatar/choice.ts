import { getRecord, putRecord } from '../lib/vault';
import { AVATAR_PRESETS, type AvatarPresetId } from '../assets/avatars/presets';

export type AvatarChoice = { kind: 'preset'; id: AvatarPresetId } | { kind: 'photo' } | { kind: 'initials' };

export const DEFAULT_CHOICE: AvatarChoice = { kind: 'preset', id: AVATAR_PRESETS[0].id };

export async function loadAvatarChoice(): Promise<AvatarChoice> {
  const c = await getRecord<AvatarChoice>('settings', 'avatar');
  if (!c) return DEFAULT_CHOICE;
  if (c.kind === 'preset' && !AVATAR_PRESETS.some((p) => p.id === c.id)) return DEFAULT_CHOICE;
  return c;
}

export async function saveAvatarChoice(c: AvatarChoice): Promise<void> {
  await putRecord('settings', 'avatar', c);
}
