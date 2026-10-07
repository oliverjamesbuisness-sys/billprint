// Runs in the browser. Phone photos are often 4–12 MB, over Vercel's 4.5 MB request limit and
// Claude's image limit, so we redraw them at most 2000 px on the long side as an 85% JPEG.
// PDFs are sent as-is (Claude reads them natively, including multi-page).
const MAX_SIDE = 2000;

export async function shrinkImage(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This browser can't open that image type (often iPhone HEIC). Please upload a JPG, PNG or PDF.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't process this image. Please try another photo.");
  return new File([blob], "bill.jpg", { type: "image/jpeg" });
}
