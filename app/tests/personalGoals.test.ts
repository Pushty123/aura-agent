import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import {
  classifyGoal,
  completePersonalGoal,
  extendGoalDate,
  goalNotificationItems,
  isGoalOverdue,
  loadBucketItems,
  loadCelebrationsEnabled,
  loadPersonalGoals,
  markBucketAchieved,
  newBucketItem,
  newPersonalGoal,
  personalGoalProgress,
  saveBucketItems,
  saveCelebrationsEnabled,
  savePersonalGoals,
  toggleGoalMilestone,
  validateBucketItem,
} from '../src/goals/personalGoals';
import { lock, createVault } from '../src/lib/vault';
import type { RoutineResponse } from '../src/reminders/routine';

describe('personal goals and bucket list', () => {
  beforeEach(async () => {
    await db.meta.clear();
    await db.records.clear();
    await db.audit.clear();
    lock();
    await createVault('passphrase-123');
  });

  it('classifies by the three-month boundary, and offers a gentle overdue extension', () => {
    const goal = newPersonalGoal({ targetDate: '2026-05-25' });
    expect(classifyGoal(goal, '2026-02-26')).toBe('short-term');
    expect(classifyGoal({ ...goal, targetDate: '2026-05-26' }, '2026-02-26')).toBe('long-term');
    expect(classifyGoal({ ...goal, targetDate: undefined }, '2026-02-26')).toBe('short-term');

    expect(isGoalOverdue(goal, '2026-05-26')).toBe(true);
    expect(isGoalOverdue({ ...goal, completedAt: '2026-05-25' }, '2026-05-26')).toBe(false);
    expect(extendGoalDate(goal, '2026-05-26')).toBe('2026-06-26');
  });

  it('calculates milestone and linked-routine progress without taking a routine completion from before the goal', () => {
    const goal = newPersonalGoal({
      routineItemId: 'walk',
      routineLinkedAt: '2026-02-27',
      routineTarget: 2,
      createdAt: new Date('2026-02-26T12:00:00Z').getTime(),
      milestones: [
        { id: 'm1', title: 'Choose a route', completedAt: '2026-02-26' },
        { id: 'm2', title: 'Invite a friend' },
      ],
    });
    const responses: RoutineResponse[] = [
      { routineId: 'walk', date: '2026-02-25', status: 'done', recordedAt: '2026-02-25T10:00:00Z' },
      { routineId: 'walk', date: '2026-02-26', status: 'done', recordedAt: '2026-02-26T10:00:00Z' },
      { routineId: 'walk', date: '2026-02-27', status: 'done', recordedAt: '2026-02-27T10:00:00Z' },
      { routineId: 'walk', date: '2026-02-28', status: 'not-now', recordedAt: '2026-02-28T10:00:00Z' },
    ];
    expect(personalGoalProgress(goal, responses, '2026-03-01')).toEqual({
      percent: 50,
      completedMilestones: 1,
      totalMilestones: 2,
      routineCompletions: 1,
      complete: false,
    });
    expect(toggleGoalMilestone(goal, 'm2', '2026-03-01').completedAt).toBeUndefined();
  });

  it('records milestone completion, goal completion, and dated bucket achievements in the encrypted vault', async () => {
    const goal = newPersonalGoal({
      title: 'Learn a song',
      milestones: [
        { id: 'm1', title: 'Pick a song' },
        { id: 'm2', title: 'Practice the chorus' },
      ],
    });
    const first = toggleGoalMilestone(goal, 'm1', '2026-02-26');
    expect(first.completedAt).toBeUndefined();
    const completed = toggleGoalMilestone(first, 'm2', '2026-02-27');
    expect(completed.completedAt).toBe('2026-02-27');
    expect(completePersonalGoal(goal, '2026-02-28').completedAt).toBe('2026-02-28');

    const item = markBucketAchieved(newBucketItem({ title: 'See the northern lights' }), '2026-02-28');
    expect(validateBucketItem(item)).toBeNull();
    await savePersonalGoals([completed]);
    await saveBucketItems([item]);
    expect((await loadPersonalGoals())[0].completedAt).toBe('2026-02-27');
    expect((await loadBucketItems())[0].achievedAt).toBe('2026-02-28');
    expect(JSON.stringify(await db.records.toArray())).not.toContain('Learn a song');
    expect(JSON.stringify(await db.records.toArray())).not.toContain('northern lights');
  });

  it('stores the celebration preference encrypted and only schedules enabled future goal reminders', async () => {
    expect(await loadCelebrationsEnabled()).toBe(true);
    await saveCelebrationsEnabled(false);
    expect(await loadCelebrationsEnabled()).toBe(false);

    const now = new Date(2026, 1, 26, 10, 0);
    const notifications = goalNotificationItems([
      newPersonalGoal({ id: 'future', title: 'Future', targetDate: '2026-02-27', reminderEnabled: true }),
      newPersonalGoal({ id: 'disabled', title: 'Disabled', targetDate: '2026-02-27', reminderEnabled: false }),
      newPersonalGoal({ id: 'done', title: 'Done', targetDate: '2026-02-27', reminderEnabled: true, completedAt: '2026-02-26' }),
    ], now);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].extra).toMatchObject({ kind: 'goal-date', goalId: 'future' });
    expect(JSON.stringify(await db.records.toArray())).not.toContain('false');
  });
});
