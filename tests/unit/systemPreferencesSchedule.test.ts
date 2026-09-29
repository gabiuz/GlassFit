/**
 * Unit & Integration Tests: System Preferences, Operating Schedule, and Quotation PDF Embedding (IMP-MS28)
 *
 * Traceability: PRD-F10, PRD-F11, PRD-F14, SDD-C7, SDD-C9, SDD-C10, ERD-E19, QAD-TC44
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    formatTime12h,
    formatDayRange,
    formatHourRange,
    formatScheduleSummary,
    formatMultiScheduleSummary,
} from "../../src/lib/settings/formatters";
import {
    SystemPreferencesSchema,
    OperatingScheduleRangeSchema,
    type OperatingScheduleRange,
} from "../../src/lib/settings/types";
import {
    generateQuotationPdfHtml,
    type QuotationPdfMetadata,
} from "../../src/lib/pricing/quotationPdfGenerator";
import type { CalculatedBOMResult } from "../../src/lib/pricing/pricingEngine";

const MOCK_BOM_RESULT: CalculatedBOMResult = {
    widthM: 1.5,
    heightM: 2.1,
    panelCount: 2,
    hasSill: true,
    finishType: "Analok",
    glassType: "6mm Clear Glass",
    leafWidthM: 0.75,
    aspectRatio: 1.4,
    isCrabbingRisk: false,
    isSpanLimitExceeded: false,
    totalLinearMetersFraming: 8.4,
    glazingAreaSqm: 3.15,
    framingItems: [],
    glazingItems: [],
    hardwareItems: [],
    consumableItems: [],
    rawFramingSubtotal: 3500,
    scrapFramingSubtotal: 350,
    effectiveFramingCost: 3850,
    rawGlazingSubtotal: 2200,
    scrapGlazingSubtotal: 220,
    effectiveGlazingCost: 2420,
    hardwareSubtotal: 800,
    consumablesSubtotal: 400,
    directMaterialsSubtotal: 7470,
    fabricationLaborCost: 2500,
    totalDirectCost: 9970,
    contractorMargin: 2492.5,
    finalQuotation: 12462.5,
    frozenDetails: {
        width_m: 1.5,
        height_m: 2.1,
        panel_count: 2,
        has_sill: true,
        finish_type: "Analok",
        glass_type: "6mm Clear Glass",
        items_breakdown: [],
        raw_material_subtotal: 7470,
        waste_allowance_subtotal: 570,
        direct_material_subtotal: 7470,
        labor_cost: 2500,
        contractor_margin: 2492.5,
        margin_rate: 0.25,
        total_estimate: 12462.5,
    },
    bomSummary: {
        total_estimated_amount: 12462.5,
        currency: "PHP",
        has_sill: true,
        structural_waiver: false,
        groups: [],
    },
};

const BASE_METADATA: QuotationPdfMetadata = {
    quotationNumber: "Q-2026-001",
    referenceCode: "CF-2026-001",
    shareableUrl: "https://glassfit.ph/q/CF-2026-001",
    customerName: "Juan Dela Cruz",
    customerPhone: "+63 917 123 4567",
    customerEmail: "juan@example.com",
    siteLocation: "Quezon City, Metro Manila",
    createdAtFormatted: "September 29, 2026",
    quotationValidityText: "Valid for 30 calendar days",
    projectName: "Sliding Glass Window Series 798",
    snapshotImageUrl: null,
    brandLogoUrl: "https://glassfit.ph/Logo.svg",
    hasSill: true,
    structuralWaiver: false,
    bomResult: MOCK_BOM_RESULT,
};

describe("IMP-MS28: System Preferences, Operating Schedule, and PDF Embedding (QAD-TC44)", () => {
    describe("QAD-TC44.3 & QAD-TC44.4: 12-Hour Time & Day Range Formatting", () => {
        it("TC-01: Converts 24-hour time to 12-hour Philippine standard time with AM/PM", () => {
            assert.strictEqual(formatTime12h("08:00"), "8:00 AM");
            assert.strictEqual(formatTime12h("08:30"), "8:30 AM");
            assert.strictEqual(formatTime12h("12:00"), "12:00 PM");
            assert.strictEqual(formatTime12h("12:30"), "12:30 PM");
            assert.strictEqual(formatTime12h("17:00"), "5:00 PM");
            assert.strictEqual(formatTime12h("17:30"), "5:30 PM");
            assert.strictEqual(formatTime12h("00:00"), "12:00 AM");
            assert.strictEqual(formatTime12h("21:45"), "9:45 PM");
        });

        it("TC-02: Formats day range string for identical start/end days and multi-day spans", () => {
            assert.strictEqual(formatDayRange("Monday", "Saturday"), "Monday - Saturday");
            assert.strictEqual(formatDayRange("Monday", "Friday"), "Monday - Friday");
            assert.strictEqual(formatDayRange("Saturday", "Saturday"), "Saturday");
            assert.strictEqual(formatDayRange("Sunday", "Sunday"), "Sunday");
        });

        it("TC-03: Formats hour range and composite schedule summaries", () => {
            assert.strictEqual(formatHourRange("08:00", "17:00"), "8:00 AM - 5:00 PM");
            assert.strictEqual(formatHourRange("08:30", "12:00"), "8:30 AM - 12:00 PM");

            const schedule1: OperatingScheduleRange = {
                id: "window-1",
                startDay: "Monday",
                endDay: "Saturday",
                startTime: "08:00",
                endTime: "17:00",
            };
            assert.strictEqual(
                formatScheduleSummary(schedule1),
                "Monday - Saturday: 8:00 AM - 5:00 PM"
            );

            const schedule2: OperatingScheduleRange = {
                id: "window-2",
                startDay: "Sunday",
                endDay: "Sunday",
                startTime: "09:00",
                endTime: "13:00",
            };
            assert.strictEqual(
                formatScheduleSummary(schedule2),
                "Sunday: 9:00 AM - 1:00 PM"
            );

            assert.strictEqual(
                formatMultiScheduleSummary([schedule1, schedule2]),
                "Monday - Saturday: 8:00 AM - 5:00 PM | Sunday: 9:00 AM - 1:00 PM"
            );
        });
    });

    describe("QAD-TC44.4 & QAD-TC44.5: Zod Schema Validation & Invariants", () => {
        it("TC-04: Validates proper schedule range and rejects startTime >= endTime", () => {
            const valid = OperatingScheduleRangeSchema.safeParse({
                id: "sch-1",
                startDay: "Monday",
                endDay: "Friday",
                startTime: "08:00",
                endTime: "17:00",
            });
            assert.strictEqual(valid.success, true);

            // Invalid: start time equals end time
            const invalidEqual = OperatingScheduleRangeSchema.safeParse({
                id: "sch-2",
                startDay: "Monday",
                endDay: "Friday",
                startTime: "17:00",
                endTime: "17:00",
            });
            assert.strictEqual(invalidEqual.success, false);

            // Invalid: start time after end time
            const invalidReversed = OperatingScheduleRangeSchema.safeParse({
                id: "sch-3",
                startDay: "Monday",
                endDay: "Friday",
                startTime: "18:00",
                endTime: "08:00",
            });
            assert.strictEqual(invalidReversed.success, false);

            // Invalid: bad time format
            const invalidFormat = OperatingScheduleRangeSchema.safeParse({
                id: "sch-4",
                startDay: "Monday",
                endDay: "Friday",
                startTime: "8:00",
                endTime: "17:00",
            });
            assert.strictEqual(invalidFormat.success, false);
        });

        it("TC-05: Validates full SystemPreferencesSchema payload", () => {
            const validPayload = {
                businessName: "GlassFit",
                contactEmail: "glassfit@gmail.com",
                contactPhone: "+63 917 123 4567",
                schedules: [
                    {
                        id: "default-1",
                        startDay: "Monday",
                        endDay: "Saturday",
                        startTime: "08:00",
                        endTime: "17:00",
                    },
                ],
            };
            const result = SystemPreferencesSchema.safeParse(validPayload);
            assert.strictEqual(result.success, true);

            // Invalid: empty schedules
            const emptySchedules = SystemPreferencesSchema.safeParse({
                ...validPayload,
                schedules: [],
            });
            assert.strictEqual(emptySchedules.success, false);

            // Invalid: bad email
            const badEmail = SystemPreferencesSchema.safeParse({
                ...validPayload,
                contactEmail: "not-an-email",
            });
            assert.strictEqual(badEmail.success, false);

            // Invalid: empty business name
            const emptyName = SystemPreferencesSchema.safeParse({
                ...validPayload,
                businessName: " ",
            });
            assert.strictEqual(emptyName.success, false);
        });
    });

    describe("QAD-TC44.6, QAD-TC44.7 & QAD-TC44.8: Quotation PDF Embedding & Resilience", () => {
        it("TC-06: Renders partner operating schedule in PDF header and ocular card", () => {
            const metadataWithSchedule: QuotationPdfMetadata = {
                ...BASE_METADATA,
                operatingDays: "Monday - Saturday",
                operatingHours: "8:00 AM - 5:00 PM",
                operatingScheduleFormatted: "Monday - Saturday: 8:00 AM - 5:00 PM",
            };

            const html = generateQuotationPdfHtml(metadataWithSchedule);

            // Header schedule block check
            assert.ok(html.includes("partner-schedule"), "HTML must contain partner-schedule class");
            assert.ok(
                html.includes("Monday - Saturday: 8:00 AM - 5:00 PM"),
                "HTML must contain formatted schedule string in header"
            );

            // Ocular card availability check
            assert.ok(html.includes("consultation-availability"), "HTML must contain consultation-availability section");
            assert.ok(
                html.includes("Consultation &amp; Ocular Measurement Hours:"),
                "HTML must render consultation hours heading"
            );
            assert.ok(
                html.includes("Monday - Saturday"),
                "HTML must render operating days in ocular card"
            );
            assert.ok(
                html.includes("8:00 AM - 5:00 PM"),
                "HTML must render operating hours in ocular card"
            );
        });

        it("TC-07: Omits schedule badges cleanly if metadata is absent without throwing error", () => {
            const metadataWithoutSchedule: QuotationPdfMetadata = {
                ...BASE_METADATA,
                operatingDays: null,
                operatingHours: null,
                operatingScheduleFormatted: null,
            };

            const html = generateQuotationPdfHtml(metadataWithoutSchedule);

            assert.strictEqual(typeof html, "string");
            assert.ok(html.includes("GlassFit Quotation Q-2026-001"));
            assert.strictEqual(html.includes("partner-schedule"), false);
            assert.strictEqual(html.includes("consultation-availability"), false);
        });
    });
});
