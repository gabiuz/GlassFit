/** IMP-MS85 / PRD-F10 / SDD-C7 / QAD-TC100.2, .5, .11, .12, .14. */
import { it } from "node:test";
import assert from "node:assert/strict";
import { calculateStandardSeries798 } from "../../src/lib/pricing/pricingEngine";
import { groupsFromBom, SILL_OMISSION_NOTICE } from "../../src/lib/pricing/quotationDocument";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";

it("consolidates document rows with escaped component attribution and reconciled allowances", () => {
  const bom = calculateStandardSeries798({ widthMm: 1200, heightMm: 1200, panelCount: 2 });
  const first = bom.framingItems[0];
  bom.framingItems = [
    { ...first, quantity: first.quantity / 2, subtotal: first.subtotal / 2, componentTrace: { componentKey: "head", componentName: "Top <Rail>", pieceCount: 1, subtotalQuantity: first.quantity / 2 } },
    { ...first, quantity: first.quantity / 2, subtotal: first.subtotal / 2, componentTrace: { componentKey: "bottom", componentName: "Bottom Frame Rail", pieceCount: 1, subtotalQuantity: first.quantity / 2 } },
    ...bom.framingItems.slice(1),
  ];
  const groups = groupsFromBom(bom);
  assert.equal(groups.filter((row) => row.componentSummary?.includes("Top <Rail>")).length, 1);
  const merged = groups.find((row) => row.componentSummary?.includes("Top <Rail>"));
  assert.ok(merged?.componentSummary?.includes("Bottom Frame Rail"));
  assert.ok(Math.abs(groups.reduce((sum, row) => sum + row.subtotal, 0) - bom.finalQuotation) < 0.02);
  const html = generateQuotationPdfHtml({ quotationNumber: "MS85", customerName: "Client", createdAtFormatted: "November 2, 2026", projectName: "Window", brandLogoUrl: "https://glassfit.test/Logo.svg", hasSill: false, structuralWaiver: false, bomResult: bom });
  assert.ok(html.includes("Contributing Parts: Top &lt;Rail&gt;"));
  assert.ok(html.includes("Bottom Frame Rail"));
  assert.ok(html.includes(SILL_OMISSION_NOTICE));
  assert.ok(!html.includes("Top <Rail>"));
});
