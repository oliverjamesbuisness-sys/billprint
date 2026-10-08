"use client";
// The whole app is one 3-step flow: upload -> review (one-tap confirm) -> result.
import { useEffect, useState } from "react";
import { ResultStep } from "@/components/result-step";
import { ReviewStep } from "@/components/review-step";
import { ReadingStep, UploadStep } from "@/components/upload-step";
import type { Flag } from "@/lib/checks";
import type { BillAnalysis, BillCosts } from "@/lib/analysis";
import type { ConfirmedBill } from "@/lib/emissions";
import { saveToHistory, type HistoryEntry } from "@/lib/history";
import type { ExtractedBill } from "@/lib/schema";
import { shrinkImage } from "@/lib/shrink-image";

type State =
  | { step: "upload"; error?: string }
  | { step: "reading" }
  | { step: "review"; bill: ExtractedBill; flags: Flag[]; busy: boolean }
  | { step: "result"; analysis: BillAnalysis; provider: string | null; history: HistoryEntry[] };

export default function Home() {
  const [state, setState] = useState<State>({ step: "upload" });

  // Each step opens at the top, so the hero number is the first thing you see.
  useEffect(() => {
    window.scrollTo(0, 0); // block body: scrollTo can return a Promise, and effects must not return one
  }, [state.step]);

  async function handleFile(file: File) {
    setState({ step: "reading" });
    try {
      const form = new FormData();
      form.append("file", await shrinkImage(file));
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const data = await response.json();
      if (data.rejected) return setState({ step: "upload", error: `That doesn't look like a utility bill. ${data.reason}` });
      if (!response.ok) return setState({ step: "upload", error: data.error });
      setState({ step: "review", bill: data.bill, flags: data.flags, busy: false });
    } catch (error) {
      setState({ step: "upload", error: error instanceof Error ? error.message : "Something went wrong. Please try again." });
    }
  }

  async function handleConfirm(confirmed: ConfirmedBill & BillCosts) {
    if (state.step !== "review") return;
    setState({ ...state, busy: true });
    const response = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmed),
    });
    const data = await response.json();
    if (!response.ok) {
      setState({ ...state, busy: false, flags: [{ field: "all", level: "warning", message: data.error }, ...state.flags] });
      return;
    }
    const analysis: BillAnalysis = data;
    const { totalKgCo2e, days } = analysis.footprint;
    // Numbers only, kept in this browser: powers the trend line and streak.
    const history = saveToHistory({
      periodStart: confirmed.periodStart,
      periodEnd: confirmed.periodEnd,
      kgCo2e: totalKgCo2e,
      kgPer30Days: (totalKgCo2e / days) * 30,
    });
    setState({ step: "result", analysis, provider: state.bill.provider, history });
  }

  switch (state.step) {
    case "upload":
      return <UploadStep onFile={handleFile} error={state.error} />;
    case "reading":
      return <ReadingStep />;
    case "review":
      return (
        <ReviewStep
          bill={state.bill}
          flags={state.flags}
          busy={state.busy}
          onConfirm={handleConfirm}
          onBack={() => setState({ step: "upload" })}
        />
      );
    case "result":
      return (
        <ResultStep
          analysis={state.analysis}
          provider={state.provider}
          history={state.history}
          onRestart={() => setState({ step: "upload" })}
        />
      );
  }
}
