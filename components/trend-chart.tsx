// Hero trend line (Altus IQ style): kg CO2e per 30 days for each bill, newest point highlighted,
// with a dashed line for a typical US home. Plain SVG, no chart library.
import type { HistoryEntry } from "@/lib/history";

const W = 300;
const H = 90;
const PAD = 10;

export function TrendChart({ history, typicalPer30 }: { history: HistoryEntry[]; typicalPer30: number }) {
  const values = history.map((h) => h.kgPer30Days);
  const max = Math.max(...values, typicalPer30) * 1.15;
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const x = (i: number) => (history.length === 1 ? W - PAD * 3 : PAD + (i / (history.length - 1)) * (W - 4 * PAD));
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;

  return (
    <figure className="mt-5" aria-label="Footprint per 30 days for each bill, compared with a typical US home">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full overflow-visible" role="img">
        <line x1={PAD} x2={W - PAD} y1={y(typicalPer30)} y2={y(typicalPer30)} stroke="white" strokeOpacity={0.35} strokeDasharray="4 4" />
        <text x={PAD} y={y(typicalPer30) - 4} fill="white" fillOpacity={0.55} fontSize={9}>
          Typical US home
        </text>
        {values.length > 1 && <polyline points={points} fill="none" stroke="#34d399" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 5 : 3} fill={i === last ? "#34d399" : "white"} fillOpacity={i === last ? 1 : 0.7} />
        ))}
        {values.length > 0 && (
          <circle cx={x(last)} cy={y(values[last])} r={9} fill="#34d399" fillOpacity={0.25} />
        )}
      </svg>
      <figcaption className="mt-1 text-xs text-white/60">
        {history.length === 1 ? "kg CO₂e per 30 days. Add next month's bill to see your trend." : "kg CO₂e per 30 days, one point per bill."}
      </figcaption>
    </figure>
  );
}
