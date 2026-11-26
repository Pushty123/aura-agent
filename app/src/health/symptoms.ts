import { db } from '../lib/db';
import { getAll, putRecord } from '../lib/vault';
import { hasPermission } from '../lib/permissions';
import { mean } from '../insights/stats';
import type { DayRecord, FoodEntry } from '../types';

/**
 * Health journal: what happened, how bad, and general self-care ideas.
 * Wellness information only. AURA never diagnoses; red flags point to a doctor.
 */
export type SymptomId =
  | 'headache'
  | 'cold'
  | 'fever'
  | 'stomach'
  | 'acidity'
  | 'cramps'
  | 'backpain'
  | 'stress'
  | 'sleep'
  | 'fatigue'
  | 'allergy'
  | 'other';

export interface HealthEntry {
  id: string;
  date: string;
  symptom: SymptomId;
  /** Shown name; for "other" this is what the person typed. */
  label: string;
  severity: 1 | 2 | 3;
  notes: string;
  ts: number;
}

interface Guide {
  label: string;
  emoji: string;
  food: string[];
  care: string[];
  redFlags: string[];
}

export const GUIDES: Record<SymptomId, Guide> = {
  headache: {
    label: 'Headache',
    emoji: '🤕',
    food: ['Water or coconut water through the day', 'Regular meals (skipping meals can trigger headaches)', 'Fruit such as banana or watermelon'],
    care: ['Rest in a dim, quiet room', 'Take a break from screens', 'Limit tea and coffee late in the day'],
    redFlags: ['Sudden, very severe headache', 'Headache with stiff neck, fever, confusion or weakness', 'After a head injury'],
  },
  cold: {
    label: 'Cold or cough',
    emoji: '🤧',
    food: ['Warm fluids: soups, warm water, herbal tea', 'Honey in warm water (not for children under 1)', 'Citrus fruit, guava or amla for vitamin C'],
    care: ['Rest and sleep well', 'Steam inhalation can ease a blocked nose', 'Wash hands often and cover coughs'],
    redFlags: ['Difficulty breathing or chest pain', 'High fever for more than 3 days', 'Cough lasting more than 3 weeks or with blood'],
  },
  fever: {
    label: 'Fever',
    emoji: '🌡️',
    food: ['Plenty of fluids: water, ORS, soups, coconut water', 'Light, easy food like khichdi or idli', 'Fresh fruit'],
    care: ['Rest', 'Wear light clothing', 'Check your temperature regularly'],
    redFlags: ['Temperature of 39.4°C (103°F) or more', 'Fever lasting more than 3 days', 'Rash, stiff neck, confusion, fits or trouble breathing'],
  },
  stomach: {
    label: 'Stomach upset',
    emoji: '🤢',
    food: ['ORS or small sips of water often', 'Plain rice, curd rice, banana, toast', 'Avoid oily, spicy and outside food for a day or two'],
    care: ['Rest', 'Wash hands before eating', 'Eat small portions'],
    redFlags: ['Signs of dehydration (very little urine, dizziness)', 'Blood in stool or vomit', 'Severe belly pain or symptoms lasting more than 2 days'],
  },
  acidity: {
    label: 'Acidity or heartburn',
    emoji: '🔥',
    food: ['Smaller meals', 'Cold milk or curd may soothe', 'Cut down on fried, spicy food, tea and coffee'],
    care: ['Do not lie down right after eating', 'Finish dinner 2–3 hours before bed', 'Raise your head slightly when sleeping'],
    redFlags: ['Chest pain spreading to arm or jaw, or with sweating', 'Trouble swallowing', 'Black stools or vomiting blood'],
  },
  cramps: {
    label: 'Period cramps',
    emoji: '🩸',
    food: ['Warm drinks such as ginger or jeera water', 'Iron-rich food: spinach, dates, jaggery, lentils', 'Less salt and caffeine'],
    care: ['A warm water bottle on the lower belly', 'Gentle stretching or a short walk', 'Rest and enough sleep'],
    redFlags: ['Pain that stops daily life or gets worse each month', 'Very heavy bleeding (changing pad every hour)', 'Fever with pelvic pain'],
  },
  backpain: {
    label: 'Back pain',
    emoji: '🧍',
    food: ['Stay hydrated', 'Calcium and vitamin D foods: milk, curd, ragi'],
    care: ['Take short walking breaks from sitting', 'Gentle stretches', 'Check your chair and screen height'],
    redFlags: ['Pain after a fall or injury', 'Numbness, weakness in legs, or loss of bladder control', 'Pain with fever or weight loss'],
  },
  stress: {
    label: 'Stress or anxiety',
    emoji: '😟',
    food: ['Regular meals', 'Less caffeine', 'Nuts, fruit and whole grains'],
    care: ['Slow breathing: in for 4, out for 6, for 2 minutes', 'A short walk outside', 'Talk to someone you trust'],
    redFlags: ['Thoughts of harming yourself: contact a doctor, a trusted person or a helpline now (in India, Tele-MANAS 14416)', 'Panic that will not settle', 'Stress stopping you from daily life for weeks'],
  },
  sleep: {
    label: 'Poor sleep',
    emoji: '😴',
    food: ['No tea or coffee after 4 pm', 'Lighter dinner, 2–3 hours before bed', 'Warm milk if it suits you'],
    care: ['Screens off 30 minutes before bed', 'Same bedtime every day', 'Dark, cool room'],
    redFlags: ['Loud snoring with pauses in breathing', 'Poor sleep for more than a month affecting the day'],
  },
  fatigue: {
    label: 'Tiredness',
    emoji: '🥱',
    food: ['Balanced meals with protein: dal, eggs, paneer', 'Iron-rich food: greens, dates, jaggery', 'Enough water'],
    care: ['Regular sleep', 'Short daytime walks', 'Take breaks from long screen sessions'],
    redFlags: ['Tiredness lasting weeks with weight loss, breathlessness or paleness'],
  },
  allergy: {
    label: 'Allergy',
    emoji: '🌼',
    food: ['Avoid foods you know trigger it', 'Plenty of water'],
    care: ['Avoid dust and smoke', 'Wash face and hands after being outside'],
    redFlags: ['Swelling of lips, face or throat, or trouble breathing: get emergency help'],
  },
  other: {
    label: 'Something else',
    emoji: '📝',
    food: ['Regular, balanced meals and enough water'],
    care: ['Rest and note how it changes'],
    redFlags: ['If it is severe, unusual or not getting better, see a doctor'],
  },
};

/** Notes that link today's symptom to the person's own recent data. */
export function personalNotes(s: SymptomId, days: DayRecord[], food: FoodEntry[], date: string): string[] {
  const week = days.filter((d) => d.date <= date).slice(-3);
  const avg = (f: (d: DayRecord) => number | undefined) => {
    const v = week.map(f).filter((x): x is number => typeof x === 'number');
    return v.length ? mean(v) : null;
  };
  const out: string[] = [];
  const water = avg((d) => d.waterGlasses);
  const sleep = avg((d) => d.sleepHours);
  const late = avg((d) => d.lateScreenMin);
  const caf = avg((d) => d.caffeineCups);
  const screen = avg((d) => d.screenMinutes);
  if (['headache', 'fatigue', 'fever', 'stomach', 'cramps'].includes(s) && water !== null && water < 6)
    out.push(`You've had about ${water.toFixed(1)} glasses of water a day recently; drinking more may help.`);
  if (['headache', 'fatigue', 'stress', 'sleep'].includes(s) && sleep !== null && sleep < 6.5)
    out.push(`Your recent sleep averages ${sleep.toFixed(1)} h; an earlier night could help.`);
  if (['headache', 'sleep', 'stress'].includes(s) && late !== null && late >= 30)
    out.push(`You've been on screens about ${Math.round(late)} min after 11 pm; try a wind-down reminder.`);
  if (['headache', 'acidity', 'sleep', 'stress'].includes(s) && caf !== null && caf >= 3)
    out.push(`About ${caf.toFixed(1)} cups of caffeine a day recently; cutting back may help.`);
  if (['headache', 'backpain'].includes(s) && screen !== null && screen >= 360)
    out.push(`Screen time is high (${Math.round(screen / 60)} h a day); take regular breaks.`);
  if (['stomach', 'acidity'].includes(s)) {
    const recent = food.filter((f) => f.date <= date).slice(-4).map((f) => f.text);
    if (recent.length) out.push(`Recently logged food: ${recent.join('; ')}. Check if anything there might be a trigger.`);
  }
  if (s === 'fatigue') {
    const protein = food.filter((f) => f.date === date).reduce((n, f) => n + f.proteinG, 0);
    if (protein > 0 && protein < 30) out.push(`Only about ${Math.round(protein)} g protein logged today; add dal, eggs, curd or paneer.`);
  }
  return out;
}

/** How often each symptom happened in the last 30 days (for patterns and AI context). */
export function recentCounts(entries: HealthEntry[], date: string, days = 30): { symptom: SymptomId; label: string; n: number }[] {
  const from = new Date(`${date}T12:00:00`);
  from.setDate(from.getDate() - days);
  const cut = from.toISOString().slice(0, 10);
  const m = new Map<string, { symptom: SymptomId; label: string; n: number }>();
  for (const e of entries.filter((x) => x.date > cut && x.date <= date)) {
    const k = e.symptom === 'other' ? `other:${e.label}` : e.symptom;
    const cur = m.get(k) ?? { symptom: e.symptom, label: e.label, n: 0 };
    cur.n++;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

export function newEntry(date: string, symptom: SymptomId, severity: 1 | 2 | 3, notes = '', label?: string): HealthEntry {
  return {
    id: `h${Date.now()}${Math.floor(Math.random() * 1000)}`,
    date,
    symptom,
    label: (symptom === 'other' ? label?.trim() : GUIDES[symptom].label) || GUIDES[symptom].label,
    severity,
    notes: notes.trim().slice(0, 500),
    ts: Date.now(),
  };
}

export async function loadHealth(): Promise<HealthEntry[]> {
  if (!(await hasPermission('healthRecords'))) return [];
  return (await getAll<HealthEntry>('health')).sort((a, b) => b.ts - a.ts);
}

export async function saveHealth(e: HealthEntry): Promise<void> {
  await putRecord('health', e.id, e);
}

export async function deleteHealth(id: string): Promise<void> {
  await db.records.delete(`health:${id}`);
}

const WORDS: [SymptomId, RegExp][] = [
  ['headache', /head ?ache|migraine|head (is )?(hurting|paining)|sar dard|sir dard/],
  ['fever', /fever|temperature|bukhar|feverish/],
  ['cold', /\bcold\b|cough|sneez|runny nose|blocked nose|sore throat|khansi|zukam/],
  ['acidity', /acidity|heartburn|acid reflux|gas trouble/],
  ['stomach', /stomach|loose motion|diarr|vomit|nause|pet dard|tummy/],
  ['cramps', /cramp|period pain/],
  ['backpain', /back ?pain|back is hurting|kamar dard/],
  ['stress', /stress|anxious|anxiety|panic|tension|overwhelm/],
  ['sleep', /can'?t sleep|cannot sleep|insomnia|slept badly|no sleep|poor sleep/],
  ['fatigue', /tired|fatigue|exhausted|no energy|weak(ness)?\b|thakan/],
  ['allergy', /allerg|itch|rash|hives/],
];

/** Finds a symptom in what the person typed or said (English and common Hindi words). */
export function detectSymptom(text: string, allowCramps = true): SymptomId | null {
  const t = text.toLowerCase();
  if (!/\b(i|i'm|im|i am|my|me|feel|feeling|having|have|got|mujhe|mera|meri)\b/.test(t) && t.split(/\s+/).length > 4) return null;
  for (const [id, re] of WORDS) if (re.test(t) && (allowCramps || id !== 'cramps')) return id;
  return null;
}
