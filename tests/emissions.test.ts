// Expected values are worked out by hand from the EPA factors cited in lib/factors.ts.
import { describe, expect, it } from "vitest";
import { billingDays, calculateFootprint, gridRegionFor } from "@/lib/emissions";
import { GAS_KG_CO2E_PER_THERM, gridRegionsForZip } from "@/lib/factors";
import egrid from "@/data/egrid.json";

const base = { zip: null, periodStart: "2026-01-01", periodEnd: "2026-01-31", electricityKwh: null, gas: null };

describe("gas factor", () => {
  it("is 53.06 kg CO2 + 1 g CH4 x 28 + 0.1 g N2O x 265 per mmBtu, divided by 10 therms/mmBtu", () => {
    expect(GAS_KG_CO2E_PER_THERM).toBeCloseTo((53.06 + 0.028 + 0.0265) / 10, 6); // 5.31145
  });
});

describe("billingDays", () => {
  it("counts printed dates inclusively", () => {
    expect(billingDays("2026-01-01", "2026-01-31")).toBe(31);
    expect(billingDays("2026-02-15", "2026-03-16")).toBe(30);
  });
});

describe("electricity", () => {
  it("uses the eGRID subregion for the ZIP (San Francisco -> CAMX, 195.04 kg/MWh)", () => {
    const result = calculateFootprint({ ...base, zip: "94110", electricityKwh: 742 });
    expect(result.electricity?.region.code).toBe("CAMX");
    expect(result.electricity?.kgCo2e).toBeCloseTo(742 * 0.19504, 3); // 144.72 kg
    expect(result.electricity?.usedFallback).toBe(false);
  });

  it("gives a much higher number for the same usage on a coal-heavier grid (St. Louis -> SRMW)", () => {
    const sf = calculateFootprint({ ...base, zip: "94110", electricityKwh: 742 }).totalKgCo2e;
    const stl = calculateFootprint({ ...base, zip: "63101", electricityKwh: 742 }).totalKgCo2e;
    expect(stl / sf).toBeCloseTo(566.357 / 195.04, 3); // ~2.9x
  });

  it("falls back to the U.S. average (349.67 kg/MWh) and says so when the ZIP is missing or unknown", () => {
    for (const zip of [null, "00000"]) {
      const result = calculateFootprint({ ...base, zip, electricityKwh: 1000 });
      expect(result.electricity?.usedFallback).toBe(true);
      expect(result.electricity?.kgCo2e).toBeCloseTo(349.67, 2);
    }
  });

  it("reports the other grid regions when a ZIP is served by more than one", () => {
    const zips = egrid.zips as Record<string, string[]>;
    const multiZip = Object.keys(zips).find((z) => zips[z].length > 1)!;
    const { otherRegions } = gridRegionFor(multiZip);
    expect(otherRegions.length).toBe(gridRegionsForZip(multiZip).length - 1);
    expect(otherRegions.length).toBeGreaterThan(0);
  });
});

describe("natural gas", () => {
  it("converts therms directly", () => {
    const result = calculateFootprint({ ...base, gas: { amount: 50, unit: "therms" } });
    expect(result.gas?.kgCo2e).toBeCloseTo(50 * 5.31145, 3); // 265.57 kg
  });

  it("converts CCF to therms with EPA's heat content (1 CCF = 1.026 therms)", () => {
    const result = calculateFootprint({ ...base, gas: { amount: 50, unit: "CCF" } });
    expect(result.gas?.therms).toBeCloseTo(51.3, 6);
    expect(result.gas?.kgCo2e).toBeCloseTo(51.3 * 5.31145, 3); // 272.48 kg
  });

  it("treats 1 MCF as 10 CCF and 1 Dth as 10 therms", () => {
    expect(calculateFootprint({ ...base, gas: { amount: 1, unit: "MCF" } }).gas?.therms).toBeCloseTo(10.26, 6);
    expect(calculateFootprint({ ...base, gas: { amount: 1, unit: "Dth" } }).gas?.therms).toBe(10);
  });
});

describe("combined bills", () => {
  it("adds electricity and gas", () => {
    const result = calculateFootprint({ ...base, zip: "94110", electricityKwh: 742, gas: { amount: 50, unit: "therms" } });
    expect(result.totalKgCo2e).toBeCloseTo(742 * 0.19504 + 50 * 5.31145, 3);
  });
});
