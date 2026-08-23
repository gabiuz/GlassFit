export type BookingStatus = "Pending" | "Reviewing" | "Confirmed" | "Cancelled";

export type BookingCustomer = {
  name: string;
  email: string;
  phone: string;
};

export type BookingQuotation = {
  filename: string;
  generatedDate: string;
  size: string;
  pdfUrl?: string;
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

