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
