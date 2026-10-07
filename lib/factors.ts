// Every number BillPrint uses to turn a bill into CO2e, with its source and year.
// All values below were checked against the EPA source files on 2026-10-06.
// Bump FACTORS_VERSION whenever any value in this file changes.
import egrid from "@/data/egrid.json";

export const FACTORS_VERSION = "2026-10-06";

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
