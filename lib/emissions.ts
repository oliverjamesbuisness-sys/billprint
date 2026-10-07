// Pure math: confirmed bill fields -> kg CO2e. No AI, no network. Every result carries the factor
// and source it used, so the UI can "show the math" for any number.
import {
  GAS_KG_CO2E_PER_THERM,
  GAS_SOURCE,
  EGRID_SOURCE,
  THERMS_PER_GAS_UNIT,
  US_AVERAGE_GRID,
  gridRegionsForZip,
  type GasUnit,
  type GridRegion,
} from "@/lib/factors";

export type ConfirmedBill = {
  zip: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  electricityKwh: number | null;
  gas: { amount: number; unit: GasUnit } | null;
};

export type FuelResult = {
  usage: number;
  unit: string;
  kgCo2e: number;
  factor: number; // kg CO2e per unit shown in `factorUnit`
  factorUnit: string;
  source: string;
  formula: string; // human-readable, e.g. "742 kWh × 0.195 kg/kWh"
};

export type Footprint = {
  days: number;
  electricity: (FuelResult & { region: GridRegion; usedFallback: boolean; otherRegions: GridRegion[] }) | null;
  gas: (FuelResult & { therms: number }) | null;
  totalKgCo2e: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days covered by the bill. Utilities print inclusive dates (Jan 1 – Jan 31 = 31 days). */
export function billingDays(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / DAY_MS) + 1;
}

/** Picks the grid region for a ZIP. A ZIP served by several regions uses the first one EPA lists. */
export function gridRegionFor(zip: string | null) {
  const regions = zip ? gridRegionsForZip(zip) : [];
  if (regions.length === 0) return { region: US_AVERAGE_GRID, usedFallback: true, otherRegions: [] };
  return { region: regions[0], usedFallback: false, otherRegions: regions.slice(1) };
}

export function calculateFootprint(bill: ConfirmedBill): Footprint {
  const days = billingDays(bill.periodStart, bill.periodEnd);

  let electricity: Footprint["electricity"] = null;
  if (bill.electricityKwh !== null) {
    const { region, usedFallback, otherRegions } = gridRegionFor(bill.zip);
    electricity = {
      usage: bill.electricityKwh,
      unit: "kWh",
      kgCo2e: bill.electricityKwh * region.co2eKgPerKwh,
      factor: region.co2eKgPerKwh,
      factorUnit: "kg CO2e/kWh",
      source: `${EGRID_SOURCE}, ${region.name} (${region.code})`,
      formula: `${bill.electricityKwh} kWh × ${region.co2eKgPerKwh.toFixed(3)} kg/kWh`,
      region,
      usedFallback,
      otherRegions,
    };
  }

  let gas: Footprint["gas"] = null;
  if (bill.gas !== null) {
    const therms = bill.gas.amount * THERMS_PER_GAS_UNIT[bill.gas.unit];
    gas = {
      usage: bill.gas.amount,
      unit: bill.gas.unit,
      therms,
      kgCo2e: therms * GAS_KG_CO2E_PER_THERM,
      factor: GAS_KG_CO2E_PER_THERM,
      factorUnit: "kg CO2e/therm",
      source: GAS_SOURCE,
      formula:
        bill.gas.unit === "therms"
          ? `${bill.gas.amount} therms × ${GAS_KG_CO2E_PER_THERM.toFixed(3)} kg/therm`
          : `${bill.gas.amount} ${bill.gas.unit} × ${THERMS_PER_GAS_UNIT[bill.gas.unit]} therms/${bill.gas.unit} × ${GAS_KG_CO2E_PER_THERM.toFixed(3)} kg/therm`,
    };
  }

  return { days, electricity, gas, totalKgCo2e: (electricity?.kgCo2e ?? 0) + (gas?.kgCo2e ?? 0) };
}
