"use client";
import { FileText, ShieldCheck, Upload } from "lucide-react";
import { Brand, Shell } from "@/components/shell";

export function UploadStep({ onFile, error }: { onFile: (file: File) => void; error?: string }) {
  return (
    <Shell
      hero={
        <>
          <Brand />
          <h1 className="mt-6 text-[28px] font-semibold leading-tight">Your home&apos;s carbon footprint, from one bill.</h1>
          <p className="mt-3 text-white/75">Upload an electric or gas bill. We read it, you confirm, you get your CO₂ and 3 ways to cut it.</p>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-tint px-6 py-10 text-center transition-colors hover:border-brand focus-within:ring-2 focus-within:ring-brand">
        <Upload className="size-8 text-brand" aria-hidden />
        <span className="text-lg font-semibold text-navy-ink">Upload your bill</span>
        <span className="text-sm text-ink-muted">Photo or PDF · electric and/or gas</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ol className="mt-8 space-y-3 text-sm text-ink">
        {["Upload a photo or PDF", "Check the numbers we read (one tap)", "See your footprint + 3 ways to cut it"].map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span className="flex size-6 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex gap-3 rounded-2xl border border-line p-4 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <p>
          <span className="font-medium text-ink">BillPrint doesn&apos;t store your bill.</span> It&apos;s sent once to
          Anthropic&apos;s Claude API to read the numbers. We keep only the numbers you confirm, and never extract your
          name or account number.
        </p>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-muted">
        <FileText className="size-4" aria-hidden /> US bills only for now. No account needed.
      </p>
    </Shell>
  );
}

export function ReadingStep() {
  return (
    <Shell
      hero={
        <>
          <Brand />
          <h1 className="mt-6 text-[28px] font-semibold leading-tight">Reading your bill…</h1>
          <p className="mt-3 text-white/75">Checking it&apos;s a utility bill, then finding your usage and billing period.</p>
        </>
      }
    >
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-page" />
        ))}
        <p className="pt-2 text-center text-sm text-ink-muted">Usually takes 10–20 seconds.</p>
      </div>
    </Shell>
  );
}
