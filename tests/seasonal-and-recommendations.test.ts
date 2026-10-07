// Expected values are worked out by hand from the EIA / ENERGY STAR / DOE numbers cited in lib/factors.ts.
import { describe, expect, it } from "vitest";
import { analyzeBill } from "@/lib/analysis";
import { END_USE_SHARE, GAS_KG_CO2E_PER_THERM, MONTHLY_USE_2025 } from "@/lib/factors";
import { shareOfYear } from "@/lib/seasonal";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("seasonal share of the year", () => {
  it("adds up to the whole year over a full calendar year", () => {
    expect(shareOfYear("gas", "2025-01-01", "2025-12-31")).toBeCloseTo(1, 9);
    expect(shareOfYear("electricity", "2025-01-01", "2025-12-31")).toBeCloseTo(1, 9);
  });

  it("gives January 21.4% of a year's residential gas, not 1/12 (8.3%)", () => {
    expect(shareOfYear("gas", "2026-01-01", "2026-01-31")).toBeCloseTo(1036216 / sum(MONTHLY_USE_2025.gas), 9);
  });

  it("gives July 11.1% of a year's residential electricity", () => {
    expect(shareOfYear("electricity", "2026-07-01", "2026-07-31")).toBeCloseTo(168011 / sum(MONTHLY_USE_2025.electricity), 9);
  });
});

const january = { zip: "94110", periodStart: "2026-01-01", periodEnd: "2026-01-31", electricityCostUsd: null, gasCostUsd: null };

describe("analyzeBill", () => {
  it("annualizes a January gas bill with the seasonal share, not x12", () => {
    const result = analyzeBill({ ...january, electricityKwh: null, gas: { amount: 100, unit: "therms" } });
    const share = 1036216 / sum(MONTHLY_USE_2025.gas);
    expect(result.annual.gasTherms).toBeCloseTo(100 / share, 6); // ≈ 467 therms, not 1,200
    expect(result.annual.kgCo2e).toBeCloseTo((100 / share) * GAS_KG_CO2E_PER_THERM, 6);
  });

  it("recommends the heating actions first for a winter gas bill, with savings = annual × 68% × cited %", () => {
    const result = analyzeBill({ ...january, electricityKwh: 300, gas: { amount: 100, unit: "therms" } });
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.slice(0, 2).map((r) => r.id).sort()).toEqual(["gas-seal", "gas-thermostat"]);

    const thermostat = result.recommendations.find((r) => r.id === "gas-thermostat")!;
    const heatingTherms = (100 / (1036216 / sum(MONTHLY_USE_2025.gas))) * END_USE_SHARE.gasSpaceHeating;
    expect(thermostat.co2KgPerYear.low).toBeCloseTo(heatingTherms * 0.08 * GAS_KG_CO2E_PER_THERM, 6);
    expect(thermostat.co2KgPerYear.high).toBeCloseTo(heatingTherms * 0.1 * GAS_KG_CO2E_PER_THERM, 6);
    expect(thermostat.why).toContain("heating season");
  });

  it("recommends AC actions first for a July electric-only bill", () => {
    const result = analyzeBill({ ...january, periodStart: "2026-07-01", periodEnd: "2026-07-31", electricityKwh: 900, gas: null });
    expect(result.recommendations.slice(0, 2).map((r) => r.id).sort()).toEqual(["electric-ac-setpoint", "electric-seal"]);
    expect(result.recommendations[0].why).toContain("cooling season");
  });

  it("uses the bill's own price when it's believable, and the EIA average when it isn't", () => {
    const own = analyzeBill({ ...january, electricityKwh: 500, gas: null, electricityCostUsd: 150 }); // $0.30/kWh
    expect(own.prices.electricity).toEqual({ usdPerUnit: 0.3, fromBill: true });
    const odd = analyzeBill({ ...january, electricityKwh: 500, gas: null, electricityCostUsd: 2 }); // $0.004/kWh: misread
    expect(odd.prices.electricity).toEqual({ usdPerUnit: 0.173, fromBill: false });
  });

  it("compares with a typical US home over the same days on the same grid", () => {
    const result = analyzeBill({ ...january, electricityKwh: 300, gas: null });
    const typicalKwh = 863 * 12 * (152329 / sum(MONTHLY_USE_2025.electricity));
    expect(result.typical.electricityKgCo2e).toBeCloseTo(typicalKwh * 0.19504, 6);
  });
});
