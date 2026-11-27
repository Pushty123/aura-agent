import { getRecord, putRecord } from '../lib/vault';
import type { RoutineResponse } from '../reminders/routine';
import { notificationId } from '../reminders/notificationIds';

export type GoalCategory = 'health' | 'study' | 'habit' | 'personal' | 'other';
export type GoalTerm = 'short-term' | 'long-term';

export interface GoalMilestone {
  id: string;
  title: string;
  completedAt?: string;
}

export interface PersonalGoal {
  id: string;
  title: string;
  category: GoalCategory;
  targetDate?: string;
  target?: string;
  milestones: GoalMilestone[];
  routineItemId?: string;
  routineLinkedAt?: string;
  routineTarget: number;
  reminderEnabled: boolean;
  createdAt: number;
  archivedAt?: string;
  completedAt?: string;
}

export interface BucketItem {
  id: string;
  title: string;
  note?: string;
  targetYear?: number;
  category?: GoalCategory;
  createdAt: number;
  achievedAt?: string;
}

export interface PersonalGoalProgress {
  percent: number;
  completedMilestones: number;
  totalMilestones: number;
  routineCompletions: number;
  complete: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES: GoalCategory[] = ['health', 'study', 'habit', 'personal', 'other'];

function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function classifyGoal(goal: Pick<PersonalGoal, 'targetDate'>, today: string): GoalTerm {
  return goal.targetDate && goal.targetDate >= addMonths(today, 3) ? 'long-term' : 'short-term';
}

export function isGoalOverdue(goal: PersonalGoal, today: string): boolean {
  return !!goal.targetDate && goal.targetDate < today && !goal.archivedAt && !goal.completedAt;
}

export function extendGoalDate(goal: PersonalGoal, today: string, months = 1): string {
  return addMonths(goal.targetDate && goal.targetDate >= today ? goal.targetDate : today, months);
}

export function personalGoalProgress(
  goal: PersonalGoal,
  responses: RoutineResponse[],
  today: string,
): PersonalGoalProgress {
  const completedMilestones = goal.milestones.filter((milestone) => milestone.completedAt).length;
  const routineCompletions = goal.routineItemId
    ? responses.filter((response) =>
        response.routineId === goal.routineItemId
        && response.status === 'done'
          && response.date >= (goal.routineLinkedAt ?? new Date(goal.createdAt).toISOString().slice(0, 10))
        && response.date <= today,
      ).length
    : 0;
  const total = goal.milestones.length + (goal.routineItemId ? goal.routineTarget : 0);
  const percent = goal.completedAt
    ? 100
    : total
      ? Math.min(100, Math.round(((completedMilestones + routineCompletions) / total) * 100))
      : 0;
  return {
    percent,
    completedMilestones,
    totalMilestones: goal.milestones.length,
    routineCompletions,
    complete: !!goal.completedAt,
  };
}

export function toggleGoalMilestone(goal: PersonalGoal, milestoneId: string, date: string): PersonalGoal {
  const milestones = goal.milestones.map((milestone) => {
    if (milestone.id !== milestoneId) return milestone;
    return milestone.completedAt
      ? { id: milestone.id, title: milestone.title }
      : { ...milestone, completedAt: date };
  });
  const allDone = milestones.length > 0
    && milestones.every((milestone) => !!milestone.completedAt)
    && !goal.routineItemId;
  return {
    ...goal,
    milestones,
    completedAt: allDone ? goal.completedAt ?? date : undefined,
  };
}

export function completePersonalGoal(goal: PersonalGoal, date: string): PersonalGoal {
  return { ...goal, completedAt: goal.completedAt ?? date };
}

export function markBucketAchieved(item: BucketItem, date: string): BucketItem {
  return { ...item, achievedAt: item.achievedAt ?? date };
}

export function validatePersonalGoal(goal: PersonalGoal): string | null {
  if (!goal.title.trim()) return 'Give the goal a name.';
  if (goal.title.trim().length > 80) return 'Keep the goal name under 80 characters.';
  if (!CATEGORIES.includes(goal.category)) return 'Choose a category.';
  if (goal.targetDate && !isValidDate(goal.targetDate)) return 'Choose a valid target date.';
  if (goal.target && goal.target.length > 120) return 'Keep the target under 120 characters.';
  if (!Number.isInteger(goal.routineTarget) || goal.routineTarget < 1 || goal.routineTarget > 365) {
    return 'Routine completion target must be between 1 and 365.';
  }
  if (goal.milestones.some((milestone) => !milestone.title.trim() || milestone.title.length > 80)) {
    return 'Give each milestone a name under 80 characters.';
  }
  return null;
}

export function validateBucketItem(item: BucketItem): string | null {
  if (!item.title.trim()) return 'Give your dream a name.';
  if (item.title.trim().length > 80) return 'Keep the title under 80 characters.';
  if (item.note && item.note.length > 280) return 'Keep the note under 280 characters.';
  if (item.targetYear !== undefined && (!Number.isInteger(item.targetYear) || item.targetYear < 1900 || item.targetYear > 9999)) {
    return 'Choose a valid target year.';
  }
  if (item.category && !CATEGORIES.includes(item.category)) return 'Choose a valid category.';
  if (item.achievedAt && !isValidDate(item.achievedAt)) return 'Choose a valid achievement date.';
  return null;
}

export function newPersonalGoal(over: Partial<PersonalGoal> = {}): PersonalGoal {
  return {
    id: `personal-goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: '',
    category: 'personal',
    milestones: [],
    routineTarget: 10,
    reminderEnabled: false,
    createdAt: Date.now(),
    ...over,
  };
}

export function newBucketItem(over: Partial<BucketItem> = {}): BucketItem {
  return {
    id: `bucket-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: '',
    createdAt: Date.now(),
    ...over,
  };
}

export async function loadPersonalGoals(): Promise<PersonalGoal[]> {
  return (await getRecord<PersonalGoal[]>('settings', 'personal-goals')) ?? [];
}

export async function savePersonalGoals(goals: PersonalGoal[]): Promise<void> {
  const ids = new Set<string>();
  for (const goal of goals) {
    const error = validatePersonalGoal(goal);
    if (error) throw new Error(error);
    if (ids.has(goal.id)) throw new Error('Goals must have unique identifiers.');
    ids.add(goal.id);
  }
  await putRecord('settings', 'personal-goals', goals);
}

export async function loadBucketItems(): Promise<BucketItem[]> {
  return (await getRecord<BucketItem[]>('settings', 'bucket-list')) ?? [];
}

export async function saveBucketItems(items: BucketItem[]): Promise<void> {
  const ids = new Set<string>();
  for (const item of items) {
    const error = validateBucketItem(item);
    if (error) throw new Error(error);
    if (ids.has(item.id)) throw new Error('Bucket list items must have unique identifiers.');
    ids.add(item.id);
  }
  await putRecord('settings', 'bucket-list', items);
}

export async function loadCelebrationsEnabled(): Promise<boolean> {
  return (await getRecord<boolean>('settings', 'celebrations-enabled')) ?? true;
}

export async function saveCelebrationsEnabled(enabled: boolean): Promise<void> {
  await putRecord('settings', 'celebrations-enabled', enabled);
}

export function goalNotificationItems(goals: PersonalGoal[], now = new Date()) {
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return goals.flatMap((goal) => {
    if (!goal.targetDate || !goal.reminderEnabled || goal.archivedAt || goal.completedAt || goal.targetDate < today) return [];
    const [year, month, day] = goal.targetDate.split('-').map(Number);
    const at = new Date(year, month - 1, day, 9, 0);
    if (at.getTime() <= now.getTime()) return [];
    return [{
      id: notificationId(`goal-date:${goal.id}`, 0),
      title: 'A gentle goal reminder',
      body: `A small nudge for "${goal.title}".`,
      schedule: { at, allowWhileIdle: true },
      extra: { aura: true as const, kind: 'goal-date', goalId: goal.id },
    }];
  });
}
