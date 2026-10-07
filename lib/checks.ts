// Deterministic sanity checks on extracted fields. We use these instead of trusting the model's own
// confidence: a 9,000 kWh month or a 70-day billing period is a fact we can check, not a feeling.
import { billingDays } from "@/lib/emissions";
import { gridRegionsForZip } from "@/lib/factors";
import type { ExtractedBill } from "@/lib/schema";

export type Flag = { field: string; level: "warning" | "info"; message: string };

const per30Days = (amount: number, days: number) => (amount / days) * 30;

export function checkBill(bill: ExtractedBill): Flag[] {
  const flags: Flag[] = [];
  const { billing_period_start: start, billing_period_end: end } = bill;

  let days: number | null = null;
  if (!start || !end) {
    flags.push({ field: "period", level: "warning", message: "Billing dates not found. Please add them." });
  } else {
    days = billingDays(start, end);
    if (Number.isNaN(days) || days < 1) {
      flags.push({ field: "period", level: "warning", message: "The end date is before the start date." });
      days = null;
    } else if (days < 20 || days > 40) {
      flags.push({ field: "period", level: "warning", message: `This period is ${days} days; most bills cover 28–33. Check the dates.` });
    }
  }

  if (!bill.service_zip) {
    flags.push({ field: "zip", level: "warning", message: "No service ZIP found. Add it: your local grid can change the electricity result by up to 6×." });
  } else {
    const regions = gridRegionsForZip(bill.service_zip);
    if (regions.length === 0) {
      flags.push({ field: "zip", level: "warning", message: "We don't recognize this ZIP. Check it, or we'll use the U.S. average." });
    } else if (regions.length > 1) {
      flags.push({ field: "zip", level: "info", message: `This ZIP is served by ${regions.length} grid regions; we use ${regions[0].name}.` });
    }
  }

  if (bill.electricity && days) {
    const kwh30 = per30Days(bill.electricity.usage_kwh, days);
    if (kwh30 < 50 || kwh30 > 5000) {
      flags.push({ field: "electricity", level: "warning", message: `That's about ${Math.round(kwh30)} kWh per 30 days, outside the usual 50–5,000. Check the number.` });
    }
    if (bill.electricity.cost_usd) {
      const rate = bill.electricity.cost_usd / bill.electricity.usage_kwh;
      if (rate < 0.05 || rate > 0.75) {
        flags.push({ field: "electricity", level: "warning", message: `Cost ÷ usage is $${rate.toFixed(2)}/kWh, which is unusual. Check usage or cost.` });
      }
    }
  }

  if (bill.natural_gas && days) {
    if (bill.natural_gas.usage < 0) {
      flags.push({ field: "gas", level: "warning", message: "Gas usage can't be negative. Check the number." });
    } else if (per30Days(bill.natural_gas.usage, days) > 400) {
      flags.push({ field: "gas", level: "warning", message: `That's more than 400 ${bill.natural_gas.unit} per 30 days, which is unusually high for a home.` });
    }
  }

  if (bill.confidence === "low") {
    flags.push({ field: "all", level: "warning", message: "The photo was hard to read. Please check every number." });
  }
  for (const note of bill.notes) flags.push({ field: "all", level: "info", message: note });

  return flags;
}
