// Measured extraction accuracy from our own eval (`npm run eval -- --publish` writes data/eval-accuracy.json).
// Shown next to each field on the review screen so people know which numbers to double-check.
// We prefer held-out REAL utility sample bills when there are enough of them; otherwise all test bills.
import accuracy from "@/data/eval-accuracy.json";

type Tally = { k: number; n: number };
type Published = { perField?: Record<string, Record<string, Tally>> };

export type FieldAccuracy = { k: number; n: number; group: "real sample" | "test" };

export function measuredAccuracy(field: string): FieldAccuracy | null {
  const perField = (accuracy as Published).perField ?? {};
  const real = perField.utility_sample?.[field];
  if (real && real.n >= 5) return { ...real, group: "real sample" };
  const all = perField.all?.[field];
  return all && all.n > 0 ? { ...all, group: "test" } : null;
}
