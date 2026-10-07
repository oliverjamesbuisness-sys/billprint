// Layout 3, "dense": small type in two tight columns, lots of fine print, history as a table,
// and a remittance coupon with an OCR scan line. The hardest layout to read on a phone photo.
import type { Bill, Fuel } from "../bills";
import * as s from "./shared";

export function renderDense(b: Bill): string {
  const c = b.provider.color;
  const css = `
    body { font-family: Verdana, Geneva, sans-serif; font-size: 7.6pt; line-height: 1.32; color: #222; }
    .top { display: grid; grid-template-columns: 1.25fr 1fr; gap: 12px; border-bottom: 2px solid ${c}; padding-bottom: 6px; }
    .name { font-size: 13pt; font-weight: bold; color: ${c}; }
    .kv { width: 100%; } .kv td { padding: 1px 3px; } .kv td:first-child { color: #555; }
    .kv tr.hl td { font-weight: bold; font-size: 9pt; border-top: 1px solid #999; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    h3 { font-size: 7.8pt; background: #eee; border-left: 4px solid ${c}; padding: 2px 6px; margin: 8px 0 3px; text-transform: uppercase; }
    table.t { width: 100%; } table.t td { padding: 1px 2px; border-bottom: 1px dotted #bbb; }
    table.reads, table.hist { width: 100%; font-size: 7pt; } table.reads th, table.hist th { text-align: left; border-bottom: 1px solid #555; font-weight: bold; padding: 1px 2px; }
    table.reads td, table.hist td { padding: 1px 2px; border-bottom: 1px dotted #ccc; }
    table.net { width: 100%; } table.net td { padding: 1px 2px; border-bottom: 1px dotted #bbb; }
    .detail { color: #666; font-size: 6.6pt; }
    .use { font-size: 9pt; font-weight: bold; margin: 3px 0; }
    .fine { font-size: 6.3pt; color: #444; text-align: justify; }
    .coupon { border-top: 1px dashed #000; margin-top: 10px; padding-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .ocr { font-family: "Courier New", monospace; letter-spacing: 2px; font-size: 9pt; margin-top: 6px; grid-column: 1 / -1; }`;

  const fuels = s.fuelsOf(b);
  const top = `<div class="top">
      <div><div class="name">${s.esc(b.provider.name)}</div><div>Customer service ${b.provider.phone} · Emergencies 24 hours</div></div>
      <table class="kv">
        ${b.showStatementDate ? `<tr><td>Bill date</td><td>${s.date(b, b.statementDate)}</td></tr>` : ""}
        <tr><td>Account no.</td><td>${b.account}</td></tr><tr><td>Due date</td><td>${s.date(b, b.dueDate)}</td></tr>
        <tr class="hl"><td>Amount due</td><td>${s.money(b.amountDueCents)}</td></tr></table></div>`;

  const summary = `<h3>Account summary</h3><table class="t">
      <tr><td>Previous amount billed</td><td class="amt">${s.money(b.previousBillCents)}</td></tr>
      <tr><td>Payments received</td><td class="amt">${s.money(-b.paymentCents)}</td></tr>
      <tr><td>Unpaid balance</td><td class="amt">${s.money(b.balanceForwardCents)}</td></tr>
      ${fuels.map((f) => `<tr><td>${s.fuelName(f)} charges</td><td class="amt">${s.money(f.costCents)}</td></tr>`).join("")}
      <tr><td><b>Total current charges</b></td><td class="amt"><b>${s.money(b.currentCents)}</b></td></tr>
      <tr><td><b>Total amount due</b></td><td class="amt"><b>${s.money(b.amountDueCents)}</b></td></tr></table>`;

  const serviceInfo = `<h3>Service information</h3><table class="t">
      <tr><td>Service address</td><td>${s.serviceLines(b).map(s.esc).join(", ")}</td></tr>
      ${b.showPeriod ? `<tr><td>Service period</td><td>${s.periodRange(b, " - ")}</td></tr>` : ""}
      ${b.showDays ? `<tr><td>Billing days</td><td>${b.period.days}</td></tr>` : ""}
      ${fuels.map((f) => `<tr><td>${s.fuelName(f)} rate / meter</td><td>${s.esc(f.rateName)} / ${f.meter}</td></tr>`).join("")}</table>`;

  const usage = (f: Fuel) => `
      ${f.reads ? `<h3>${s.fuelName(f)} meter readings</h3>${s.readsTable(b, f)}` : ""}
      ${f.net ? `<h3>Net metering</h3>${s.netBlock(f)}` : ""}
      ${f.ccf ? `<div>${s.ccfLine(f)}</div>` : ""}
      ${f.net ? "" : `<div class="use">${s.fuelName(f)} usage this period: ${s.usageText(f)}</div>`}
      ${f.previous ? `<h3>${s.fuelName(f)} usage comparison</h3><table class="t" data-trap="previous_usage"><tr><td></td><td><b>Usage</b></td><td><b>Avg daily</b></td></tr>${s.previousRows(f)}</table>` : ""}`;

  const charges = `<h3>Current charges detail</h3><table class="t">${fuels
    .map((f) => `<tr><td colspan="2"><b>${s.fuelName(f)} service</b></td></tr>${s.chargeRows(f)}<tr><td><b>Total ${s.fuelName(f).toLowerCase()} charges</b></td><td class="amt"><b>${s.money(f.costCents)}</b></td></tr>`)
    .join("")}<tr><td><b>Total current charges</b></td><td class="amt"><b>${s.money(b.currentCents)}</b></td></tr></table>`;
  const history = s.has(b, "history_chart") ? `<h3>12-month usage history</h3>${s.historyTable(fuels)}` : "";
  const messages = `<h3>News &amp; messages</h3>${s.MESSAGES.map((m) => `<p class="fine">${m}</p>`).join("")}`;
  const fine = `<h3>Rate information</h3><p class="fine">${s.FINE_PRINT.repeat(2)}</p>`;

  const ocr = `${b.account.replace(/ /g, "")} ${String(b.amountDueCents).padStart(9, "0")} ${b.id % 10}`;
  const coupon = s.has(b, "remit_zip")
    ? `<div class="coupon" data-trap="remit_zip">
        <div><b>Return this coupon with your payment.</b><br>Account ${b.account}<br>Due ${s.date(b, b.dueDate)} · Amount due ${s.money(b.amountDueCents)}<br>Amount enclosed: $________</div>
        <div><b>Remit to:</b><br>${s.remitLines(b).map(s.esc).join("<br>")}</div><div class="ocr">${ocr}</div></div>`
    : `<div class="coupon"><div><b>AutoPay customers:</b> your payment will be drafted on the due date. Do not mail a payment.</div><div>Account ${b.account}</div><div class="ocr">${ocr}</div></div>`;

  const usageAll = fuels.map(usage).join("");
  const pages = b.multiPage
    ? [`${top}<div class="cols"><div>${summary}${messages}</div><div>${fine}</div></div>${coupon}`,
       `${top}<div class="cols"><div>${serviceInfo}${usageAll}</div><div>${charges}${history}</div></div>`]
    : [`${top}<div class="cols"><div>${summary}${serviceInfo}${usageAll}</div><div>${charges}${history}${messages}${fine}</div></div>${coupon}`];
  return s.htmlDoc(css, pages);
}
