export type BookingStatus = "Pending" | "Reviewing" | "Confirmed" | "Cancelled";

export type BookingCustomer = {
  name: string;
  email: string;
  phone: string;
};

export type BookingQuotation = {
  id?: string;
  filename: string;
  generatedDate: string;
  size: string;
  pdfUrl?: string;
  document?: import("@/lib/pricing/quotationDocument").QuotationDocumentSnapshotV1 | null;
  calculatedFinalPrice?: number;
  negotiatedFinalPrice?: number | null;
  effectiveFinalPrice?: number;
  isPriceModified?: boolean;
  itemPricing?: import("@/lib/pricing/quotationDocument").ItemPricingView[];
  itemPriceOverrides?: import("@/lib/pricing/quotationDocument").QuotationItemPriceOverridesV1 | null;
  quotationSource?: "canonical-v1" | "legacy-reconstructed";
  supportsItemNegotiation?: boolean;
  negotiatedBy?: string | null;
  negotiatedAt?: string | null;
  updatedAt?: string;
};

export type AdminBookingItem = {
  id: string;
  referenceNo: string;
  customer: BookingCustomer;
  productSummary: string;
  date: string;
  receivedDate: string;
  status: BookingStatus;
  quotation: BookingQuotation;
};
