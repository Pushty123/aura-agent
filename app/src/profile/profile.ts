import { getRecord, putRecord } from '../lib/vault';

export type Sex = 'female' | 'male' | 'other';
export type Activity = 'low' | 'light' | 'moderate' | 'high';
export type GoalKind = 'lose' | 'maintain' | 'gain';
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bloodGroup: BloodGroup;
  allergies: string;
  activity: Activity;
  goal: GoalKind;
  updatedAt: number;
}

export interface Targets {
  bmi: number;
  bmiBand: string;
  bmr: number;
  kcal: number;
  proteinG: number;
}

/** Returns a plain-words error, or null if the profile is fine. */
export function validateProfile(p: Partial<Profile>): string | null {
  if (!p.name || !p.name.trim()) return 'Please enter your name.';
  if (!p.age || p.age < 10 || p.age > 110) return 'Age must be between 10 and 110.';
  if (!p.heightCm || p.heightCm < 100 || p.heightCm > 250) return 'Height must be between 100 and 250 cm.';
  if (!p.weightKg || p.weightKg < 25 || p.weightKg > 300) return 'Weight must be between 25 and 300 kg.';
  if (p.allergies && p.allergies.length > 300) return 'Keep allergies under 300 characters.';
  return null;
}

const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
const GOAL_ADJUST: Record<GoalKind, number> = { lose: -400, maintain: 0, gain: 300 };

export function bmiBand(bmi: number): string {
  if (bmi < 18.5) return 'Below the usual range';
  if (bmi < 25) return 'In the usual range';
  if (bmi < 30) return 'Above the usual range';
  return 'Well above the usual range';
}

/**
 * Approximate wellness targets (Mifflin-St Jeor). Not medical advice.
 * "other" uses the midpoint of the male and female constants.
 */
export function computeTargets(p: Pick<Profile, 'age' | 'sex' | 'heightCm' | 'weightKg' | 'activity' | 'goal'>): Targets {
  const m = p.heightCm / 100;
  const bmi = Math.round((p.weightKg / (m * m)) * 10) / 10;
  const sexConst = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  const bmr = Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sexConst);
  const kcal = Math.max(1200, Math.round((bmr * ACTIVITY_FACTOR[p.activity] + GOAL_ADJUST[p.goal]) / 10) * 10);
  const perKg = p.goal === 'maintain' ? 1.0 : 1.2;
  return { bmi, bmiBand: bmiBand(bmi), bmr, kcal, proteinG: Math.round(p.weightKg * perKg) };
}

export async function loadProfile(): Promise<Profile | undefined> {
  return getRecord<Profile>('settings', 'profile');
}

export async function saveProfile(p: Profile): Promise<void> {
  await putRecord('settings', 'profile', { ...p, name: p.name.trim(), allergies: p.allergies.trim(), updatedAt: Date.now() });
}
