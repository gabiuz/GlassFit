import { z } from "zod";

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DayOfWeekSchema = z.enum(DAYS_OF_WEEK);

export const OperatingScheduleRangeSchema = z.object({
  id: z.string().min(1),
  startDay: DayOfWeekSchema,
  endDay: DayOfWeekSchema,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be in HH:MM format"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be in HH:MM format"),
}).refine((data) => data.startTime < data.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

export const SystemPreferencesSchema = z.object({
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters").max(100),
  contactEmail: z.string().trim().email("Invalid email address"),
  contactPhone: z.string().trim().min(7, "Contact number is too short").max(30),
  schedules: z.array(OperatingScheduleRangeSchema).min(1, "At least one operating schedule is required"),
});

export type SystemPreferencesInput = z.infer<typeof SystemPreferencesSchema>;
export type OperatingScheduleRange = z.infer<typeof OperatingScheduleRangeSchema>;

export interface SystemPreferencesRecord {
  id: string;
  businessName: string;
  contactEmail: string;
  contactPhone: string;
  operatingDaysRange: string;
  operatingHoursRange: string;
  operatingSchedules: OperatingScheduleRange[];
  lastBackupAt?: string | null;
  lastBackupBy?: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface BusinessAnalyticsOverview {
  total_bookings: number;
  pending_count: number;
  ongoing_count: number;
  done_count: number;
  total_estimated_value: number;
  total_negotiated_value: number;
  avg_quotation_value: number;
}

export interface BusinessAnalyticsPlatforms {
  messenger_count: number;
  viber_count: number;
  other_count: number;
}

export interface BusinessAnalyticsCatalog {
  total_products: number;
  active_products: number;
  draft_products: number;
  avg_base_price: number;
}

export interface BusinessAnalyticsProductDistribution {
  type_name: string;
  count: number;
}

export interface BusinessAnalyticsMonthlyTrend {
  month_label: string;
  count: number;
  total_value: number;
}

export interface BusinessAnalyticsData {
  overview: BusinessAnalyticsOverview;
  platforms: BusinessAnalyticsPlatforms;
  catalog: BusinessAnalyticsCatalog;
  product_distribution: BusinessAnalyticsProductDistribution[];
  monthly_trends: BusinessAnalyticsMonthlyTrend[];
}

