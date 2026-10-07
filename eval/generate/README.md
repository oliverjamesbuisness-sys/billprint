# Synthetic bill generator

```bash
npx tsx eval/generate/generate.ts     # ~6 s; same seed -> byte-identical files and labels
```

Writes 38 documents to `eval/bills/synthetic/`, their rows to `eval/labels.csv` (rows with other sources,
such as `utility_sample`, are kept) and per-bill details (date style, degradation settings, decoys) to
`eval/bills/synthetic/manifest.json`.

## How it works

1. **`bills.ts`**: `PLAN` has one line per bill and says where each trap goes. A seeded RNG (one stream
   per bill) fills in names, dates, usage and charges. Each bill is a single data object.
2. **`templates/`**: five layouts (classic, modern, dense two-column, table-heavy, combined electric+gas)
   plus three non-bills (phone bill, water bill, grocery receipt). Every utility and person is made up.
   The ZIPs are real and come from 10 different grid regions.
3. **`generate.ts`**: the installed Google Chrome (playwright-core) renders each bill as a PDF or PNG.
   The `.jpg` bills are PNGs degraded with sharp to look like phone photos (3–8° tilt, about 700 px
   wide, blur, uneven lighting, JPEG quality 28–45).
4. **Self-check before any label is written.** The script reads back the text Chrome actually rendered
   and checks that:
   - every labeled value is printed;
   - every blank label (missing ZIP, missing dates) is absent in every date format;
   - every trap tag has its element on the page;
   - multi-page PDFs keep usage off page 1;
   - each page fits on letter size.

   If any check fails, `labels.csv` is not written.

Labels come from the same object the template printed, so they are correct by construction.

## Traps (tags in `labels.csv`)

| tag | what the bill does | correct label |
|---|---|---|
| `remit_zip` | payment address with a different ZIP | service ZIP |
| `history_chart` | 13-month chart or table | this period only |
| `previous_usage` | last period / same period last year | this period |
| `meter_reads` | start/end meter reads (5-digit numbers) | usage, not a read |
| `multi_page` | PDF where usage is only on page 2 | usage from page 2 |
| `combined` | electric + gas on one bill | both fuels, separate costs |
| `net_metering` | delivered / received / net kWh | delivered |
| `ccf_and_therms` | `CCF × therm factor = therms` | therms |
| `missing_zip` | no service ZIP anywhere (sometimes a remit ZIP is printed) | blank |
| `missing_dates` | no billing period (sometimes a bill date and day count) | blank |
| `non_bill` | phone bill, water bill (CCF!), grocery receipt | `is_utility_bill=false`, rest blank |
| `degraded` | phone-photo look | same as clean |

Untagged decoys (listed in `manifest.json` notes):
- **Unpaid balance (5 bills):** amount due ≠ current charges. The `total_cost_usd` label is the current
  charges.
- **ZIP+4:** the label is the 5-digit ZIP.
- **Periods printed without a year:** 6 bills. In 3 of them the year changes: two periods run from
  December into January, and one falls entirely in the year before its January statement date.
