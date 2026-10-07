// Picks exactly 3 ways to cut THIS bill's emissions. Rule-based, reductions only (no fuel switching or
// time-of-use shifting: their CO2 effect can't be computed honestly from one bill). Every saving is
//   estimated yearly use × EIA share of that use × cited % saving
// so it can be checked by hand. Savings overlap, so the UI never adds them up.
import { END_USE_SHARE, SAVINGS } from "@/lib/factors";

type Range = { low: number; high: number };

export type Recommendation = {
  id: string;
  fuel: "electricity" | "gas";
  title: string;
  how: string;
  why: string;
  source: string;
  co2KgPerYear: Range;
  usdPerYear: Range;
};

export type RecommendationContext = {
  periodLabel: string; // e.g. "Jan 5 – Feb 4"
  heatingSeason: boolean; // most bill days fall in Oct–Apr
  coolingSeason: boolean; // most bill days fall in Jun–Sep
  electricity: null | { annualKwh: number; kgPerKwh: number; usdPerKwh: number; usedThisBill: number; typicalThisBill: number };
  gas: null | { annualTherms: number; kgPerTherm: number; usdPerTherm: number; usedThisBill: number; typicalThisBill: number };
};

// 2 = triggered by this bill's season, 1 = useful any time, 0 = off-season (only used to fill up to 3).
type Candidate = Recommendation & { priority: 0 | 1 | 2 };

const round = (n: number) => Math.round(n).toLocaleString("en-US");
const vsTypical = (used: number, typical: number, unit: string) =>
  `you used ${round(used)} ${unit} vs about ${round(typical)} for a typical US home over the same days`;

const THERMOSTAT_HOW = "A programmable or smart thermostat does it automatically.";
const SEAL_HOW = "Weatherstrip doors and windows and seal attic gaps. Many utilities offer a free home energy audit.";
const SHOWER_HOW = "WaterSense showerheads use no more than 2.0 gallons per minute, so you use less hot water with no change in habits.";

export function recommend(ctx: RecommendationContext): Recommendation[] {
  const candidates: Candidate[] = [];
  const { electricity: e, gas: g } = ctx;

  // Energy saved per year (kWh or therms) -> CO2 and dollars, using THIS bill's grid factor and price.
  const fromKwh = (low: number, high: number) => ({
    co2KgPerYear: { low: low * e!.kgPerKwh, high: high * e!.kgPerKwh },
    usdPerYear: { low: low * e!.usdPerKwh, high: high * e!.usdPerKwh },
  });
  const fromTherms = (low: number, high: number) => ({
    co2KgPerYear: { low: low * g!.kgPerTherm, high: high * g!.kgPerTherm },
    usdPerYear: { low: low * g!.usdPerTherm, high: high * g!.usdPerTherm },
  });

  if (g) {
    const heatingTherms = g.annualTherms * END_USE_SHARE.gasSpaceHeating;
    const why = ctx.heatingSeason
      ? `This bill covers ${ctx.periodLabel}, heating season. Heating is about 68% of a gas home's use, and ${vsTypical(g.usedThisBill, g.typicalThisBill, "therms")}.`
      : "Heating is about 68% of a gas home's yearly use (EIA). Set this up before winter.";
    const priority = ctx.heatingSeason ? 2 : 0;
    candidates.push({
      id: "gas-thermostat", fuel: "gas", priority, why,
      title: "Turn the heat down 7–10°F at night and when you're out",
      how: THERMOSTAT_HOW,
      source: `${SAVINGS.thermostat.source}; heating share from ${END_USE_SHARE.source}`,
      ...fromTherms(heatingTherms * SAVINGS.thermostat.low, heatingTherms * SAVINGS.thermostat.high),
    });
    candidates.push({
      id: "gas-seal", fuel: "gas", priority, why,
      title: "Seal air leaks and top up attic insulation",
      how: SEAL_HOW,
      source: `${SAVINGS.sealAndInsulate.source}; heating share from ${END_USE_SHARE.source}`,
      ...fromTherms(heatingTherms * SAVINGS.sealAndInsulate.low, heatingTherms * SAVINGS.sealAndInsulate.high),
    });
    candidates.push({
      id: "gas-showerhead", fuel: "gas", priority: 1,
      title: "Fit a WaterSense low-flow showerhead",
      how: SHOWER_HOW,
      why: ctx.heatingSeason
        ? "Water heating is about a quarter of a gas home's use (EIA), all year round."
        : `This bill covers ${ctx.periodLabel}, outside heating season, so most of this gas went to hot water.`,
      source: `${SAVINGS.showerheadSource}, converted to gas energy (a lower bound)`,
      ...fromTherms(SAVINGS.showerheadThermsPerYear, SAVINGS.showerheadThermsPerYear),
    });
  }

  if (e) {
    const coolingKwh = e.annualKwh * END_USE_SHARE.electricCooling;
    const coolingWhy = ctx.coolingSeason
      ? `This bill covers ${ctx.periodLabel}, cooling season. AC is about 22% of a home's electricity, and ${vsTypical(e.usedThisBill, e.typicalThisBill, "kWh")}.`
      : "Cooling is about 22% of a typical home's yearly electricity (EIA). Set this up before summer.";
    const coolingPriority = ctx.coolingSeason ? 2 : 0;
    candidates.push({
      id: "electric-ac-setpoint", fuel: "electricity", priority: coolingPriority, why: coolingWhy,
      title: "Raise the AC setpoint when you're out or asleep",
      how: THERMOSTAT_HOW,
      source: `${SAVINGS.thermostat.source}; cooling share from ${END_USE_SHARE.source}`,
      ...fromKwh(coolingKwh * SAVINGS.thermostat.low, coolingKwh * SAVINGS.thermostat.high),
    });
    candidates.push({
      id: "electric-seal", fuel: "electricity", priority: coolingPriority, why: coolingWhy,
      title: "Seal air leaks so the AC works less",
      how: SEAL_HOW,
      source: `${SAVINGS.sealAndInsulate.source}; cooling share from ${END_USE_SHARE.source}`,
      ...fromKwh(coolingKwh * SAVINGS.sealAndInsulate.low, coolingKwh * SAVINGS.sealAndInsulate.high),
    });
    candidates.push({
      id: "electric-standby", fuel: "electricity", priority: 1,
      title: "Cut standby power with smart power strips",
      how: "Put the TV, console and computer on a strip that switches off when they're idle.",
      why: `Devices on standby use 5–10% of a home's electricity. At your estimated ${round(e.annualKwh)} kWh a year, cutting half of that adds up.`,
      source: SAVINGS.standbyHalf.source,
      ...fromKwh(e.annualKwh * SAVINGS.standbyHalf.low, e.annualKwh * SAVINGS.standbyHalf.high),
    });
    if (!g) {
      // No gas on this bill: the home may heat water (and maybe rooms) with electricity.
      const heatingKwh = e.annualKwh * END_USE_SHARE.electricSpaceHeating;
      candidates.push({
        id: "electric-heat-thermostat", fuel: "electricity", priority: ctx.heatingSeason ? 2 : 0,
        title: "If you heat with electricity: turn it down 7–10°F at night",
        how: THERMOSTAT_HOW,
        why: `This bill covers ${ctx.periodLabel} and has no gas, so your heating may be electric. Heating is about 14% of an average home's electricity, more in electrically heated homes.`,
        source: `${SAVINGS.thermostat.source}; heating share from ${END_USE_SHARE.source}`,
        ...fromKwh(heatingKwh * SAVINGS.thermostat.low, heatingKwh * SAVINGS.thermostat.high),
      });
      candidates.push({
        id: "electric-showerhead", fuel: "electricity", priority: 1,
        title: "Fit a WaterSense low-flow showerhead (if your water heater is electric)",
        how: SHOWER_HOW,
        why: "This bill has no gas, so your water heater is probably electric. Water heating is about 12% of home electricity (EIA).",
        source: SAVINGS.showerheadSource,
        ...fromKwh(SAVINGS.showerheadKwhPerYear, SAVINGS.showerheadKwhPerYear),
      });
    }
  }

  const mid = (c: Candidate) => (c.co2KgPerYear.low + c.co2KgPerYear.high) / 2;
  return candidates
    .sort((a, b) => b.priority - a.priority || mid(b) - mid(a))
    .slice(0, 3)
    .map(({ priority: _priority, ...rec }) => rec);
}
