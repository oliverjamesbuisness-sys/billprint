"use client";
import { CalendarCheck, Flame, Lightbulb, RotateCcw, Zap } from "lucide-react";
import { Brand, Shell, formatKg } from "@/components/shell";
import { TrendChart } from "@/components/trend-chart";
import { monthStreak, type HistoryEntry } from "@/lib/history";
import type { BillAnalysis } from "@/lib/analysis";
import type { FuelResult } from "@/lib/emissions";
import type { Recommendation } from "@/lib/recommendations";

const twoSig = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 2 });
const range = (low: number, high: number, prefix = "") =>
  Math.abs(high - low) < 0.5 ? `${prefix}${twoSig.format(low)}` : `${prefix}${twoSig.format(low)}–${twoSig.format(high)}`;

export function ResultStep({
  analysis,
  provider,
  history,
  onRestart,
}: {
  analysis: BillAnalysis;
  provider: string | null;
  history: HistoryEntry[];
  onRestart: () => void;
}) {
  const { footprint, annual, typical, recommendations, prices } = analysis;
  const { totalKgCo2e, days, electricity, gas } = footprint;
  const streak = monthStreak(history);

  return (
    <Shell
      hero={
        <>
          <Brand />
          <p className="mt-6 text-sm text-white/70">This bill&apos;s footprint{provider ? ` · ${provider}` : ""}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-6xl font-bold tracking-tight">{formatKg(totalKgCo2e)}</span>
            <span className="text-base font-medium text-white/80">kg CO₂e</span>
          </p>
          <p className="mt-2 text-white/75">
            over {days} days · about {formatKg((totalKgCo2e / days) * 30)} kg per 30 days
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/90">
              ≈ {twoSig.format(annual.kgCo2e / 1000)} tonnes a year (seasonal estimate)
            </span>
            {streak >= 2 && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm text-white/90">
                <CalendarCheck className="size-4" aria-hidden /> {streak} months in a row
              </span>
            )}
          </div>
          <TrendChart history={history} typicalPer30={(typical.kgCo2e / days) * 30} />
        </>
      }
    >
      <h2 className="text-lg font-semibold text-navy-ink">3 ways to cut it</h2>
      <p className="mt-1 text-sm text-ink-muted">Picked for this bill. Savings overlap, so don&apos;t add them up.</p>
      <div className="mt-3 space-y-3">
        {recommendations.map((rec) => (
          <ActionCard key={rec.id} rec={rec} />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        $ uses{" "}
        {[prices.electricity && (prices.electricity.fromBill ? `your bill's $${prices.electricity.usdPerUnit.toFixed(2)}/kWh` : "the US average electricity price"),
          prices.gas && (prices.gas.fromBill ? `your bill's $${prices.gas.usdPerUnit.toFixed(2)}/therm` : "the US average gas price")]
          .filter(Boolean)
          .join(" and ")}
        {prices.electricity?.fromBill || prices.gas?.fromBill ? " (includes fixed fees, so savings may be slightly high)" : ` (${prices.fallbackSource})`}.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-navy-ink">Where it comes from</h2>
      <div className="mt-3 space-y-3">
        {electricity && (
          <BreakdownCard
            icon={<Zap className="size-5" aria-hidden />}
            label="Electricity"
            fuel={electricity}
            share={electricity.kgCo2e / totalKgCo2e}
            note={
              electricity.usedFallback
                ? "No ZIP, so we used the U.S. average grid. Add your ZIP for your local grid; it can change this 2–3×."
                : `Your grid: ${electricity.region.name}.`
            }
          />
        )}
        {gas && (
          <BreakdownCard
            icon={<Flame className="size-5" aria-hidden />}
            label="Natural gas"
            fuel={gas}
            share={gas.kgCo2e / totalKgCo2e}
            note="Burning gas at home. Methane leaked before it reaches you isn't counted, so this is a lower bound."
          />
        )}
      </div>

      <ComparisonCard yours={{ electricity: electricity?.kgCo2e ?? 0, gas: gas?.kgCo2e ?? 0 }} typical={{ electricity: typical.electricityKgCo2e, gas: typical.gasKgCo2e }} source={typical.source} />

      {history.length > 1 && <HistoryList history={history} />}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {electricity && <Tile value={electricity.usage.toLocaleString("en-US")} label="kWh used" />}
        {gas && <Tile value={gas.usage.toLocaleString("en-US")} label={`${gas.unit} of gas`} />}
        <Tile value={String(days)} label="days in this bill" />
        {electricity && <Tile value={electricity.factor.toFixed(3)} label="kg CO₂e per kWh on your grid" />}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-muted">
        Yearly figure: this bill scaled by how much of a typical year&apos;s use falls in these days ({annual.source}), not ×12.
        Your climate can make your real year differ.
      </p>

      <button
        onClick={onRestart}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line py-3 text-sm font-medium text-ink transition-colors hover:bg-page"
      >
        <RotateCcw className="size-4" aria-hidden /> Check another bill
      </button>
    </Shell>
  );
}

function HistoryList({ history }: { history: HistoryEntry[] }) {
  const newestFirst = [...history].reverse();
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-navy-ink">Your bills</h2>
      <p className="text-xs text-ink-muted">Saved only in this browser, numbers only.</p>
      <ul className="mt-2 divide-y divide-line">
        {newestFirst.map((entry, i) => {
          const older = newestFirst[i + 1];
          const change = older ? (entry.kgPer30Days - older.kgPer30Days) / older.kgPer30Days : null;
          const month = new Date(`${entry.periodEnd}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
          return (
            <li key={entry.periodEnd + entry.periodStart} className="flex items-center justify-between py-3 text-sm">
              <span className="text-ink">{month}</span>
              <span className="flex items-center gap-2">
                <span className="tabular font-medium text-navy-ink">{formatKg(entry.kgPer30Days)} kg / 30 days</span>
                {change !== null && (
                  <span className={`tabular rounded-full px-2 py-0.5 text-xs ${change <= 0 ? "bg-brand-tint text-brand-dark" : "bg-warn-tint text-warn"}`}>
                    {change <= 0 ? "▼" : "▲"} {Math.abs(Math.round(change * 100))}%
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActionCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="flex gap-2 font-semibold text-navy-ink">
        <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        {rec.title}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-brand-tint px-3 py-2">
          <p className="tabular text-lg font-semibold text-brand-dark">{range(rec.co2KgPerYear.low, rec.co2KgPerYear.high)} kg</p>
          <p className="text-xs text-ink-muted">CO₂e saved / year</p>
        </div>
        <div className="rounded-xl bg-page px-3 py-2">
          <p className="tabular text-lg font-semibold text-navy-ink">{range(rec.usdPerYear.low, rec.usdPerYear.high, "$")}</p>
          <p className="text-xs text-ink-muted">saved / year</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink">
        <span className="font-medium">Why this one: </span>
        {rec.why}
      </p>
      <p className="mt-1 text-sm text-ink-muted">{rec.how}</p>
      <details className="mt-2 text-xs text-ink-muted">
        <summary className="cursor-pointer font-medium text-brand">Source</summary>
        <p className="mt-1">{rec.source}</p>
      </details>
    </div>
  );
}

function ComparisonCard({ yours, typical, source }: { yours: { electricity: number; gas: number }; typical: { electricity: number; gas: number }; source: string }) {
  const max = Math.max(yours.electricity + yours.gas, typical.electricity + typical.gas);
  return (
    <div className="mt-6 rounded-2xl border border-line p-4">
      <p className="font-semibold text-navy-ink">Your home vs a typical US home</p>
      <p className="text-xs text-ink-muted">Same days, same grid · dark = electricity, light = gas</p>
      <div className="mt-4 space-y-3">
        <ComparisonBar label="Your home" electricity={yours.electricity} gas={yours.gas} max={max} />
        <ComparisonBar label="Typical US home" electricity={typical.electricity} gas={typical.gas} max={max} />
      </div>
      <p className="mt-3 text-xs text-ink-muted">Typical usage: {source}.</p>
    </div>
  );
}

function ComparisonBar({ label, electricity, gas, max }: { label: string; electricity: number; gas: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular font-medium text-navy-ink">{formatKg(electricity + gas)} kg</span>
      </div>
      <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-page">
        <div className="bg-brand" style={{ width: `${(electricity / max) * 100}%` }} />
        <div className="bg-brand/40" style={{ width: `${(gas / max) * 100}%` }} />
      </div>
    </div>
  );
}

function BreakdownCard({ icon, label, fuel, share, note }: { icon: React.ReactNode; label: string; fuel: FuelResult; share: number; note: string }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <span className="text-brand">{icon}</span>
          {label}
        </span>
        <span className="text-sm text-ink-muted">{Math.round(share * 100)}%</span>
      </div>
      <p className="mt-1 tabular text-3xl font-semibold text-navy-ink">
        {formatKg(fuel.kgCo2e)} <span className="text-base font-medium text-ink-muted">kg CO₂e</span>
      </p>
      <div className="mt-3 h-1.5 rounded-full bg-page">
        <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(3, share * 100)}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink-muted">{note}</p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-medium text-brand">Show the math</summary>
        <p className="mt-2 tabular text-ink">
          {fuel.formula} = {formatKg(fuel.kgCo2e)} kg CO₂e
        </p>
        <p className="mt-1 text-xs text-ink-muted">Source: {fuel.source}</p>
      </details>
    </div>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-page p-4">
      <p className="tabular text-2xl font-semibold text-navy-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}
