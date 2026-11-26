/** One record per day. All values are optional because sources may be switched off. */
export type DataSource = 'demo' | 'device' | 'manual' | 'csv';

export interface DayRecord {
  /** ISO date, YYYY-MM-DD. This is also the record id. */
  date: string;
  /** Hours slept the night ending on this date. */
  sleepHours?: number;
  steps?: number;
  /** Total screen time that day, in minutes. */
  screenMinutes?: number;
  /** Screen time after 23:00 on the evening before this date's sleep, in minutes. */
  lateScreenMin?: number;
  /** 1 (low) – 5 (great). */
  mood?: 1 | 2 | 3 | 4 | 5;
  waterGlasses?: number;
  caffeineCups?: number;
  workout?: boolean;
  source: DataSource;
}

export interface FoodEntry {
  id: string;
  date: string;
  text: string;
  kcal: number;
  proteinG: number;
  unmatched: string[];
}

export interface Evidence {
  /** Number of days used. */
  n: number;
  /** Effect in human units (e.g. -72 minutes of sleep). */
  effect: number;
  unit: string;
  /** Spearman rank correlation, if relevant. */
  rho?: number;
  /** Permutation-test p-value, if relevant. */
  p?: number;
  /** Days that matched the pattern, for "14 of 18 nights" style text. */
  matched?: number;
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  evidence?: Evidence;
  confidence: 'low' | 'medium' | 'high';
  /** What the user can do about it. */
  suggestion?: string;
  /** Used for ranking. */
  score: number;
  /** True when there was not enough data and this is a placeholder. */
  notEnoughData?: boolean;
}

export type DataKind = 'day' | 'food' | 'goal' | 'settings' | 'workout';
