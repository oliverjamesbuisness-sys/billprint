// Every number BillPrint uses to turn a bill into CO2e, with its source and year.
// All values below were checked against the EPA source files on 2026-10-06.
// Bump FACTORS_VERSION whenever any value in this file changes.
import egrid from "@/data/egrid.json";

export const FACTORS_VERSION = "2026-10-06b";

// ── Electricity ────────────────────────────────────────────────────────────────
// EPA eGRID2023 (rev2, released 2025-06-12): subregion annual CO2e *total output* emission rate,
// looked up by ZIP using EPA's Power Profiler ZIP Code Tool v14.3 (converted to data/egrid.json
// by scripts/build-grid-data.ts). Total output rate = the standard "location-based" method.
export const EGRID_SOURCE = "EPA eGRID2023 rev2 (2025), subregion CO2e total output emission rate";

export type GridRegion = { code: string; name: string; co2eKgPerKwh: number };

const subregions = egrid.subregions as Record<string, { name: string; co2eKgPerMwh: number }>;
const zips = egrid.zips as Record<string, string[]>;

// Used only when we have no ZIP. eGRID2023 rev2 Summary Tables, Table 1, "U.S." row:
// 770.884 lb CO2e/MWh x 0.45359237 kg/lb = 349.67 kg/MWh. Grid regions range from 110 (NYUP)
// to 702 (PRMS) kg/MWh, so this fallback can be off by 2-3x; the UI labels it as such.
export const US_AVERAGE_GRID: GridRegion = { code: "US", name: "U.S. average", co2eKgPerKwh: 0.34967 };

/** ZIP -> eGRID subregions serving it (some ZIPs are served by up to 3). */
export function gridRegionsForZip(zip: string): GridRegion[] {
  const codes = zips[zip.trim().slice(0, 5).padStart(5, "0")] ?? [];
  return codes
    .filter((code) => subregions[code])
    .map((code) => ({ code, name: subregions[code].name, co2eKgPerKwh: subregions[code].co2eKgPerMwh / 1000 }));
}

// ── Natural gas ────────────────────────────────────────────────────────────────
// EPA GHG Emission Factors Hub 2025 (Jan 2025), Table 1 "Stationary Combustion", Natural Gas row:
//   53.06 kg CO2/mmBtu, 1 g CH4/mmBtu, 0.1 g N2O/mmBtu; heat content 0.001026 mmBtu/scf.
// Global warming potentials: IPCC AR5 100-year, as used by the same Hub (Table 11): CH4 = 28, N2O = 265.
// Combustion only: methane leaked upstream (wells, pipelines) is NOT included, matching eGRID,
// which also excludes upstream emissions. The UI says so.
export const GAS_SOURCE = "EPA GHG Emission Factors Hub 2025, Table 1 (natural gas combustion, AR5 GWPs)";
const KG_CO2_PER_MMBTU = 53.06;
const KG_CH4_PER_MMBTU = 0.001;
const KG_N2O_PER_MMBTU = 0.0001;
const GWP_CH4 = 28;
const GWP_N2O = 265;
const MMBTU_PER_THERM = 0.1; // definition: 1 therm = 100,000 Btu

export const GAS_KG_CO2E_PER_THERM =
  (KG_CO2_PER_MMBTU + KG_CH4_PER_MMBTU * GWP_CH4 + KG_N2O_PER_MMBTU * GWP_N2O) * MMBTU_PER_THERM; // ≈ 5.311

// Gas unit -> therms. Therms and dekatherms are energy units (exact). CCF/MCF are volumes, converted with
// EPA's average heat content (0.001026 mmBtu/scf => 1 CCF = 1.026 therms); a bill's own "therm factor"
// can differ by a few percent, so when a bill shows therms we always use the therms.
export const THERMS_PER_GAS_UNIT = {
  therms: 1,
  Dth: 10,
  CCF: 1.026,
  MCF: 10.26,
} as const;

export type GasUnit = keyof typeof THERMS_PER_GAS_UNIT;

// ── Seasonal pattern (to estimate a year from one bill) ────────────────────────
// A January gas bill x 12 can double the real year, so instead we scale by how much of a typical year's
// use falls in the bill's days. National monthly totals, calendar year 2025:
// Gas: EIA "U.S. Natural Gas Residential Consumption" (MMcf), https://www.eia.gov/dnav/ng/hist/n3010us2m.htm
// Electricity: EIA Electric Power Monthly Table 5.1, residential sales (thousand MWh; 2025 preliminary),
//   https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_01
export const SEASONAL_SOURCE = "EIA 2025 national monthly residential consumption";
export const MONTHLY_USE_2025 = {
  gas: [1036216, 795645, 527628, 325383, 189284, 130009, 110844, 104398, 112441, 216066, 470346, 824311],
  electricity: [152329, 127517, 108969, 97306, 104856, 135822, 168011, 155204, 126778, 107313, 101222, 129667],
} as const;

// ── Prices (fallback when the bill's own price isn't printed or looks wrong) ───
// Electricity: 17.30 cents/kWh, US residential average 2025 (preliminary), EIA Electric Power Monthly Table 5.3.
// Gas: $15.34 per Mcf, US residential 2025, EIA https://www.eia.gov/dnav/ng/hist/n3010us3a.htm, converted with
//   EIA's 10.37 therms per Mcf (https://www.eia.gov/tools/faqs/faq.php?id=45&t=8) = $1.479/therm.
export const US_PRICE = { electricityUsdPerKwh: 0.173, gasUsdPerTherm: 15.34 / 10.37, source: "EIA 2025 US residential averages" };

// ── Typical US home (for the "your home vs typical" comparison) ────────────────
// Electricity: 863 kWh/month per residential customer, 2024, EIA table 5A
//   (https://www.eia.gov/electricity/sales_revenue_price/pdf/table_5A.pdf) => 10,356 kWh/yr.
// Gas: 56.6 million Btu/yr per household that uses natural gas, EIA RECS 2020 Table CE2.1 => 566 therms/yr.
export const TYPICAL_HOME = { kwhPerYear: 863 * 12, gasThermsPerYear: 566, source: "EIA 2024 (electricity), EIA RECS 2020 (gas)" };

// ── What the energy is used for (EIA RECS 2020, national, site energy) ─────────
// Gas, Table CE4.1: total 4,241 trillion Btu; space heating 2,887; water heating 1,081.
// Electricity, Tables CE4.1/CE5.1a: total 1,305 billion kWh; air conditioning 253.8 + air handlers for cooling 38.0;
//   space heating 161.1 + air handlers for heating 23.5; water heating 156.2.
export const END_USE_SHARE = {
  gasSpaceHeating: 2887 / 4241, // 68.1%
  gasWaterHeating: 1081 / 4241, // 25.5%
  electricCooling: (253.8 + 38.0) / 1305, // 22.4%
  electricSpaceHeating: (161.1 + 23.5) / 1305, // 14.1%
  source: "EIA Residential Energy Consumption Survey (RECS) 2020",
};

// ── Savings claims behind the recommendations (low-high fractions of the end use) ──
export const SAVINGS = {
  // ENERGY STAR smart thermostat FAQ: "approximately 8% of heating and cooling bills";
  // DOE Energy Saver Guide 2022: "save as much as 10% per year on heating and cooling" (7-10°F setback, 8 h/day).
  thermostat: { low: 0.08, high: 0.1, source: "ENERGY STAR (8%) and DOE Energy Saver Guide 2022 (up to 10%)" },
  // ENERGY STAR: "save an average of 15% on heating and cooling costs"; DOE Energy Saver Guide 2022:
  // air sealing can save "10%-20% on your heating and cooling bills". We use 10-15% (conservative).
  sealAndInsulate: { low: 0.1, high: 0.15, source: "ENERGY STAR (15% average) and DOE Energy Saver Guide 2022 (10-20%)" },
  // LBNL (standby.lbl.gov): standby power is "5-10% of residential electricity use". Assumes you cut half of it.
  standbyHalf: { low: 0.025, high: 0.05, source: "Lawrence Berkeley National Lab: standby is 5-10% of home electricity; assumes cutting half" },
  // EPA WaterSense showerheads (updated Mar 2026): "more than 330 kilowatt hours of electricity annually" per family.
  // For gas water heaters we use the same energy (330 kWh x 3,412 Btu/kWh = 11.3 therms), a conservative lower bound.
  showerheadKwhPerYear: 330,
  showerheadThermsPerYear: (330 * 3412) / 100000,
  showerheadSource: "EPA WaterSense (2026): more than 330 kWh/yr per family",
};
