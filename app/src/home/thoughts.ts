import type { DayRecord } from '../types';

/** Short, original wellness thoughts. One per day, same for the whole day. */
export const THOUGHTS = [
  'Small steps every day add up to big changes.',
  'Rest is part of the work, not a break from it.',
  'Your phone can wait. Your sleep cannot.',
  'Drink a glass of water before your next cup of tea.',
  'A ten-minute walk is better than a perfect plan you never start.',
  'Be as kind to yourself as you are to your friends.',
  'Progress, not perfection.',
  'The best time to put the phone down is a little earlier than you think.',
  'Notice one thing that went well today.',
  'Your body keeps the score of your habits. Give it good ones.',
  'Slow breathing is a reset button you always carry.',
  'Sunlight in the morning, screens off at night.',
  'A good day often starts the night before.',
  'Move a little, every hour.',
  'Eat colours: the more on your plate, the better.',
  'You do not need to do everything today. Just the next right thing.',
  'Consistency beats intensity.',
  'Talk to someone you care about today.',
  'Sitting is easy. Standing up for two minutes is easier than you think.',
  'Sleep is the cheapest health upgrade there is.',
  'One habit at a time.',
  'If it matters, put it on the calendar.',
  'Gratitude turns what we have into enough.',
  'Stretch your body, then your mind.',
  'Fresh air clears more than your lungs.',
  'A clear evening makes a clear morning.',
  'Celebrate the streak, forgive the slip.',
  'Your future self is watching. Make them proud.',
  'Less scrolling, more strolling.',
  'Listen to your body before it has to shout.',
];

export function thoughtFor(date: string): string {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return THOUGHTS[h % THOUGHTS.length];
}

/** One friendly line about today from the person's own numbers. */
export function todayLine(d: DayRecord | undefined, score?: number): string {
  if (!d) return "Let's check your wellness today.";
  if (d.sleepHours !== undefined && d.sleepHours < 6) return `Only ${d.sleepHours.toFixed(1)} h of sleep. Go easy today and drink water.`;
  if (d.steps !== undefined && d.steps >= 10000) return `${d.steps.toLocaleString()} steps already. Great going!`;
  if (d.lateScreenMin !== undefined && d.lateScreenMin >= 60) return 'Late screens last night. Try a phone-free last hour tonight.';
  if (score !== undefined && score >= 80) return 'You are in great balance today. Keep it going!';
  if (d.sleepHours !== undefined && d.sleepHours >= 7) return `${d.sleepHours.toFixed(1)} h of sleep. A well-rested start!`;
  if (d.steps !== undefined && d.steps < 3000) return 'A short walk would lift your day.';
  return "Let's check your wellness today.";
}
