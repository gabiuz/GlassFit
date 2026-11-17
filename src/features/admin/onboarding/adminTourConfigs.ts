import type { OnboardingTourStep } from "@/lib/onboarding/types";

export interface BookingsQueueStepsInput {
  filteredBookingsCount: number;
  hasSelectedBooking: boolean;
}

export function resolveBookingsQueueSteps(
  input: BookingsQueueStepsInput,
): OnboardingTourStep[] {
  const hasList = input.filteredBookingsCount > 0;
  return [
    {
      id: "bookings-search-tabs",
      targetSelector: '[data-onboarding-target="admin-bookings-search-and-tabs"]',
      title: "Search & Filter Consultation Requests",
      description:
        "Search requests by booking reference (GF-...), customer name, email, or product summary, and filter the queue using the All, Pending, Reviewing, Confirmed, and Cancelled status tabs.",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "bookings-select-record",
      targetSelector: hasList
        ? '[data-onboarding-target="admin-bookings-list"]'
        : '[data-onboarding-target="admin-bookings-empty-state"]',
      title: "Select a Consultation Record",
      description:
        "Click any booking card on the left to inspect the customer's contact details, quotation pricing breakdown, and downloadable PDF in the right-hand panel.",
      preferredPlacement: hasList ? "right" : "left",
      primaryActionLabel:
        hasList && input.hasSelectedBooking ? "Next" : "Got it",
    },
  ];
}

export function resolveBookingsInspectorSteps(
  supportsItemNegotiation: boolean,
): OnboardingTourStep[] {
  return [
    {
      id: "bookings-pricing-card",
      targetSelector: '[data-onboarding-target="admin-bookings-pricing-card"]',
      title: "Review & Adjust Quotation Pricing",
      description: supportsItemNegotiation
        ? "Add or edit the Site Installation & Labor Fee, or click Edit Price on any fixture to set a negotiated per-item subtotal (Reset restores the calculated price). Modified items display a Negotiated badge while preserving the original calculated amount."
        : "Add or edit the Site Installation & Labor Fee, or click Edit Final Price to negotiate the overall quotation total (per-item editing is unavailable for legacy reconstructed quotations). Modified totals display an Adjusted / Confirmed Total badge.",
      preferredPlacement: "left",
      primaryActionLabel: "Next",
    },
    {
      id: "bookings-pdf-actions",
      targetSelector: '[data-onboarding-target="admin-bookings-pdf-and-actions"]',
      title: "Preview PDF, Save Status, or Discard",
      description:
        "Use View PDF or Download PDF to open the printable quotation sheet in a new browser tab. After changing Update Status (Pending, Reviewing, Confirmed, Cancelled), click Save Changes to apply it. Clicking Discard asks for confirmation and permanently deletes the booking and quotation record.",
      preferredPlacement: "left",
      primaryActionLabel: "Got it",
    },
  ];
}

export function resolveMaterialsTourSteps(): OnboardingTourStep[] {
  return [
    {
      id: "materials-entry-actions",
      targetSelector: '[data-onboarding-target="admin-materials-entry-actions"]',
      title: "Individual & Bulk Material Entry",
      description:
        "Use Add Material to register a single aluminum profile, glass sheet, hardware item, or consumable. For bulk updates, use Import Spreadsheet to upsert items from a CSV/spreadsheet or Batch Price Adjust to apply a percentage or fixed-amount adjustment across a category.",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "materials-filter-bar",
      targetSelector: '[data-onboarding-target="admin-materials-filter-bar"]',
      title: "Filter by Category, Finish & Status",
      description:
        "Narrow the catalog by material category, aluminum finish (Analok, PowderCoatedWhite, Anodized, etc.), or Active Only / Inactive Only status, or search by material code and description.",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "materials-table",
      targetSelector: '[data-onboarding-target="admin-materials-table"]',
      title: "Pricing, Active Status & Safe Deletion",
      description:
        "Updating a material's Unit Price or toggling Active immediately governs new parametric BOM calculations and product setup validations without altering frozen historical customer quotations. If you delete a material that is already linked to a product component, GlassFit safely deactivates it instead of deleting it so existing product formulas do not break.",
      preferredPlacement: "top",
      primaryActionLabel: "Got it",
    },
  ];
}

export function resolveProductsTourSteps(): OnboardingTourStep[] {
  return [
    {
      id: "products-create-actions",
      targetSelector: '[data-onboarding-target="admin-products-create-actions"]',
      title: "Three Product Roles & Creation Entry Points",
      description:
        "Choose the entry button matching what you are building: Add Product creates a standalone Standard Fixture (7-step wizard for windows, doors, cabinets, or partitions), Add-on Accessory starts the 5-step wizard for Insect Screens or Security Grilles, and Add Accessory starts the 4-step wizard for swappable Hardware Accessories (handles, locks, hinges, rollers).",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "products-filter-bar",
      targetSelector: '[data-onboarding-target="admin-products-filter-bar"]',
      title: "Filter by Role Scope, Category & Status",
      description:
        "Switch scope tabs to view standard fixtures versus add-on or hardware attachments, and filter by product type or Published (Active) versus Draft (Inactive) status.",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "products-table",
      targetSelector: '[data-onboarding-target="admin-products-table"]',
      title: "Edit Setup, Clone Presets, or Delete",
      description:
        "Click Edit to open the Product Setup Wizard, or Duplicate to clone a product preset (including its template, component mappings, and rules) into a new draft. Clicking Delete permanently removes the product and its stored 3D/image assets from the storefront (add-ons currently linked to a host product are protected from deletion until unlinked).",
      preferredPlacement: "top",
      primaryActionLabel: "Got it",
    },
  ];
}

export function resolveDashboardTourSteps(): OnboardingTourStep[] {
  return [
    {
      id: "dashboard-metrics",
      targetSelector: '[data-onboarding-target="admin-dashboard-metrics"]',
      title: "Live Storefront & Booking Metrics",
      description:
        "Track your published All Products count alongside New Booking (Pending), Pending booking (Ongoing / under review), and Approved Booking (Done / confirmed) consultation counts.",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "dashboard-quick-actions",
      targetSelector: '[data-onboarding-target="admin-dashboard-quick-actions"]',
      title: "Quick Action Shortcuts",
      description:
        "Jump directly to the Products catalog (Go to Products) or the Booking Request queue (Go to Booking).",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "dashboard-activity-feeds",
      targetSelector: '[data-onboarding-target="admin-dashboard-activity-feeds"]',
      title: "Recent Bookings & Product Updates",
      description:
        "Review the 5 most recent customer booking requests and the latest 5 updated catalog products at a glance.",
      preferredPlacement: "top",
      primaryActionLabel: "Got it",
    },
  ];
}

export function resolveStaffTourSteps(roleName: string): OnboardingTourStep[] {
  const isOwner = roleName.trim().toLowerCase() === "owner";
  return [
    {
      id: "staff-invite-button",
      targetSelector: '[data-onboarding-target="admin-staff-invite-button"]',
      title: "Invite Staff & Share 6-Digit Verification Code",
      description:
        "Click Invite Staff to send an activation email that assigns the Staff role. After submitting, the dialog displays a 6-digit Admin Verification Code that you must copy and share with the invited staff member out-of-band (in person, SMS, phone, or secure chat) so they can activate their account.",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "staff-table",
      targetSelector: '[data-onboarding-target="admin-staff-table"]',
      title: "Manage Account Status & Invitations",
      description: isOwner
        ? "Use the row action menu (...) to Suspend or Reactivate staff accounts, Resend Invite (which issues a fresh 6-digit verification code), or Remove Staff for non-Owner accounts."
        : "Use the row action menu (...) to Suspend or Reactivate other staff accounts or Resend Invite (which issues a fresh 6-digit verification code). Account removal is restricted to the Owner role.",
      preferredPlacement: "top",
      primaryActionLabel: "Got it",
    },
  ];
}

export function resolveSettingsTourSteps(
  roleName: string,
): OnboardingTourStep[] {
  const normalizedRole = roleName.trim().toLowerCase();
  const isStaff = normalizedRole === "staff";
  const isOwner = normalizedRole === "owner";

  return [
    {
      id: "settings-profile-card",
      targetSelector: '[data-onboarding-target="admin-settings-profile-card"]',
      title: "Profile, Password & Email Approval Rules",
      description: isStaff
        ? "Update your display name or password at any time. If you request an Email Address change as a Staff member, your current email stays active until an Owner or Manager approves the request."
        : "Update your display name, password, or email address (changes for Owner and Manager accounts apply immediately). Pending Staff email requests also appear here so you can review them or Retry delivery if an approval email failed.",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    },
    {
      id: "settings-preferences-card",
      targetSelector:
        '[data-onboarding-target="admin-settings-preferences-card"]',
      title: "Business Details & Operating Schedules",
      description: isOwner
        ? "As Owner, click Edit to update the business name, contact email/phone, and active operating schedule windows displayed across customer consultation surfaces."
        : "View the active business contact details and operating schedule windows. Editing system preferences is restricted to the Owner role.",
      preferredPlacement: "top",
      primaryActionLabel: "Next",
    },
    {
      id: "settings-data-management-card",
      targetSelector:
        '[data-onboarding-target="admin-settings-data-management-card"]',
      title: "Analytics, Spreadsheet Exports & System Backup",
      description:
        "Open View Analytics & Insights to inspect booking conversion, platform, and product distribution charts, or export Booking Records and Product Records as Excel (.xls) or .csv files. Download Backup (restricted to the Owner role) downloads a JSON snapshot of database records, SHA-256 checksums, and the Cloudflare R2 asset-key manifest.",
      preferredPlacement: "top",
      primaryActionLabel: "Got it",
    },
  ];
}
