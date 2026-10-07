// Layout 2, "modern": a minimal app-style statement. Big numbers, rounded cards, lots of white space,
// one accent colour, lowercase wordmark. Single page only.
import type { Bill, Fuel } from "../bills";
import * as s from "./shared";

export function renderModern(b: Bill): string {
  if (b.multiPage) throw new Error(`${b.slug}: the modern layout is single-page only`);
  const a = b.provider.color;
  const css = `
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #161616; }
    .top { display: flex; justify-content: space-between; align-items: baseline; }
    .word { font-size: 17pt; font-weight: 700; letter-spacing: -.4px; text-transform: lowercase; color: ${a}; }
    .muted { color: #777; }
    .hero { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 16px; margin-top: 22px; padding: 16px 0; border-top: 1px solid #e6e6e6; border-bottom: 1px solid #e6e6e6; }
    .k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.2px; color: #888; margin-bottom: 4px; }
    .big { font-size: 28pt; font-weight: 300; letter-spacing: -1px; }
    .mid { font-size: 13pt; }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
    .card { border: 1px solid #ececec; border-radius: 14px; padding: 12px 16px; background: #fafafa; }
    .card .v { font-size: 20pt; font-weight: 500; letter-spacing: -.5px; }
    .card .cost { font-size: 11pt; color: ${a}; font-weight: 600; }
    .chip { display: inline-block; background: #eef; border-radius: 10px; padding: 2px 8px; font-size: 8pt; margin-top: 6px; }
    .wide { grid-column: 1 / -1; }
    table.net td, table.lines td, table.act td { padding: 3px 0; border-bottom: 1px solid #efefef; }
    table.net, table.lines, table.act, table.reads { width: 100%; }
    table.reads { font-size: 8pt; margin-top: 6px; } table.reads th { text-align: left; color: #888; font-weight: 500; font-size: 7pt; text-transform: uppercase; }
    table.reads td { padding: 2px 0; border-bottom: 1px solid #efefef; }
    .detail { color: #999; font-size: 7.5pt; }
    h3 { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.2px; color: #888; font-weight: 500; margin: 18px 0 6px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .chart-title { font-size: 8pt; color: #666; margin-bottom: 2px; }
    .foot { margin-top: 18px; font-size: 8pt; color: #666; border-top: 1px solid #e6e6e6; padding-top: 10px; }`;

  const fuels = s.fuelsOf(b);
  const top = `<div class="top"><div class="word">${s.esc(b.provider.name)}</div>
    <div class="muted">Statement${b.showStatementDate ? ` · ${s.date(b, b.statementDate)}` : ""}</div></div>`;
  const hero = `<div class="hero">
      <div><div class="k">Amount due</div><div class="big">${s.money(b.amountDueCents)}</div></div>
      <div><div class="k">Due date</div><div class="mid">${s.date(b, b.dueDate)}</div></div>
      <div><div class="k">Account</div><div class="mid">${b.account}</div></div></div>`;

  const periodCard = b.showPeriod
    ? `<div class="card"><div class="k">Billing period</div><div class="mid">${s.periodRange(b)}</div><div class="muted">${b.period.days} days</div></div>`
    : `<div class="card"><div class="k">Billing cycle</div><div class="mid">${b.showDays ? `${b.period.days} days` : "Monthly"}</div></div>`;
  const addressCard = `<div class="card"><div class="k">Service address</div><div class="mid">${s.serviceLines(b).map(s.esc).join("<br>")}</div></div>`;

  const fuelCard = (f: Fuel) => {
    const change = f.previous ? Math.round(((f.usage - f.previous.lastPeriod) / f.previous.lastPeriod) * 100) : 0;
    const prev = f.previous
      ? `<div data-trap="previous_usage"><span class="chip">${change <= 0 ? "↓" : "↑"} ${Math.abs(change)}% vs last period (${s.num(f.previous.lastPeriod, f.decimals)} ${f.unit})</span>
         <span class="chip">Same period last year: ${s.num(f.previous.lastYear, f.decimals)} ${f.unit}</span></div>`
      : "";
    return `<div class="card${fuels.length === 1 ? " wide" : ""}"><div class="k">${f.kind === "electric" ? "Electricity" : "Natural gas"}</div>
      <div class="v">${s.usageText(f)}${f.net ? ` <span class="muted" style="font-size:9pt">from the grid</span>` : ""}</div>
      <div class="cost">${s.money(f.costCents)}</div>
      ${f.ccf ? `<div class="muted">${s.ccfLine(f)}</div>` : ""}${prev}${s.netBlock(f)}${s.readsTable(b, f)}</div>`;
  };

  const history = s.has(b, "history_chart")
    ? `<h3>Last 13 months</h3><div class="cols">${fuels.map((f) => s.historyChart(f, { width: fuels.length > 1 ? 330 : 690, height: 105, color: a, title: `${s.fuelName(f)} (${f.unit})` })).join("")}</div>`
    : "";
  const lines = `<h3>What you're paying for</h3><div class="cols"${fuels.length === 1 ? ' style="grid-template-columns:1fr"' : ""}>${fuels
    .map((f) => `<table class="lines"><tr><td colspan="2"><b>${s.fuelName(f)}</b></td></tr>${s.chargeRows(f)}<tr><td><b>${s.fuelName(f)} total</b></td><td class="amt"><b>${s.money(f.costCents)}</b></td></tr></table>`)
    .join("")}</div>`;
  const activity = `<h3>Account activity</h3><table class="act">
      <tr><td>Previous balance</td><td class="amt">${s.money(b.previousBillCents)}</td></tr>
      <tr><td>Payments</td><td class="amt">${s.money(-b.paymentCents)}</td></tr>
      <tr><td>Current charges</td><td class="amt">${s.money(b.currentCents)}</td></tr>
      <tr><td><b>Amount due</b></td><td class="amt"><b>${s.money(b.amountDueCents)}</b></td></tr></table>`;
  const foot = `<div class="foot">Questions? Call ${b.provider.phone}. Pay in the app or set up AutoPay.${
    s.has(b, "remit_zip") ? ` <span data-trap="remit_zip">Paying by check? Mail it to ${s.remitLines(b).map(s.esc).join(", ")}.</span>` : ""}</div>`;

  return s.htmlDoc(css, [`${top}${hero}<div class="cards">${periodCard}${addressCard}${fuels.map(fuelCard).join("")}</div>${history}${lines}${activity}${foot}`]);
}
