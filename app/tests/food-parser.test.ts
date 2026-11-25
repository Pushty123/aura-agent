import { describe, expect, it } from 'vitest';
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
