import { describe, expect, it } from 'vitest';
import { FOODS } from '../src/food/foods';
import { parseFood } from '../src/food/parse';

describe('food parser', () => {
  it('parses quantities and totals foods separated by commas and "and"', () => {
    const result = parseFood('2 rotis, dal and curd');

    expect(result.items.map(({ food, qty }) => [food.name, qty])).toEqual([
      ['roti', 2],
      ['dal', 1],
      ['curd', 1],
    ]);
    expect(result.kcal).toBe(450);
    expect(result.unmatched).toEqual([]);
  });

  it('recognises required Indian foods, aliases, and plurals', () => {
    const foods = 'roti, chapatis, dal, curd, rice, idlis, dosa, paneer, eggs, banana, sambar, upma, poha, chai, milk';
    const result = parseFood(foods);

    expect(result.items.map(({ food }) => food.name)).toEqual([
      'roti', 'roti', 'dal', 'curd', 'rice', 'idli', 'dosa', 'paneer',
      'egg', 'banana', 'sambar', 'upma', 'poha', 'tea', 'milk',
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it('supports number words, decimal quantities, and serving units', () => {
    const result = parseFood('two bananas and 1.5 cups of milk');

    expect(result.items.map(({ food, qty }) => [food.name, qty])).toEqual([
      ['banana', 2],
      ['milk', 1.5],
    ]);
    expect(result.kcal).toBe(435);
  });

  it('returns unknown foods as unmatched without partial matches', () => {
    const result = parseFood('2 rotis, mystery paneer smoothie');

    expect(result.items.map(({ food, qty }) => [food.name, qty])).toEqual([['roti', 2]]);
    expect(result.unmatched).toEqual(['mystery paneer smoothie']);
  });

  it('marks calorie totals as approximate and not medical advice', () => {
    expect(parseFood('2 rotis').note).toMatch(/approximate estimates.*not medical advice/i);
  });
});

describe('food table', () => {
  it('has about 200 foods with valid fields', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(200);
    for (const f of FOODS) {
      expect(f.name.trim()).not.toBe('');
      expect(f.unit.trim()).not.toBe('');
      expect(f.kcal).toBeGreaterThan(0);
      expect(f.proteinG).toBeGreaterThanOrEqual(0);
      expect(f.name).toBe(f.name.toLowerCase());
    }
  });

  it('has no duplicate names or aliases', () => {
    const words = FOODS.flatMap((f) => [f.name, ...f.aliases]);
    expect(new Set(words).size).toBe(words.length);
  });

  it('resolves every name and alias to its own food', () => {
    for (const f of FOODS) {
      for (const term of [f.name, ...f.aliases]) {
        const r = parseFood(term);
        expect(r.unmatched, term).toEqual([]);
        expect(r.items.map((i) => i.food.name), term).toEqual([f.name]);
      }
    }
  });

  it('estimates new foods correctly', () => {
    const idli = parseFood('2 idli sambar');
    expect(idli.items).toHaveLength(1);
    expect(idli.kcal).toBe(420);
    expect(idli.proteinG).toBe(16);
    expect(parseFood('2 aloo paratha').kcal).toBe(560);
    expect(parseFood('1 palak paneer and 2 roti').kcal).toBe(440);
    expect(parseFood('apple').kcal).toBe(95);
  });

  it('keeps longer names winning over shorter ones', () => {
    expect(parseFood('masala dosa').items[0].food.name).toBe('masala dosa');
    expect(parseFood('sweet lassi').items[0].food.name).toBe('sweet lassi');
  });
});