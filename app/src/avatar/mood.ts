import type { AvatarPreset } from '../assets/avatars/presets';
import type { DayRecord } from '../types';

/**
 * The avatar's expression and aura colour follow your latest day, like a
 * companion that mirrors how you are doing (inspired by apps such as Finch).
 * Playful feedback only, not a health judgement.
 */
export type Tone = 'good' | 'ok' | 'low' | 'none';

export interface Mood {
  tone: Tone;
  eyes: AvatarPreset['eyes'];
  mouth: AvatarPreset['mouth'];
  label: string;
  color: string;
}

export const TONE_COLOR: Record<Tone, string> = {
  good: '#35CFC8',
  ok: '#438CCB',
  low: '#E8A33D',
  none: '#454B5C',
};

export function avatarMood(day: DayRecord | undefined, score: number | null | undefined): Mood {
  const m = (tone: Tone, eyes: Mood['eyes'], mouth: Mood['mouth'], label: string): Mood => ({
    tone,
    eyes,
    mouth,
    label,
    color: TONE_COLOR[tone],
  });
  if (!day || score === null || score === undefined) return m('none', 'warm', 'calm', 'Ready when you are');
  if (day.sleepHours !== undefined && day.sleepHours < 6) return m('low', 'sleepy', 'calm', 'Running on low sleep');
  if (score >= 75) return m('good', 'warm', 'grin', 'In balance today');
  if (score >= 50) return m('ok', 'curious', 'smile', 'Doing okay');
  return m('low', 'focused', 'calm', 'Take it easy today');
}
