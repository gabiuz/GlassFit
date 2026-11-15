import type { QuotationDocumentDraftV1 } from "@/lib/pricing/quotationDocument";

export type ApprovedAccessoryLookup = (
  productId: string,
  componentId: string,
  accessoryId: string,
) => Promise<{ productName: string; basePrice: number } | null>;

/** IMP-MS77 / QAD-TC92.9: validate the submitted slot and trusted catalog identity. */
export async function validateAccessoryQuotationSelections(
  document: QuotationDocumentDraftV1,
  lookup: ApprovedAccessoryLookup,
): Promise<void> {
  for (const item of document.items) {
    const seenSlots = new Set<string>();
    let trustedDelta = 0;
    for (const selection of item.swappedAccessories ?? []) {
      const componentId = selection.slotComponentId;
      if (!componentId || seenSlots.has(componentId)) {
        throw new Error("Each hardware selection must identify a unique product part.");
      }
      seenSlots.add(componentId);
      if (selection.accessoryId === "default") {
        if ((selection.priceDelta ?? 0) !== 0 || (selection.unitPrice ?? 0) !== 0) {
          throw new Error("The original part must have no accessory price change.");
        }
        continue;
      }
      if (!item.productId) {
        throw new Error("Hardware selection requires a catalog product.");
      }
      const approved = await lookup(item.productId, componentId, selection.accessoryId);
      if (!approved) {
        throw new Error("A selected hardware option is no longer approved for this part. Review the quotation.");
      }
      if (selection.accessoryName !== approved.productName ||
          selection.unitPrice !== approved.basePrice ||
          selection.priceDelta !== approved.basePrice) {
        throw new Error("Hardware name or price changed. Review the quotation before continuing.");
      }
      trustedDelta += approved.basePrice;
    }
    if (Math.round((item.accessoryPriceDelta ?? 0) * 100) !== Math.round(trustedDelta * 100)) {
      throw new Error("Hardware total changed. Review the quotation before continuing.");
    }
  }
}
