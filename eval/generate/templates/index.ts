// Picks the HTML template for a document.
import type { Doc } from "../bills";
import { renderClassic } from "./classic";
import { renderCombined } from "./combined";
import { renderDense } from "./dense";
import { renderModern } from "./modern";
import { renderNonBill } from "./nonbills";
import { renderTabular } from "./tabular";

export function renderDoc(doc: Doc): string {
  if (doc.type === "nonbill") return renderNonBill(doc);
  const layouts = { classic: renderClassic, modern: renderModern, dense: renderDense, tabular: renderTabular, combined: renderCombined };
  return layouts[doc.layout](doc);
}
