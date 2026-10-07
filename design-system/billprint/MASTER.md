# BillPrint Design System (MASTER)

> Page files in `design-system/billprint/pages/[page].md` override this file when they exist.

Built from the product brief (Altus IQ layering + Watershed number-first hierarchy + CoolClimate
comparison bar) using UI UX Pro Max output as the base: Inter typography and the accessibility
checklist come from its first run; its suggested "vibrant / landing page / handwritten font"
patterns were rejected because BillPrint is a calm 3-step consumer tool, not a marketing page.

## Feel
Calm consumer app, mobile-first. One accent color. Lots of whitespace. Big numerals, small labels.
No enterprise jargon (no "scope 1/2/3", no portfolios, no multi-property).

## Layout shell (Altus IQ)
- Dark navy **hero** at the top of every screen: short confident headline, the one big number.
- A white **card sheet** with a large top radius slides up over the hero and holds everything else.
- Content width: max 28rem (448px) centered on desktop; full-bleed on phones; 16px side gutter.

## Color
| Role | Hex | Use |
|---|---|---|
| Navy (hero bg) | `#0B1F33` | hero background only |
| Navy text-on-light | `#0F2A44` | headings on white |
| Accent green | `#059669` | primary buttons, chart line, highlighted data point, positive savings |
| Accent tint | `#ECFDF5` | accent backgrounds (savings chips) |
| Sheet / card | `#FFFFFF` | card sheet and cards |
| Page bg (below sheet) | `#F4F6F8` | |
| Body text | `#1F2937` | 4.5:1+ on white |
| Muted text | `#6B7280` | labels, captions |
| Border | `#E5E7EB` | card borders |
| Warning | `#B45309` on `#FFFBEB` | sanity flags ("check this") |
| Error | `#B91C1C` | rejections |

Only one accent. Electricity vs gas are distinguished by **label + icon**, not by extra colors
(chart series: accent green solid vs accent green at 40% opacity).

## Typography
- **Inter** for everything (`next/font/google`), tabular numerals for all figures (`font-variant-numeric: tabular-nums`).
- Hero number: 56–64px, weight 700, letter-spacing -0.02em, unit in 16px weight 500 next to it.
- Card numbers: 28–32px weight 650; card labels: 13px uppercase-free, muted.
- Headlines: 22–24px weight 650, short and confident ("Your home's footprint").

## Components
- **Hero number + trend line** (Altus IQ): big number, then a smooth line chart with the latest point highlighted.
  Single-bill state: one highlighted point with a dashed "typical US home" reference line, so it still looks complete.
- **Stat tiles** (2-up grid): kWh, therms, days in period, grid intensity.
- **Breakdown cards** (Watershed): Electricity / Gas, each with big number + small label + share bar.
- **Comparison bar** (CoolClimate): stacked horizontal bar "Your home" vs "Typical US home", by fuel.
- **Action cards** (Enersee): CO2 saved/yr and $ saved/yr side by side, plus a one-line "Why this one" tied to the bill.
- **Field review rows**: label, extracted value (editable inline), evidence quote from the bill, flag chip if a check failed.
- **Billing history list** (later): month, kWh/therms, kg CO2e, small delta chip.

## Motion
150–250ms ease-out transitions; sheet slides up 300ms on result. Respect `prefers-reduced-motion`.

## Pre-delivery checklist (from UI UX Pro Max)
- [ ] No emojis as icons (use lucide-react SVG icons)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover and focus states with smooth transitions (150–300ms); focus rings visible for keyboard nav
- [ ] Text contrast 4.5:1 minimum
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375px, 768px, 1024px, 1440px; no horizontal scroll on phones
