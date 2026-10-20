# MS-46: Decimal Price Formatting on Client-Side Displays

**Project:** GlassFit  
**Version:** 1.0.0  
**Date:** October 13, 2026  
**Status:** Ready for Implementation  
**Traceability:** `PRD-F1`, `PRD-F2`, `PRD-F6`, `PRD-F10`, `PRD-F11`, `QAD-TC62`  

## Requirement

All in-scope client-facing price displays must render with exactly two decimal places (for example, `₱12,500.00` instead of `₱12,500`) using a consistent Philippine Peso prefix and grouping. This applies to catalog prices, filter range labels, product details, visualization workspace prices, measurement estimates, and quotation summary prices. The requirement is presentation-only: do not change price values, calculations, rounding before formatting, persistence, or payloads. The formatter itself rounds to two fractional digits according to `Intl.NumberFormat` behavior.

This release changes only price formatting in existing components and adds a shared pure formatting utility. It does not alter pricing calculations, database schema, server actions, API payloads, admin displays, shareable quotation output, or the CSV export formatter (which already uses two decimal places).

## Current state audit

The codebase has two formatting patterns:

**Already correct:** Admin displays and the shareable quotation page already show two decimal places. `PriceCard.tsx` uses currency-style `Intl.NumberFormat` with the PHP currency, whose default fraction digits are two. Preserve these existing formatters; do not migrate them as part of MS-46.

| File | Line(s) | Current call | Status |
|---|---|---|---|
| `src/features/admin/bookings/BookingsContent.tsx` | 525, 536, 602, 605, 611 | `.toLocaleString("en-PH", { minimumFractionDigits: 2 })` | Correct |
| `src/features/admin/materials/MaterialsContent.tsx` | 500 | `.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` | Correct |
| `src/features/admin/materials/MaterialUploadModal.tsx` | 326, 329 | `.toLocaleString("en-US", { minimumFractionDigits: 2 })` | Correct |
| `src/features/admin/products/setup/ValidationWorkspaceSection.tsx` | 456 | `.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` | Correct |
| `src/features/admin/settings/components/ProductDistributionChart.tsx` | 68 | `.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` | Correct |
| `src/features/admin/settings/components/BusinessIntelligenceModal.tsx` | 159, 201 | `.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` | Correct |
| `src/features/admin/products/ProductsPage.tsx` | 18-21 | `Intl.NumberFormat("en-PH", { style: "decimal", minimumFractionDigits: 2 })` | Correct |
| `src/app/q/[code]/page.tsx` | 30-34 | `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 })` | Correct |
| `src/app/q/[code]/page.tsx` | 215, 217, 255, 355, 358 | `.toLocaleString("en-PH", { minimumFractionDigits: 2 })` | Correct |
| `src/lib/export/csvFormatter.ts` | 87 | `.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` | Correct |

**Pattern B (missing decimals, needs fix):** Used in client-facing catalog, visualization workspace, and quotation summary.

| File | Line(s) | Current call | Problem |
|---|---|---|---|
| `src/features/product/components/ProductCard.tsx` | 22 | `basePrice.toLocaleString("en-PH")` | No fraction digits; shows `₱ 12,500` |
| `src/features/product/components/FilterChips.tsx` | 19 | `filters.range[0].toLocaleString()` and `filters.range[1].toLocaleString()` | No fraction digits on price range chip |
| `src/features/product-details/components/ProductDetails.tsx` | 119 | `product.base_price.toLocaleString("en-PH")` | No fraction digits; shows `Starting at ₱12,500` |
| `src/features/visualization/components/AddProductModal.tsx` | 177 | `product.basePrice.toLocaleString("en-PH")` | No fraction digits in workspace add-product card |
| `src/features/visualization/components/MeasurementConfirmationModal.tsx` | 544 | `Math.round(displayedPrice).toLocaleString()` | Explicitly rounds away decimals and uses bare `toLocaleString()` |
| `src/features/quotation/components/ProductSummary.tsx` | 80-86 | `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })` | Explicitly caps fraction digits at 0 |
| `src/features/quotation/components/ProductSummary.tsx` | 146 | `consolidatedSummary.totalLaborCost.toLocaleString("en-PH")` | No fraction digits on labor cost line |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | 949-955 | `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })` | Explicitly caps fraction digits at 0 for workspace total price |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | 845-863 | `formattedPrice` and `formattedUnitPrice`, both with `maximumFractionDigits: 0` | Active product total and unit price omit cents |

## Implementation plan

### Step 1: Create a shared formatting utility

Create `formatPeso` in `src/lib/format.ts` and use it at every in-scope site. It must:

- Signature: `formatPeso(amount: number): string`.
- Format the numeric portion with `Intl.NumberFormat("en-PH", { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 })`, then prefix `₱` with no intervening space. This fixes the exact display independently of locale-specific currency-symbol placement.
- Example outputs: `formatPeso(12500) === "₱12,500.00"`; `formatPeso(12500.5) === "₱12,500.50"`.
- Do not add a compact variant. Filter endpoints use the same two-decimal format.
- Callers must pass the original numeric amount. Do not wrap it in `Math.round`, truncate it, or otherwise pre-round it.

### Step 2: Fix each Pattern B site

Each fix is a one-line formatting change. No structural, layout, or logic changes are needed.

| File | Change |
|---|---|
| `ProductCard.tsx:22` | Use `formatPeso(basePrice)` for the amount, preserving the existing `Starting at` label. The amount itself has no space after `₱`, per the formatter contract. |
| `FilterChips.tsx:19` | Use `formatPeso` for both range endpoints; retain the existing separator. |
| `ProductDetails.tsx:119` | Use `formatPeso(product.base_price)`, preserving `Starting at`. |
| `AddProductModal.tsx:177` | Use `formatPeso(product.basePrice)`, preserving surrounding card layout. |
| `MeasurementConfirmationModal.tsx:544` | Replace `Math.round(displayedPrice).toLocaleString()` with `formatPeso(displayedPrice)`; do not round to whole pesos before formatting. |
| `ProductSummary.tsx:80-86` | Set `formattedTotal` using `formatPeso(consolidatedSummary.finalGrandTotal)`. |
| `ProductSummary.tsx:146` | Use `formatPeso(consolidatedSummary.totalLaborCost)`. |
| `ProductModelWorkspace.tsx:845-863` | Use `formatPeso` for both `realtimePricing.totalPrice` and `realtimePricing.unitPrice`. |
| `ProductModelWorkspace.tsx:949-955` | Use `formatPeso(totalScenePrice)` for the applied scene total. |

### Step 3: Verify existing correct sites

Preserve the already-correct admin, `PriceCard.tsx`, public quotation, and CSV formatter sites listed above. They are regression-check surfaces only and must not be migrated in MS-46.

### Step 4: Verification

- Run `npm run lint`, `npx tsc --noEmit`, `npm run test`, and `npm run build`; all must pass.
- Visual spot-check each affected page:
  - Product catalog cards show `₱X,XXX.XX`
  - Product detail page shows `Starting at ₱X,XXX.XX`
  - Filter chip price range shows decimals
  - Add Product modal in workspace shows `₱X,XXX.XX`
  - Measurement Confirmation modal estimated price shows decimals
  - Quotation summary estimated total and labor cost show exactly two fractional digits
  - Workspace active total, unit price, and applied scene price show exactly two fractional digits
  - Shareable quotation page (`/q/[code]`) remains unaffected (already correct)
  - Admin pages remain unaffected (already correct)

## Acceptance checks

| ID | Check | Trace |
|---|---|---|
| MS46-AC1 | Product catalog cards show base prices with exactly two fractional digits and the `₱` prefix (for example, `₱12,500.00`). | PRD-F1, QAD-TC62 |
| MS46-AC2 | Product detail starting prices show exactly two fractional digits. | PRD-F2, QAD-TC62 |
| MS46-AC3 | Visualization active total, unit price, and applied scene total show exactly two fractional digits. | PRD-F6, QAD-TC62 |
| MS46-AC4 | Measurement estimate preserves fractional peso values and displays exactly two fractional digits. | PRD-F10, QAD-TC62 |
| MS46-AC5 | Quotation total and labor cost show exactly two fractional digits. | PRD-F10, PRD-F11, QAD-TC62 |
| MS46-AC6 | Workspace Add Product prices show exactly two fractional digits. | PRD-F6, QAD-TC62 |
| MS46-AC7 | Filter range endpoints both show the exact two-decimal Peso format. | PRD-F1, QAD-TC62 |
| MS46-AC8 | Admin and CSV price formatting remains unchanged. | QAD-TC62 |
| MS46-AC9 | Shareable quotation currency formatting remains unchanged. | PRD-F11, QAD-TC62 |
| MS46-AC10 | Lint, typecheck, unit tests, and production build pass. | QAD-TC62 |

## Files

- `src/lib/format.ts` (new, shared formatting utility)
- `docs/qad-glassfit.md` (add QAD-TC62)
- `docs/index.md` (register MS-46)
- `src/features/product/components/ProductCard.tsx`
- `src/features/product/components/FilterChips.tsx`
- `src/features/product-details/components/ProductDetails.tsx`
- `src/features/visualization/components/AddProductModal.tsx`
- `src/features/visualization/components/MeasurementConfirmationModal.tsx`
- `src/features/visualization/components/ProductModelWorkspace.tsx`
- `src/features/quotation/components/ProductSummary.tsx`

No new package, migration, server action parameter, or pricing rule is introduced. QAD-TC62 is recorded in `docs/qad-glassfit.md`, and MS-46 is registered in `docs/index.md`.
