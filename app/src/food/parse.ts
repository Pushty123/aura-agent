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
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5,
};

// Longest names first so "masala dosa" beats "dosa".
const LOOKUP: { term: string; food: Food }[] = FOODS.flatMap((f) => [f.name, ...f.aliases].map((term) => ({ term, food: f })))
  .sort((a, b) => b.term.length - a.term.length);

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
    const m = part.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|half)?\s*(?:x\s*)?(.*)$/);
    const qtyRaw = m?.[1];
    const rest = (m?.[2] ?? part).replace(/^(of|katori|bowl|plate|glass|cup|piece|pieces)\s+/, '').trim();
    const qty = qtyRaw ? (NUMBER_WORDS[qtyRaw] ?? Number(qtyRaw)) : 1;
    const hit = LOOKUP.find((l) => rest === l.term || rest.includes(l.term));
    if (hit && qty > 0 && qty <= 20) items.push({ food: hit.food, qty });
    else unmatched.push(part);
  }

  const kcal = Math.round(items.reduce((s, i) => s + i.food.kcal * i.qty, 0));
  const proteinG = Math.round(items.reduce((s, i) => s + i.food.proteinG * i.qty, 0) * 10) / 10;
  return { items, kcal, proteinG, unmatched };
}

/** Plain, non-medical tip based on today's totals. */
export function foodTip(totalProteinG: number, mealsLogged: number): string {
  if (mealsLogged === 0) return 'Log a meal to get a tip.';
  if (totalProteinG < 40) return 'Protein looks low so far today. Dal, eggs, curd or paneer could help. (General tip, not medical advice.)';
  return 'Protein looks reasonable so far today. (General tip, not medical advice.)';
}
