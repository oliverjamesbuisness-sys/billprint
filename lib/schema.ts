// The one definition of what we extract from a bill. Claude's output is forced to match this schema
// (structured outputs), and zod validates it again on our side.
import { z } from "zod";

const evidence = z
  .string()
  .describe("The exact text copied from the bill that this value was read from (for the user to check).");

export const ExtractedBillSchema = z.object({
  is_utility_bill: z
    .boolean()
    .describe("true only for a residential electricity and/or natural gas utility bill or statement."),
  rejection_reason: z
    .string()
    .nullable()
    .describe("If is_utility_bill is false: one short, friendly sentence saying what the file looks like instead. Otherwise null."),
  provider: z.string().nullable().describe("Utility company name as printed, or null."),
  service_zip: z
    .string()
    .nullable()
    .describe("5-digit ZIP of the SERVICE address (where the energy is used), never the utility's payment/remittance address. Null if not printed."),
  service_state: z.string().nullable().describe("2-letter state of the service address, or null."),
  billing_period_start: z.string().nullable().describe("First day of the billing/service period, YYYY-MM-DD."),
  billing_period_end: z.string().nullable().describe("Last day of the billing/service period, YYYY-MM-DD."),
  electricity: z
    .object({
      usage_kwh: z.number().describe("Total kWh used in THIS billing period (not previous periods, not history charts, not meter readings)."),
      cost_usd: z.number().nullable().describe("Electricity charges for this period only (exclude past-due balances), or null."),
      evidence,
    })
    .nullable()
    .describe("Null if the bill has no electricity service."),
  natural_gas: z
    .object({
      usage: z.number().describe("Total gas used in THIS billing period."),
      unit: z.enum(["therms", "CCF", "MCF", "Dth"]).describe("Use therms if the bill shows both therms and CCF."),
      cost_usd: z.number().nullable().describe("Gas charges for this period only (exclude past-due balances), or null."),
      evidence,
    })
    .nullable()
    .describe("Null if the bill has no natural gas service."),
  total_cost_usd: z
    .number()
    .nullable()
    .describe("Total CURRENT charges for this billing period, excluding any previous balance. Null if not printed."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Your confidence that every extracted value is correct. Use low if the image is blurry, cut off, or ambiguous."),
  notes: z
    .array(z.string())
    .describe("Anything that could make the numbers misleading, e.g. solar/net metering, estimated meter read, multiple meters summed, partial period. Empty if none."),
});

export type ExtractedBill = z.infer<typeof ExtractedBillSchema>;

/** Derived, not extracted, so it can never contradict the sections that are present. */
export function utilityType(bill: Pick<ExtractedBill, "electricity" | "natural_gas">) {
  if (bill.electricity && bill.natural_gas) return "both";
  if (bill.electricity) return "electricity";
  if (bill.natural_gas) return "natural_gas";
  return "none";
}
