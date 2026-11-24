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
  it('parses alarms', () => {
    expect(parseCommand('set an alarm for 6:30 am', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 6, minute: 30 });
    expect(parseCommand('wake me at 7 pm', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 19, minute: 0 });
    expect(parseCommand('alarm 12 am', '2026-11-24')).toMatchObject({ type: 'alarm', hour: 0 });
  });
  it('parses events with tomorrow', () => {
    const c = parseCommand('add event study group tomorrow 5 pm', '2026-11-24');
    expect(c).toMatchObject({ type: 'event', date: '2026-11-25', hour: 17, minute: 0 });
    expect((c as { title: string }).title.toLowerCase()).toContain('study group');
  });
  it('does not act on things it does not understand', () => {
    expect(parseCommand('delete all my data', '2026-11-24').type).toBe('unknown');
    expect(parseCommand('set an alarm for sometime', '2026-11-24').type).toBe('unknown');
  });
});
