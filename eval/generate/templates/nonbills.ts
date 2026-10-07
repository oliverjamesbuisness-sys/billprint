// Documents that are NOT electricity/gas bills (label is_utility_bill=false, every other field blank).
// Each looks bill-like on purpose: ZIPs, dates, totals and (for water) CCF usage, which is easy to mistake for gas.
import { makeRng, REGIONS, type NonBill, type Rng } from "../bills";
import * as s from "./shared";

const cents = (rng: Rng, min: number, max: number) => rng.int(min * 100, max * 100);
const longDate = (iso: string) => s.fullDate(iso, "short");
const place = (rng: Rng) => {
  const zip = rng.pick(Object.keys(REGIONS));
  return { zip, ...REGIONS[zip], street: `${rng.int(20, 4800)} ${rng.pick(["Elmwood Ave", "Harbor St", "Kingsley Rd", "Meadow Ln"])}` };
};

export function renderNonBill(d: NonBill): string {
  const rng = makeRng(d.seed);
  if (d.layout === "telecom") return telecom(rng);
  if (d.layout === "water") return water(rng);
  return receipt(rng);
}

function telecom(rng: Rng): string {
  const at = place(rng);
  const end = `2026-0${rng.int(3, 8)}-${rng.int(10, 20)}`;
  const lines = [
    ["Unlimited Plus plan (line 1)", cents(rng, 55, 75)],
    ["Line 2 - Unlimited Basic", cents(rng, 25, 35)],
    ["Device installment 14 of 24", cents(rng, 20, 40)],
    ["International calling add-on", cents(rng, 5, 10)],
    ["Taxes, surcharges & fees", cents(rng, 9, 16)],
  ] as const;
  const total = lines.reduce((t, l) => t + l[1], 0);
  const css = `body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 9.5pt; color: #222; }
    .hd { background: #5b2a86; color: #fff; padding: 14px 18px; border-radius: 8px; display: flex; justify-content: space-between; }
    .hd b { font-size: 18pt; } table { width: 100%; margin-top: 12px; } td, th { padding: 4px 2px; border-bottom: 1px solid #eee; text-align: left; }
    .box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; } .box div { background: #f5f0fa; border-radius: 8px; padding: 10px; }
    .k { font-size: 7.5pt; color: #777; text-transform: uppercase; } .v { font-size: 15pt; } .foot { font-size: 8pt; color: #666; margin-top: 20px; }`;
  return s.htmlDoc(css, [`
    <div class="hd"><div><b>Parlance Mobile</b><br>Your monthly wireless statement</div><div>Account 7730 ${rng.int(1000, 9999)} 2<br>Statement date ${longDate(end)}</div></div>
    <div class="box"><div><div class="k">Amount due</div><div class="v">${s.money(total)}</div></div>
      <div><div class="k">Billing period</div><div class="v" style="font-size:11pt">${longDate(addMonth(end, -1))} – ${longDate(end)}</div></div>
      <div><div class="k">Data used</div><div class="v">${rng.int(80, 340) / 10} GB</div></div></div>
    <p><b>Billing address</b><br>${s.esc(rng.pick(["Alex Moreno", "Taylor Kim", "Chris Doyle"]))}<br>${at.street}<br>${at.city}, ${at.state} ${at.zip}</p>
    <table><tr><th>Line</th><th>Talk</th><th>Text</th><th>Data</th></tr>
      <tr><td>(555) 010-${rng.int(1000, 1999)}</td><td>${rng.int(200, 600)} min</td><td>${rng.int(400, 1500)} msgs</td><td>${rng.int(50, 220) / 10} GB</td></tr>
      <tr><td>(555) 010-${rng.int(2000, 2999)}</td><td>${rng.int(50, 300)} min</td><td>${rng.int(100, 900)} msgs</td><td>${rng.int(10, 120) / 10} GB</td></tr></table>
    <table><tr><th>Charges</th><th class="amt">Amount</th></tr>${lines.map(([l, c]) => `<tr><td>${l}</td><td class="amt">${s.money(c)}</td></tr>`).join("")}
      <tr><td><b>Total due</b></td><td class="amt"><b>${s.money(total)}</b></td></tr></table>
    <div class="foot">Mail payments to Parlance Mobile, PO Box 660012, Dallas, TX 75266. Questions? Dial 611 from your phone.</div>`]);
}

function water(rng: Rng): string {
  const at = place(rng);
  const end = `2026-0${rng.int(4, 8)}-${rng.int(10, 25)}`;
  const ccf = rng.int(5, 14), prev = rng.int(1200, 5400), rate = rng.int(380, 620); // rate in cents per CCF
  const lines: [string, number][] = [
    ["Water base charge", cents(rng, 12, 20)],
    [`Water usage ${ccf} CCF × ${s.money(rate)}`, ccf * rate],
    ["Sewer service charge", cents(rng, 25, 45)],
    ["Stormwater fee", cents(rng, 4, 9)],
  ];
  const total = lines.reduce((t, l) => t + l[1], 0);
  const css = `body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #123; }
    h1 { color: #0b6e8a; margin: 0; font-size: 18pt; } .sub { color: #0b6e8a; } table { width: 100%; margin-top: 12px; }
    td, th { border: 1px solid #b7d4dd; padding: 4px 6px; text-align: left; } th { background: #e3f1f5; }
    .due { margin-top: 14px; font-size: 13pt; font-weight: bold; }`;
  return s.htmlDoc(css, [`
    <h1>Calder Springs Water Authority</h1><div class="sub">Water &amp; Sewer Bill · 1-800-555-0119</div>
    <table><tr><th>Account</th><th>Service address</th><th>Bill date</th><th>Due date</th></tr>
      <tr><td>W-${rng.int(100000, 999999)}</td><td>${at.street}, ${at.city}, ${at.state} ${at.zip}</td><td>${longDate(end)}</td><td>${longDate(addMonth(end, 1))}</td></tr></table>
    <table><tr><th>Meter</th><th>Service period</th><th>Previous read</th><th>Current read</th><th>Water used</th></tr>
      <tr><td>WM${rng.int(10000, 99999)}</td><td>${longDate(addMonth(end, -1))} – ${longDate(end)}</td><td>${prev}</td><td>${prev + ccf}</td><td>${ccf} CCF (${s.num(ccf * 748)} gallons)</td></tr></table>
    <table><tr><th>Charges</th><th class="amt">Amount</th></tr>${lines.map(([l, c]) => `<tr><td>${l}</td><td class="amt">${s.money(c)}</td></tr>`).join("")}</table>
    <div class="due">Total amount due: ${s.money(total)}</div>
    <p>Conserve water: fix leaks promptly and water lawns before 8 am. One CCF equals 748 gallons.</p>`]);
}

function receipt(rng: Rng): string {
  const at = place(rng);
  const items = ["ORGANIC BANANAS", "WHOLE MILK 1 GAL", "SOURDOUGH LOAF", "LARGE EGGS 12CT", "CHEDDAR BLOCK", "BABY SPINACH",
    "OLIVE OIL 500ML", "PASTA PENNE", "TOMATO SAUCE", "COFFEE BEANS", "GREEK YOGURT", "APPLES GALA"].map((n) => [n, cents(rng, 1, 12)] as const);
  const sub = items.reduce((t, i) => t + i[1], 0), tax = Math.round(sub * 0.0625);
  const css = `body { background: #fff; font-family: "Courier New", monospace; font-size: 10pt; }
    .page { width: 3.4in !important; min-height: 0 !important; padding: 0.25in 0.2in !important; }
    .c { text-align: center; } .r { display: flex; justify-content: space-between; } hr { border: none; border-top: 1px dashed #000; }`;
  const day = `2026-0${rng.int(1, 9)}-${rng.int(10, 28)}`;
  return s.htmlDoc(css, [`
    <div class="c"><b>HOLLINS &amp; PRATT GROCERS</b><br>${at.street.toUpperCase()}<br>${at.city.toUpperCase()}, ${at.state} ${at.zip}<br>(555) 010-${rng.int(3000, 3999)}</div><hr>
    ${items.map(([n, c]) => `<div class="r"><span>${n}</span><span>${(c / 100).toFixed(2)}</span></div>`).join("")}<hr>
    <div class="r"><span>SUBTOTAL</span><span>${(sub / 100).toFixed(2)}</span></div><div class="r"><span>TAX</span><span>${(tax / 100).toFixed(2)}</span></div>
    <div class="r"><b>TOTAL</b><b>${((sub + tax) / 100).toFixed(2)}</b></div><div class="r"><span>DEBIT CARD</span><span>${((sub + tax) / 100).toFixed(2)}</span></div><hr>
    <div class="c">${s.fullDate(day, "slash")} ${rng.int(8, 20)}:${String(rng.int(0, 59)).padStart(2, "0")}<br>ITEMS ${items.length}<br>THANK YOU FOR SHOPPING WITH US</div>`]);
}

function addMonth(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
