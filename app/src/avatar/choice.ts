import { getRecord, putRecord } from '../lib/vault';
import { CHARACTERS } from './characters';

export type AvatarChoice = { kind: 'character'; id: string } | { kind: 'photo' } | { kind: 'initials' };

export const DEFAULT_CHOICE: AvatarChoice = { kind: 'character', id: CHARACTERS[0].id };

export async function loadAvatarChoice(): Promise<AvatarChoice> {
  const c = await getRecord<AvatarChoice | { kind: string }>('settings', 'avatar');
  if (!c) return DEFAULT_CHOICE;
  if (c.kind === 'photo' || c.kind === 'initials') return c as AvatarChoice;
  if (c.kind === 'character' && CHARACTERS.some((x) => x.id === (c as { id: string }).id)) return c as AvatarChoice;
  return DEFAULT_CHOICE; // older avatar styles move to the default character
}

export async function saveAvatarChoice(c: AvatarChoice): Promise<void> {
  await putRecord('settings', 'avatar', c);
}
