# BillPrint — build plan (6-hour sprint)

Live: https://billprint-eight.vercel.app · Repo: https://github.com/oliverjamesbuisness-sys/billprint

## Product
Upload a photo or PDF of a home utility bill (electric and/or gas). BillPrint:
1. Extracts the key fields with an AI vision model (Claude): utility type, usage + unit (kWh, therms, CCF, MCF),
   billing period dates, provider, service-address ZIP.
2. Shows the fields so the user can correct them **before** anything is calculated.
3. Calculates CO2e with plain, unit-tested code (never the AI), using published factors with source + year cited in code.
4. Gives 3 specific, personalized ways to cut emissions, each with estimated CO2 and dollar savings.

## Judging criteria → how we score
| Criterion | Our answer |
|---|---|
| Working & well built | Deployed from hour 1; thin end-to-end first; typed schema; unit tests on all math |
| Originality | (council to pick ONE) "show the math" / grid-aware recommendations / measured per-field accuracy shown in the UI |
| Real impact | Personalized to the user's own usage, grid region and season; dollar savings make it actionable |
| Testing & honesty | 30+ bill eval with per-field accuracy, failure list, hallucination rate; failure modes in README |
| Communication | 3-step UI, every number traceable to a source, README diagram |

## Architecture
```
Browser                         Vercel (Next.js route handlers)             External
───────                         ───────────────────────────────             ────────
[1 Upload] ─ photo shrunk ───▶  POST /api/extract ── file ───────────────▶  Claude Opus 5.5
           in browser                │  (lib/extract.ts: the ONLY AI call)    (vision + PDF,
                                     ◀── JSON matching zod schema ──────────   structured output)
[2 Review & correct] ◀── fields + sanity flags (lib/checks.ts)
        │ user confirms
        ▼
[3 Results] ◀──────────────────  POST /api/calculate
                                     lib/grid.ts         ZIP → eGRID subregion (EPA lookup table)
                                     lib/emissions.ts    usage × factor → kg CO2e   (pure, tested)
                                     lib/recommendations.ts  rule-based, ranked by this bill's savings
                                     lib/factors.ts      every factor/price + source + year
```
Nothing is stored server-side. Only the needed fields are extracted (no name, no account number).

## Stack (one-line rationale each)
- **Next.js 16 + TypeScript on Vercel**: one language for app, eval and test-bill generator; one-command deploys.
- **Claude Opus 5.5 via official `@anthropic-ai/sdk`, structured outputs + zod**: reads PDFs natively (multi-page too), so
  there is no PDF→image step to break; schema-enforced output can't come back malformed.
- **Plain TypeScript emission math + Vitest**: numbers people act on come from tested code with cited factors.
- **Browser-side photo downscaling (~2000 px JPEG)**: keeps uploads under Vercel's 4.5 MB request limit and Claude's image limit; PDFs capped at ~4 MB with a clear error.
- **shadcn/ui + UI UX Pro Max design system** (`design-system/MASTER.md`): accessible components, one deliberate visual system.
- **Eval**: `tsx eval/run.ts` + `eval/labels.csv`.
- **Synthetic bills**: HTML templates → installed Chrome (playwright-core) → PDF/PNG → sharp degradations (blur, tilt, low-res, JPEG artifacts).

## Extraction schema (draft)
```
is_utility_bill: boolean
provider: string | null
service_zip: string | null          // SERVICE address ZIP, not the utility's payment/remittance address
billing_period_start: YYYY-MM-DD | null
billing_period_end:   YYYY-MM-DD | null
electricity: { usage: number, unit: "kWh" } | null      // current period total, not history/meter reads
natural_gas: { usage: number, unit: "therms" | "CCF" | "MCF" | "Dth" } | null
notes: string[]                     // e.g. "net metering", "two meters summed"
```
utility type is derived (electricity / gas / both) from which blocks are present.

## Sanity checks (deterministic flags shown in the review step — instead of model "confidence")
kWh outside ~50–5,000 per 30 days · gas outside ~0–400 therms per 30 days · period not 20–40 days ·
end before start · ZIP not in EPA lookup · negative usage (solar net metering) · bill not recognized.

## Methodology — current defaults (OPEN for council)
1. **Electricity factor**: EPA eGRID subregion *total output* CO2e rate (location-based, annual average) by ZIP;
   alternatives: eGRID *non-baseload* rate (≈ marginal) for savings; adding grid T&D loss.
2. **Gas factor**: EPA GHG Emission Factors Hub, natural gas combustion (kg CO2/MMBtu + CH4 + N2O).
   Combustion only; upstream methane leakage noted qualitatively, not added.
3. **Time basis**: report per billing period (and per day); annual only as "if every period were like this" with caveat — or not at all.
4. **Recommendations**: fixed library of ~8 actions with % savings ranges cited to DOE / ENERGY STAR; filter by
   utility type + season; rank by this bill's kg CO2e saved; show ranges, not point estimates.
   Alternative: LLM writes the recommendations (rejected so far: unauditable numbers).
5. **Dollar savings**: EIA average residential price (state or national) vs the bill's own average $/kWh
   (includes fixed charges → overstates marginal savings).
6. **Units**: CCF→therms via EIA average heat content (~1.037 therms/CCF) when the bill shows no therm factor.

## Eval
- `eval/bills/{synthetic,public,private}`; target 30+ bills: synthetic (varied layouts, providers, units, date formats,
  combined gas+electric, multi-page PDFs, blurry/tilted/low-res photos, missing ZIP) + public utility sample bills.
  `private/` (real personal bills) is gitignored.
- `eval/labels.csv`: one row per bill; synthetic labels written by the generator (truth known by construction),
  public bills labeled by hand; blank = field not on the bill (correct answer is null).
- `eval/run.ts`: per-field accuracy, hallucination rate (non-null where label blank), end-to-end
  "CO2 within 5% of label-based CO2", latency + cost per bill, failure list; results saved to `eval/results/`.
  Report split by source (synthetic clean / synthetic degraded / public real) so synthetic doesn't inflate the score.

## Known risks / failure modes to test
Remittance-address ZIP picked instead of service ZIP (wrong grid region) · previous-period or history-chart usage picked ·
meter reads picked instead of usage · two meters / combined bills · net metering (net ≠ consumption) ·
CCF vs therms confusion · date formats (DD/MM vs MM/DD) · multi-page PDFs where usage is on page 2 ·
HEIC photos from non-Safari browsers · prompt injection via text inside an uploaded file (impact limited by schema) ·
ZIPs spanning multiple eGRID subregions.

## Hour-by-hour
| Time | Goal |
|---|---|
| 0:00–0:30 | Pre-planning: skeleton deployed ✅, council, eng review, design system |
| 0:30–1:30 | Thinnest end-to-end: upload → extract → edit → CO2 (national factor) → result, deployed |
| 1:30–2:30 | Real math: eGRID by ZIP, gas units, sanity flags, Vitest · parallel: synthetic bill generator |
| 2:30–3:30 | Eval script + labels + baseline score (user hand-labels public bills) |
| 3:30–4:30 | 3 recommendations (CO2 + $ ranges), differentiator, design pass |
| 4:30–5:15 | Fix top eval failures, re-run, before/after; /qa Quick on live URL |
| 5:15–6:00 | Feature freeze, README + diagram, final deploy, smoke test, Q&A cheat sheet, /retro |

Cut order if behind: model comparison → state-level prices → extra layouts → design polish.
