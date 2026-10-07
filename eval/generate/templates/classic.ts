// Layout 1, "classic": a traditional utility statement. Boxed sections with solid colour headers,
// an account summary, per-service detail, a bar chart, and a tear-off payment stub at the bottom.
import type { Bill, Fuel } from "../bills";
import * as s from "./shared";

export function renderClassic(b: Bill): string {
  const c = b.provider.color;
  const css = `
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1b1b1b; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${c}; padding-bottom: 10px; }
    .brand { display: flex; gap: 10px; align-items: center; }
    .mono { width: 46px; height: 46px; border-radius: 50%; background: ${c}; color: #fff; font: bold 17px Georgia, serif; display: flex; align-items: center; justify-content: center; }
    .brand h1 { font-size: 16pt; margin: 0; color: ${c}; text-transform: uppercase; letter-spacing: .5px; }
    .brand .sub { font-size: 8pt; color: #555; margin-top: 2px; }
    .acct { border: 1px solid ${c}; font-size: 8.5pt; min-width: 230px; }
    .acct td { padding: 3px 8px; border-bottom: 1px solid #d5dbe6; }
    .acct td:first-child { font-weight: bold; color: ${c}; text-transform: uppercase; font-size: 7pt; }
    .acct tr.due td { background: ${c}; color: #fff; font-size: 11pt; font-weight: bold; }
    .row { display: flex; gap: 14px; margin-top: 12px; }
    .box { border: 1px solid #c9d1de; padding: 8px 10px; flex: 1; }
    .box h2, .sec h2 { font-size: 8.5pt; text-transform: uppercase; color: #fff; background: ${c}; margin: -8px -10px 6px; padding: 4px 10px; letter-spacing: .4px; }
    .sec { border: 1px solid #c9d1de; padding: 8px 10px; margin-top: 12px; }
    .addr { line-height: 1.35; font-weight: bold; }
    table.sum, table.charges, table.net, table.cmp { width: 100%; }
    table.sum td, table.charges td, table.net td, table.cmp td { padding: 2px 0; border-bottom: 1px dotted #c9d1de; }
    tr.tot td { font-weight: bold; border-top: 1px solid #333; border-bottom: none; }
    tr.due td { font-weight: bold; font-size: 10.5pt; color: ${c}; }
    .detail { color: #666; font-size: 7.5pt; }
    .meta { font-size: 8pt; color: #444; margin-bottom: 4px; }
    table.reads { width: 100%; margin: 4px 0 6px; font-size: 8pt; }
    table.reads th { background: #eef1f6; text-align: left; padding: 2px 4px; font-size: 7pt; text-transform: uppercase; }
    table.reads td { padding: 2px 4px; border-bottom: 1px solid #e3e6ec; }
    .usage { font-size: 10pt; margin: 6px 0; padding: 4px 6px; background: #f3f5f9; }
    .conv { font-size: 8.5pt; margin: 4px 0; }
    .two { display: flex; gap: 14px; align-items: flex-start; margin-top: 6px; }
    .chart-title, .cmp-title { font-size: 7.5pt; font-weight: bold; text-transform: uppercase; color: ${c}; margin-bottom: 2px; }
    .msg { font-size: 8pt; color: #333; }
    .msg li { margin-bottom: 2px; }
    .stub { margin-top: 14px; border-top: 2px dashed #777; padding-top: 6px; }
    .cut { font-size: 7pt; color: #666; text-align: center; margin-bottom: 6px; }
    .stubgrid { display: flex; justify-content: space-between; gap: 20px; }
    .stubgrid .lbl { font-size: 6.8pt; text-transform: uppercase; color: #666; }
    .stubgrid .v { font-weight: bold; margin-bottom: 4px; }
    .ways { font-size: 8pt; background: #f3f5f9; padding: 6px 8px; margin-top: 12px; }`;

  const header = `
    <div class="hdr">
      <div class="brand"><div class="mono">${b.provider.initials}</div>
        <div><h1>${s.esc(b.provider.name)}</h1><div class="sub">Customer Service ${b.provider.phone} · Mon–Fri 7am–7pm</div></div></div>
      <table class="acct">
        <tr><td>Account number</td><td>${b.account}</td></tr>
        ${b.showStatementDate ? `<tr><td>Statement date</td><td>${s.date(b, b.statementDate)}</td></tr>` : ""}
        <tr><td>Payment due</td><td>${s.date(b, b.dueDate)}</td></tr>
        <tr class="due"><td>Amount due</td><td>${s.money(b.amountDueCents)}</td></tr>
      </table>
    </div>`;

  const period = b.showPeriod
    ? `<p><b>Billing period:</b> ${s.periodRange(b, " to ")} (${b.period.days} days)</p>`
    : b.showDays ? `<p><b>Days billed:</b> ${b.period.days}</p>` : "";
  const service = `<div class="box"><h2>Service for</h2>
      <div class="addr">${[b.customer, ...s.serviceLines(b)].map((l) => s.esc(l.toUpperCase())).join("<br>")}</div>${period}</div>`;

  const summary = `<div class="box"><h2>Your account summary</h2><table class="sum">
      <tr><td>Previous balance</td><td class="amt">${s.money(b.previousBillCents)}</td></tr>
      <tr><td>Payment received${b.showPeriod && b.paymentCents ? ` ${s.date(b, b.paymentDate)}` : ""} — thank you</td><td class="amt">${s.money(-b.paymentCents)}</td></tr>
      <tr><td>Balance forward</td><td class="amt">${s.money(b.balanceForwardCents)}</td></tr>
      ${b.electric ? `<tr><td>Current electric charges</td><td class="amt">${s.money(b.electric.costCents)}</td></tr>` : ""}
      ${b.gas ? `<tr><td>Current gas charges</td><td class="amt">${s.money(b.gas.costCents)}</td></tr>` : ""}
      <tr class="tot"><td>Total current charges</td><td class="amt">${s.money(b.currentCents)}</td></tr>
      <tr class="due"><td>Total amount due</td><td class="amt">${s.money(b.amountDueCents)}</td></tr></table></div>`;

  const fuelSection = (f: Fuel) => {
    const word = f.kind === "electric" ? "electric" : "gas";
    const usage = f.net
      ? s.netBlock(f)
      : `<div class="usage">Total ${f.kind === "electric" ? "electricity" : "gas"} used this period: <b>${s.usageText(f)}</b></div>`;
    const chart = s.has(b, "history_chart") ? s.historyChart(f, { width: 330, height: 120, color: c, title: `Your monthly ${word} use (${f.unit})` }) : "";
    const cmp = f.previous
      ? `<div data-trap="previous_usage" style="flex:1"><div class="cmp-title">Usage comparison</div><table class="cmp">${s.previousRows(f)}</table></div>`
      : "";
    return `<div class="sec"><h2>${s.fuelName(f)} service details</h2>
      <div class="meta">Rate: ${s.esc(f.rateName)} · Meter ${f.meter}</div>
      ${s.readsTable(b, f)}
      ${f.ccf ? `<div class="conv">${s.ccfLine(f)}</div>` : ""}
      ${usage}
      <table class="charges">${s.chargeRows(f)}<tr class="tot"><td>Total ${word} charges</td><td class="amt">${s.money(f.costCents)}</td></tr></table>
      ${chart || cmp ? `<div class="two">${chart}${cmp}</div>` : ""}</div>`;
  };

  const messages = `<div class="sec"><h2>Important messages</h2><ul class="msg">${s.MESSAGES.slice(0, 3).map((m) => `<li>${m}</li>`).join("")}</ul></div>`;
  const stub = s.has(b, "remit_zip")
    ? `<div class="stub" data-trap="remit_zip"><div class="cut">✂ - - - - - - - Please detach and return this portion with your payment - - - - - - -</div>
        <div class="stubgrid">
          <div><div class="lbl">Account number</div><div class="v">${b.account}</div><div class="lbl">Amount due</div><div class="v">${s.money(b.amountDueCents)}</div>
            <div class="lbl">Due date</div><div class="v">${s.date(b, b.dueDate)}</div><div class="lbl">Amount enclosed</div><div class="v">$ __________</div></div>
          ${b.showZip ? `<div><div class="lbl">Service address</div><div class="v">${[b.customer, ...s.serviceLines(b)].map((l) => s.esc(l.toUpperCase())).join("<br>")}</div></div>` : ""}
          <div><div class="lbl">Make checks payable and mail to</div><div class="v">${s.remitLines(b).map((l) => s.esc(l.toUpperCase())).join("<br>")}</div></div>
        </div></div>`
    : `<div class="ways"><b>Ways to pay:</b> online in your account · AutoPay · by phone at ${b.provider.phone}. This is your paperless statement.</div>`;

  const fuelSections = s.fuelsOf(b).map(fuelSection).join("");
  const page1 = `${header}<div class="row">${service}${summary}</div>`;
  const pages = b.multiPage
    ? [`${page1}${messages}${stub}`, `${header}${fuelSections}`]
    : [`${page1}${fuelSections}${s.fuelsOf(b).length > 1 ? "" : messages}${stub}`];
  return s.htmlDoc(css, pages);
}
