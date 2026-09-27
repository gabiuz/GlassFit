/**
 * GlassFit My Requests View Model & Deterministic Fixtures (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, ERD-E2, QAD-TC32
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import type { BookingRequestStatus } from "@/lib/booking/types";

export type RequestFilter = "All" | "Active" | "Completed" | "Cancelled";

export interface RequestUpdate {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
}

export interface ClientRequestQuotation {
  filename: string;
  generatedAt: string;
  availability: "prototype-only";
}

export interface ClientRequestItem {
  id: string;
  referenceNo: string;
  productName: string;
  productCount: number;
  submittedAt: string;
  status: BookingRequestStatus;
  quotation: ClientRequestQuotation;
  updates: RequestUpdate[];
}

export type ProgressStepState = "complete" | "current" | "future";

export interface ProgressStep {
  id: "submitted" | "under_review" | "confirmed" | "completed";
  label: "Submitted" | "Under Review" | "Confirmed" | "Completed";
  state: ProgressStepState;
}

export interface ProgressBehavior {
  isCancelled: boolean;
  steps: ProgressStep[];
}

export interface StatusBanner {
  title: string;
  description: string;
  treatment: "cyan" | "amber" | "green" | "red";
}

export interface StatusBadge {
  label: string;
  variant: "amber" | "green" | "red";
  bgClass: string;
  textClass: string;
  borderClass: string;
}

/**
 * Compile-time exhaustiveness assertion helper.
 */
export function assertNever(value: never, message = "Unhandled booking request status"): never {
  throw new Error(`${message}: ${String(value)}`);
}

/**
 * Maps database BookingRequestStatus to human-readable customer status label.
 */
export function getBookingStatusLabel(status: BookingRequestStatus): string {
  switch (status) {
    case "Pending":
      return "Submitted";
    case "Ongoing":
      return "Under Review";
    case "Done":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    default:
      return assertNever(status);
  }
}

/**
 * Maps database BookingRequestStatus to its matching filter bucket.
 */
export function getBookingStatusFilter(status: BookingRequestStatus): RequestFilter {
  switch (status) {
    case "Pending":
    case "Ongoing":
      return "Active";
    case "Done":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    default:
      return assertNever(status);
  }
}

/**
 * Maps database BookingRequestStatus to UI badge styling tokens.
 */
export function getBookingStatusBadge(status: BookingRequestStatus): StatusBadge {
  switch (status) {
    case "Pending":
      return {
        label: "Submitted",
        variant: "amber",
        bgClass: "bg-[#ffc876]",
        textClass: "text-white",
        borderClass: "border-transparent",
      };
    case "Ongoing":
      return {
        label: "Under Review",
        variant: "amber",
        bgClass: "bg-[#ffc876]",
        textClass: "text-white",
        borderClass: "border-transparent",
      };
    case "Done":
      return {
        label: "Completed",
        variant: "green",
        bgClass: "bg-[#05b64b]",
        textClass: "text-white",
        borderClass: "border-transparent",
      };
    case "Cancelled":
      return {
        label: "Cancelled",
        variant: "red",
        bgClass: "bg-[#c50000]",
        textClass: "text-white",
        borderClass: "border-transparent",
      };
    default:
      return assertNever(status);
  }
}

/**
 * Maps database BookingRequestStatus to conditional banner copy and treatment.
 */
export function getBookingStatusBanner(status: BookingRequestStatus): StatusBanner {
  switch (status) {
    case "Pending":
      return {
        title: "Your request was received",
        description: "We will review your consultation PDF and contact you.",
        treatment: "cyan",
      };
    case "Ongoing":
      return {
        title: "Review in progress",
        description: "Our team is reviewing the request details.",
        treatment: "amber",
      };
    case "Done":
      return {
        title: "Request completed",
        description: "Your request has been processed. Check the latest update below.",
        treatment: "green",
      };
    case "Cancelled":
      return {
        title: "Request cancelled",
        description: "This request is no longer active. Contact GlassFit if you need assistance.",
        treatment: "red",
      };
    default:
      return assertNever(status);
  }
}

/**
 * Maps database BookingRequestStatus to step progression behavior.
 */
export function getBookingProgressBehavior(status: BookingRequestStatus): ProgressBehavior {
  switch (status) {
    case "Pending":
      return {
        isCancelled: false,
        steps: [
          { id: "submitted", label: "Submitted", state: "current" },
          { id: "under_review", label: "Under Review", state: "future" },
          { id: "confirmed", label: "Confirmed", state: "future" },
          { id: "completed", label: "Completed", state: "future" },
        ],
      };
    case "Ongoing":
      return {
        isCancelled: false,
        steps: [
          { id: "submitted", label: "Submitted", state: "complete" },
          { id: "under_review", label: "Under Review", state: "current" },
          { id: "confirmed", label: "Confirmed", state: "future" },
          { id: "completed", label: "Completed", state: "future" },
        ],
      };
    case "Done":
      return {
        isCancelled: false,
        steps: [
          { id: "submitted", label: "Submitted", state: "complete" },
          { id: "under_review", label: "Under Review", state: "complete" },
          { id: "confirmed", label: "Confirmed", state: "complete" },
          { id: "completed", label: "Completed", state: "complete" },
        ],
      };
    case "Cancelled":
      return {
        isCancelled: true,
        steps: [
          { id: "submitted", label: "Submitted", state: "future" },
          { id: "under_review", label: "Under Review", state: "future" },
          { id: "confirmed", label: "Confirmed", state: "future" },
          { id: "completed", label: "Completed", state: "future" },
        ],
      };
    default:
      return assertNever(status);
  }
}

/**
 * Deterministic fixture dataset per IMP-MS19 Appendix A.
 *
 * Total records: 5 (All: 5, Active: 2, Completed: 2, Cancelled: 1).
 */
export const CANONICAL_REQUEST_FIXTURES: ClientRequestItem[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    referenceNo: "CF-2026-001",
    productName: "Series 798 Sliding Window",
    productCount: 3,
    submittedAt: "2026-01-15T09:30:00+08:00",
    status: "Ongoing",
    quotation: {
      filename: "CF-2026-001-quotation.pdf",
      generatedAt: "2026-01-15T09:35:00+08:00",
      availability: "prototype-only",
    },
    // Deliberately out-of-order stored updates per Appendix A: U1-3, U1-1, U1-5, U1-2, U1-4
    updates: [
      {
        id: "U1-3",
        occurredAt: "2026-01-16T14:17:00+08:00",
        title: "Under review",
        description: "Our team is reviewing the request details.",
      },
      {
        id: "U1-1",
        occurredAt: "2026-01-15T09:30:00+08:00",
        title: "Request submitted",
        description: "Your consultation request has been received.",
      },
      {
        id: "U1-5",
        occurredAt: "2026-01-18T13:20:00+08:00",
        title: "Quotation in preparation",
        description: "We will update you once the quotation is ready.",
      },
      {
        id: "U1-2",
        occurredAt: "2026-01-15T10:10:00+08:00",
        title: "Quotation received",
        description: "Your prototype quotation reference is attached to this request.",
      },
      {
        id: "U1-4",
        occurredAt: "2026-01-17T08:45:00+08:00",
        title: "Measurements noted",
        description: "Preliminary dimensions were added to the review notes.",
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    referenceNo: "CF-2026-002",
    productName: "Frameless Glass Door",
    productCount: 2,
    submittedAt: "2026-01-10T14:15:00+08:00",
    status: "Pending",
    quotation: {
      filename: "CF-2026-002-quotation.pdf",
      generatedAt: "2026-01-10T14:20:00+08:00",
      availability: "prototype-only",
    },
    updates: [
      {
        id: "U2-1",
        occurredAt: "2026-01-10T14:15:00+08:00",
        title: "Request submitted",
        description: "Your consultation request has been received.",
      },
      {
        id: "U2-2",
        occurredAt: "2026-01-10T14:20:00+08:00",
        title: "Awaiting review",
        description: "Your request is waiting for staff review.",
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    referenceNo: "CF-2026-003",
    productName: "Aluminum Glass Partition",
    productCount: 4,
    submittedAt: "2026-01-05T11:00:00+08:00",
    status: "Done",
    quotation: {
      filename: "CF-2026-003-quotation.pdf",
      generatedAt: "2026-01-05T11:05:00+08:00",
      availability: "prototype-only",
    },
    updates: [
      {
        id: "U3-1",
        occurredAt: "2026-01-05T11:00:00+08:00",
        title: "Request submitted",
        description: "Your consultation request has been received.",
      },
      {
        id: "U3-2",
        occurredAt: "2026-01-06T09:10:00+08:00",
        title: "Under review",
        description: "Our team started reviewing the request details.",
      },
      {
        id: "U3-3",
        occurredAt: "2026-01-07T15:30:00+08:00",
        title: "Quotation confirmed",
        description: "The consultation quotation was confirmed.",
      },
      {
        id: "U3-4",
        occurredAt: "2026-01-08T10:00:00+08:00",
        title: "Request completed",
        description: "Your request has been processed.",
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    referenceNo: "CF-2026-004",
    productName: "Storefront System",
    productCount: 1,
    submittedAt: "2025-12-28T16:45:00+08:00",
    status: "Done",
    quotation: {
      filename: "CF-2026-004-quotation.pdf",
      generatedAt: "2025-12-28T16:50:00+08:00",
      availability: "prototype-only",
    },
    updates: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    referenceNo: "CF-2026-005",
    productName: "Glass Canopy",
    productCount: 2,
    submittedAt: "2025-12-20T10:00:00+08:00",
    status: "Cancelled",
    quotation: {
      filename: "CF-2026-005-quotation.pdf",
      generatedAt: "2025-12-20T10:05:00+08:00",
      availability: "prototype-only",
    },
    updates: [
      {
        id: "U5-1",
        occurredAt: "2025-12-20T10:00:00+08:00",
        title: "Request submitted",
        description: "Your consultation request has been received.",
      },
      {
        id: "U5-2",
        occurredAt: "2025-12-21T09:30:00+08:00",
        title: "Cancellation requested",
        description: "A cancellation request was recorded.",
      },
      {
        id: "U5-3",
        occurredAt: "2025-12-21T10:15:00+08:00",
        title: "Request cancelled",
        description: "This request is no longer active.",
      },
    ],
  },
];
