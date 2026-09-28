/**
 * Unit Tests: Client Request Mapper and Timeline Synthesizer (IMP-MS20)
 *
 * Traceability: PRD-F17, SDD-C8, SDD-C10, DSD-UI12, ERD-E13, ERD-E15, ERD-E16, QAD-TC33
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  ClientBookingRequestRow,
  ClientQuotationSnapshotDto,
} from "../../src/features/my-requests/clientRequestQueries";
import {
  deriveProductSummary,
  deriveReferenceNumber,
  extractQuotationFixtures,
  mapBookingRequestRowToClientItem,
  mapClientQuotationArtifact,
  synthesizeRequestUpdates,
} from "../../src/features/my-requests/clientRequestMapper";
import type { RawQuotationItemRecord } from "../../src/lib/booking/types";

describe("IMP-MS20: Client Request Mapper and Synthesizer (QAD-TC33)", () => {
  const baseBookingRow: ClientBookingRequestRow = {
    booking_request_id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    profile_id: "p1-user-id",
    status: "Pending",
    selected_platform: "Messenger",
    created_at: "2026-02-01T10:00:00.000Z",
    updated_at: "2026-02-01T10:00:00.000Z",
    booking_link: {
      link_id: "link-001",
      token_hash: "hash-001",
      status: "Active",
      created_at: "2026-02-01T10:00:00.000Z",
      quotation: {
        quotation_id: "q-001",
        quotation_number: "Q-2026-010",
        pdf_r2_object_key: "quotations/Q-2026-010.pdf",
        total_estimated_amount: 25000,
        negotiated_amount: null,
        negotiated_at: null,
        created_at: "2026-02-01T10:05:00.000Z",
        updated_at: "2026-02-01T10:05:00.000Z",
        quotation_document_snapshot: {
          schemaVersion: 1,
          quotationNumber: "Q-2026-010",
          referenceCode: "CF-2026-010",
          shareablePath: "/q/CF-2026-010",
          createdAt: "2026-02-01T10:05:00.000Z",
          customer: {
            name: "Juan Dela Cruz",
            phone: "+639171234567",
            email: "juan@example.com",
            siteLocation: "Taguig",
          },
          projectName: "Master Bedroom Windows",
          snapshotObjectKey: null,
          hasSill: false,
          structuralWaiver: false,
          items: [
            {
              itemId: "item-1",
              productId: "prod-1",
              productName: "Series 798 Sliding Window",
              productType: "window",
              variantName: "Standard",
              specificationSummary: "3 Panels, Clear Glass, Powder Coated White",
              dimensionsFormatted: "1800mm x 1200mm",
              widthMm: 1800,
              heightMm: 1200,
              panelCount: 3,
              hasSill: false,
              structuralWaiver: false,
              finishLabel: "Powder Coated White",
              glassLabel: "6mm Clear Tempered Glass",
              quantity: 2,
              unitPrice: 12500,
              calculatedSubtotal: 25000,
              imageSource: null,
              groups: [
                {
                  groupName: "Frame",
                  description: "Aluminum Frame",
                  quantity: 2,
                  unit: "set",
                  unitPrice: 12500,
                  subtotal: 25000,
                },
              ],
            },
          ],
          pricing: {
            directMaterialsSubtotal: 18000,
            laborSubtotal: 4500,
            contractorMargin: 2500,
            calculatedFinalPrice: 25000,
          },
        },
        quotation_items: [],
      },
      snapshot: {
        snapshot_id: "snap-001",
        final_image_r2_key: "snapshots/snap-001.webp",
        created_at: "2026-02-01T10:00:00.000Z",
      },
    },
  };

  it("TC33.1: mapBookingRequestRowToClientItem maps standard row to ClientRequestItem", () => {
    const clientItem = mapBookingRequestRowToClientItem(baseBookingRow);

    assert.strictEqual(clientItem.id, "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d");
    assert.strictEqual(clientItem.referenceNo, "CF-2026-010");
    assert.strictEqual(clientItem.productName, "Series 798 Sliding Window");
    assert.strictEqual(clientItem.productCount, 2);
    assert.strictEqual(clientItem.submittedAt, "2026-02-01T10:00:00.000Z");
    assert.strictEqual(clientItem.status, "Pending");
    assert.strictEqual(clientItem.quotation.filename, "Q-2026-010.pdf");
    assert.strictEqual(clientItem.quotation.availability, "available");
    assert.strictEqual(clientItem.quotation.referenceCode, "CF-2026-010");
    assert.strictEqual(clientItem.quotation.shareableUrl, "/q/CF-2026-010");
    assert.strictEqual(clientItem.quotation.r2ObjectKey, "quotations/Q-2026-010.pdf");
  });

  it("TC33.2: Product summarization for single vs multi-product snapshots", () => {
    // Single product
    const singleSummary = deriveProductSummary(baseBookingRow.booking_link?.quotation);
    assert.strictEqual(singleSummary.productName, "Series 798 Sliding Window");
    assert.strictEqual(singleSummary.productCount, 2);

    // Multi-product snapshot
    const multiSnapshotQuotation: ClientQuotationSnapshotDto = {
      ...baseBookingRow.booking_link!.quotation!,
      quotation_document_snapshot: {
        schemaVersion: 1,
        quotationNumber: "Q-2026-011",
        referenceCode: "CF-2026-011",
        shareablePath: "/q/CF-2026-011",
        createdAt: "2026-02-01T10:05:00.000Z",
        customer: {
          name: "Juan Dela Cruz",
          phone: null,
          email: null,
          siteLocation: null,
        },
        projectName: "Full House Package",
        snapshotObjectKey: null,
        hasSill: false,
        structuralWaiver: false,
        items: [
          {
            itemId: "item-1",
            productId: "prod-1",
            productName: "Series 798 Sliding Window",
            productType: "window",
            variantName: "Standard",
            specificationSummary: "Specs 1",
            dimensionsFormatted: "1800 x 1200",
            widthMm: 1800,
            heightMm: 1200,
            panelCount: 3,
            hasSill: false,
            structuralWaiver: false,
            finishLabel: "White",
            glassLabel: "Clear",
            quantity: 3,
            unitPrice: 10000,
            calculatedSubtotal: 30000,
            imageSource: null,
            groups: [{ groupName: "G1", description: "D1", quantity: 1, unit: "set", unitPrice: 30000, subtotal: 30000 }],
          },
          {
            itemId: "item-2",
            productId: "prod-2",
            productName: "Frameless Glass Door",
            productType: "door",
            variantName: "Standard",
            specificationSummary: "Specs 2",
            dimensionsFormatted: "900 x 2100",
            widthMm: 900,
            heightMm: 2100,
            panelCount: 1,
            hasSill: false,
            structuralWaiver: false,
            finishLabel: "Matte Black",
            glassLabel: "Frosted",
            quantity: 2,
            unitPrice: 15000,
            calculatedSubtotal: 30000,
            imageSource: null,
            groups: [{ groupName: "G2", description: "D2", quantity: 1, unit: "set", unitPrice: 30000, subtotal: 30000 }],
          },
        ],
        pricing: {
          directMaterialsSubtotal: 40000,
          laborSubtotal: 10000,
          contractorMargin: 10000,
          calculatedFinalPrice: 60000,
        },
      },
    };

    const multiSummary = deriveProductSummary(multiSnapshotQuotation);
    assert.strictEqual(multiSummary.productName, "Series 798 Sliding Window and 1 more");
    assert.strictEqual(multiSummary.productCount, 5);
  });

  it("TC33.3: synthesizeRequestUpdates generates milestones for Pending, Ongoing, and Done", () => {
    // 1. Pending status: Submitted + Quotation (2 updates)
    const pendingUpdates = synthesizeRequestUpdates(baseBookingRow);
    assert.strictEqual(pendingUpdates.length, 2);
    assert.strictEqual(pendingUpdates[0].title, "Quotation received");
    assert.strictEqual(pendingUpdates[1].title, "Request submitted");

    // 2. Ongoing status: Submitted + Quotation + Under Review (3 updates)
    const ongoingRow: ClientBookingRequestRow = {
      ...baseBookingRow,
      status: "Ongoing",
      updated_at: "2026-02-02T14:00:00.000Z",
    };
    const ongoingUpdates = synthesizeRequestUpdates(ongoingRow);
    assert.strictEqual(ongoingUpdates.length, 3);
    assert.strictEqual(ongoingUpdates[0].title, "Under review");
    assert.strictEqual(ongoingUpdates[1].title, "Quotation received");
    assert.strictEqual(ongoingUpdates[2].title, "Request submitted");

    // 3. Done status with negotiated pricing: Submitted + Quotation + Under Review + Confirmed + Completed (5 updates)
    const doneRow: ClientBookingRequestRow = {
      ...baseBookingRow,
      status: "Done",
      updated_at: "2026-02-04T16:00:00.000Z",
      booking_link: {
        ...baseBookingRow.booking_link!,
        quotation: {
          ...baseBookingRow.booking_link!.quotation!,
          negotiated_amount: 23500,
          negotiated_at: "2026-02-03T11:30:00.000Z",
        },
      },
    };
    const doneUpdates = synthesizeRequestUpdates(doneRow);
    assert.strictEqual(doneUpdates.length, 5);
    assert.strictEqual(doneUpdates[0].title, "Request completed");
    assert.strictEqual(doneUpdates[1].title, "Quotation confirmed");
    assert.strictEqual(doneUpdates[2].title, "Under review");
    assert.strictEqual(doneUpdates[3].title, "Quotation received");
    assert.strictEqual(doneUpdates[4].title, "Request submitted");
  });

  it("TC33.4: synthesizeRequestUpdates handles Cancelled status correctly", () => {
    const cancelledRow: ClientBookingRequestRow = {
      ...baseBookingRow,
      status: "Cancelled",
      updated_at: "2026-02-02T17:00:00.000Z",
    };
    const cancelledUpdates = synthesizeRequestUpdates(cancelledRow);

    assert.strictEqual(cancelledUpdates.length, 3);
    assert.strictEqual(cancelledUpdates[0].title, "Request cancelled");
    assert.strictEqual(cancelledUpdates[0].occurredAt, "2026-02-02T17:00:00.000Z");
    assert.strictEqual(cancelledUpdates[1].title, "Quotation received");
    assert.strictEqual(cancelledUpdates[2].title, "Request submitted");
  });

  it("TC33.5: synthesizeRequestUpdates always returns strictly newest-first sorted updates", () => {
    const row: ClientBookingRequestRow = {
      ...baseBookingRow,
      status: "Done",
      created_at: "2026-01-01T08:00:00.000Z",
      updated_at: "2026-01-05T18:00:00.000Z",
    };
    const updates = synthesizeRequestUpdates(row);

    for (let i = 0; i < updates.length - 1; i++) {
      const current = new Date(updates[i].occurredAt).getTime();
      const next = new Date(updates[i + 1].occurredAt).getTime();
      assert.ok(current >= next, `Timeline inversion between index ${i} and ${i + 1}`);
    }
  });

  it("TC33.6: Legacy quotation item fixtures fallback when snapshot is absent or unparseable", () => {
    const legacyItems: RawQuotationItemRecord[] = [
      {
        item_name: "Glass Partition Panel A",
        item_group_name: "Glass",
        quantity: 3,
        unit: "panel",
        unit_price: 5000,
        estimated_subtotal: 15000,
        pricing_details: {
          item_id: "panel-a",
          product_name: "Frameless Glass Partition",
          item_quantity: 3,
        },
      },
      {
        item_name: "Glass Partition Panel B",
        item_group_name: "Glass",
        quantity: 2,
        unit: "panel",
        unit_price: 5000,
        estimated_subtotal: 10000,
        pricing_details: {
          item_id: "panel-b",
          product_name: "Awning Window",
          item_quantity: 2,
        },
      },
    ];

    const legacyQuotation: ClientQuotationSnapshotDto = {
      quotation_id: "q-legacy",
      quotation_number: "Q-2026-099",
      pdf_r2_object_key: null,
      total_estimated_amount: 25000,
      negotiated_amount: null,
      negotiated_at: null,
      created_at: "2026-01-10T12:00:00.000Z",
      updated_at: "2026-01-10T12:00:00.000Z",
      quotation_document_snapshot: null,
      quotation_items: legacyItems,
    };

    const fixtures = extractQuotationFixtures(legacyItems);
    assert.strictEqual(fixtures.length, 2);
    assert.strictEqual(fixtures[0].name, "Frameless Glass Partition");
    assert.strictEqual(fixtures[0].quantity, 3);
    assert.strictEqual(fixtures[1].name, "Awning Window");
    assert.strictEqual(fixtures[1].quantity, 2);

    const summary = deriveProductSummary(legacyQuotation);
    assert.strictEqual(summary.productName, "Frameless Glass Partition and 1 more");
    assert.strictEqual(summary.productCount, 5);

    // Fallback when no fixtures exist
    const emptySummary = deriveProductSummary(null);
    assert.strictEqual(emptySummary.productName, "Custom Consultation Fixture");
    assert.strictEqual(emptySummary.productCount, 1);
  });

  it("TC33.7: Fallback reference number when quotation is absent", () => {
    const rowWithoutQuotation: ClientBookingRequestRow = {
      ...baseBookingRow,
      booking_request_id: "deadbeef-1234-5678-9abc-def012345678",
      booking_link: null,
    };

    const refNo = deriveReferenceNumber(rowWithoutQuotation, null);
    assert.strictEqual(refNo, "CF-DEADBEEF");

    const artifact = mapClientQuotationArtifact(rowWithoutQuotation, null, refNo);
    assert.strictEqual(artifact.filename, "CF-DEADBEEF-quotation.pdf");
    assert.strictEqual(artifact.availability, "pending");
    assert.strictEqual(artifact.r2ObjectKey, null);
  });
});
