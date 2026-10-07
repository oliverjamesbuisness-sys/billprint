// Synthetic utility-bill generator for the BillPrint eval.
//
//   npx tsx eval/generate/generate.ts          (run from the project root; SEED=123 for a different set)
//
// 1. bills.ts turns a fixed trap plan + a seeded RNG into one data object per bill.
// 2. A template (templates/) turns that object into HTML; the installed Google Chrome (playwright-core) prints it
//    to PDF or takes a PNG screenshot.
// 3. The .jpg bills are those PNGs degraded with sharp to look like phone photos
//    (tilt, low resolution, blur, uneven light, heavy JPEG compression).
// 4. Self-check of the rendered page text: every labeled value must be printed, every blank label must truly be
//    absent, every trap tag must have its element on the page, and multi-page PDFs keep usage off page 1.
// 5. eval/labels.csv is written from the same objects (rows from other sources, e.g. utility_sample, are kept).
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import sharp from "sharp";
import { billSeed, buildDocs, labelRow, LABEL_COLUMNS, makeRng, round, TRAPS, type DateStyle, type Doc, type LabelRow, type Rng } from "./bills";
import { renderDoc } from "./templates";
import { money, num, periodDate } from "./templates/shared";

const SEED = Number(process.env.SEED ?? 20261006);
const OUT_DIR = path.join("eval", "bills", "synthetic");
const LABELS_CSV = path.join("eval", "labels.csv");
const PAGE_PX = { width: 816, height: 1056 }; // 8.5 x 11 in at 96 CSS px per inch
const DATE_STYLES: DateStyle[] = ["slash", "short", "dmy", "long", "yearless", "yearless_slash"];

async function main() {
  if (!fs.existsSync(path.join("eval", "generate"))) throw new Error("Run this from the project root.");
  const docs = buildDocs(SEED);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) if (/^\d{3}_.+\.(pdf|png|jpg)$/.test(f)) fs.rmSync(path.join(OUT_DIR, f));

  const browser = await chromium.launch({ channel: "chrome" }); // installed Google Chrome, nothing to download
  const page = await browser.newPage({ viewport: PAGE_PX, deviceScaleFactor: 2 });
  const problems: string[] = [];
  const manifest: Record<string, unknown>[] = [];
  try {
    for (const doc of docs) {
      await page.setContent(renderDoc(doc), { waitUntil: "load" });
      const shown = await readPage(page);
      problems.push(...check(doc, shown).map((m) => `${doc.slug}: ${m}`));

      const out = path.join(OUT_DIR, path.basename(doc.file));
      const info: Record<string, unknown> = { file: doc.file, layout: doc.layout, format: doc.format, traps: doc.traps, notes: doc.notes };
      if (doc.type === "bill") Object.assign(info, { date_style: doc.dateStyle, gas_unit: doc.gas?.unit ?? null, amount_due: doc.amountDueCents / 100 });
      if (doc.format === "pdf") {
        const pdf = fixPdfDates(await page.pdf({ width: "8.5in", height: "11in", printBackground: true }));
        info.pages = countPdfPages(pdf);
        if (info.pages !== shown.pages) problems.push(`${doc.slug}: PDF has ${info.pages} pages but the layout has ${shown.pages}`);
        fs.writeFileSync(out, pdf);
      } else {
        const png = await page.locator(".page").first().screenshot();
        if (doc.format === "png") fs.writeFileSync(out, png);
        else {
          const { jpg, params } = await degrade(png, makeRng(billSeed(SEED, doc.id) + 500), doc.layout);
          fs.writeFileSync(out, jpg);
          info.degrade = params;
        }
      }
      manifest.push(info);
      process.stdout.write(".");
    }
  } finally {
    await browser.close();
  }

  if (problems.length) {
    console.error(`\nSelf-check failed (labels.csv NOT written):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  const kept = writeLabels(docs.map(labelRow));
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify({ seed: SEED, bills: manifest }, null, 2) + "\n");
  printSummary(docs, kept);
}

// ── Reading back what Chrome actually rendered ───────────────────────────────
async function readPage(page: Page) {
  return page.evaluate(() => {
    const pages = Array.from(document.querySelectorAll<HTMLElement>(".page"));
    return {
      pages: pages.length,
      text: document.body.innerText, // includes SVG chart labels
      firstPage: pages[0]?.innerText ?? "",
      heights: pages.map((p) => p.offsetHeight),
      traps: Array.from(document.querySelectorAll("[data-trap]")).map((e) => e.getAttribute("data-trap") ?? ""),
    };
  });
}
type Shown = Awaited<ReturnType<typeof readPage>>;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Is `value` on the page as a whole token? ("689" must not match inside "1,689" or "68.90"; case-insensitive.) */
const printed = (text: string, value: string) => new RegExp("(?<![\\w.,/])" + escapeRe(value) + "(?![\\w]|[.,/]\\d)", "i").test(text);

function check(doc: Doc, shown: Shown): string[] {
  const bad: string[] = [];
  if (doc.layout !== "receipt")
    shown.heights.forEach((h, i) => h > PAGE_PX.height + 1 && bad.push(`page ${i + 1} overflows letter size (${h}px)`));
  if (doc.type === "nonbill") return bad;

  const b = doc;
  const label = labelRow(b);
  const mustShow = (what: string, value: string) => { if (!printed(shown.text, value)) bad.push(`${what} "${value}" is labeled but not printed`); };
  const mustHide = (what: string, value: string, text = shown.text) => { if (printed(text, value)) bad.push(`${what} "${value}" is printed but must not be`); };

  // 1. Every labeled value is printed, in the bill's own formatting.
  if (!shown.text.toLowerCase().includes(b.provider.name.toLowerCase())) bad.push("provider name not printed");
  if (label.service_zip) mustShow("service ZIP", label.service_zip);
  if (label.period_start) for (const d of [b.period.start, b.period.end]) mustShow("period date", periodDate(d, b.dateStyle));
  for (const f of [b.electric, b.gas]) {
    if (!f) continue;
    mustShow(`${f.kind} usage`, num(f.usage, f.decimals));
    mustShow(`${f.kind} cost`, money(f.costCents).slice(1));
  }
  mustShow("total current charges", money(b.currentCents).slice(1));

  // 2. Every blank label is truly absent: no service ZIP anywhere / no period date in any format.
  if (!b.showZip) mustHide("service ZIP", b.service.zip);
  if (!b.showPeriod) for (const style of DATE_STYLES) for (const d of [b.period.start, b.period.end]) mustHide("period date", periodDate(d, style));

  // 3. Each visual trap is on the page exactly when it is tagged.
  for (const t of ["remit_zip", "history_chart", "previous_usage", "meter_reads", "net_metering", "ccf_and_therms"] as const) {
    if (b.traps.includes(t) !== shown.traps.includes(t)) bad.push(`trap ${t} tagged=${b.traps.includes(t)} but on page=${shown.traps.includes(t)}`);
  }
  if (b.traps.includes("remit_zip")) mustShow("remit ZIP", b.provider.remit.zip);

  // 4. Multi-page bills keep the usage numbers off page 1.
  if (b.multiPage) for (const f of [b.electric, b.gas]) if (f) mustHide(`${f.kind} usage on page 1`, num(f.usage, f.decimals), shown.firstPage);
  return bad;
}

// ── PDF helpers ──────────────────────────────────────────────────────────────
/** Chrome stamps the current time into each PDF; pin it so re-runs give byte-identical files (keeps the eval cache warm). */
function fixPdfDates(pdf: Buffer): Buffer {
  const text = pdf.toString("latin1").replace(/\/(CreationDate|ModDate) \(D:\d{14}/g, (_m, key) => `/${key} (D:20260101000000`);
  return Buffer.from(text, "latin1"); // same length, so the PDF's byte offsets stay valid
}
const countPdfPages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

// ── Phone-photo degradation ──────────────────────────────────────────────────
async function degrade(png: Buffer, rng: Rng, layout: string) {
  const p = {
    tilt_deg: round((rng.chance(0.5) ? -1 : 1) * rng.float(3, 8), 1),
    width_px: layout === "dense" ? rng.int(950, 1050) : rng.int(680, 820), // dense small print would be unreadable at 700 px
    blur_sigma: round(rng.float(0.5, 1.0), 2),
    jpeg_quality: rng.int(28, 45),
    shadow_opacity: round(rng.float(0.25, 0.45), 2),
    light_spot_pct: [rng.int(15, 85), rng.int(10, 60)],
  };
  const desk = { r: 92, g: 82, b: 70 };
  const margin = Math.round(((await sharp(png).metadata()).width ?? 1600) * 0.06);

  // 1. The paper lies on a desk and is photographed at a tilt.
  const tilted = await sharp(png).flatten({ background: "#ffffff" })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: desk })
    .rotate(p.tilt_deg, { background: desk }).png().toBuffer();
  // 2. Low resolution and slightly out of focus.
  const small = await sharp(tilted).resize({ width: p.width_px }).png().toBuffer();
  const soft = await sharp(small).blur(p.blur_sigma).png().toBuffer();
  // 3. Uneven light (a bright spot fading to shadowed corners), a warm indoor colour cast, heavy JPEG compression.
  const { width, height } = await sharp(soft).metadata();
  const light = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="l" cx="${p.light_spot_pct[0]}%" cy="${p.light_spot_pct[1]}%" r="90%">
      <stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="${p.shadow_opacity}"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#l)"/></svg>`;
  const jpg = await sharp(soft)
    .recomb([[1.04, 0, 0], [0, 1.0, 0], [0, 0, 0.88]])
    .composite([{ input: Buffer.from(light) }])
    .jpeg({ quality: p.jpeg_quality })
    .toBuffer();
  return { jpg, params: p };
}

// ── labels.csv ───────────────────────────────────────────────────────────────
function writeLabels(rows: LabelRow[]): number {
  const header = LABEL_COLUMNS.join(",");
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // Keep rows this generator didn't write (e.g. hand-labeled source=utility_sample bills).
  let kept: string[] = [];
  if (fs.existsSync(LABELS_CSV)) {
    const [oldHeader = "", ...lines] = fs.readFileSync(LABELS_CSV, "utf8").split(/\r?\n/);
    if (oldHeader.trim() && oldHeader.trim() !== header) throw new Error(`${LABELS_CSV} has different columns; not overwriting it.`);
    kept = lines.filter((l) => l.trim() && !l.replace(/^"/, "").startsWith("synthetic/"));
  }
  const synthetic = rows.map((r) => LABEL_COLUMNS.map((c) => cell(r[c])).join(","));
  fs.writeFileSync(LABELS_CSV, [header, ...synthetic, ...kept].join("\n") + "\n");
  return kept.length;
}

function printSummary(docs: Doc[], kept: number) {
  const tally = (key: (d: Doc) => string[]) => {
    const counts: Record<string, number> = {};
    for (const d of docs) for (const k of key(d)) counts[k] = (counts[k] ?? 0) + 1;
    return Object.entries(counts).map(([k, n]) => `${k}=${n}`).join("  ");
  };
  console.log(`\n\nWrote ${docs.length} documents to ${OUT_DIR}/ and their rows to ${LABELS_CSV} (kept ${kept} non-synthetic rows).`);
  console.log(`  source:  ${tally((d) => [d.source])}`);
  console.log(`  format:  ${tally((d) => [d.format])}`);
  console.log(`  layout:  ${tally((d) => [d.layout])}`);
  console.log(`  traps:   ${TRAPS.map((t) => `${t}=${docs.filter((d) => d.traps.includes(t)).length}`).join("  ")}`);
  console.log(`  no traps (clean controls): ${docs.filter((d) => d.traps.length === 0).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
