import type { DayRecord, FoodEntry } from '../types';
import { streaks } from '../goals/badges';
import { thoughtFor } from '../home/thoughts';

/**
 * Built-in answers computed on the phone, used when smart replies are off,
 * not logged in, or the server is unreachable. Plain, friendly and always
 * based on the person's own numbers.
 */
export interface LocalReply {
  text: string;
  meta: string;
}

const avg = (v: (number | undefined)[]) => {
  const x = v.filter((n): n is number => typeof n === 'number');
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
};
const h = (min: number) => `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;

export function localReply(q: string, days: DayRecord[], food: FoodEntry[], date: string): LocalReply | null {
  const t = q.toLowerCase().trim();
  const week = days.filter((d) => d.date <= date).slice(-7);
  const today = days.find((d) => d.date === date);
  const meta = `Built-in answer · from your last ${week.length} day${week.length === 1 ? '' : 's'}`;

  if (/^(hi|hello|hey|namaste|good (morning|evening|afternoon))\b/.test(t))
    return { text: `Hi! 👋 Ask me about your sleep, steps, screen time, water, mood or food, or tell me how you feel. Thought for today: ${thoughtFor(date)}`, meta: 'Built-in answer' };
  if (/^(thanks|thank you|thx|ok|okay|cool|nice)\b/.test(t)) return { text: "You're welcome! Small steps every day. 🌱", meta: 'Built-in answer' };

  if (/screen|phone|mobile|scroll|instagram|youtube|reels|app usage/.test(t)) {
    const s = avg(week.map((d) => d.screenMinutes));
    const late = avg(week.map((d) => d.lateScreenMin));
    if (s === null) return { text: 'I do not have screen-time data yet. Allow usage access in ☰ Menu → Phone & band data.', meta };
    return {
      text:
        `You average ${h(s)} of screen time a day${today?.screenMinutes !== undefined ? ` (today so far: ${h(today.screenMinutes)})` : ''}. ` +
        (late !== null && late >= 30 ? `About ${Math.round(late)} min of it is after 11 pm, which can cut into sleep. Try a wind-down reminder at 10:30 pm.` : 'Late-night use is low. Nice!') +
        (s > 300 ? ' Setting a daily limit on your top app in ☰ Menu → App usage can help.' : ''),
      meta,
    };
  }
  if (/water|hydrat|drink/.test(t)) {
    const w = avg(week.map((d) => d.waterGlasses));
    if (w === null) return { text: 'No water logged yet. Tap +1 water on Home each time you drink a glass.', meta };
    return { text: `You average ${w.toFixed(1)} glasses a day${today?.waterGlasses !== undefined ? `, ${today.waterGlasses} so far today` : ''}. ${w < 8 ? 'Aim for about 8. A reminder every 2 hours in Goals → Reminders helps.' : 'Great hydration!'}`, meta };
  }
  if (/mood|feel(ing)? (today|lately)|happy|sad|how am i feeling/.test(t)) {
    const m = avg(week.map((d) => d.mood));
    if (m === null) return { text: 'No mood logged yet. Tap a face in Track → Check-in.', meta };
    return { text: `Your mood averages ${m.toFixed(1)} out of 5 this week. ${m < 3 ? 'It has been a tougher week. A walk, good sleep and talking to someone you trust can help.' : 'You have been feeling fairly good. Keep it up!'}`, meta };
  }
  if (/coffee|tea|caffeine|chai/.test(t)) {
    const c = avg(week.map((d) => d.caffeineCups));
    if (c === null) return { text: 'No caffeine logged yet. Use +1 cup in Check-in.', meta };
    return { text: `About ${c.toFixed(1)} cups a day. ${c >= 3 ? 'Try no tea or coffee after 4 pm for better sleep.' : 'That is a moderate amount.'}`, meta };
  }
  if (/exercise|workout|gym|squat|push.?up|yoga/.test(t)) {
    const e = avg(week.map((d) => d.exerciseMinutes));
    const n = week.filter((d) => d.workout || (d.exerciseMinutes ?? 0) > 0).length;
    return { text: `You worked out on ${n} of the last ${week.length} days${e !== null ? `, about ${Math.round(e)} min on average` : ''}. ${n < 3 ? 'Try a 10-minute camera workout in Track → Exercise.' : 'Great consistency!'}`, meta };
  }
  if (/food|eat|ate|calorie|kcal|protein|diet|meal/.test(t)) {
    const todayFood = food.filter((f) => f.date === date);
    if (!todayFood.length) return { text: 'Nothing logged today yet. Add a meal in Track → Food (a photo works too).', meta };
    const kcal = todayFood.reduce((a, f) => a + f.kcal, 0);
    const p = todayFood.reduce((a, f) => a + f.proteinG, 0);
    return { text: `Today: ${todayFood.length} meal${todayFood.length > 1 ? 's' : ''}, about ${Math.round(kcal)} kcal and ${Math.round(p)} g protein (estimates). ${p < 40 ? 'Add dal, eggs, curd or paneer for more protein.' : 'Good protein!'}`, meta };
  }
  if (/streak|badge/.test(t)) {
    const s = streaks(days, date).filter((x) => x.current > 0).sort((a, b) => b.current - a.current);
    return { text: s.length ? `Your streaks: ${s.map((x) => `${x.def.emoji} ${x.def.label} ${x.current} days`).join(', ')}. Don't break them!` : 'No streak running yet. Log your mood or drink 8 glasses today to start one.', meta };
  }
  if (/how am i|how('?s| is) my|summary|overview|today|this week|report|doing/.test(t)) {
    const parts: string[] = [];
    const sl = avg(week.map((d) => d.sleepHours));
    const st = avg(week.map((d) => d.steps));
    const sc = avg(week.map((d) => d.screenMinutes));
    if (sl !== null) parts.push(`sleep ${sl.toFixed(1)} h`);
    if (st !== null) parts.push(`${Math.round(st).toLocaleString()} steps`);
    if (sc !== null) parts.push(`${h(sc)} screen time`);
    if (!parts.length) return { text: 'Not enough data yet. Check in today, or allow phone data in ☰ Menu.', meta };
    const tip = sl !== null && sl < 7 ? 'The biggest win this week would be an earlier bedtime.' : st !== null && st < 6000 ? 'A daily 20-minute walk would lift your score.' : sc !== null && sc > 300 ? 'Cutting screen time a little would help most.' : 'You are doing well. Keep the routine going!';
    return { text: `This week you average ${parts.join(', ')} a day. ${tip} See the Report tab for details.`, meta };
  }
  if (/tip|advice|improve|suggest|what should i/.test(t)) {
    const sl = avg(week.map((d) => d.sleepHours));
    const late = avg(week.map((d) => d.lateScreenMin));
    const tip = late !== null && late >= 30 ? 'Put the phone away by 11 pm. Your data shows late screens cost you sleep.' : sl !== null && sl < 7 ? 'Go to bed 30 minutes earlier this week.' : 'Take a 10-minute walk after lunch every day.';
    return { text: `One small step: ${tip}`, meta };
  }
  return null;
}
