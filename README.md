# BillPrint

**Upload a photo or PDF of a US home utility bill. Get its CO₂ footprint, with every number traced to an EPA or EIA source, and exactly 3 ways to cut it.**

Live: https://billprint-eight.vercel.app · No account needed · BillPrint doesn't store your bill.

## What it does

1. **Upload** a photo or PDF of an electric and/or gas bill.
2. **Claude reads it**: first it checks the file is actually a utility bill, then it pulls out usage and unit (kWh, therms, CCF, MCF, Dth), billing period, provider, service ZIP and charges, each with the exact text it read the value from.
3. **You confirm in one tap.** Each field shows the bill text it came from, sanity flags for suspicious values, and how often our extractor got that field right in testing.
4. **Plain code (not AI) calculates** the footprint, a seasonal yearly estimate, a comparison with a typical US home, and 3 actions tailored to this bill, each with CO₂ and dollars saved per year.

## How it works

```mermaid
flowchart LR
  A[Photo or PDF] -->|shrunk in browser<br/>to fit 4.5 MB| B[/api/extract/]
  B -->|the ONLY AI call| C[Claude Opus 5.5<br/>structured output]
  C --> D{Utility bill?}
  D -->|no| E[Friendly rejection]
  D -->|yes| F[Fields + bill quotes<br/>+ sanity flags]
  F --> G[You confirm or fix<br/>one tap]
  G --> H[/api/calculate/<br/>plain, tested code]
  H --> I[ZIP → EPA eGRID region]
  H --> J[EPA gas factor]
  H --> K[EIA seasonal pattern]
  H --> L[Rule-based 3 actions]
  I & J & K & L --> M[Result: footprint,<br/>yearly estimate,<br/>vs typical home, 3 actions]
```

| Part | File | Why it's built this way |
|---|---|---|
| Extraction | `lib/extract.ts`, `lib/schema.ts` | Claude reads PDFs natively (multi-page too), so there is no conversion step to break; the output schema is enforced by the API and checked again with zod. |
| Sanity checks | `lib/checks.ts` | Model self-confidence is poorly calibrated; a 9,000 kWh month or a 70-day period is a fact we can check. |
| Emission math | `lib/emissions.ts` | The numbers a user acts on come from unit-tested code with cited factors, never from the model. |
| All factors | `lib/factors.ts` | One versioned file; every value has its source and year next to it. |
| Yearly estimate | `lib/seasonal.ts` | A January gas bill ×12 can double the real year, so we scale by EIA's monthly pattern instead. |
| Recommendations | `lib/recommendations.ts` | Reductions only, picked by this bill's fuel and season; savings = yearly use × EIA end-use share × cited % saving, shown as ranges and never summed. |
| Eval | `eval/run.mts`, `eval/labels.csv` | Runs the exact production pipeline on every test bill and scores each field. |

**Privacy:** the file exists only in memory for one request. It is sent once to Anthropic's Claude API to read the numbers; BillPrint never stores it, never logs bill content, and never extracts names, account numbers or street addresses.

## Emission factors and sources

| What | Value | Source |
|---|---|---|
| Electricity | ZIP → eGRID subregion CO₂e *total output* rate, 110–702 kg/MWh | EPA eGRID2023 rev2 (June 2025), via EPA Power Profiler ZIP Code Tool v14.3 (41,588 ZIPs, 27 regions) |
| Electricity, no ZIP | 349.67 kg/MWh (U.S. average), labeled as approximate | eGRID2023 rev2 Summary Tables, Table 1, U.S. row (770.884 lb/MWh) |
| Natural gas | 5.311 kg CO₂e/therm (53.06 kg CO₂ + 1 g CH₄ + 0.1 g N₂O per MMBtu, AR5 GWPs 28/265) | EPA GHG Emission Factors Hub 2025, Table 1 |
| CCF → therms | 1.026 | EPA Hub heat content, 0.001026 MMBtu/scf |
| Seasonal pattern | 2025 monthly US residential gas and electricity use | EIA Natural Gas Monthly; EIA Electric Power Monthly Table 5.1 |
| Fallback prices | 17.30 ¢/kWh; $15.34/Mcf ÷ 10.37 = $1.479/therm | EIA 2025 US residential averages |
| Typical home | 863 kWh/month; 566 therms/yr (gas homes) | EIA 2024 table 5A; EIA RECS 2020 Table CE2.1 |
| End-use shares | Gas: heating 68.1%, water 25.5%. Electricity: cooling 22.4%, heating 14.1% | EIA RECS 2020 Tables CE4.1, CE5.1a |
| Savings | Thermostat 8–10% of heating/cooling; seal and insulate 10–15%; standby 5–10% of electricity (we assume cutting half); WaterSense showerhead ≥330 kWh/yr | ENERGY STAR; DOE Energy Saver Guide 2022; Lawrence Berkeley National Lab; EPA WaterSense |

Rebuild the grid data from EPA's spreadsheet with `npx tsx scripts/build-grid-data.ts`.

## Eval

**Test set:** 38 synthetic bills (26 clean, 12 photo-like degraded) with labels generated from the same data that rendered each bill, plus held-out real utility sample bills labeled by hand. Synthetic bills use fictional utility names. Deliberate traps: payment-address ZIP ≠ service ZIP (12), 12-month history charts (10), meter readings (12), previous-period usage (8), combined gas + electric (8), multi-page PDFs (5), genuinely missing ZIP or dates (10, where the right answer is "not on the bill"), CCF and therms on one bill (4), solar net metering (3), non-bills (3).

**Run it:** `npm run eval` (needs `ANTHROPIC_API_KEY` in `.env.local`). Raw model outputs are cached in `eval/cache/`, so re-scoring is free.

**Results:** _pending first run._ Reported per field with 95% Wilson intervals, split by source; plus "CO₂e within ±5% of truth" (what a user gets if they confirm without editing), fabrication rate on fields absent from the bill, and accuracy by Claude's own confidence rating.

## Where it fails, and why

- **Payment-address ZIPs.** Bills print the utility's remit-to address too; picking that ZIP silently picks the wrong grid region, and no sanity check can catch a valid-but-wrong ZIP. Mitigation: the ZIP field shows the bill text it came from.
- **Usage history charts and meter readings** are full of numbers that look like usage.
- **Solar / net metering.** We report kWh delivered from the grid; a net-metered home's footprint depends on accounting choices we don't model.
- **ZIPs served by several grid regions** (2,955 of them): we use the first region EPA lists and say so.
- **Billing-day conventions** differ (inclusive vs read-to-read), shifting per-30-day and yearly figures by about 3% (never the bill total).
- **The yearly estimate uses the national monthly pattern**; homes in mild or extreme climates, or that don't heat with gas, will differ.
- **Average, not marginal, grid factors.** Savings are footprint reductions; true avoided emissions depend on which power plants respond, which one bill can't tell us.
- **Gas is combustion only.** Methane leaked upstream isn't counted (eGRID excludes it for power plants too), so gas numbers are a lower bound.
- **Dollar savings from the bill's own price** include fixed fees you can't save, so they may be slightly high.
- **HEIC photos** open only in Safari; other browsers need JPG, PNG or PDF.
- **Synthetic bills were generated by us**, so their scores are optimistic; that's why real utility samples are scored separately, after freezing the prompt.

## Run locally

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm install
npm run dev
npm test                     # 18 unit tests on the math and recommendations
npm run eval                 # extraction accuracy on the test bills
```
