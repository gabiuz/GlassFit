export type DashboardMetric = {
  label: string;
  value: string;
  iconSrc: string;
  widthClass?: string;
  variant?: "dark" | "light";
};

export type QuickAction = {
  title: string;
  buttonLabel: string;
  isFeatured?: boolean;
};

export type BookingStatus = "Confirmed" | "Pending" | "Cancelled";

export type BookingRequest = {
  id: string;
  customer: string;
  productName: string;
  status: BookingStatus;
};

export type ProductUpdate = {
  productName: string;
  description: string;
};

export type DashboardSummary = {
  title: string;
  date: string;
  greeting: string;
  description: string;
};

export const dashboardSummary: DashboardSummary = {
  title: "Dashboard",
  date: "Monday, May 19, 2026",
  greeting: "Welcome, Jedia Sagun!",
  description: "Here's the summary of Glassfit activity.",
};

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: "All Products",
    value: "167",
    iconSrc: "/admin/all-product.svg",
    variant: "dark",
  },
  {
    label: "New Booking",
    value: "6",
    iconSrc: "/admin/new-booking.svg",
  },

  {
    label: "Pending booking",
    value: "7",
    iconSrc: "/admin/pending-booking.svg",
  },
  {
    label: "Approved Booking",
    value: "18",
    iconSrc: "/admin/approved-booking.svg",
  },
];

export const quickActions: QuickAction[] = [
  {
    title: "Manage product and pricing",
    buttonLabel: "Go to Products",
    isFeatured: true,
  },
  {
    title: "Process Booking Request",
    buttonLabel: "Go to Booking",
  },
];

export const recentBookingRequests: BookingRequest[] = [
  {
    id: "Bk_1",
    customer: "Reynard Rabanal",
    productName: "Sliding Door",
    status: "Confirmed",
  },
  {
    id: "Bk_2",
    customer: "Gianne Dasco",
    productName: "Sliding Window",
    status: "Pending",
  },
  {
    id: "Bk_3",
    customer: "Gabriel Pelagio",
    productName: "Shower Enclosure",
    status: "Pending",
  },
  {
    id: "Bk_4",
    customer: "Mary Cruz",
    productName: "Office Partition",
    status: "Pending",
  },
  {
    id: "Bk_5",
    customer: "John Romero",
    productName: "Kitchen Cabinet",
    status: "Cancelled",
  },
];

export const productUpdates: ProductUpdate[] = [
  {
    productName: "Aluminum Sliding Window",
    description: "Product Update -- 2h ago",
  },
  {
    productName: "Pantry Cabinet",
    description: "Variation Added -- 2h ago",
  },
  {
    productName: "Glass Partition",
    description: "Product Update -- 2h ago",
  },
  {
    productName: "Glass Balcony Training",
    description: "2d Preview Update -- 2h ago",
  },
  {
    productName: "French Door",
    description: "Pricing Update -- Yesterday",
  },
  {
    productName: "Bi-fold Windows",
    description: "Pricing Update -- Yesterday",
  },
];
