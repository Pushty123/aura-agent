import { describe, expect, it } from 'vitest';
import { streaks } from '../src/goals/badges';
import type { DayRecord } from '../src/types';

const day = (n: number, p: Partial<DayRecord>): DayRecord => ({ date: `2026-11-${String(n).padStart(2, '0')}`, source: 'manual', ...p });

describe('streak badges', () => {
  it('counts the current streak and does not break before today is logged', () => {
    const days = [day(22, { sleepHours: 7.5 }), day(23, { sleepHours: 8 }), day(24, { sleepHours: 7 }), day(25, { sleepHours: 7.2 }), day(26, { steps: 2000 })];
    const s = streaks(days, '2026-11-26').find((x) => x.def.id === 'sleep')!;
    expect(s.current).toBe(4);
    expect(s.tier?.name).toBe('Bronze');
    expect(s.next?.name).toBe('Silver');
  });
  it('breaks on a missed day and keeps the best run', () => {
    const days = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => day(n, { steps: 9000 })).concat([day(9, { steps: 3000 }), day(10, { steps: 9000 })]);
    const s = streaks(days, '2026-11-10').find((x) => x.def.id === 'steps')!;
    expect(s.current).toBe(1);
    expect(s.best).toBe(8);
    expect(s.tier?.name).toBe('Silver');
  });
  it('a gap in dates ends the run', () => {
    const days = [day(1, { mood: 3 }), day(2, { mood: 4 }), day(5, { mood: 4 })];
    const s = streaks(days, '2026-11-05').find((x) => x.def.id === 'checkin')!;
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
    expect(s.tier).toBeNull();
  });
  it('less screen time is the goal for screen badges', () => {
    const s = streaks([day(25, { screenMinutes: 200 }), day(26, { screenMinutes: 100 })], '2026-11-26').find((x) => x.def.id === 'screen')!;
    expect(s.current).toBe(2);
  });
});
