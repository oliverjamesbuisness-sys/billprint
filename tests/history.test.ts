import { describe, expect, it } from "vitest";
import { monthStreak, type HistoryEntry } from "@/lib/history";

const bill = (periodEnd: string): HistoryEntry => ({ periodStart: periodEnd, periodEnd, kgCo2e: 1, kgPer30Days: 1 });

describe("monthStreak", () => {
  it("is 0 with no bills and 1 with one bill", () => {
    expect(monthStreak([])).toBe(0);
    expect(monthStreak([bill("2026-03-04")])).toBe(1);
  });

  it("counts consecutive months back from the newest bill, across a year boundary", () => {
    expect(monthStreak([bill("2025-11-05"), bill("2025-12-04"), bill("2026-01-06")])).toBe(3);
  });

  it("stops at a gap", () => {
    expect(monthStreak([bill("2025-10-05"), bill("2025-12-04"), bill("2026-01-06")])).toBe(2);
  });
});
