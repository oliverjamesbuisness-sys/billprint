// Everything the result screen shows, computed from the fields the user confirmed. Plain code only.
import { calculateFootprint, type ConfirmedBill } from "@/lib/emissions";
import { GAS_KG_CO2E_PER_THERM, SEASONAL_SOURCE, TYPICAL_HOME, US_PRICE } from "@/lib/factors";
import { recommend } from "@/lib/recommendations";
import { COOLING_MONTHS, HEATING_MONTHS, fractionOfDaysIn, shareOfYear } from "@/lib/seasonal";

export type BillCosts = { electricityCostUsd: number | null; gasCostUsd: number | null };

/** The bill's own price (cost ÷ usage) if it's believable, else the EIA national average. */
function pickPrice(cost: number | null, usage: number, believable: [number, number], fallback: number) {
  if (cost !== null && cost > 0 && usage > 0) {
    const rate = cost / usage;
    if (rate >= believable[0] && rate <= believable[1]) return { usdPerUnit: rate, fromBill: true };
  }
  return { usdPerUnit: fallback, fromBill: false };
}

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function analyzeBill(bill: ConfirmedBill & BillCosts) {
  const footprint = calculateFootprint(bill);
  const { periodStart: start, periodEnd: end } = bill;
  const electricShare = shareOfYear("electricity", start, end);
  const gasShare = shareOfYear("gas", start, end);
  const e = footprint.electricity;
  const g = footprint.gas;

  const electricity = e && {
    annualKwh: e.usage / electricShare,
    typicalKwhThisBill: TYPICAL_HOME.kwhPerYear * electricShare,
    price: pickPrice(bill.electricityCostUsd, e.usage, [0.05, 0.75], US_PRICE.electricityUsdPerKwh),
  };
  const gas = g && {
    annualTherms: g.therms / gasShare,
    typicalThermsThisBill: TYPICAL_HOME.gasThermsPerYear * gasShare,
    price: pickPrice(bill.gasCostUsd, g.therms, [0.3, 5], US_PRICE.gasUsdPerTherm),
  };

  const annualKgCo2e =
    (e && electricity ? electricity.annualKwh * e.factor : 0) + (g && gas ? gas.annualTherms * GAS_KG_CO2E_PER_THERM : 0);
  const typical = {
    electricityKgCo2e: e && electricity ? electricity.typicalKwhThisBill * e.factor : 0,
    gasKgCo2e: g && gas ? gas.typicalThermsThisBill * GAS_KG_CO2E_PER_THERM : 0,
  };

  const recommendations = recommend({
    periodLabel: `${formatDay(start)} – ${formatDay(end)}`,
    heatingSeason: fractionOfDaysIn(HEATING_MONTHS, start, end) >= 0.5,
    coolingSeason: fractionOfDaysIn(COOLING_MONTHS, start, end) >= 0.5,
    electricity:
      e && electricity
        ? { annualKwh: electricity.annualKwh, kgPerKwh: e.factor, usdPerKwh: electricity.price.usdPerUnit, usedThisBill: e.usage, typicalThisBill: electricity.typicalKwhThisBill }
        : null,
    gas:
      g && gas
        ? { annualTherms: gas.annualTherms, kgPerTherm: GAS_KG_CO2E_PER_THERM, usdPerTherm: gas.price.usdPerUnit, usedThisBill: g.therms, typicalThisBill: gas.typicalThermsThisBill }
        : null,
  });

  return {
    footprint,
    annual: { kgCo2e: annualKgCo2e, electricityKwh: electricity?.annualKwh ?? null, gasTherms: gas?.annualTherms ?? null, source: SEASONAL_SOURCE },
    typical: { ...typical, kgCo2e: typical.electricityKgCo2e + typical.gasKgCo2e, source: TYPICAL_HOME.source },
    prices: {
      electricity: electricity?.price ?? null,
      gas: gas?.price ?? null,
      fallbackSource: US_PRICE.source,
    },
    recommendations,
  };
}

export type BillAnalysis = ReturnType<typeof analyzeBill>;
