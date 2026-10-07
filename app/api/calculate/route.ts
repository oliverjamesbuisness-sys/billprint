// POST the fields the user confirmed -> footprint. Plain code only: no AI is involved past this point.
import { z } from "zod";
import { calculateFootprint } from "@/lib/emissions";

const ConfirmedBillSchema = z.object({
  zip: z.string().regex(/^\d{5}$/).nullable(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  electricityKwh: z.number().nonnegative().nullable(),
  gas: z.object({ amount: z.number().nonnegative(), unit: z.enum(["therms", "CCF", "MCF", "Dth"]) }).nullable(),
});

export async function POST(request: Request) {
  const parsed = ConfirmedBillSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Some fields are missing or invalid.", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.electricityKwh === null && parsed.data.gas === null) {
    return Response.json({ error: "Add electricity (kWh) or gas usage to calculate." }, { status: 400 });
  }
  return Response.json({ footprint: calculateFootprint(parsed.data) });
}
