import { describe, expect, it } from 'vitest';
import { localReply } from '../src/ask/localBrain';
import type { DayRecord } from '../src/types';

const days: DayRecord[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  date: `2026-11-${20 + n - 1}`,
  source: 'manual',
  sleepHours: 6,
  steps: 5000,
  screenMinutes: 360,
  lateScreenMin: 50,
  waterGlasses: 5,
  mood: 3,
}));
const D = '2026-11-26';

describe('built-in answers', () => {
  it('answers common questions from the person’s own data', () => {
    expect(localReply('how much screen time do I have', days, [], D)?.text).toContain('6 h 0 min');
    expect(localReply('am I drinking enough water?', days, [], D)?.text).toContain('5.0 glasses');
    expect(localReply('how am i doing this week', days, [], D)?.text).toContain('earlier bedtime');
    expect(localReply('hi', days, [], D)?.text).toContain('Hi');
    expect(localReply('give me a tip', days, [], D)?.text).toContain('11 pm');
  });
  it('uses the food log and says when there is nothing yet', () => {
    expect(localReply('what did I eat', days, [], D)?.text).toContain('Nothing logged today');
    const food = [{ id: 'f', date: D, text: 'dal rice', kcal: 450, proteinG: 14, ts: 1 }] as never[];
    expect(localReply('calories today', days, food, D)?.text).toContain('450 kcal');
  });
  it('returns null for things it cannot answer', () => {
    expect(localReply('who won the cricket match', days, [], D)).toBeNull();
  });
});
