import type { DayRecord } from "../types";

export interface WeeklySummary {
  lines: string[];
  isDemo: boolean;
}

const hasSleep = (d: DayRecord) => typeof d.sleepHours === "number";
const hasScreen = (d: DayRecord) => typeof d.screenMinutes === "number";

export function weeklySummary(days: DayRecord[]): WeeklySummary {
  // Sort by date, then take the last 7 days.
  const week = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const isDemo = week.length > 0 && week.every((d) => d.source === "demo");

  const sleepDays = week.filter(hasSleep);
  if (sleepDays.length < 3) {
    return {
      lines: ["Not enough data yet. Log at least 3 nights of sleep to see your weekly summary."],
      isDemo,
    };
  }

  const avg = sleepDays.reduce((s, d) => s + d.sleepHours!, 0) / sleepDays.length;
  const best = sleepDays.reduce((a, b) => (b.sleepHours! > a.sleepHours! ? b : a));

  const lines = [
    `You slept ${avg.toFixed(1)} hours a night on average.`,
    `Your best night was ${best.date} (${best.sleepHours} h).`,
  ];

  const screenDays = week.filter(hasScreen);
  if (screenDays.length > 0) {
    const most = screenDays.reduce((a, b) => (b.screenMinutes! > a.screenMinutes! ? b : a));
    lines.push(`Most screen time was ${most.date} (${(most.screenMinutes! / 60).toFixed(1)} h).`);
  }

  lines.push(
    avg < 7
      ? "Try going to bed 30 minutes earlier this week."
      : "Your sleep looks steady. Keep your routine."
  );

  return { lines, isDemo };
}