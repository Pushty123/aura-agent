import { FOODS, type Food } from './foods';

export interface ParsedFood {
  food: Food;
  qty: number;
}
export interface ParseResult {
  items: ParsedFood[];
  kcal: number;
  proteinG: number;
  /** Words we could not match, so the UI can say so instead of guessing. */
  unmatched: string[];
  note: string;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
};

const SERVING_UNITS = new Set(['bowl', 'cup', 'glass', 'katori', 'plate', 'piece', 'serving']);

function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
      if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
      return word;
    })
    .join(' ');
}

const LOOKUP = new Map<string, Food>(
  FOODS.flatMap((food) => [food.name, ...food.aliases].map((term) => [normalizeTerm(term), food] as const)),
);

/** Parse text like "2 rotis and dal, 1 banana" into an estimate. */
export function parseFood(text: string): ParseResult {
  const parts = text
    .toLowerCase()
    .split(/,|\band\b|\bwith\b|\+|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const items: ParsedFood[] = [];
  const unmatched: string[] = [];

  for (const part of parts) {
    const m = part.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)?\s*(?:x\s*)?(.*)$/);
    const qtyRaw = m?.[1];
    const rest = (m?.[2] ?? part)
      .trim()
      .replace(/^(?:of\s+)?/, '')
      .replace(/^(\w+)\s+(?:of\s+)?/u, (prefix, unit: string) => (
        SERVING_UNITS.has(normalizeTerm(unit)) ? '' : prefix
      ))
      .trim();
    const qty = qtyRaw ? (NUMBER_WORDS[qtyRaw] ?? Number(qtyRaw)) : 1;
    const food = LOOKUP.get(normalizeTerm(rest));
    if (food && Number.isFinite(qty) && qty > 0 && qty <= 20) items.push({ food, qty });
    else unmatched.push(part);
  }

  const kcal = Math.round(items.reduce((s, i) => s + i.food.kcal * i.qty, 0));
  const proteinG = Math.round(items.reduce((s, i) => s + i.food.proteinG * i.qty, 0) * 10) / 10;
  return { items, kcal, proteinG, unmatched, note: 'Approximate estimates only; not medical advice.' };
}

/** Plain, non-medical tip based on today's totals. */
export function foodTip(totalProteinG: number, mealsLogged: number): string {
  if (mealsLogged === 0) return 'Log a meal to get a tip.';
  if (totalProteinG < 40) return 'Protein looks low so far today. Dal, eggs, curd or paneer could help. (General tip, not medical advice.)';
  return 'Protein looks reasonable so far today. (General tip, not medical advice.)';
}
