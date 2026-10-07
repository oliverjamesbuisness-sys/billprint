// Layout 4, "tabular": an old mainframe-style statement where everything sits in bordered grey-header tables,
// numbers in a monospace font, labels in capitals.
import type { Bill, Fuel } from "../bills";
import * as s from "./shared";

export function renderTabular(b: Bill): string {
  const css = `
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8.4pt; color: #000; }
    .title { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 4px; }
    .title .t1 { font-size: 13pt; font-weight: bold; letter-spacing: 2px; }
    .title .t2 { font-size: 10pt; font-weight: bold; text-transform: uppercase; }
    table.g, table.reads, table.hist, table.net { width: 100%; margin-top: 6px; }
    table.g th, table.reads th, table.hist th { background: #d9d9d9; border: 1px solid #555; font-size: 7pt; text-transform: uppercase; padding: 3px 4px; text-align: left; }
    table.g td, table.reads td, table.hist td, table.net td { border: 1px solid #777; padding: 2px 4px; font-family: "Courier New", monospace; font-size: 8.4pt; }
    table.g td.lbl { font-family: Arial, sans-serif; font-weight: bold; background: #f2f2f2; width: 28%; text-transform: uppercase; font-size: 7pt; }
    .cap { font-weight: bold; text-transform: uppercase; font-size: 8pt; margin-top: 8px; letter-spacing: 1px; }
    .detail { color: #333; }
    .note { font-size: 7pt; margin-top: 8px; }`;

  const fuels = s.fuelsOf(b);
  const title = `<div class="title"><div><div class="t1">STATEMENT OF ACCOUNT</div><div class="t2">${s.esc(b.provider.name)}</div></div>
      <div style="text-align:right">CUSTOMER SERVICE ${b.provider.phone}</div></div>`;
  const acct = `<table class="g"><tr><th>Account no.</th>${b.showStatementDate ? "<th>Statement date</th>" : ""}${b.showPeriod ? "<th>Billing period</th>" : ""}${b.showDays ? "<th>Days</th>" : ""}<th>Due date</th><th>Amount due</th></tr>
      <tr><td>${b.account}</td>${b.showStatementDate ? `<td>${s.date(b, b.statementDate)}</td>` : ""}${b.showPeriod ? `<td>${s.periodRange(b, " - ")}</td>` : ""}${b.showDays ? `<td>${b.period.days}</td>` : ""}<td>${s.date(b, b.dueDate)}</td><td>${s.money(b.amountDueCents)}</td></tr></table>`;
  const location = `<table class="g"><tr><td class="lbl">Customer</td><td>${s.esc(b.customer.toUpperCase())}</td></tr>
      <tr><td class="lbl">Service location</td><td>${s.serviceLines(b).map((l) => s.esc(l.toUpperCase())).join(", ")}</td></tr>
      ${fuels.map((f) => `<tr><td class="lbl">${s.fuelName(f)} rate schedule</td><td>${s.esc(f.rateName.toUpperCase())}</td></tr>`).join("")}</table>`;

  const reads = fuels.some((f) => f.reads) ? `<div class="cap">Meter readings</div>${fuels.map((f) => s.readsTable(b, f)).join("")}` : "";
  const net = fuels.map((f) => (f.net ? `<div class="cap">Net metering summary</div>${s.netBlock(f)}` : "")).join("");
  const usageRow = (f: Fuel) =>
    `<tr><td>${s.fuelName(f).toUpperCase()}</td><td>${f.net ? `${s.num(f.usage)} (DELIVERED)` : s.num(f.usage, f.decimals)}</td><td>${f.unit}</td>${b.showDays ? `<td>${s.num(f.usage / b.period.days, 2)}</td>` : ""}</tr>`;
  const usage = `<div class="cap">Usage summary</div><table class="g"><tr><th>Service</th><th>Usage</th><th>Unit</th>${b.showDays ? "<th>Avg per day</th>" : ""}</tr>${fuels.map(usageRow).join("")}</table>
      ${fuels.map((f) => (f.ccf ? `<div class="note">GAS CONVERSION: ${s.ccfLine(f)}</div>` : "")).join("")}`;
  const charges = `<div class="cap">Current charges</div><table class="g"><tr><th>Description</th><th>Amount</th></tr>${fuels
    .map((f) => `${s.chargeRows(f)}<tr><td><b>TOTAL ${s.fuelName(f).toUpperCase()} CHARGES</b></td><td class="amt"><b>${s.money(f.costCents)}</b></td></tr>`)
    .join("")}<tr><td><b>TOTAL CURRENT CHARGES</b></td><td class="amt"><b>${s.money(b.currentCents)}</b></td></tr></table>`;
  const summary = `<div class="cap">Account summary</div><table class="g"><tr><th>Previous balance</th><th>Payments</th><th>Balance forward</th><th>Current charges</th><th>Total amount due</th></tr>
      <tr><td>${s.money(b.previousBillCents)}</td><td>${s.money(-b.paymentCents)}</td><td>${s.money(b.balanceForwardCents)}</td><td>${s.money(b.currentCents)}</td><td>${s.money(b.amountDueCents)}</td></tr></table>`;
  const history = s.has(b, "history_chart") ? `<div class="cap">Usage history</div>${s.historyTable(fuels)}` : "";
  const previous = fuels.some((f) => f.previous)
    ? `<div class="cap">Usage comparison</div><table class="g" data-trap="previous_usage"><tr><th>Period</th><th>Usage</th><th>Avg per day</th></tr>${fuels.map((f) => s.previousRows(f)).join("")}</table>`
    : "";
  const remit = s.has(b, "remit_zip")
    ? `<table class="g" data-trap="remit_zip"><tr><th>Remit payment to</th><th>Account no.</th><th>Amount enclosed</th></tr><tr><td>${s.remitLines(b).map((l) => s.esc(l.toUpperCase())).join("<br>")}</td><td>${b.account}</td><td>$__________</td></tr></table>`
    : `<div class="note">PAY BY PHONE ${b.provider.phone} OR ONLINE. AUTOPAY CUSTOMERS: PAYMENT WILL BE DRAFTED ON THE DUE DATE.</div>`;
  const notice = `<div class="note">${s.MESSAGES[3]} ${s.MESSAGES[0]}</div>`;

  const pages = b.multiPage
    ? [`${title}${acct}${location}${summary}${notice}${remit}`, `${title}${reads}${net}${usage}${charges}${previous}${history}`]
    : [`${title}${acct}${location}${reads}${net}${usage}${charges}${summary}${previous}${history}${remit}`];
  return s.htmlDoc(css, pages);
}
