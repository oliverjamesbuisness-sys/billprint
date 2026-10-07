// POST a bill (multipart "file") -> either a friendly rejection, or extracted fields + sanity flags.
// Privacy: the file only exists in memory during this request. Nothing is stored, and we never log bill content.
import { checkBill } from "@/lib/checks";
import { extractBill, type BillFile } from "@/lib/extract";
import { utilityType } from "@/lib/schema";

const ALLOWED_TYPES: BillFile["mediaType"][] = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024; // Vercel rejects request bodies over 4.5 MB; photos are shrunk in the browser first

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type as BillFile["mediaType"])) {
    return Response.json({ error: "Please upload a PDF or a JPG/PNG photo of your bill." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That file is over 4 MB. Try a photo, or a smaller PDF." }, { status: 413 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const { bill, model, latencyMs } = await extractBill({ base64, mediaType: file.type as BillFile["mediaType"] });

    if (!bill.is_utility_bill) {
      return Response.json({ rejected: true, reason: bill.rejection_reason ?? "This doesn't look like a utility bill." });
    }
    return Response.json({ bill, utilityType: utilityType(bill), flags: checkBill(bill), meta: { model, latencyMs } });
  } catch (error) {
    console.error("extract failed:", error instanceof Error ? error.name : "unknown"); // error type only, never bill content
    return Response.json({ error: "We couldn't read this file. Try a clearer photo or the original PDF." }, { status: 502 });
  }
}
