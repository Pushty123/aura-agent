import { getRecord, putRecord } from '../lib/vault';
import { mean } from '../insights/stats';
import { newReminder, type Reminder } from '../reminders/reminders';
import type { AppLimit, AppUse } from '../native/bridge';
import type { DayRecord } from '../types';
import { newGoal, type Goal } from './goals';

/**
 * Turns a goal typed in plain words ("Exams on 15 Dec, 4 subjects") into a
 * plan: goals, reminders and app limits built from the person's own data.
 * Runs entirely on the phone. Nothing is applied until the person confirms.
 */
export type PlanKind = 'exam' | 'fitness' | 'sleep' | 'screen' | 'habit';

export interface ParsedGoal {
  kind: PlanKind;
  title: string;
  date: string | null;
  subjects: string[];
  hours: number | null;
}

export interface Phase {
  label: string;
  from: string;
  to: string;
  detail: string;
}

export interface Plan {
  id: string;
  kind: PlanKind;
  title: string;
  until: string | null;
  daysLeft: number | null;
  goals: Goal[];
  reminders: Reminder[];
  limits: AppLimit[];
  phases: Phase[];
  /** First days of the study timetable: date and what to do. */
  timetable: { date: string; task: string }[];
  tips: string[];
  /** Why each number was chosen, from the person's data. */
  reasons: string[];
}

export interface PlanContext {
  today: string;
  days: DayRecord[];
  apps: AppUse[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY = 86_400_000;
const toDate = (s: string) => new Date(`${s}T12:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m, d, 12);
  return dt.getMonth() === m && dt.getDate() === d ? iso(dt) : null;
}

/** Finds a date in free text. Dates without a year roll to the next occurrence. */
export function parseDate(text: string, today: string): string | null {
  const t = text.toLowerCase();
  const ty = Number(today.slice(0, 4));
  const future = (m: number, d: number, y?: number) => {
    if (y) return validDate(y < 100 ? 2000 + y : y, m, d);
    const s = validDate(ty, m, d);
    return s && s < today ? validDate(ty + 1, m, d) : s;
  };
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return validDate(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (m) return future(+m[2] - 1, +m[1], m[3] ? +m[3] : undefined);
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?([a-z]{3,9})\.?(?:,?\s*(\d{4}))?/);
  if (m && MONTHS.includes(m[2].slice(0, 3))) return future(MONTHS.indexOf(m[2].slice(0, 3)), +m[1], m[3] ? +m[3] : undefined);
  m = t.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s*(\d{4}))?/);
  if (m && MONTHS.includes(m[1].slice(0, 3))) return future(MONTHS.indexOf(m[1].slice(0, 3)), +m[2], m[3] ? +m[3] : undefined);
  m = t.match(/\bin\s+(\d{1,3})\s*(day|week|month)s?\b/);
  if (m) return addDays(today, +m[1] * (m[2] === 'day' ? 1 : m[2] === 'week' ? 7 : 30));
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  if (/\bnext week\b/.test(t)) return addDays(today, 7);
  if (/\bnext month\b/.test(t)) return addDays(today, 30);
  return null;
}

export function parseGoal(text: string, today: string): ParsedGoal {
  const t = text.toLowerCase();
  const kind: PlanKind = /exam|test|boards?\b|semester|sem\b|study|studies|gate|jee|neet|cat\b|upsc|interview|viva|internal/.test(t)
    ? 'exam'
    : /sleep|insomnia|wake up|bedtime/.test(t)
      ? 'sleep'
      : /screen|phone|instagram|reels|social media|addict|youtube|scroll/.test(t)
        ? 'screen'
        : /fit|weight|gym|run|walk|marathon|\bkg\b|exercise|workout|steps|5k|10k|muscle/.test(t)
          ? 'fitness'
          : 'habit';
  let subjects: string[] = [];
  const list = text.match(/(?:subjects?|papers?)\s*[:\-–]?\s*([A-Za-z][A-Za-z .&+]*(?:,\s*[A-Za-z][A-Za-z .&+]*)+(?:\s+and\s+[A-Za-z .&+]+)?)/i)
    ?? text.match(/:\s*([A-Za-z][A-Za-z .&+]*(?:,\s*[A-Za-z][A-Za-z .&+]*)+)/);
  if (list) {
    subjects = list[1].split(/,|\band\b/i).map((s) => s.trim()).filter((s) => s && s.length <= 30 && !/\d/.test(s));
  }
  if (subjects.length < 2) {
    const n = t.match(/(\d{1,2})\s*(?:subjects?|papers?|courses?)/);
    subjects = n ? Array.from({ length: clamp(+n[1], 1, 12) }, (_, i) => `Subject ${i + 1}`) : [];
  }
  const h = t.match(/(\d{1,2}(?:\.\d)?)\s*(?:h|hrs?|hours?)\b(?:\s*(?:a|per|each)\s*day)?/);
  const title = text.trim().replace(/\s+/g, ' ').slice(0, 60) || 'My plan';
  return { kind, title, date: parseDate(text, today), subjects: subjects.slice(0, 12), hours: h ? clamp(+h[1], 1, 12) : null };
}

const DISTRACTING = /instagram|facebook|snapchat|youtube|netflix|hotstar|primevideo|twitter|\.x\.|tiktok|reddit|moj|josh|sharechat|pubg|freefire|bgmi|game|mxplayer|jiocinema|telegram/i;

export function distractingApps(apps: AppUse[]): AppUse[] {
  return apps.filter((a) => DISTRACTING.test(a.pkg) || DISTRACTING.test(a.label)).sort((a, b) => b.minutes - a.minutes);
}

function baseline(days: DayRecord[], today: string, f: (d: DayRecord) => number | undefined): number | null {
  const v = days.filter((d) => d.date <= today).slice(-7).map(f).filter((x): x is number => typeof x === 'number');
  return v.length >= 3 ? mean(v) : null;
}

function goal(title: string, icon: string, metric: Goal['metric'], target?: number, extra: Partial<Goal> = {}): Goal {
  return { ...newGoal(title, metric, target), icon, ...extra };
}

export function buildPlan(p: ParsedGoal, ctx: PlanContext): Plan {
  const { today } = ctx;
  if (p.date && p.date <= today) throw new Error('That date is today or in the past. Pick a future date.');
  const until = p.date ?? (p.kind === 'exam' ? null : addDays(today, 28));
  if (p.kind === 'exam' && !until) throw new Error('Add the exam date, for example "Exams on 15 Dec".');
  const daysLeft = until ? diffDays(today, until) : null;
  const planId = `p${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const tag = { planId, endsOn: until ?? undefined };
  const out: Plan = { id: planId, kind: p.kind, title: p.title, until, daysLeft, goals: [], reminders: [], limits: [], phases: [], timetable: [], tips: [], reasons: [] };
  const screen = baseline(ctx.days, today, (d) => d.screenMinutes);
  const steps = baseline(ctx.days, today, (d) => d.steps);
  const sleep = baseline(ctx.days, today, (d) => d.sleepHours);
  const late = baseline(ctx.days, today, (d) => d.lateScreenMin);
  const remind = (title: string, body: string, time: string) => ({ ...newReminder({ title, body, time }), planId, until: until ?? undefined });

  const screenTarget = (cut: number, fallback: number) => {
    if (screen === null) {
      out.reasons.push(`No screen-time history yet, so the limit starts at ${fallback} min a day.`);
      return fallback;
    }
    const t = clamp(roundTo(screen * cut, 15), 60, 240);
    out.reasons.push(`You average ${Math.round(screen)} min of screen time a day; the plan cuts it to ${t} min.`);
    return t;
  };
  const appLimits = (share: number, max: number) => {
    const top = distractingApps(ctx.apps).filter((a) => a.minutes >= 15).slice(0, 3);
    for (const a of top) {
      const m = clamp(roundTo(a.minutes * share, 5), 15, max);
      out.limits.push({ pkg: a.pkg, label: a.label, minutes: m });
      out.reasons.push(`${a.label}: ${a.minutes} min today → limit ${m} min.`);
    }
    if (!top.length) out.tips.push('Allow App usage access (Me → App usage) so AURA can also set limits on your most distracting apps.');
  };

  if (p.kind === 'exam') {
    const dl = daysLeft!;
    const hours = p.hours ?? (dl <= 7 ? 6 : dl <= 30 ? 4 : 3);
    const blocks = clamp(Math.ceil(hours / 1.5), 2, 4);
    const times = ['07:00', '16:30', '19:00', '21:00'].slice(0, blocks);
    out.goals.push(goal(`Study ${hours} h`, '📚', 'habit', undefined, { ...tag, reminderTime: times[0] }));
    out.goals.push(goal('Screen time during exams', '📵', 'screenMinutes', screenTarget(dl <= 14 ? 0.5 : 0.65, 120), tag));
    out.goals.push(goal('Sleep before exams', '😴', 'sleepHours', 7.5, tag));
    times.forEach((tm, i) => out.reminders.push(remind(`📚 Study block ${i + 1}`, 'Phone away. 50 min focus, then a 10 min break.', tm)));
    out.reminders.push(remind('🌙 Exam wind-down', 'Sleep helps you remember what you studied. Screens off.', '22:30'));
    appLimits(dl <= 14 ? 0.4 : 0.5, 45);
    if (sleep !== null && sleep < 7) out.reasons.push(`Your sleep averages ${sleep.toFixed(1)} h; memory works better with 7–8 h.`);

    // Phases: learn → revise → practice papers.
    const mockDays = dl >= 10 ? 3 : dl >= 4 ? 1 : 0;
    const learn = Math.max(0, Math.floor((dl - mockDays) * 0.65));
    const revise = dl - mockDays - learn;
    let cur = today;
    const phase = (label: string, n: number, detail: string) => {
      if (n <= 0) return;
      out.phases.push({ label, from: cur, to: addDays(cur, n - 1), detail });
      cur = addDays(cur, n);
    };
    phase('Learn', learn, 'Cover new topics, one subject per block. Make short notes.');
    phase('Revise', revise, 'Go through notes and weak topics. Active recall: close the book and write what you remember.');
    phase('Practice papers', mockDays, 'Timed past papers in exam conditions. Check mistakes.');

    const subs = p.subjects.length ? p.subjects : ['Hardest subject', 'Next subject', 'Revision of yesterday'];
    for (let i = 0; i < Math.min(dl, 7); i++) {
      const a = subs[i % subs.length];
      const b = subs[(i + 1) % subs.length];
      const inLearn = out.phases[0]?.label === 'Learn' && i < learn;
      out.timetable.push({ date: addDays(today, i), task: subs.length > 1 ? `${a} + ${b}${inLearn ? '' : ' (revision)'}` : a });
    }
    out.tips.push(
      'Start each day with the subject you find hardest, while your mind is fresh.',
      'Keep the phone in another room during study blocks.',
      'Eat regular meals and drink water; skipping meals hurts focus.',
      'A 20-minute walk or stretch between blocks helps concentration.',
    );
  } else if (p.kind === 'fitness') {
    const st = steps === null ? 7000 : clamp(roundTo(steps * 1.2, 500), 5000, 12000);
    out.reasons.push(steps === null ? 'No step history yet, so the plan starts at 7,000 steps.' : `You average ${Math.round(steps).toLocaleString()} steps; the plan adds about 20%.`);
    out.goals.push(goal('Daily steps', '🚶', 'steps', st, tag));
    out.goals.push(goal('Workout', '💪', 'exerciseMinutes', 30, { ...tag, daysPerWeek: 5, reminderTime: '18:00' }));
    out.goals.push(goal('Water', '💧', 'waterGlasses', 8, tag));
    out.reminders.push(remind('💪 Workout time', '30 minutes: walk, run or a camera workout in AURA.', '18:00'));
    out.reminders.push(remind('🚶 Walk break', 'Stand up and walk for 10 minutes.', '15:00'));
    out.tips.push('Increase steps or distance by about 10% a week, not more.', 'Protein at each meal helps recovery: dal, eggs, paneer, curd.', 'Rest at least one day a week.');
  } else if (p.kind === 'sleep') {
    out.goals.push(goal('Sleep', '😴', 'sleepHours', 7.5, tag));
    out.goals.push(goal('Screen time', '📵', 'screenMinutes', screenTarget(0.8, 180), tag));
    out.reminders.push(remind('🌙 Wind down', 'Screens off in 30 minutes. Dim the lights.', '22:30'));
    out.reminders.push(remind('☕ Last caffeine', 'No more tea or coffee today for better sleep.', '16:00'));
    if (late !== null) out.reasons.push(`You spend about ${Math.round(late)} min on screens after 11 pm.`);
    if (sleep !== null) out.reasons.push(`Your sleep averages ${sleep.toFixed(1)} h.`);
    out.tips.push('Wake up at the same time every day, even weekends.', 'Get morning daylight for 10 minutes.', 'Keep the phone away from the bed.');
  } else if (p.kind === 'screen') {
    out.goals.push(goal('Screen time', '📵', 'screenMinutes', screenTarget(0.7, 150), tag));
    out.reminders.push(remind('📵 Phone-free hour', 'Put the phone away for an hour. Read, walk or talk to someone.', '20:00'));
    appLimits(0.6, 60);
    out.tips.push('Turn off notifications for social apps.', 'Move distracting apps off the home screen.', 'Use grayscale mode in the evening.');
  } else {
    out.goals.push(goal(p.title.slice(0, 60), '🎯', 'habit', undefined, { ...tag, reminderTime: '19:00' }));
    out.reminders.push(remind(`🎯 ${p.title.slice(0, 50)}`, 'Time for your goal. Small steps every day.', '19:00'));
    out.tips.push('Make it small enough to do even on a bad day.', 'Do it at the same time each day.', 'Tick it off in Goals to build a streak.');
  }
  return out;
}

/** Saved summary of an applied plan, so it can be shown and removed later. */
export interface SavedPlan {
  id: string;
  kind: PlanKind;
  title: string;
  until: string | null;
  phases: Phase[];
  tips: string[];
  limitPkgs: string[];
  createdAt: number;
}

export async function loadPlans(): Promise<SavedPlan[]> {
  return (await getRecord<SavedPlan[]>('settings', 'plans')) ?? [];
}

export async function savePlans(list: SavedPlan[]): Promise<void> {
  await putRecord('settings', 'plans', list);
}

export function summarise(p: Plan): SavedPlan {
  return { id: p.id, kind: p.kind, title: p.title, until: p.until, phases: p.phases, tips: p.tips, limitPkgs: p.limits.map((l) => l.pkg), createdAt: Date.now() };
}

/** Merge new limits; a stricter (lower) existing limit is kept. */
export function mergeLimits(existing: AppLimit[], add: AppLimit[]): AppLimit[] {
  const m = new Map(existing.map((l) => [l.pkg, l]));
  for (const l of add) {
    const cur = m.get(l.pkg);
    if (!cur || l.minutes < cur.minutes) m.set(l.pkg, l);
  }
  return [...m.values()];
}

export const EXAMPLES = [
  'Exams on 15 Dec: Maths, Physics, Chemistry, English',
  'Semester exams in 3 weeks, 5 subjects',
  'Reduce my Instagram and screen time',
  'Sleep better, I wake up tired',
  'Get fit and walk more',
  'Read 20 pages every day',
];
