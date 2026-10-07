// POST the fields the user confirmed -> footprint, yearly estimate, comparison and 3 recommendations.
// Plain code only: no AI is involved past this point.
import { z } from "zod";
import { analyzeBill } from "@/lib/analysis";

const money = z.number().nonnegative().nullable();

const ConfirmedBillSchema = z.object({
  zip: z.string().regex(/^\d{5}$/).nullable(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  electricityKwh: z.number().nonnegative().nullable(),
  gas: z.object({ amount: z.number().nonnegative(), unit: z.enum(["therms", "CCF", "MCF", "Dth"]) }).nullable(),
  electricityCostUsd: money.default(null),
  gasCostUsd: money.default(null),
});

export async function POST(request: Request) {
  const parsed = ConfirmedBillSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Some fields are missing or invalid.", issues: parsed.error.issues }, { status: 400 });
  }
  const bill = parsed.data;
  if (bill.electricityKwh === null && bill.gas === null) {
    return Response.json({ error: "Add electricity (kWh) or gas usage to calculate." }, { status: 400 });
  }
  if (bill.periodEnd < bill.periodStart) {
    return Response.json({ error: "The billing period ends before it starts." }, { status: 400 });
  }
  return Response.json(analyzeBill(bill));
}
