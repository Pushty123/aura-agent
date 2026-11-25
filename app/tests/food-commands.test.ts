import { describe, expect, it } from 'vitest';
import { parseFood } from '../src/food/parse';
import { parseCommand } from '../src/commands/parse';

describe('food parsing', () => {
  it('parses "2 rotis and dal"', () => {
    const r = parseFood('2 rotis and dal');
    expect(r.items.map((i) => [i.food.name, i.qty])).toEqual([['roti', 2], ['dal', 1]]);
    expect(r.kcal).toBe(2 * 100 + 150);
    expect(r.unmatched).toEqual([]);
  });
  it('prefers the longer match (masala dosa over dosa)', () => {
    expect(parseFood('1 masala dosa').items[0].food.name).toBe('masala dosa');
  });
  it('reports unknown foods instead of guessing', () => {
    const r = parseFood('2 rotis, dragonfruit smoothie');
    expect(r.unmatched).toEqual(['dragonfruit smoothie']);
    expect(r.items).toHaveLength(1);
  });
  it('understands number words', () => {
    expect(parseFood('two eggs').items[0].qty).toBe(2);
  });
});

describe('command parsing', () => {
  it('creates a confirmation description with the alarm title and time', () => {
    expect(parseCommand('set an alarm for 6:30 am', '2026-11-24')).toMatchObject({
      type: 'alarm',
      summary: 'Set an alarm titled "AURA" for 06:30.',
    });
  });

  it('creates a confirmation description with the event title, date, and time', () => {
    expect(parseCommand('add event study group tomorrow 5 pm', '2026-11-24')).toMatchObject({
      type: 'event',
      summary: 'Add calendar event "study group" on 2026-11-25 at 17:00.',
    });
  });

  it('parses alarms', () => {
    expect(parseCommand('set an alarm for 6:30 am', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 6, minute: 30 });
    expect(parseCommand('wake me at 7 pm', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 19, minute: 0 });
    expect(parseCommand('alarm 12 am', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 0 });
    expect(parseCommand('alarm 7pm', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 19, minute: 0 });
    expect(parseCommand('wake me at 6', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 6, minute: 0 });
    expect(parseCommand('set an alarm for 6:30 pm', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 18, minute: 30 });
    expect(parseCommand('set an alarm for 12 pm', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 12, minute: 0 });
  });
  it('parses events with tomorrow and am/pm times', () => {
    const c = parseCommand('add event study group tomorrow 5 pm', '2026-11-24');
    expect(c).toMatchObject({ type: 'event', date: '2026-11-25', hour: 17, minute: 0 });
    expect((c as { title: string }).title.toLowerCase()).toContain('study group');

    expect(parseCommand('schedule a meeting tomorrow at 3', '2026-11-24')).toMatchObject({
      type: 'event',
      title: 'meeting',
      date: '2026-11-25',
      hour: 3,
      minute: 0,
    });
    expect(parseCommand('remind me to walk at 5 pm', '2026-11-24')).toMatchObject({
      type: 'event',
      title: 'walk',
      date: '2026-11-24',
      hour: 17,
      minute: 0,
    });
    expect(parseCommand('remind me to walk tomorrow at 5 pm', '2026-11-24')).toMatchObject({
      type: 'event',
      title: 'walk',
      date: '2026-11-25',
      hour: 17,
      minute: 0,
    });
    expect(parseCommand('create event for today at 9:15 pm', '2026-11-24')).toMatchObject({
      type: 'event',
      date: '2026-11-24',
      hour: 21,
      minute: 15,
    });
  });
  it('returns unknown for unsupported or malformed input without throwing', () => {
    const badInputs = [
      'delete all my data',
      'set an alarm for sometime',
      'alarm 25 pm',
      'alarm 6:75 am',
      'schedule a meeting tomorrow sometime',
      '',
      '   ',
      null,
      undefined,
      42,
    ];

    for (const input of badInputs) {
      expect(() => parseCommand(input as string, '2026-11-24')).not.toThrow();
      expect(parseCommand(input as string, '2026-11-24').type).toBe('unknown');
    }

    expect(parseCommand('schedule a meeting tomorrow at 3', 'not-a-date').type).toBe('unknown');
    expect(parseCommand('delete all my data', '2026-11-24').summary).toContain('did not understand');
  });
});
