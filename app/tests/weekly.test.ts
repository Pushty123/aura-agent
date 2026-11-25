import { describe, it, expect } from "vitest";
import { weeklySummary } from "../src/summary/weekly";
import type { DayRecord } from "../src/types";

const day = (i: number, sleep?: number, screen?: number, source: DayRecord["source"] = "manual"): DayRecord => ({
  date: `2026-11-${String(10 + i).padStart(2, "0")}`,
  sleepHours: sleep,
  screenMinutes: screen,
  source,
});

describe("weeklySummary", () => {
  it("returns average, best night, most screen time and a tip", () => {
    const { lines } = weeklySummary([day(1, 6, 120), day(2, 8, 300), day(3, 7, 90)]);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("7.0");
    expect(lines[1]).toContain("2026-11-12");
    expect(lines[2]).toContain("2026-11-12");
  });

  it("suggests earlier bedtime when average sleep is under 7", () => {
    const { lines } = weeklySummary([day(1, 5), day(2, 6), day(3, 6)]);
    expect(lines[lines.length - 1]).toContain("earlier");
  });

  it("skips the screen line when there is no screen data", () => {
    const { lines } = weeklySummary([day(1, 7), day(2, 8), day(3, 7)]);
    expect(lines).toHaveLength(3);
  });

  it("only uses the last 7 days, even if input is unsorted", () => {
    const days = [9, 1, 8, 2, 7, 3, 6, 4, 5, 10].map((i) => day(i, i === 1 ? 1 : 8, 60));
    expect(weeklySummary(days).lines[0]).toContain("8.0");
  });

  it("says not enough data with fewer than 3 nights", () => {
    expect(weeklySummary([day(1, 7)]).lines[0]).toContain("Not enough data");
  });

  it("flags demo data", () => {
    const demo = [day(1, 7, 60, "demo"), day(2, 7, 60, "demo"), day(3, 7, 60, "demo")];
    expect(weeklySummary(demo).isDemo).toBe(true);
    expect(weeklySummary([day(1, 7), day(2, 7), day(3, 7)]).isDemo).toBe(false);
  });
});