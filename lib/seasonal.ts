// Estimates a year of use from one bill with the national monthly pattern (EIA 2025), instead of x 12.
// Example: January is 21.4% of a typical year's residential gas use, so a January gas bill x 4.7 (not x 12).
import { MONTHLY_USE_2025 } from "@/lib/factors";

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAY_MS = 24 * 60 * 60 * 1000;

export type Fuel = "gas" | "electricity";

/** Fraction (0–1) of a typical year's use that falls on the bill's days (inclusive). */
export function shareOfYear(fuel: Fuel, start: string, end: string): number {
  const months = MONTHLY_USE_2025[fuel];
  const yearTotal = months.reduce((sum, m) => sum + m, 0);
  let share = 0;
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += DAY_MS) {
    const month = new Date(t).getUTCMonth();
    share += months[month] / DAYS_IN_MONTH[month] / yearTotal; // each day gets its month's daily average
  }
  return share;
}

/** Fraction of the bill's days that fall in the given months (0 = January). */
export function fractionOfDaysIn(monthsOfYear: number[], start: string, end: string): number {
  let inside = 0;
  let total = 0;
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += DAY_MS) {
    total++;
    if (monthsOfYear.includes(new Date(t).getUTCMonth())) inside++;
  }
  return total === 0 ? 0 : inside / total;
}

export const HEATING_MONTHS = [9, 10, 11, 0, 1, 2, 3]; // Oct–Apr
export const COOLING_MONTHS = [5, 6, 7, 8]; // Jun–Sep
