"use client";
import { Flame, RotateCcw, Zap } from "lucide-react";
import { Brand, Shell, formatKg } from "@/components/shell";
import type { Footprint, FuelResult } from "@/lib/emissions";

export function ResultStep({ footprint, provider, onRestart }: { footprint: Footprint; provider: string | null; onRestart: () => void }) {
  const { totalKgCo2e, days, electricity, gas } = footprint;
  const per30 = (totalKgCo2e / days) * 30;

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
            over {days} days · about {formatKg(per30)} kg per 30 days
          </p>
        </>
      }
    >
      <h2 className="text-lg font-semibold text-navy-ink">Where it comes from</h2>
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
            note="Burning gas at home. Methane leaked before it reaches you isn't counted."
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {electricity && <Tile value={electricity.usage.toLocaleString("en-US")} label="kWh used" />}
        {gas && <Tile value={`${gas.usage.toLocaleString("en-US")}`} label={`${gas.unit} of gas`} />}
        <Tile value={String(days)} label="days in this bill" />
        {electricity && <Tile value={electricity.factor.toFixed(3)} label="kg CO₂e per kWh on your grid" />}
      </div>

      <button
        onClick={onRestart}
        className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line py-3 text-sm font-medium text-ink transition-colors hover:bg-page"
      >
        <RotateCcw className="size-4" aria-hidden /> Check another bill
      </button>
    </Shell>
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
