// Data for the synthetic eval bills.
//
// Every bill is ONE `Bill` object. A template renders it to HTML and `labelRow()` turns the very same object
// into its eval/labels.csv row, so a label can never disagree with what was printed (correct by construction).
// All randomness comes from a seeded RNG (one stream per bill): same seed -> identical bills on every run.

export type Trap =
  | "remit_zip" | "history_chart" | "previous_usage" | "meter_reads" | "multi_page" | "combined"
  | "net_metering" | "ccf_and_therms" | "missing_zip" | "missing_dates" | "non_bill" | "degraded";
export const TRAPS: Trap[] = [
  "remit_zip", "history_chart", "previous_usage", "meter_reads", "multi_page", "combined",
  "net_metering", "ccf_and_therms", "missing_zip", "missing_dates", "non_bill", "degraded",
];

export type GasUnit = "therms" | "CCF" | "MCF" | "Dth";
/** How dates are printed. The "yearless" styles print the billing period without a year (only the statement date has one). */
export type DateStyle = "slash" | "short" | "dmy" | "long" | "yearless" | "yearless_slash";
export type Layout = "classic" | "modern" | "dense" | "tabular" | "combined";
export type NonBillLayout = "telecom" | "water" | "receipt";
export type Format = "pdf" | "png" | "jpg";
export type Source = "synthetic_clean" | "synthetic_degraded";

// ── Seeded random numbers (mulberry32) ───────────────────────────────────────
export type Rng = ReturnType<typeof makeRng>;
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    float: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

export const round = (x: number, decimals = 0) => Math.round(x * 10 ** decimals) / 10 ** decimals;

// ── Places: real ZIPs in different grid regions. Streets and people are made up. ──
type Climate = "hot" | "cold" | "mild" | "mixed";
interface Region { city: string; state: string; climate: Climate; kwhPrice: [number, number]; thermPrice: [number, number] }
export const REGIONS: Record<string, Region> = {
  "94110": { city: "San Francisco", state: "CA", climate: "mild", kwhPrice: [0.32, 0.4], thermPrice: [2.0, 2.6] },
  "10001": { city: "New York", state: "NY", climate: "cold", kwhPrice: [0.24, 0.3], thermPrice: [1.6, 2.1] },
  "63101": { city: "St. Louis", state: "MO", climate: "mixed", kwhPrice: [0.11, 0.14], thermPrice: [1.1, 1.5] },
  "60601": { city: "Chicago", state: "IL", climate: "cold", kwhPrice: [0.15, 0.18], thermPrice: [0.9, 1.3] },
  "98101": { city: "Seattle", state: "WA", climate: "mild", kwhPrice: [0.11, 0.14], thermPrice: [1.4, 1.8] },
  "80202": { city: "Denver", state: "CO", climate: "cold", kwhPrice: [0.14, 0.17], thermPrice: [0.8, 1.2] },
  "02139": { city: "Cambridge", state: "MA", climate: "cold", kwhPrice: [0.28, 0.33], thermPrice: [1.8, 2.3] },
  "77002": { city: "Houston", state: "TX", climate: "hot", kwhPrice: [0.14, 0.16], thermPrice: [1.0, 1.4] },
  "33101": { city: "Miami", state: "FL", climate: "hot", kwhPrice: [0.14, 0.17], thermPrice: [1.8, 2.4] },
  "85004": { city: "Phoenix", state: "AZ", climate: "hot", kwhPrice: [0.13, 0.16], thermPrice: [1.3, 1.8] },
};

const STREETS = ["Larkspur Ln", "Wexford Ave", "Juniper St", "Calloway Dr", "Hollis Pl", "Marigold Way", "Bramble Ct",
  "Ashgrove Rd", "Tilden St", "Copley Ter", "Quarry Rd", "Sandpiper Cir", "Linden Row", "Orchard Hill Dr"];
const PEOPLE = ["Jordan Ellis", "Priya Raman", "Marcus Bell", "Sofia Alvarez", "Dana Whitaker", "Kenji Mori", "Aaliyah Brooks",
  "Tomasz Nowak", "Grace Okafor", "Luis Ortega", "Hannah Feld", "Omar Haddad", "Riley Chen", "Nadia Petrova"];

// ── Fictional utilities (invented names, no real companies or logos) ─────────
export interface Provider {
  key: string;
  name: string;
  initials: string; // drawn as a plain monogram, the only "logo"
  zip: string; // service territory
  phone: string; // 555-01xx numbers are reserved for fiction
  color: string;
  remit: { line: string; city: string; state: string; zip: string }; // payment address, ZIP differs from service ZIP
}
const p = (key: string, name: string, initials: string, zip: string, phone: string, color: string, remit: Provider["remit"]): Provider =>
  ({ key, name, initials, zip, phone, color, remit });
export const PROVIDERS = {
  bayfront: p("bayfront", "Bayfront Gas & Electric", "BG", "94110", "1-800-555-0131", "#0f4c81", { line: "PO Box 997310", city: "Sacramento", state: "CA", zip: "95899" }),
  quillfield: p("quillfield", "Quillfield Energy", "QE", "10001", "1-800-555-0144", "#3b2f80", { line: "PO Box 1802", city: "Newark", state: "NJ", zip: "07101" }),
  orrin: p("orrin", "Orrin River Energy", "OR", "63101", "1-800-555-0152", "#1f6f50", { line: "PO Box 66110", city: "St. Louis", state: "MO", zip: "63166" }),
  tamberlane: p("tamberlane", "Tamberlane Gas Company", "TG", "63101", "1-800-555-0163", "#8a3b12", { line: "PO Box 4030", city: "Kansas City", state: "MO", zip: "64121" }),
  bellmoor: p("bellmoor", "Bellmoor Electric", "BE", "60601", "1-800-555-0117", "#b5121b", { line: "PO Box 6119", city: "Carol Stream", state: "IL", zip: "60197" }),
  fenwick: p("fenwick", "Fenwick Hollow Gas", "FH", "60601", "1-800-555-0178", "#005f73", { line: "PO Box 3375", city: "Aurora", state: "IL", zip: "60507" }),
  graymarsh: p("graymarsh", "Graymarsh Public Power", "GP", "98101", "1-800-555-0129", "#2d6a4f", { line: "PO Box 34027", city: "Seattle", state: "WA", zip: "98124" }),
  pinewhistle: p("pinewhistle", "Pinewhistle Natural Gas", "PN", "98101", "1-800-555-0186", "#386641", { line: "PO Box 9100", city: "Tacoma", state: "WA", zip: "98411" }),
  kestrel: p("kestrel", "Kestrel Ridge Energy", "KR", "80202", "1-800-555-0190", "#6a4c93", { line: "PO Box 173810", city: "Denver", state: "CO", zip: "80217" }),
  saltmarsh: p("saltmarsh", "Saltmarsh Light & Power", "SL", "02139", "1-800-555-0134", "#1d3557", { line: "PO Box 4410", city: "Boston", state: "MA", zip: "02241" }),
  harrowgate: p("harrowgate", "Harrowgate Gas Service", "HG", "02139", "1-800-555-0105", "#9c2c13", { line: "PO Box 1170", city: "Worcester", state: "MA", zip: "01613" }),
  vantorra: p("vantorra", "Vantorra Energy", "VE", "77002", "1-800-555-0112", "#d35400", { line: "PO Box 650321", city: "Dallas", state: "TX", zip: "75265" }),
  thistledown: p("thistledown", "Thistledown Gas", "TD", "77002", "1-800-555-0157", "#5a189a", { line: "PO Box 4567", city: "Houston", state: "TX", zip: "77210" }),
  coralwick: p("coralwick", "Coralwick Power & Light", "CP", "33101", "1-800-555-0148", "#0077b6", { line: "PO Box 025576", city: "Miami", state: "FL", zip: "33102" }),
  duskvale: p("duskvale", "Duskvale Electric", "DE", "85004", "1-800-555-0166", "#c1121f", { line: "PO Box 52010", city: "Phoenix", state: "AZ", zip: "85072" }),
  amberline: p("amberline", "Amberline Gas", "AG", "85004", "1-800-555-0171", "#bc6c25", { line: "PO Box 98890", city: "Las Vegas", state: "NV", zip: "89193" }),
};
type ProviderKey = keyof typeof PROVIDERS;

// ── The plan: one line per bill. Traps are placed deliberately; the RNG only fills in names and numbers. ──
// "combined" (both fuels), "degraded" (jpg = phone photo) and "non_bill" are added automatically.
interface Recipe {
  layout: Layout | NonBillLayout;
  format: Format;
  fuels?: "E" | "G" | "EG";
  provider?: ProviderKey;
  dates?: DateStyle;
  gas?: GasUnit;
  traps?: Trap[];
  periodEnd?: string; // pin the period end (year-boundary cases)
  balanceForward?: boolean; // unpaid previous balance, so "amount due" is not the current charges
}
export const PLAN: Recipe[] = [
  /*  1 */ { layout: "classic", fuels: "E", provider: "bayfront", format: "pdf", dates: "slash", traps: ["remit_zip", "meter_reads", "history_chart"] },
  /*  2 */ { layout: "modern", fuels: "E", provider: "quillfield", format: "png", dates: "short", traps: ["previous_usage"], balanceForward: true },
  /*  3 */ { layout: "dense", fuels: "G", provider: "tamberlane", format: "jpg", dates: "dmy", gas: "therms", traps: ["remit_zip", "ccf_and_therms", "meter_reads"] },
  /*  4 */ { layout: "tabular", fuels: "E", provider: "bellmoor", format: "pdf", dates: "slash", traps: ["multi_page", "meter_reads", "history_chart"] },
  /*  5 */ { layout: "combined", fuels: "EG", provider: "kestrel", format: "png", dates: "yearless", gas: "Dth", traps: ["remit_zip", "history_chart"], periodEnd: "2026-01-07" },
  /*  6 */ { layout: "classic", fuels: "G", provider: "pinewhistle", format: "jpg", dates: "short", gas: "therms", traps: ["missing_zip"] },
  /*  7 */ { layout: "modern", fuels: "E", provider: "duskvale", format: "pdf", dates: "long", traps: ["net_metering", "previous_usage"] },
  /*  8 */ { layout: "dense", fuels: "E", provider: "vantorra", format: "png", dates: "slash", traps: ["history_chart", "previous_usage", "remit_zip"], balanceForward: true },
  /*  9 */ { layout: "tabular", fuels: "G", provider: "harrowgate", format: "jpg", dates: "slash", gas: "CCF", traps: ["meter_reads"] },
  /* 10 */ { layout: "combined", fuels: "EG", provider: "bayfront", format: "pdf", dates: "short", gas: "therms", traps: ["multi_page", "meter_reads"] },
  /* 11 */ { layout: "classic", fuels: "E", provider: "coralwick", format: "png", dates: "long", traps: ["missing_dates", "history_chart"] },
  /* 12 */ { layout: "modern", fuels: "E", provider: "graymarsh", format: "jpg", dates: "dmy", traps: ["remit_zip"] },
  /* 13 */ { layout: "dense", fuels: "E", provider: "saltmarsh", format: "pdf", dates: "yearless", traps: ["multi_page", "remit_zip", "previous_usage"] },
  /* 14 */ { layout: "tabular", fuels: "EG", provider: "quillfield", format: "png", dates: "slash", gas: "therms", traps: ["ccf_and_therms", "meter_reads", "history_chart"] },
  /* 15 */ { layout: "combined", fuels: "EG", provider: "orrin", format: "jpg", dates: "short", gas: "MCF", traps: ["previous_usage"], balanceForward: true },
  /* 16 */ { layout: "classic", fuels: "E", provider: "vantorra", format: "pdf", dates: "dmy", traps: ["meter_reads", "missing_zip", "remit_zip"] },
  /* 17 */ { layout: "modern", fuels: "G", provider: "fenwick", format: "png", dates: "short", gas: "therms", traps: ["missing_dates"] },
  /* 18 */ { layout: "dense", fuels: "G", provider: "thistledown", format: "jpg", dates: "long", gas: "MCF", traps: ["history_chart"] },
  /* 19 */ { layout: "tabular", fuels: "E", provider: "duskvale", format: "pdf", dates: "short", traps: ["net_metering", "meter_reads", "multi_page"] },
  /* 20 */ { layout: "combined", fuels: "G", provider: "harrowgate", format: "png", dates: "yearless_slash", gas: "therms", traps: ["ccf_and_therms", "remit_zip"] },
  /* 21 */ { layout: "classic", fuels: "EG", provider: "kestrel", format: "jpg", dates: "slash", gas: "Dth", traps: ["missing_zip"] },
  /* 22 */ { layout: "modern", fuels: "EG", provider: "bayfront", format: "pdf", dates: "yearless", gas: "therms", traps: ["history_chart"], periodEnd: "2026-01-04" },
  /* 23 */ { layout: "dense", fuels: "E", provider: "bellmoor", format: "png", dates: "dmy", traps: ["missing_zip", "meter_reads"], balanceForward: true },
  /* 24 */ { layout: "tabular", fuels: "E", provider: "coralwick", format: "jpg", dates: "long", traps: ["previous_usage", "missing_dates"] },
  /* 25 */ { layout: "combined", fuels: "EG", provider: "quillfield", format: "pdf", dates: "slash", gas: "CCF", traps: ["remit_zip", "missing_dates"] },
  /* 26 */ { layout: "classic", fuels: "E", provider: "saltmarsh", format: "png", dates: "short", traps: ["remit_zip", "previous_usage"] },
  /* 27 */ { layout: "modern", fuels: "E", provider: "orrin", format: "jpg", dates: "slash", traps: ["meter_reads", "history_chart"] },
  /* 28 */ { layout: "dense", fuels: "E", provider: "graymarsh", format: "pdf", dates: "dmy", traps: ["multi_page", "missing_dates"] },
  /* 29 */ { layout: "tabular", fuels: "G", provider: "tamberlane", format: "png", dates: "dmy", gas: "therms", traps: ["ccf_and_therms", "meter_reads", "remit_zip"] },
  /* 30 */ { layout: "classic", fuels: "E", provider: "kestrel", format: "jpg", dates: "long", traps: ["net_metering", "history_chart"] },
  /* 31 */ { layout: "dense", fuels: "E", provider: "coralwick", format: "pdf", dates: "yearless_slash", traps: ["missing_zip", "remit_zip", "meter_reads"], periodEnd: "2025-12-30", balanceForward: true },
  /* 32 */ { layout: "combined", fuels: "EG", provider: "quillfield", format: "png", dates: "yearless", gas: "CCF", traps: ["previous_usage"] },
  /* 33 */ { layout: "modern", fuels: "G", provider: "amberline", format: "jpg", dates: "long", gas: "therms" },
  /* 34 */ { layout: "tabular", fuels: "E", provider: "vantorra", format: "pdf", dates: "short" },
  /* 35 */ { layout: "dense", fuels: "G", provider: "fenwick", format: "png", dates: "long", gas: "therms" },
  /* 36 */ { layout: "telecom", format: "pdf" },
  /* 37 */ { layout: "water", format: "png" },
  /* 38 */ { layout: "receipt", format: "jpg" },
];

// ── Bill data model ──────────────────────────────────────────────────────────
export interface ChargeLine { label: string; detail?: string; cents: number }
export interface MeterRead { meter: string; register: string; prev: number; curr: number; usage: number; unit: string }
export interface Fuel {
  kind: "electric" | "gas";
  usage: number; // THE labeled usage for this period (kWh delivered from the grid on net-metered bills)
  unit: "kWh" | GasUnit;
  decimals: number; // digits printed after the decimal point
  rateName: string;
  meter: string;
  reads?: MeterRead[]; // trap: meter_reads
  ccf?: { ccf: number; factor: number }; // trap: ccf_and_therms (usage is the therms figure)
  net?: { delivered: number; received: number; net: number }; // trap: net_metering (usage = delivered)
  charges: ChargeLine[];
  costCents: number; // = sum of charges
  history: { month: string; year: number; days: number; value: number }[]; // 13 periods, the last one is this bill
  previous?: { lastPeriod: number; lastYear: number }; // trap: previous_usage
}
export interface Bill {
  type: "bill";
  id: number;
  slug: string;
  file: string; // relative to eval/bills/
  format: Format;
  source: Source;
  layout: Layout;
  traps: Trap[];
  provider: Provider;
  customer: string;
  account: string;
  service: { street: string; city: string; state: string; zip: string; zip4: string | null };
  showZip: boolean; // false -> trap missing_zip: no service ZIP anywhere on the bill
  showCityState: boolean;
  period: { start: string; end: string; days: number };
  statementDate: string;
  dueDate: string;
  paymentDate: string;
  dateStyle: DateStyle;
  showPeriod: boolean; // false -> trap missing_dates: no period or read dates anywhere
  showStatementDate: boolean;
  showDays: boolean;
  electric: Fuel | null;
  gas: Fuel | null;
  currentCents: number; // total CURRENT charges = the total_cost_usd label
  previousBillCents: number;
  paymentCents: number;
  balanceForwardCents: number;
  amountDueCents: number; // balance forward + current charges
  multiPage: boolean;
  notes: string[]; // human-readable details for manifest.json
}
export interface NonBill {
  type: "nonbill";
  id: number;
  slug: string;
  file: string;
  format: Format;
  source: Source;
  layout: NonBillLayout;
  traps: Trap[];
  seed: number; // the template draws its own (deterministic) content from this
  notes: string[];
}
export type Doc = Bill | NonBill;

// ── Dates (ISO strings, UTC, so time zones can't shift a day) ────────────────
const DAY_MS = 86_400_000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Usage models: seasonal shape x a random household size ───────────────────
const KWH_SEASON: Record<Climate, number[]> = {
  //       J     F     M     A     M     J     J     A     S     O     N     D
  hot: [0.8, 0.8, 0.85, 0.95, 1.25, 1.55, 1.75, 1.75, 1.55, 1.2, 0.9, 0.85],
  mixed: [1.1, 1.05, 0.9, 0.85, 0.95, 1.2, 1.35, 1.35, 1.15, 0.9, 0.95, 1.1],
  cold: [1.15, 1.1, 1.0, 0.9, 0.9, 1.05, 1.2, 1.2, 1.0, 0.9, 1.0, 1.15],
  mild: [1.15, 1.1, 1.0, 0.95, 0.9, 0.9, 0.95, 0.95, 0.9, 0.95, 1.05, 1.15],
};
const HEAT_SEASON = [1.0, 0.95, 0.65, 0.35, 0.1, 0, 0, 0, 0.08, 0.3, 0.6, 0.95]; // share of peak space heating
const HEAT_CLIMATE: Record<Climate, number> = { cold: 1.0, mixed: 0.85, mild: 0.55, hot: 0.3 };
const THERMS_PER_UNIT: Record<GasUnit, number> = { therms: 1, CCF: 1.037, MCF: 10.37, Dth: 10 };

/** 13 billing periods ending with this one (the last value IS this bill's usage). */
function makeHistory(end: string, days: number, current: number, decimals: number, rng: Rng, per30: (month: number) => number) {
  const [y, m] = end.split("-").map(Number);
  const out: Fuel["history"] = [];
  for (let k = 12; k >= 0; k--) {
    const idx = y * 12 + (m - 1) - k;
    const month = idx % 12;
    const periodDays = k === 0 ? days : rng.int(28, 33);
    const value = k === 0 ? current : Math.max(round(per30(month) * (periodDays / 30) * rng.float(0.88, 1.12), decimals), 10 ** -decimals);
    out.push({ month: MONTHS[month], year: Math.floor(idx / 12), days: periodDays, value });
  }
  return out;
}

// ── Charges (all money in integer cents, unit prices in 1/100,000 dollar, so every line adds up exactly) ──
const lineCents = (qty: number, price: number) => Math.round((qty * price) / 1000);
const fmtQty = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPrice = (price: number) => (price < 0 ? "-$" : "$") + (Math.abs(price) / 1e5).toFixed(5);

const ELECTRIC_WORDS = [
  ["Basic service charge", "Energy charge", "Delivery charge", "Fuel cost adjustment", "Taxes & fees"],
  ["Customer charge", "Generation", "Transmission & distribution", "Power cost adjustment", "State & local taxes"],
  ["Monthly service charge", "Electric supply", "Distribution service", "Rate adjustment rider", "Sales & franchise tax"],
];
const TEXAS_WORDS = ["Base charge", "Energy charge", "TDU delivery charges", "Fuel adjustment", "Gross receipts & PUC fees"];
const GAS_WORDS = [
  ["Customer charge", "Gas supply", "Distribution charge", "Taxes & fees"],
  ["Basic service charge", "Natural gas cost", "Delivery charge", "State & local taxes"],
  ["Monthly service fee", "Commodity charge", "Transportation & delivery", "Franchise tax"],
];

function taxLine(label: string, lines: ChargeLine[], rng: Rng): ChargeLine {
  const rate = round(rng.float(0.015, 0.065), 4);
  const subtotal = lines.reduce((s, l) => s + l.cents, 0);
  return { label, detail: `${(rate * 100).toFixed(2)}% of ${fmtMoney(subtotal)}`, cents: Math.round(subtotal * rate) };
}
const fmtMoney = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function electricCharges(billedKwh: number, region: Region, words: string[], rng: Rng, net: boolean): ChargeLine[] {
  const perKwh = Math.round(rng.float(...region.kwhPrice) * 1e5);
  const supply = Math.round(perKwh * rng.float(0.5, 0.6));
  const delivery = Math.round(perKwh * rng.float(0.32, 0.4));
  const adjust = Math.round(perKwh * rng.float(-0.03, 0.05));
  const q = `${fmtQty(billedKwh, 0)} kWh${net ? " (net)" : ""}`;
  const lines: ChargeLine[] = [
    { label: words[0], cents: rng.int(16, 32) * 50 },
    { label: words[1], detail: `${q} × ${fmtPrice(supply)}`, cents: lineCents(billedKwh, supply) },
    { label: words[2], detail: `${q} × ${fmtPrice(delivery)}`, cents: lineCents(billedKwh, delivery) },
    { label: words[3], detail: `${q} × ${fmtPrice(adjust)}`, cents: lineCents(billedKwh, adjust) },
  ];
  return [...lines, taxLine(words[4], lines, rng)];
}

function gasCharges(usage: number, unit: GasUnit, decimals: number, region: Region, words: string[], rng: Rng): ChargeLine[] {
  const perUnit = rng.float(...region.thermPrice) * THERMS_PER_UNIT[unit] * 1e5;
  const supply = Math.round(perUnit * rng.float(0.45, 0.6));
  const delivery = Math.round(perUnit * rng.float(0.3, 0.42));
  const q = `${fmtQty(usage, decimals)} ${unit}`;
  const lines: ChargeLine[] = [
    { label: words[0], cents: rng.int(19, 45) * 50 },
    { label: words[1], detail: `${q} × ${fmtPrice(supply)}`, cents: lineCents(usage, supply) },
    { label: words[2], detail: `${q} × ${fmtPrice(delivery)}`, cents: lineCents(usage, delivery) },
  ];
  return [...lines, taxLine(words[3], lines, rng)];
}
const sum = (lines: ChargeLine[]) => lines.reduce((s, l) => s + l.cents, 0);

// ── Building one bill ────────────────────────────────────────────────────────
const NON_BILL_LAYOUTS: string[] = ["telecom", "water", "receipt"];
const sortTraps = (traps: Trap[]) => TRAPS.filter((t) => traps.includes(t));
const pad3 = (n: number) => String(n).padStart(3, "0");
const meterNo = (rng: Rng) => `${rng.int(10, 99)}${rng.int(100000, 999999)}`;

function makeBill(id: number, r: Recipe, rng: Rng): Bill {
  const provider = PROVIDERS[r.provider!];
  const region = REGIONS[provider.zip];
  const fuels = r.fuels!;
  const traps = sortTraps([...(r.traps ?? []), ...(fuels === "EG" ? ["combined" as const] : []), ...(r.format === "jpg" ? ["degraded" as const] : [])]);
  const has = (t: Trap) => traps.includes(t);
  const notes: string[] = [];

  // Dates: a 27–35 day period ending somewhere in Oct 2025 – Sep 2026; statement 2–5 days later.
  const days = rng.int(27, 35);
  const end = r.periodEnd ?? addDays("2025-10-05", rng.int(0, 355));
  const start = addDays(end, -days);
  const statementDate = addDays(end, rng.int(2, 5));
  const dueDate = addDays(statementDate, rng.int(18, 24));
  const paymentDate = addDays(statementDate, -rng.int(8, 16));
  const month = Number(end.slice(5, 7)) - 1;
  const dateStyle = r.dates ?? "short";
  if (dateStyle.startsWith("yearless")) notes.push(`period printed without a year; statement date ${statementDate} gives it`);
  if (start.slice(0, 4) !== statementDate.slice(0, 4)) notes.push("period and statement date fall in different years");

  // Electricity
  let electric: Fuel | null = null;
  if (fuels.includes("E")) {
    const base = rng.int(450, 850);
    const per30 = (mo: number) => base * KWH_SEASON[region.climate][mo];
    const kwh = Math.round(per30(month) * (days / 30) * rng.float(0.92, 1.08));
    const net = has("net_metering") ? (() => { const received = Math.round(kwh * rng.float(0.3, 0.6)); return { delivered: kwh, received, net: kwh - received }; })() : undefined;
    const words = provider.key === "vantorra" ? TEXAS_WORDS : rng.pick(ELECTRIC_WORDS);
    const charges = electricCharges(net ? net.net : kwh, region, words, rng, !!net);
    const meter = meterNo(rng);
    let reads: MeterRead[] | undefined;
    if (has("meter_reads")) {
      const prev = rng.int(10000, 88000);
      reads = [{ meter, register: net ? "Delivered" : "Total kWh", prev, curr: prev + kwh, usage: kwh, unit: "kWh" }];
      if (net) {
        const prev2 = rng.int(1000, 30000);
        reads.push({ meter, register: "Received", prev: prev2, curr: prev2 + net.received, usage: net.received, unit: "kWh" });
      }
    }
    const history = makeHistory(end, days, kwh, 0, rng, per30);
    electric = {
      kind: "electric", usage: kwh, unit: "kWh", decimals: 0, meter, reads, net, charges, costCents: sum(charges), history,
      rateName: net ? "Residential Net Energy Metering (NEM-R)" : rng.pick(["Residential Service RS-1", "Schedule R - Residential", "Residential Standard (Rate 10)", "RES Basic Residential"]),
      previous: has("previous_usage") ? { lastPeriod: history[11].value, lastYear: history[0].value } : undefined,
    };
    if (net) notes.push(`net metering: label = ${kwh} kWh delivered; ${net.received} received, ${net.net} net billed`);
  }

  // Natural gas
  let gas: Fuel | null = null;
  if (fuels.includes("G")) {
    const baseload = rng.int(10, 16), heat = rng.int(60, 110);
    const thermsPer30 = (mo: number) => baseload + heat * HEAT_SEASON[mo] * HEAT_CLIMATE[region.climate];
    const therms = thermsPer30(month) * (days / 30) * rng.float(0.92, 1.08);
    const unit: GasUnit = r.gas ?? "therms";
    let usage: number, decimals: number, ccf: Fuel["ccf"];
    if (has("ccf_and_therms")) {
      // The bill prints CCF, a therm factor and therms. The label is the therms figure.
      const c = Math.max(4, Math.round(therms / 1.037));
      ccf = { ccf: c, factor: round(rng.float(1.012, 1.062), 4) };
      usage = round(c * ccf.factor, 1);
      decimals = 1;
      notes.push(`gas: ${c} CCF × ${ccf.factor} = ${usage} therms (label)`);
    } else {
      decimals = { therms: 0, CCF: 0, MCF: 1, Dth: 2 }[unit];
      usage = Math.max(round(therms / THERMS_PER_UNIT[unit], decimals), unit === "therms" || unit === "CCF" ? 4 : 0.4);
    }
    const per30InUnit = (mo: number) => thermsPer30(mo) / (ccf ? 1 : THERMS_PER_UNIT[unit]);
    const charges = gasCharges(usage, unit, decimals, region, rng.pick(GAS_WORDS), rng);
    const meter = meterNo(rng);
    let reads: MeterRead[] | undefined;
    if (has("meter_reads") && (ccf || unit === "CCF")) {
      // Gas meters count volume (CCF), so reads only appear where the bill shows CCF.
      const vol = ccf ? ccf.ccf : usage;
      const prev = rng.int(1000, 8800);
      reads = [{ meter, register: "Gas (CCF)", prev, curr: prev + vol, usage: vol, unit: "CCF" }];
    }
    const history = makeHistory(end, days, usage, decimals, rng, per30InUnit);
    gas = {
      kind: "gas", usage, unit, decimals, meter, reads, ccf, charges, costCents: sum(charges), history,
      rateName: rng.pick(["Residential Gas Service G-1", "Schedule RG - Residential Heating", "Residential Firm Sales (Rate 1)"]),
      previous: has("previous_usage") ? { lastPeriod: history[11].value, lastYear: history[0].value } : undefined,
    };
  }

  // Money: current charges are the label; an unpaid balance makes "amount due" a decoy.
  const currentCents = (electric?.costCents ?? 0) + (gas?.costCents ?? 0);
  const previousBillCents = Math.round(currentCents * rng.float(0.8, 1.25));
  const paymentCents = r.balanceForward ? (rng.chance(0.5) ? 0 : Math.round(previousBillCents * rng.float(0.3, 0.7))) : previousBillCents;
  const balanceForwardCents = previousBillCents - paymentCents;
  if (r.balanceForward) notes.push(`unpaid balance ${fmtMoney(balanceForwardCents)}: amount due is not the current charges`);

  // Address, plus what is deliberately left off the page.
  const showZip = !has("missing_zip");
  const showPeriod = !has("missing_dates");
  const zip4 = rng.chance(0.4) ? String(rng.int(1000, 9899)) : null;
  const showCityState = showZip || rng.chance(0.5);
  const showStatementDate = showPeriod || rng.chance(0.6);
  const showDays = showPeriod || (showStatementDate && rng.chance(0.6));
  if (!showZip) notes.push(showCityState ? "service address has city/state but no ZIP" : "service address is street only");
  if (!showPeriod) notes.push(showStatementDate ? `no period dates; statement date printed${showDays ? " plus day count (do not compute a start date)" : ""}` : "no period dates; only a due date");
  if (zip4 && showZip) notes.push("service ZIP printed as ZIP+4");

  const kindWord = fuels === "EG" ? "combined" : fuels === "E" ? "electric" : "gas";
  const slug = `${pad3(id)}_${provider.key}_${kindWord}`;
  return {
    type: "bill", id, slug, file: `synthetic/${slug}.${r.format}`, format: r.format,
    source: r.format === "jpg" ? "synthetic_degraded" : "synthetic_clean", layout: r.layout as Layout, traps, provider,
    customer: rng.pick(PEOPLE),
    account: `${rng.int(1000, 9999)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
    service: {
      street: `${rng.int(14, 4870)} ${rng.pick(STREETS)}${rng.chance(0.3) ? `, Apt ${rng.int(1, 9)}${rng.pick(["A", "B", "C", "D"])}` : ""}`,
      city: region.city, state: region.state, zip: provider.zip, zip4,
    },
    showZip, showCityState, period: { start, end, days }, statementDate, dueDate, paymentDate, dateStyle,
    showPeriod, showStatementDate, showDays, electric, gas, currentCents, previousBillCents, paymentCents,
    balanceForwardCents, amountDueCents: balanceForwardCents + currentCents, multiPage: has("multi_page"), notes,
  };
}

function makeNonBill(id: number, r: Recipe, seed: number): NonBill {
  const name = { telecom: "parlance_telecom", water: "caldersprings_water", receipt: "hollinspratt_receipt" }[r.layout as NonBillLayout];
  const slug = `${pad3(id)}_${name}`;
  return {
    type: "nonbill", id, slug, file: `synthetic/${slug}.${r.format}`, format: r.format,
    source: r.format === "jpg" ? "synthetic_degraded" : "synthetic_clean", layout: r.layout as NonBillLayout,
    traps: sortTraps(["non_bill", ...(r.format === "jpg" ? ["degraded" as const] : [])]), seed,
    notes: [{ telecom: "phone bill (has ZIP, dates, totals but no energy)", water: "water-only bill (usage in CCF, like gas)", receipt: "grocery receipt" }[r.layout as NonBillLayout]],
  };
}

/** Each bill gets its own RNG stream, so editing one line of PLAN doesn't reshuffle the others. */
export const billSeed = (seed: number, id: number) => seed * 1000 + id;
export function buildDocs(seed: number): Doc[] {
  return PLAN.map((r, i) =>
    NON_BILL_LAYOUTS.includes(r.layout) ? makeNonBill(i + 1, r, billSeed(seed, i + 1)) : makeBill(i + 1, r, makeRng(billSeed(seed, i + 1))));
}

// ── Labels: the eval/labels.csv row, read straight off the same object the template printed ──
export const LABEL_COLUMNS = [
  "file", "source", "is_utility_bill", "provider", "service_zip", "period_start", "period_end", "electricity_kwh",
  "gas_usage", "gas_unit", "electricity_cost_usd", "gas_cost_usd", "total_cost_usd", "traps",
] as const;
export type LabelRow = Record<(typeof LABEL_COLUMNS)[number], string>;

export function labelRow(d: Doc): LabelRow {
  const blank = Object.fromEntries(LABEL_COLUMNS.map((c) => [c, ""])) as LabelRow;
  const base = { ...blank, file: d.file, source: d.source, traps: d.traps.join(";") };
  if (d.type === "nonbill") return { ...base, is_utility_bill: "false" }; // every other field must come back null
  const dollars = (cents: number) => (cents / 100).toFixed(2);
  return {
    ...base,
    is_utility_bill: "true",
    provider: d.provider.name,
    service_zip: d.showZip ? d.service.zip : "",
    period_start: d.showPeriod ? d.period.start : "",
    period_end: d.showPeriod ? d.period.end : "",
    electricity_kwh: d.electric ? String(d.electric.usage) : "",
    gas_usage: d.gas ? String(d.gas.usage) : "",
    gas_unit: d.gas ? d.gas.unit : "",
    electricity_cost_usd: d.electric ? dollars(d.electric.costCents) : "",
    gas_cost_usd: d.gas ? dollars(d.gas.costCents) : "",
    total_cost_usd: dollars(d.currentCents),
  };
}
