// Runs the real extractor on every bill in eval/labels.csv and scores it field by field.
//
//   npm run eval                      # all bills, default model
//   npm run eval -- --only=utility    # only bills whose source contains "utility"
//   npm run eval -- --model=claude-sonnet-5-5 --fresh
//   npm run eval -- --publish         # also write data/eval-accuracy.json (shown in the app's review screen)
//
// It runs the same pipeline users get (same image shrinking, same lib/extract.ts). Raw model outputs are
// cached in eval/cache/ (keyed by file + model + prompt), so re-scoring after a label fix costs nothing.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
if (args.model) process.env.EXTRACTION_MODEL = args.model; // must be set before lib/extract is imported

const { extractBill, EXTRACTION_MODEL, SYSTEM_PROMPT } = await import("@/lib/extract");
const { calculateFootprint } = await import("@/lib/emissions");
const { utilityType } = await import("@/lib/schema");
type ExtractedBill = import("@/lib/schema").ExtractedBill;

const BILLS_DIR = "eval/bills";
const PRICE_PER_MTOK: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
};

// ── CSV (tiny parser: handles quoted fields with commas) ──────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...data] = rows.filter((r) => r.some((x) => x.trim() !== ""));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// ── Run the extractor (cached) ───────────────────────────────────────────────
const MEDIA: Record<string, "application/pdf" | "image/png" | "image/jpeg" | "image/webp"> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

type RunResult = { bill: ExtractedBill | null; error: string | null; latencyMs: number; inputTokens: number; outputTokens: number };

async function runOne(file: string): Promise<RunResult> {
  const raw = readFileSync(path.join(BILLS_DIR, file));
  const key = createHash("sha256").update(raw).update(EXTRACTION_MODEL).update(SYSTEM_PROMPT).digest("hex").slice(0, 16);
  const cacheFile = path.join("eval/cache", EXTRACTION_MODEL, `${key}.json`);
  if (!args.fresh && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));

  // Same as the browser: photos -> max 2000 px, 85% JPEG. PDFs untouched.
  let mediaType = MEDIA[path.extname(file).toLowerCase()];
  let bytes = raw;
  if (mediaType !== "application/pdf") {
    bytes = await sharp(raw).rotate().resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    mediaType = "image/jpeg";
  }

  let result: RunResult;
  try {
    const out = await extractBill({ base64: bytes.toString("base64"), mediaType });
    result = { bill: out.bill, error: null, latencyMs: out.latencyMs, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
  } catch (error) {
    result = { bill: null, error: error instanceof Error ? error.message : String(error), latencyMs: 0, inputTokens: 0, outputTokens: 0 };
  }
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(result));
  return result;
}

// ── Scoring ──────────────────────────────────────────────────────────────────
const FIELDS = [
  "utility_type", "provider", "service_zip", "period_start", "period_end",
  "electricity_kwh", "gas_usage", "gas_unit", "electricity_cost_usd", "gas_cost_usd", "total_cost_usd",
] as const;
type Field = (typeof FIELDS)[number];
type Value = string | number | null;

function predicted(bill: ExtractedBill, field: Field): Value {
  switch (field) {
    case "utility_type": return utilityType(bill);
    case "provider": return bill.provider;
    case "service_zip": return bill.service_zip;
    case "period_start": return bill.billing_period_start;
    case "period_end": return bill.billing_period_end;
    case "electricity_kwh": return bill.electricity?.usage_kwh ?? null;
    case "gas_usage": return bill.natural_gas?.usage ?? null;
    case "gas_unit": return bill.natural_gas?.unit ?? null;
    case "electricity_cost_usd": return bill.electricity?.cost_usd ?? null;
    case "gas_cost_usd": return bill.natural_gas?.cost_usd ?? null;
    case "total_cost_usd": return bill.total_cost_usd;
  }
}

function expected(label: Record<string, string>, field: Field): Value {
  if (field === "utility_type") {
    const e = label.electricity_kwh !== "", g = label.gas_usage !== "";
    return e && g ? "both" : e ? "electricity" : g ? "natural_gas" : "none";
  }
  const v = label[field];
  if (v === "") return null;
  return /_kwh$|_usage$|_usd$/.test(field) ? Number(v) : v;
}

const normalizeProvider = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(inc|co|company|corp|corporation|llc|the)\b/g, " ").replace(/\s+/g, " ").trim();

function matches(field: Field, exp: Value, got: Value): boolean {
  if (exp === null || got === null) return exp === got;
  if (typeof exp === "number") return Math.abs(Number(got) - exp) <= Math.max(0.01, Math.abs(exp) * 0.005);
  if (field === "provider") {
    // Label may list accepted names separated by "|"; containment either way counts.
    return exp.split("|").some((alt) => {
      const a = normalizeProvider(alt), b = normalizeProvider(String(got));
      return a === b || a.includes(b) || b.includes(a);
    });
  }
  return String(got).trim().toLowerCase() === String(exp).trim().toLowerCase();
}

/** 95% Wilson score interval: honest error bars for small samples (0/30 errors still allows ~10%). */
function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function footprintFrom(values: { zip: Value; kwh: Value; gas: Value; unit: Value }) {
  return calculateFootprint({
    zip: values.zip === null ? null : String(values.zip),
    periodStart: "2026-01-01", periodEnd: "2026-01-31", // total CO2e doesn't depend on the dates
    electricityKwh: values.kwh === null ? null : Number(values.kwh),
    gas: values.gas === null || values.unit === null ? null : { amount: Number(values.gas), unit: values.unit as "therms" },
  }).totalKgCo2e;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const labels = parseCsv(readFileSync("eval/labels.csv", "utf8")).filter((l) => !args.only || l.source.includes(args.only));
console.log(`Running ${labels.length} bills with ${EXTRACTION_MODEL}…`);

const results: { label: Record<string, string>; run: RunResult }[] = [];
for (let i = 0; i < labels.length; i += 4) {
  const batch = labels.slice(i, i + 4);
  const runs = await Promise.all(batch.map((l) => runOne(l.file)));
  batch.forEach((label, j) => results.push({ label, run: runs[j] }));
  process.stdout.write(`  ${Math.min(i + 4, labels.length)}/${labels.length}\r`);
}

type Tally = { k: number; n: number };
const tally = () => ({ k: 0, n: 0 });
const perField: Record<string, Record<string, Tally>> = {}; // source -> field -> tally
const failures: { file: string; field: string; expected: Value; got: Value; traps: string }[] = [];
const fabrication = tally(), validity = tally(), co2Within5 = tally();
const byConfidence: Record<string, Tally> = {};

for (const { label, run } of results) {
  const bill = run.bill;
  const isBill = label.is_utility_bill.toLowerCase() !== "false";
  const gotIsBill = bill?.is_utility_bill ?? false;
  validity.n++;
  if (gotIsBill === isBill) validity.k++;
  else failures.push({ file: label.file, field: "is_utility_bill", expected: String(isBill), got: run.error ?? String(gotIsBill), traps: label.traps });
  if (!isBill) continue;

  let allRight = true;
  for (const field of FIELDS) {
    const exp = expected(label, field);
    const got = bill && gotIsBill ? predicted(bill, field) : null;
    const ok = bill !== null && gotIsBill && matches(field, exp, got);
    for (const group of ["all", label.source]) {
      perField[group] ??= {};
      perField[group][field] ??= tally();
      perField[group][field].n++;
      if (ok) perField[group][field].k++;
    }
    if (exp === null) {
      fabrication.n++;
      if (got !== null) fabrication.k++;
    }
    if (!ok) {
      allRight = false;
      failures.push({ file: label.file, field, expected: exp, got: run.error ?? got, traps: label.traps });
    }
  }

  if (bill && gotIsBill) {
    const want = footprintFrom({ zip: expected(label, "service_zip"), kwh: expected(label, "electricity_kwh"), gas: expected(label, "gas_usage"), unit: expected(label, "gas_unit") });
    const got = footprintFrom({ zip: bill.service_zip, kwh: predicted(bill, "electricity_kwh"), gas: predicted(bill, "gas_usage"), unit: predicted(bill, "gas_unit") });
    co2Within5.n++;
    if (want > 0 && Math.abs(got - want) / want <= 0.05) co2Within5.k++;
    byConfidence[bill.confidence] ??= tally();
    byConfidence[bill.confidence].n++;
    if (allRight) byConfidence[bill.confidence].k++;
  } else {
    co2Within5.n++;
  }
}

const pct = ({ k, n }: Tally) => {
  const [lo, hi] = wilson(k, n);
  return n === 0 ? "n/a" : `${k}/${n} = ${Math.round((100 * k) / n)}% (95% CI ${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`;
};

console.log(`\nModel: ${EXTRACTION_MODEL}   bills: ${results.length}\n`);
console.log(`Is it a utility bill?          ${pct(validity)}`);
console.log(`CO2e within ±5% of truth       ${pct(co2Within5)}   <- what users get if they confirm without editing`);
console.log(`Fabricated a value not on bill ${pct(fabrication)}   <- lower is better`);
for (const [source, fields] of Object.entries(perField)) {
  console.log(`\nPer-field accuracy [${source}]`);
  for (const [field, t] of Object.entries(fields)) console.log(`  ${field.padEnd(22)} ${pct(t)}`);
}
console.log(`\nAll fields right, by Claude's own confidence rating:`);
for (const [level, t] of Object.entries(byConfidence)) console.log(`  ${level.padEnd(8)} ${pct(t)}`);

const tokensIn = results.reduce((s, r) => s + r.run.inputTokens, 0), tokensOut = results.reduce((s, r) => s + r.run.outputTokens, 0);
const [pin, pout] = PRICE_PER_MTOK[EXTRACTION_MODEL] ?? [0, 0];
const cost = (tokensIn * pin + tokensOut * pout) / 1e6;
const latencies = results.map((r) => r.run.latencyMs).filter((ms) => ms > 0).sort((a, b) => a - b);
console.log(`\nCost ≈ $${cost.toFixed(2)} total, $${(cost / Math.max(1, results.length)).toFixed(3)}/bill (uncached runs only); median latency ${((latencies[Math.floor(latencies.length / 2)] ?? 0) / 1000).toFixed(1)}s`);

console.log(`\nFailures (${failures.length}):`);
for (const f of failures) console.log(`  ${f.file}  ${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.got)}${f.traps ? `  [${f.traps}]` : ""}`);

const summary = {
  model: EXTRACTION_MODEL, ranAt: new Date().toISOString(), bills: results.length,
  validity, co2Within5, fabrication, perField, byConfidence, costUsd: cost, failures,
};
mkdirSync("eval/results", { recursive: true });
const stamp = summary.ranAt.replace(/[:.]/g, "-");
writeFileSync(`eval/results/${stamp}-${EXTRACTION_MODEL}.json`, JSON.stringify(summary, null, 2));
writeFileSync("eval/results/latest.json", JSON.stringify(summary, null, 2));
if (args.publish) {
  writeFileSync("data/eval-accuracy.json", JSON.stringify({ model: EXTRACTION_MODEL, ranAt: summary.ranAt, perField, co2Within5, fabrication }, null, 2));
  console.log("\nPublished data/eval-accuracy.json for the review screen.");
}
