// Layout 5, "combined": an electric + gas statement with a summary bar and two side-by-side service panels
// (amber for electric, blue for gas), serif headings. Also renders single-service bills as one wide panel.
import type { Bill, Fuel } from "../bills";
import * as s from "./shared";

export function renderCombined(b: Bill): string {
  const css = `
    body { font-family: "Trebuchet MS", Arial, sans-serif; font-size: 8.8pt; color: #222; }
    h1 { font-family: Georgia, serif; font-size: 19pt; margin: 0; color: #2b2b2b; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    .tag { font-family: Georgia, serif; font-style: italic; color: #777; }
    .meta td { padding: 1px 6px; } .meta td:first-child { color: #777; text-align: right; }
    .bar { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #ccc; margin-top: 12px; }
    .bar > div { padding: 7px 10px; border-right: 1px solid #ccc; } .bar > div:last-child { border-right: none; background: #f4f1ea; }
    .bar .k { font-size: 7pt; text-transform: uppercase; color: #777; letter-spacing: .6px; }
    .bar .v { font-family: Georgia, serif; font-size: 14pt; }
    .where { margin-top: 10px; display: flex; gap: 30px; }
    .panels { display: grid; gap: 14px; margin-top: 12px; }
    .panel { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
    .panel h2 { margin: 0; padding: 6px 10px; color: #fff; font-family: Georgia, serif; font-size: 12pt; font-weight: normal; }
    .panel.electric h2 { background: #c27c0e; } .panel.gas h2 { background: #1d5fa8; }
    .panel .in { padding: 8px 10px; }
    .bigu { font-family: Georgia, serif; font-size: 18pt; margin: 4px 0; }
    table.ch, table.cmp, table.net, table.reads { width: 100%; margin-top: 6px; }
    table.ch td, table.cmp td, table.net td { padding: 2px 0; border-bottom: 1px solid #eee; }
    table.reads { font-size: 7.4pt; } table.reads th { text-align: left; font-size: 6.6pt; color: #666; text-transform: uppercase; } table.reads td { border-bottom: 1px solid #eee; padding: 1px 2px; }
    .detail { color: #888; font-size: 7.2pt; }
    .chart-title { font-size: 7.5pt; color: #666; margin-top: 6px; }
    .msgs { margin-top: 12px; font-size: 8pt; color: #444; border-left: 3px solid #ddd; padding-left: 10px; }
    .coupon { margin-top: 14px; border-top: 2px dotted #888; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 8.4pt; }
    .coupon .k { font-size: 7pt; color: #777; text-transform: uppercase; }`;

  const fuels = s.fuelsOf(b);
  const head = `<div class="head"><div><h1>${s.esc(b.provider.name)}</h1><div class="tag">${fuels.length > 1 ? "Electric &amp; natural gas" : s.fuelName(fuels[0]).toLowerCase()} service · ${b.provider.phone}</div></div>
      <table class="meta"><tr><td>Account</td><td>${b.account}</td></tr>
        ${b.showStatementDate ? `<tr><td>Statement date</td><td>${s.date(b, b.statementDate)}</td></tr>` : ""}
        <tr><td>Due date</td><td>${s.date(b, b.dueDate)}</td></tr></table></div>`;
  const bar = `<div class="bar">
      <div><div class="k">Electric charges</div><div class="v">${b.electric ? s.money(b.electric.costCents) : "—"}</div></div>
      <div><div class="k">Gas charges</div><div class="v">${b.gas ? s.money(b.gas.costCents) : "—"}</div></div>
      <div><div class="k">Total current charges</div><div class="v">${s.money(b.currentCents)}</div></div>
      <div><div class="k">Amount due${b.balanceForwardCents ? " (incl. past due)" : ""}</div><div class="v">${s.money(b.amountDueCents)}</div></div></div>`;
  const where = `<div class="where"><div><b>Service address</b><br>${s.serviceLines(b).map(s.esc).join("<br>")}</div>
      ${b.showPeriod ? `<div><b>Service period</b><br>${s.periodRange(b, " to ")}<br>${b.period.days} days</div>` : b.showDays ? `<div><b>Days of service</b><br>${b.period.days}</div>` : ""}
      <div><b>Previous balance</b> ${s.money(b.previousBillCents)}<br><b>Payments</b> ${s.money(-b.paymentCents)}<br><b>Balance forward</b> ${s.money(b.balanceForwardCents)}</div></div>`;

  const panel = (f: Fuel) => `<div class="panel ${f.kind}"><h2>${f.kind === "electric" ? "Electricity" : "Natural Gas"}</h2><div class="in">
      <div>Meter ${f.meter} · ${s.esc(f.rateName)}</div>
      ${s.readsTable(b, f)}
      ${f.ccf ? `<div style="margin-top:6px">${s.ccfLine(f)}</div>` : ""}
      ${f.net ? s.netBlock(f) : `<div class="bigu">${s.usageText(f)}</div><div style="color:#777">used this period</div>`}
      <table class="ch">${s.chargeRows(f)}<tr><td><b>${f.kind === "electric" ? "Electric" : "Gas"} subtotal</b></td><td class="amt"><b>${s.money(f.costCents)}</b></td></tr></table>
      ${f.previous ? `<table class="cmp" data-trap="previous_usage"><tr><td colspan="3"><b>How your use compares</b></td></tr>${s.previousRows(f)}</table>` : ""}
      ${s.has(b, "history_chart") ? s.historyChart(f, { width: fuels.length > 1 ? 320 : 680, height: 100, color: f.kind === "electric" ? "#c27c0e" : "#1d5fa8", title: `Monthly use, ${f.unit}` }) : ""}
    </div></div>`;
  const panels = `<div class="panels" style="grid-template-columns:${fuels.length > 1 ? "1fr 1fr" : "1fr"}">${fuels.map(panel).join("")}</div>`;
  const msgs = `<div class="msgs">${s.MESSAGES[1]} ${s.MESSAGES[4]}</div>`;
  const coupon = s.has(b, "remit_zip")
    ? `<div class="coupon" data-trap="remit_zip"><div><div class="k">Account</div>${b.account}<div class="k">Amount due</div>${s.money(b.amountDueCents)}</div>
        <div><div class="k">Due date</div>${s.date(b, b.dueDate)}<div class="k">Amount enclosed</div>$________</div>
        <div><div class="k">Send payment to</div>${s.remitLines(b).map(s.esc).join("<br>")}</div></div>`
    : `<div class="msgs">Pay online, by phone at ${b.provider.phone}, or with AutoPay.</div>`;

  const pages = b.multiPage
    ? [`${head}${bar}${where}${msgs}${coupon}`, `${head}${panels}`]
    : [`${head}${bar}${where}${panels}${msgs}${coupon}`];
  return s.htmlDoc(css, pages);
}
