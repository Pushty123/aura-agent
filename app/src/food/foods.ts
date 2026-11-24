/**
 * Built-in table of common foods. Values are APPROXIMATE typical figures for one
 * serving and are meant for rough estimates only (not medical or dietary advice).
 * Review and adjust before using for anything beyond a demo.
 */
export interface Food {
  name: string;
  /** Alternative words people might type. */
  aliases: string[];
  /** What one "unit" is, shown to the user. */
  unit: string;
  kcal: number;
  proteinG: number;
}

export const FOODS: Food[] = [
  { name: 'roti', aliases: ['rotis', 'chapati', 'chapatis', 'phulka'], unit: '1 piece', kcal: 100, proteinG: 3 },
  { name: 'paratha', aliases: ['parathas'], unit: '1 piece', kcal: 230, proteinG: 5 },
  { name: 'naan', aliases: ['naans'], unit: '1 piece', kcal: 260, proteinG: 8 },
  { name: 'rice', aliases: ['steamed rice', 'chawal'], unit: '1 katori (150 g cooked)', kcal: 195, proteinG: 4 },
  { name: 'jeera rice', aliases: [], unit: '1 katori', kcal: 215, proteinG: 4 },
  { name: 'biryani', aliases: ['veg biryani', 'chicken biryani'], unit: '1 plate', kcal: 450, proteinG: 15 },
  { name: 'dal', aliases: ['daal', 'dhal', 'toor dal', 'moong dal'], unit: '1 katori', kcal: 150, proteinG: 8 },
  { name: 'rajma', aliases: [], unit: '1 katori', kcal: 190, proteinG: 9 },
  { name: 'chole', aliases: ['chana', 'chana masala'], unit: '1 katori', kcal: 210, proteinG: 9 },
  { name: 'sambar', aliases: [], unit: '1 katori', kcal: 90, proteinG: 4 },
  { name: 'paneer', aliases: ['paneer curry', 'paneer butter masala'], unit: '100 g / 1 katori', kcal: 265, proteinG: 18 },
  { name: 'egg', aliases: ['eggs', 'boiled egg', 'boiled eggs', 'omelette'], unit: '1 egg', kcal: 75, proteinG: 6 },
  { name: 'chicken curry', aliases: ['chicken'], unit: '1 katori', kcal: 240, proteinG: 22 },
  { name: 'fish curry', aliases: ['fish'], unit: '1 katori', kcal: 190, proteinG: 20 },
  { name: 'mixed veg', aliases: ['sabzi', 'vegetable curry', 'veg curry'], unit: '1 katori', kcal: 110, proteinG: 3 },
  { name: 'aloo sabzi', aliases: ['aloo', 'potato curry'], unit: '1 katori', kcal: 150, proteinG: 3 },
  { name: 'curd', aliases: ['dahi', 'yogurt', 'yoghurt'], unit: '1 katori', kcal: 100, proteinG: 5 },
  { name: 'raita', aliases: [], unit: '1 katori', kcal: 90, proteinG: 4 },
  { name: 'milk', aliases: [], unit: '1 glass (250 ml)', kcal: 150, proteinG: 8 },
  { name: 'buttermilk', aliases: ['chaas', 'lassi'], unit: '1 glass', kcal: 80, proteinG: 4 },
  { name: 'idli', aliases: ['idlis'], unit: '1 piece', kcal: 60, proteinG: 2 },
  { name: 'dosa', aliases: ['dosas', 'plain dosa'], unit: '1 piece', kcal: 135, proteinG: 3 },
  { name: 'masala dosa', aliases: [], unit: '1 piece', kcal: 250, proteinG: 5 },
  { name: 'upma', aliases: [], unit: '1 katori', kcal: 190, proteinG: 4 },
  { name: 'poha', aliases: [], unit: '1 katori', kcal: 180, proteinG: 3 },
  { name: 'oats', aliases: ['oatmeal', 'porridge'], unit: '1 bowl', kcal: 170, proteinG: 6 },
  { name: 'bread', aliases: ['toast', 'bread slice'], unit: '1 slice', kcal: 80, proteinG: 3 },
  { name: 'sandwich', aliases: ['veg sandwich'], unit: '1 sandwich', kcal: 250, proteinG: 8 },
  { name: 'maggi', aliases: ['noodles', 'instant noodles'], unit: '1 pack', kcal: 350, proteinG: 8 },
  { name: 'pasta', aliases: [], unit: '1 plate', kcal: 330, proteinG: 11 },
  { name: 'pizza', aliases: ['pizza slice'], unit: '1 slice', kcal: 285, proteinG: 12 },
  { name: 'burger', aliases: [], unit: '1 burger', kcal: 400, proteinG: 18 },
  { name: 'samosa', aliases: ['samosas'], unit: '1 piece', kcal: 260, proteinG: 4 },
  { name: 'pakora', aliases: ['pakoras', 'bhajiya'], unit: '4 pieces', kcal: 220, proteinG: 5 },
  { name: 'vada pav', aliases: [], unit: '1 piece', kcal: 290, proteinG: 7 },
  { name: 'pav bhaji', aliases: [], unit: '1 plate', kcal: 400, proteinG: 9 },
  { name: 'banana', aliases: ['bananas'], unit: '1 medium', kcal: 105, proteinG: 1 },
  { name: 'apple', aliases: ['apples'], unit: '1 medium', kcal: 95, proteinG: 0.5 },
  { name: 'mango', aliases: [], unit: '1 medium', kcal: 200, proteinG: 2 },
  { name: 'orange', aliases: ['oranges'], unit: '1 medium', kcal: 62, proteinG: 1 },
  { name: 'peanuts', aliases: ['groundnuts'], unit: 'handful (30 g)', kcal: 170, proteinG: 7 },
  { name: 'almonds', aliases: ['badam'], unit: 'handful (25 g)', kcal: 145, proteinG: 5 },
  { name: 'biscuit', aliases: ['biscuits', 'cookies'], unit: '2 pieces', kcal: 90, proteinG: 1 },
  { name: 'chips', aliases: ['wafers'], unit: '1 small pack', kcal: 160, proteinG: 2 },
  { name: 'chocolate', aliases: [], unit: '2 squares', kcal: 110, proteinG: 1 },
  { name: 'ice cream', aliases: [], unit: '1 scoop', kcal: 140, proteinG: 2 },
  { name: 'gulab jamun', aliases: [], unit: '1 piece', kcal: 150, proteinG: 2 },
  { name: 'tea', aliases: ['chai'], unit: '1 cup with milk and sugar', kcal: 70, proteinG: 2 },
  { name: 'coffee', aliases: ['filter coffee'], unit: '1 cup with milk and sugar', kcal: 80, proteinG: 2 },
  { name: 'cold drink', aliases: ['soda', 'cola', 'soft drink'], unit: '1 can (330 ml)', kcal: 140, proteinG: 0 },
  { name: 'juice', aliases: ['fruit juice'], unit: '1 glass', kcal: 110, proteinG: 1 },
];
