import { getAll, putRecord } from '../lib/vault';
import type { ExerciseId } from './reps';

export interface Workout {
  id: string;
  date: string;
  exercise: ExerciseId;
  reps: number;
  seconds: number;
  ts: number;
}

export async function saveWorkout(w: Omit<Workout, 'id' | 'ts'>): Promise<Workout> {
  const full: Workout = { ...w, id: `w${Date.now()}`, ts: Date.now() };
  await putRecord('workout', full.id, full);
  return full;
}

export async function loadWorkouts(): Promise<Workout[]> {
  return (await getAll<Workout>('workout')).sort((a, b) => b.ts - a.ts);
}
