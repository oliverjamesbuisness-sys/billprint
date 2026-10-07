// Helpers every layout uses: formatting, a few reusable blocks, and the letter-size page wrapper.
// Elements that show a trap carry data-trap="..." so generate.ts can check each trap tag really got printed.
import { MONTHS, type Bill, type DateStyle, type Fuel, type Trap } from "../bills";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const has = (b: Bill, t: Trap) => b.traps.includes(t);
export const fuelsOf = (b: Bill) => [b.electric, b.gas].filter((f): f is Fuel => f !== null);

export const money = (cents: number) =>
  (cents < 0 ? "-$" : "$") + (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const usageText = (f: Fuel) => `${num(f.usage, f.decimals)} ${f.unit}`;
export const fuelName = (f: Fuel) => (f.kind === "electric" ? "Electric" : "Natural Gas");

// ── Dates ──
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (iso: string) => iso.split("-").map(Number);

/** A full date (statement date, due date) in the bill's style. */
export function fullDate(iso: string, style: DateStyle): string {
  const [y, m, d] = ymd(iso);
  if (style === "slash" || style === "yearless_slash") return `${pad(m)}/${pad(d)}/${y}`; // 01/05/2026
  if (style === "dmy") return `${d} ${MONTHS[m - 1]} ${y}`; // 5 Jan 2026
  if (style === "long") return `${LONG[m - 1]} ${d}, ${y}`; // January 5, 2026
  return `${MONTHS[m - 1]} ${d}, ${y}`; // Jan 5, 2026
}
/** A billing-period or meter-read date. The "yearless" styles drop the year, like many real bills. */
export function periodDate(iso: string, style: DateStyle): string {
  const [, m, d] = ymd(iso);
  if (style === "yearless") return `${MONTHS[m - 1]} ${d}`; // Dec 4
  if (style === "yearless_slash") return `${pad(m)}/${pad(d)}`; // 12/04
  return fullDate(iso, style);
}
export const periodRange = (b: Bill, sep = " – ") => `${periodDate(b.period.start, b.dateStyle)}${sep}${periodDate(b.period.end, b.dateStyle)}`;
export const date = (b: Bill, iso: string) => fullDate(iso, b.dateStyle);

// ── Addresses ──
/** Service address lines. On missing_zip bills the ZIP (and sometimes city/state) is simply not printed. */
export function serviceLines(b: Bill): string[] {
  const s = b.service;
  if (!b.showZip) return b.showCityState ? [s.street, `${s.city}, ${s.state}`] : [s.street];
  return [s.street, `${s.city}, ${s.state} ${s.zip}${s.zip4 ? "-" + s.zip4 : ""}`];
}
/** The utility's payment address (trap remit_zip: a different ZIP than the service address). */
export function remitLines(b: Bill): string[] {
  const r = b.provider.remit;
  return [b.provider.name, r.line, `${r.city}, ${r.state} ${r.zip}`];
}

// ── Reusable blocks ──
export function chargeRows(f: Fuel, detailClass = "detail"): string {
  return f.charges
    .map((l) => `<tr><td>${esc(l.label)}${l.detail ? ` <span class="${detailClass}">${esc(l.detail)}</span>` : ""}</td><td class="amt">${money(l.cents)}</td></tr>`)
    .join("");
}

/** Meter reading table (trap meter_reads): the start/end reads are big numbers that are NOT the usage. */
export function readsTable(b: Bill, f: Fuel, cls = "reads"): string {
  if (!f.reads) return "";
  const dates = b.showPeriod;
  const head = `<tr><th>Meter</th><th>Register</th>${dates ? "<th>Read dates</th>" : ""}<th>Previous read</th><th>Current read</th><th>Mult.</th><th>Usage</th></tr>`;
  const rows = f.reads
    .map((r) => `<tr><td>${r.meter}</td><td>${r.register}</td>${dates ? `<td>${periodRange(b, " - ")}</td>` : ""}<td>${r.prev}</td><td>${r.curr}</td><td>1</td><td>${num(r.usage)} ${r.unit}</td></tr>`)
    .join("");
  return `<table class="${cls}" data-trap="meter_reads">${head}${rows}</table>`;
}

/** Net metering box (trap net_metering): delivered vs received vs net. The label is the delivered figure. */
export function netBlock(f: Fuel, cls = "net"): string {
  if (!f.net) return "";
  return `<table class="${cls}" data-trap="net_metering">
    <tr><td>Energy delivered to you from the grid</td><td class="amt">${num(f.net.delivered)} kWh</td></tr>
    <tr><td>Energy received from your solar system</td><td class="amt">${num(f.net.received)} kWh</td></tr>
    <tr><td>Net energy billed</td><td class="amt">${num(f.net.net)} kWh</td></tr></table>`;
}

/** CCF -> therms conversion line (trap ccf_and_therms). The label is the therms figure. */
export function ccfLine(f: Fuel): string {
  if (!f.ccf) return "";
  return `<span data-trap="ccf_and_therms">${num(f.ccf.ccf)} CCF × ${f.ccf.factor.toFixed(4)} therm factor = ${num(f.usage, 1)} therms</span>`;
}

/** "Last period / same period last year" comparison (trap previous_usage). */
export function previousRows(f: Fuel): string {
  if (!f.previous) return "";
  const avg = (v: number, days: number) => num(v / days, f.decimals ? 2 : 1);
  const h = f.history;
  return `<tr><td>This period</td><td>${num(f.usage, f.decimals)} ${f.unit}</td><td>${avg(f.usage, h[12].days)}/day</td></tr>
    <tr><td>Last period</td><td>${num(f.previous.lastPeriod, f.decimals)} ${f.unit}</td><td>${avg(f.previous.lastPeriod, h[11].days)}/day</td></tr>
    <tr><td>Same period last year</td><td>${num(f.previous.lastYear, f.decimals)} ${f.unit}</td><td>${avg(f.previous.lastYear, h[0].days)}/day</td></tr>`;
}

/** 13-month usage bar chart (trap history_chart): twelve distractor numbers next to the real one. */
export function historyChart(f: Fuel, o: { width: number; height: number; color: string; values?: boolean; title?: string }): string {
  const h = f.history;
  const left = 34, bottom = 16, top = o.values === false ? 8 : 14;
  const plotW = o.width - left - 4, plotH = o.height - top - bottom;
  const max = Math.max(...h.map((x) => x.value));
  const step = niceStep(max / 4);
  const yMax = Math.ceil(max / step) * step;
  const slot = plotW / h.length, barW = slot * 0.68;
  const y = (v: number) => top + plotH - (v / yMax) * plotH;
  let svg = "";
  for (let t = 0; t <= yMax + 1e-9; t += step) {
    svg += `<line x1="${left}" x2="${o.width - 4}" y1="${y(t)}" y2="${y(t)}" stroke="#ddd" stroke-width="0.6"/>`;
    svg += `<text x="${left - 3}" y="${y(t) + 3}" text-anchor="end" font-size="7" fill="#666">${num(t, step < 1 ? 2 : Number.isInteger(step) ? 0 : 1)}</text>`;
  }
  h.forEach((p, i) => {
    const x = left + i * slot + (slot - barW) / 2;
    const last = i === h.length - 1;
    svg += `<rect x="${x}" y="${y(p.value)}" width="${barW}" height="${top + plotH - y(p.value)}" fill="${o.color}" opacity="${last ? 1 : 0.45}"/>`;
    if (o.values !== false) svg += `<text x="${x + barW / 2}" y="${y(p.value) - 2}" text-anchor="middle" font-size="6.5" fill="#333">${num(p.value, f.decimals)}</text>`;
    svg += `<text x="${x + barW / 2}" y="${o.height - 5}" text-anchor="middle" font-size="7" fill="#444">${p.month}${i === 0 || p.month === "Jan" ? ` '${String(p.year).slice(2)}` : ""}</text>`;
  });
  const title = o.title ? `<div class="chart-title">${esc(o.title)}</div>` : "";
  return `<div class="chart" data-trap="history_chart">${title}<svg width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" style="font-family:inherit">${svg}</svg></div>`;
}
function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
}

/** 13-month usage history as a table (trap history_chart, table form). */
export function historyTable(fuels: Fuel[], cls = "hist"): string {
  const rows = fuels[0].history
    .map((_, i) => `<tr><td>${fuels[0].history[i].month} ${fuels[0].history[i].year}</td><td>${fuels[0].history[i].days}</td>${fuels
      .map((f) => `<td>${num(f.history[i].value, f.decimals)}</td>`)
      .join("")}</tr>`)
    .reverse()
    .join("");
  return `<table class="${cls}" data-trap="history_chart"><tr><th>Month</th><th>Days</th>${fuels.map((f) => `<th>${f.unit}</th>`).join("")}</tr>${rows}</table>`;
}

export const MESSAGES = [
  "Lower your bill this season: set your thermostat a few degrees lower at night and seal drafts around doors and windows.",
  "Paperless billing and AutoPay are free. Enroll online or call Customer Service.",
  "Budget Billing spreads your payments evenly across the year. Ask us whether your account is eligible.",
  "Rate changes approved by the state utilities commission took effect this billing cycle. See the enclosed notice for details.",
  "Assistance programs may lower your bill if you qualify. Call us or visit a community action agency near you.",
  "Call before you dig. Contact the national call-before-you-dig line a few days before any digging project.",
];
export const FINE_PRINT =
  "Charges are calculated using the rate schedules on file with the state regulatory commission. Late payment charges may apply to " +
  "balances not received by the due date. If you dispute any portion of this bill, please contact us before the due date; undisputed " +
  "amounts remain payable. Meter readings may be estimated when access to the meter is unavailable; estimated reads are adjusted on a " +
  "later bill after an actual read. Taxes and franchise fees are collected on behalf of state and local governments. ";

/** Wraps letter-size pages into one HTML document. Each string in `pages` prints as exactly one page. */
export function htmlDoc(css: string, pages: string[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 8.5in 11in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 8.5in; min-height: 11in; padding: 0.45in 0.5in; position: relative; break-after: page; background: #fff; }
.page:last-child { break-after: auto; }
.pageno { position: absolute; bottom: 0.25in; right: 0.5in; font-size: 7pt; color: #777; }
table { border-collapse: collapse; }
.amt { text-align: right; white-space: nowrap; }
${css}
</style></head><body>${pages
    .map((p, i) => `<div class="page">${p}${pages.length > 1 ? `<div class="pageno">Page ${i + 1} of ${pages.length}</div>` : ""}</div>`)
    .join("")}</body></html>`;
}
