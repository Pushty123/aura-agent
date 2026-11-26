import { describe, it, expect } from "vitest";
import { weeklySummary } from "../src/summary/weekly";
import type { DayRecord } from "../src/types";

const day = (i: number, sleep?: number, screen?: number): DayRecord => ({
  date: `2026-11-${String(10 + i).padStart(2, "0")}`,
  sleepHours: sleep,
  screenMinutes: screen,
  source: "manual",
});

describe("weeklySummary (edge cases)", () => {
  it("reports the average sleep and the highest screen-time day", () => {
    const res = weeklySummary([day(1, 6, 120), day(2, 8, 300), day(3, 7, 90)]);
    expect(res.hasEnoughData).toBe(true);
    expect(res.avgSleepHours).toBe(7);
    expect(res.highestScreenDay?.date).toBe("2026-11-12");
    expect(res.highestScreenDay?.minutes).toBe(300);
  });

  it("suggests an earlier bedtime when average sleep is under 7", () => {
    const res = weeklySummary([day(1, 5), day(2, 6), day(3, 6)]);
    expect(res.suggestion).toContain("earlier");
  });

  it("has no screen-time day when there is no screen data", () => {
    const res = weeklySummary([day(1, 7), day(2, 8), day(3, 7)]);
    expect(res.highestScreenDay).toBeNull();
    expect(res.sentences.join(" ")).not.toContain("screen time");
  });

  it("only uses the last 7 days, even if input is unsorted", () => {
    const days = [9, 1, 8, 2, 7, 3, 6, 4, 5, 10].map((i) => day(i, i === 1 ? 1 : 8, 60));
    const res = weeklySummary(days);
    expect(res.daysCount).toBe(7);
    expect(res.avgSleepHours).toBe(8);
  });

  it("says not enough data with fewer than 3 days", () => {
    const res = weeklySummary([day(1, 7)]);
    expect(res.hasEnoughData).toBe(false);
  });

  it("does not invent a sleep average when sleep is missing", () => {
    const res = weeklySummary([day(1, undefined, 60), day(2, undefined, 90), day(3, undefined, 30)]);
    expect(res.avgSleepHours).toBeNull();
    expect(res.sentences[0]).toContain("Sleep was not logged");
  });
});
