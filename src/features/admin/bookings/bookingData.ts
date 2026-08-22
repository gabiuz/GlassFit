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

export const initialAdminBookings: AdminBookingItem[] = [
  {
    id: "BK_001",
    referenceNo: "CF-0000-000",
    customer: {
      name: "Juan Dela Cruz",
      email: "juandc@gmail.com",
      phone: "+63 917 123 4567",
    },
    productSummary: "2 Products · Alu. Sliding Window, French Door",
    date: "June 3 · 10:22 AM",
    receivedDate: "Received May 18, 2026 at 10:22 AM via Messenger",
    status: "Pending",
    quotation: {
      filename: "GlassFit_Quotation_Q-2026-0482.pdf",
      generatedDate: "Generated May 21, 2026 · 3:42 PM",
      size: "248 KB",
    },
  },
  {
    id: "BK_002",
    referenceNo: "CF-0000-001",
    customer: {
      name: "Maria Santos",
      email: "maria.santos@gmail.com",
      phone: "+63 918 234 5678",
    },
    productSummary: "2 Products · Alu. Sliding Window, French Door",
    date: "June 3 · 10:22 AM",
    receivedDate: "Received May 18, 2026 at 11:15 AM via Website",
    status: "Confirmed",
    quotation: {
      filename: "GlassFit_Quotation_Q-2026-0483.pdf",
      generatedDate: "Generated May 21, 2026 · 4:10 PM",
      size: "312 KB",
    },
  },
  {
    id: "BK_003",
    referenceNo: "CF-0000-002",
    customer: {
      name: "Ricardo Gomez",
      email: "ricardo.gomez@yahoo.com",
      phone: "+63 920 345 6789",
    },
    productSummary: "1 Product · Office Glass Partition",
    date: "June 2 · 04:45 PM",
    receivedDate: "Received May 17, 2026 at 04:30 PM via WhatsApp",
    status: "Pending",
    quotation: {
      filename: "GlassFit_Quotation_Q-2026-0480.pdf",
      generatedDate: "Generated May 20, 2026 · 1:15 PM",
      size: "195 KB",
    },
  },
  {
    id: "BK_004",
    referenceNo: "CF-0000-003",
    customer: {
      name: "Elena Reyes",
      email: "elena.reyes@outlook.com",
      phone: "+63 922 456 7890",
    },
    productSummary: "3 Products · Shower Enclosure, Mirror Wall",
    date: "June 1 · 02:15 PM",
    receivedDate: "Received May 16, 2026 at 02:00 PM via Messenger",
    status: "Reviewing",
    quotation: {
      filename: "GlassFit_Quotation_Q-2026-0478.pdf",
      generatedDate: "Generated May 19, 2026 · 11:30 AM",
      size: "420 KB",
    },
  },
  {
    id: "BK_005",
    referenceNo: "CF-0000-004",
    customer: {
      name: "Antonio Luna",
      email: "antonio.luna@gmail.com",
      phone: "+63 915 567 8901",
    },
    productSummary: "4 Products · Aluminum Folding Door System",
    date: "May 31 · 09:30 AM",
    receivedDate: "Received May 15, 2026 at 09:00 AM via Website",
    status: "Cancelled",
    quotation: {
      filename: "GlassFit_Quotation_Q-2026-0475.pdf",
      generatedDate: "Generated May 18, 2026 · 10:00 AM",
      size: "540 KB",
    },
  },
];
