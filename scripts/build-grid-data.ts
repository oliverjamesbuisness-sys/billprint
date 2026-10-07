// Converts EPA's Power Profiler ZIP Code Tool into data/egrid.json, which the app reads at runtime.
//
// Source file (public EPA data, eGRID2023 rev2, released 2025-06-12):
//   https://www.epa.gov/system/files/documents/2025-06/power_profiler_zipcode_tool_v14.3.xlsx
// Download it to data/raw/ first, then run:  npx tsx scripts/build-grid-data.ts
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

const SOURCE_FILE = "data/raw/power_profiler_zipcode_tool_v14.3.xlsx";
const SOURCE_URL =
  "https://www.epa.gov/system/files/documents/2025-06/power_profiler_zipcode_tool_v14.3.xlsx";

// Formula cells come back as { result }, rich text as { richText }; we only want plain values.
function plain(value: ExcelJS.CellValue): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "object" && "result" in value) return plain(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "richText" in value) return value.richText.map((t) => t.text).join("");
  return String(value);
}

function rowValues(row: ExcelJS.Row) {
  return (row.values as ExcelJS.CellValue[]).slice(1).map(plain); // ExcelJS rows are 1-indexed
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);

  // Columns: SRNAME, SUBRGN, CO2, CH4, N2O, CO2e (all kg/MWh, total output), NOX, SO2, GGRSLOSS
  const subregions: Record<string, { name: string; co2eKgPerMwh: number; gridGrossLoss: number }> = {};
  workbook.getWorksheet("Subregion Rates (kg-MWh)")!.eachRow((row, rowNumber) => {
    if (rowNumber < 5) return; // title + header rows
    const [name, code, , , , co2e, , , gridLoss] = rowValues(row);
    if (typeof code === "string" && code.trim() && typeof co2e === "number") {
      subregions[code.trim()] = { name: String(name).trim(), co2eKgPerMwh: co2e, gridGrossLoss: Number(gridLoss) };
    }
  });

  // Columns: zip, Subregion 1, Subregion 2, Subregion 3 (a ZIP can be served by more than one grid region)
  const zips: Record<string, string[]> = {};
  workbook.getWorksheet("Zip-subregion")!.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const [zip, ...codes] = rowValues(row);
    const regions = codes.filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim());
    if (zip !== null && regions.length > 0) zips[String(zip).padStart(5, "0")] = regions;
  });

  const output = {
    source: "EPA eGRID2023 (rev2), via Power Profiler ZIP Code Tool v14.3, released 2025-06-12",
    sourceUrl: SOURCE_URL,
    units: "co2eKgPerMwh = subregion annual CO2e total output emission rate (kg/MWh); gridGrossLoss = fraction",
    subregions,
    zips,
  };
  writeFileSync("data/egrid.json", JSON.stringify(output));

  const multi = Object.values(zips).filter((r) => r.length > 1).length;
  console.log(`subregions: ${Object.keys(subregions).length}  zips: ${Object.keys(zips).length}  multi-region zips: ${multi}`);
  console.log(Object.entries(subregions).map(([k, v]) => `${k}=${v.co2eKgPerMwh}`).join("  "));
}

main();
