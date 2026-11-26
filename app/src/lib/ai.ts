import { db } from './db';
import { AccountError, apiCall, getSession } from './account';
import { audit } from './vault';
import { balanceScore } from '../insights/balance';
import { runInsights } from '../insights/engine';
import { mean } from '../insights/stats';
import type { DayRecord } from '../types';
import { computeTargets, validateProfile, type Profile } from '../profile/profile';
import type { Workout } from '../exercise/workouts';

/**
 * Smart replies (optional, off by default).
 *
 * Only a short SUMMARY is sent: averages, insight sentences and a coarse profile
 * (age band, goal, BMI band). Never your name, email, allergies, blood group,
 * photos, exact height or weight, or individual day records.
 */
export const MAX_CONTEXT = 3800;

export async function getAiConsent(): Promise<boolean> {
  return (await db.meta.get('ai-consent'))?.value === 'on';
}

export async function setAiConsent(on: boolean): Promise<void> {
  await db.meta.put({ key: 'ai-consent', value: on ? 'on' : 'off' });
  await audit('consent.set', `smart-replies = ${on ? 'on' : 'off'}`);
}

const avg = (xs: (number | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? mean(v) : null;
};

const ageBand = (age: number) => (age < 20 ? 'teens' : `${Math.floor(age / 10) * 10}s`);

export function buildContext(days: DayRecord[], profile?: Profile | null, workouts: Workout[] = []): string {
  const week = days.slice(-7);
  const lines: string[] = [];

  if (week.length === 0) {
    lines.push('No daily records yet.');
  } else {
    lines.push(`Summary of the last ${week.length} logged day(s):`);
    const sleep = avg(week.map((d) => d.sleepHours));
    const steps = avg(week.map((d) => d.steps));
    const screen = avg(week.map((d) => d.screenMinutes));
    const late = avg(week.map((d) => d.lateScreenMin));
    const caf = avg(week.map((d) => d.caffeineCups));
    const water = avg(week.map((d) => d.waterGlasses));
    const mood = avg(week.map((d) => d.mood));
    if (sleep !== null) lines.push(`- Sleep: ${sleep.toFixed(1)} h per night on average`);
    if (steps !== null) lines.push(`- Steps: ${Math.round(steps)} per day on average`);
    if (screen !== null) lines.push(`- Screen time: ${Math.round(screen)} min per day on average`);
    if (late !== null) lines.push(`- Late-night screen time: ${Math.round(late)} min per night on average`);
    if (caf !== null) lines.push(`- Caffeine: ${caf.toFixed(1)} cups per day on average`);
    if (water !== null) lines.push(`- Water: ${water.toFixed(1)} glasses per day on average`);
    if (mood !== null) lines.push(`- Mood: ${mood.toFixed(1)} out of 5 on average`);

    const latest = days[days.length - 1];
    const b = balanceScore(latest, days.slice(0, -1));
    lines.push(`Balance Score for the latest day: ${b.score}/100 (${b.reasons.map((r) => `${r.label} ${r.points}/${r.max}`).join(', ')})`);
  }

  const insights = runInsights(days).filter((i) => !i.notEnoughData).slice(0, 3);
  if (insights.length) {
    lines.push('Patterns found in the data:');
    for (const i of insights) {
      lines.push(`- ${i.title}: ${i.detail} (${i.confidence} confidence${i.evidence ? `, ${i.evidence.n} days` : ''})`);
    }
  }

  const recentWorkouts = workouts.slice(0, 20);
  if (recentWorkouts.length) {
    const byType = new Map<string, number>();
    for (const w of recentWorkouts) byType.set(w.exercise, (byType.get(w.exercise) ?? 0) + w.reps);
    lines.push(`Recent camera workouts (reps): ${[...byType].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }

  if (profile && !validateProfile(profile)) {
    const t = computeTargets(profile);
    lines.push(`About the person: age ${ageBand(profile.age)}, goal ${profile.goal}, BMI band "${t.bmiBand}", daily target about ${t.kcal} kcal.`);
  }

  if (days.some((d) => d.source === 'demo')) {
    lines.push('NOTE: some or all of this data is DEMO sample data, not a real person.');
  }

  const text = lines.join('\n');
  return text.length > MAX_CONTEXT ? text.slice(0, MAX_CONTEXT) : text;
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export async function smartStatus(): Promise<boolean> {
  try {
    return (await apiCall<{ enabled: boolean }>('/v1/chat/status', { method: 'GET', label: 'smart-reply-status' })).enabled;
  } catch {
    return false;
  }
}

export async function askSmart(question: string, history: Turn[], context: string): Promise<string> {
  const session = await getSession();
  if (!session) throw new AccountError('Log in to use smart replies.');
  const r = await apiCall<{ reply: string }>('/v1/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ question, context, history: history.slice(-6) }),
    label: 'smart-reply (summary of patterns only: no raw records, no identity)',
  });
  await audit('smart-reply', `Asked a question (${question.length} chars) with a ${context.length}-char summary`);
  return r.reply;
}
