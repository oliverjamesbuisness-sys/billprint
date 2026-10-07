"use client";
import { useState } from "react";
import { AlertTriangle, FlaskConical, Info } from "lucide-react";
import { Brand, Shell } from "@/components/shell";
import type { Flag } from "@/lib/checks";
import { measuredAccuracy } from "@/lib/accuracy";
import type { BillCosts } from "@/lib/analysis";
import type { ConfirmedBill } from "@/lib/emissions";
import type { GasUnit } from "@/lib/factors";
import type { ExtractedBill } from "@/lib/schema";

const GAS_UNITS: GasUnit[] = ["therms", "CCF", "MCF", "Dth"];

export function ReviewStep({
  bill,
  flags,
  onConfirm,
  onBack,
  busy,
}: {
  bill: ExtractedBill;
  flags: Flag[];
  onConfirm: (confirmed: ConfirmedBill & BillCosts) => void;
  onBack: () => void;
  busy: boolean;
}) {
  const [zip, setZip] = useState(bill.service_zip ?? "");
  const [start, setStart] = useState(bill.billing_period_start ?? "");
  const [end, setEnd] = useState(bill.billing_period_end ?? "");
  const [kwh, setKwh] = useState(bill.electricity ? String(bill.electricity.usage_kwh) : "");
  const [gasAmount, setGasAmount] = useState(bill.natural_gas ? String(bill.natural_gas.usage) : "");
  const [gasUnit, setGasUnit] = useState<GasUnit>(bill.natural_gas?.unit ?? "therms");
  // Per-fuel charges; on a single-fuel bill the total is that fuel's charge.
  const singleFuel = Boolean(bill.electricity) !== Boolean(bill.natural_gas);
  const [elecCost, setElecCost] = useState(String(bill.electricity?.cost_usd ?? (singleFuel && bill.electricity ? bill.total_cost_usd ?? "" : "")));
  const [gasCost, setGasCost] = useState(String(bill.natural_gas?.cost_usd ?? (singleFuel && bill.natural_gas ? bill.total_cost_usd ?? "" : "")));

  const flagsFor = (field: string) => flags.filter((f) => f.field === field);
  const canSubmit = start !== "" && end !== "" && (kwh !== "" || gasAmount !== "") && !busy;

  function submit() {
    onConfirm({
      zip: /^\d{5}$/.test(zip) ? zip : null,
      periodStart: start,
      periodEnd: end,
      electricityKwh: kwh === "" ? null : Number(kwh),
      gas: gasAmount === "" ? null : { amount: Number(gasAmount), unit: gasUnit },
      electricityCostUsd: kwh !== "" && elecCost !== "" ? Number(elecCost) : null,
      gasCostUsd: gasAmount !== "" && gasCost !== "" ? Number(gasCost) : null,
    });
  }

  return (
    <Shell
      hero={
        <>
          <Brand />
          <h1 className="mt-6 text-[28px] font-semibold leading-tight">Check these numbers</h1>
          <p className="mt-3 text-white/75">
            {bill.provider ? `${bill.provider} · ` : ""}Read by AI. Fix anything that&apos;s wrong, then continue.
          </p>
        </>
      }
    >
      <FlagList flags={flagsFor("all")} />

      <div className="space-y-5">
        <Field label="Electricity used (kWh)" evidence={bill.electricity?.evidence} flags={flagsFor("electricity")} accuracyField="electricity_kwh">
          <input inputMode="decimal" value={kwh} onChange={(e) => setKwh(e.target.value)} placeholder="None on this bill" className={inputClass} />
        </Field>

        <Field label="Gas used" evidence={bill.natural_gas?.evidence} flags={flagsFor("gas")} accuracyField="gas_usage">
          <div className="flex gap-2">
            <input inputMode="decimal" value={gasAmount} onChange={(e) => setGasAmount(e.target.value)} placeholder="None on this bill" className={inputClass} />
            <select value={gasUnit} onChange={(e) => setGasUnit(e.target.value as GasUnit)} className={`${inputClass} w-28 cursor-pointer`} aria-label="Gas unit">
              {GAS_UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Billing period" flags={flagsFor("period")} accuracyField="period_start">
          <div className="flex items-center gap-2">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} aria-label="Start date" />
            <span className="text-ink-muted">to</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} aria-label="End date" />
          </div>
        </Field>

        <Field label="Service ZIP (picks your local grid)" flags={flagsFor("zip")} accuracyField="service_zip">
          <input inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 94110" className={inputClass} />
        </Field>

        <Field label="Charges this period ($, optional: used for your savings in dollars)" flags={[]}>
          <div className="flex gap-2">
            {kwh !== "" && <input inputMode="decimal" value={elecCost} onChange={(e) => setElecCost(e.target.value)} placeholder="Electric $" aria-label="Electricity charges in dollars" className={inputClass} />}
            {gasAmount !== "" && <input inputMode="decimal" value={gasCost} onChange={(e) => setGasCost(e.target.value)} placeholder="Gas $" aria-label="Gas charges in dollars" className={inputClass} />}
          </div>
        </Field>
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="mt-8 w-full cursor-pointer rounded-2xl bg-brand py-4 text-lg font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Calculating…" : "Looks right, show my footprint"}
      </button>
      <button onClick={onBack} className="mt-3 w-full cursor-pointer py-2 text-sm text-ink-muted hover:text-ink">
        Upload a different bill
      </button>
    </Shell>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-3 text-base text-ink tabular transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

function Field({
  label,
  evidence,
  flags,
  accuracyField,
  children,
}: {
  label: string;
  evidence?: string;
  flags: Flag[];
  accuracyField?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-navy-ink">{label}</p>
      {children}
      {evidence && <p className="mt-1.5 text-xs text-ink-muted">From your bill: &ldquo;{evidence}&rdquo;</p>}
      {accuracyField && <TestedNote field={accuracyField} />}
      <FlagList flags={flags} />
    </div>
  );
}

// Differentiator: measured error from our eval, not the model's self-confidence, right where you check.
function TestedNote({ field }: { field: string }) {
  const tested = measuredAccuracy(field);
  if (!tested) return null;
  const shaky = tested.k / tested.n < 0.9;
  return (
    <p className={`mt-1 flex items-center gap-1.5 text-xs ${shaky ? "font-medium text-warn" : "text-ink-muted"}`}>
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      In testing, our AI read this right on {tested.k} of {tested.n} {tested.group} bills{shaky ? ", so please check it" : ""}.
    </p>
  );
}

function FlagList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="mt-2 mb-2 space-y-1.5">
      {flags.map((flag) => (
        <li
          key={flag.message}
          className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${flag.level === "warning" ? "bg-warn-tint text-warn" : "bg-page text-ink-muted"}`}
        >
          {flag.level === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {flag.message}
        </li>
      ))}
    </ul>
  );
}
