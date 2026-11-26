import arjunStanding from '../assets/characters/arjun-standing.webp';
import ananyaStanding from '../assets/characters/ananya-standing.webp';
import kabirStanding from '../assets/characters/kabir-standing.webp';
import meeraStanding from '../assets/characters/meera-standing.webp';

/**
 * AURA's fixed full-body characters (original AI-generated designs owned by
 * Team Phoenix). Each can have up to four poses; missing poses fall back to
 * "standing". Add a pose by dropping e.g. `arjun-wave.webp` in
 * src/assets/characters and listing it here.
 */
export type Pose = 'standing' | 'wave' | 'tired' | 'walk';

export interface Character {
  id: string;
  name: string;
  tagline: string;
  poses: Partial<Record<Pose, string>> & { standing: string };
  /** Where the face is, as a fraction of image height, for round head crops. */
  faceY: number;
}

export const CHARACTERS: Character[] = [
  { id: 'ananya', name: 'Ananya', tagline: 'Calm and curious', poses: { standing: ananyaStanding }, faceY: 0.13 },
  { id: 'arjun', name: 'Arjun', tagline: 'Easy-going and active', poses: { standing: arjunStanding }, faceY: 0.11 },
  { id: 'meera', name: 'Meera', tagline: 'Stylish and focused', poses: { standing: meeraStanding }, faceY: 0.13 },
  { id: 'kabir', name: 'Kabir', tagline: 'Cool and confident', poses: { standing: kabirStanding }, faceY: 0.1 },
];

export function characterById(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

/** Pick the pose that matches the day; falls back to standing. */
export function poseFor(c: Character, tone: 'good' | 'ok' | 'low' | 'none', sleepy: boolean, active: boolean): string {
  if (sleepy && c.poses.tired) return c.poses.tired;
  if (active && c.poses.walk) return c.poses.walk;
  if (tone === 'good' && c.poses.wave) return c.poses.wave;
  return c.poses.standing;
}
