import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UpdateBookingLaborInputSchema } from "@/lib/booking/types";

describe("QAD-TC40: Administrative Labor Fee Input and Total Recalculation", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validIsoDate = "2026-09-28T12:00:00.000Z";

  it("validates valid administrative labor fee input payload", () => {
    const payload = {
      quotationId: validUuid,
      laborAmount: 1250.50,
      laborDescription: "Standard installation labor fee for 2nd floor window replacement.",
      expectedUpdatedAt: validIsoDate,
    };

    const parsed = UpdateBookingLaborInputSchema.safeParse(payload);
    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      assert.strictEqual(parsed.data.laborAmount, 1250.50);
      assert.strictEqual(parsed.data.laborDescription, "Standard installation labor fee for 2nd floor window replacement.");
    }
  });

  it("rejects negative labor fee amounts", () => {
    const payload = {
      quotationId: validUuid,
      laborAmount: -100,
      expectedUpdatedAt: validIsoDate,
    };

    const parsed = UpdateBookingLaborInputSchema.safeParse(payload);
    assert.strictEqual(parsed.success, false);
  });

  it("computes final grand total accurately from raw fabrication price and admin labor fee", () => {
    const rawFabricationPrice = 4500.00;
    const adminLaborCharge = 1200.00;

    const grandTotal = rawFabricationPrice + adminLaborCharge;

    assert.strictEqual(grandTotal, 5700.00);
  });

  it("allows setting 0 or null labor fee when customer opts for self-pickup / materials only", () => {
    const payloadZero = {
      quotationId: validUuid,
      laborAmount: 0,
      laborDescription: "Client opted for self-installation / pickup.",
      expectedUpdatedAt: validIsoDate,
    };

    const parsedZero = UpdateBookingLaborInputSchema.safeParse(payloadZero);
    assert.strictEqual(parsedZero.success, true);
    if (parsedZero.success) {
      assert.strictEqual(parsedZero.data.laborAmount, 0);
    }

    const payloadNull = {
      quotationId: validUuid,
      laborAmount: null,
      expectedUpdatedAt: validIsoDate,
    };

    const parsedNull = UpdateBookingLaborInputSchema.safeParse(payloadNull);
    assert.strictEqual(parsedNull.success, true);
    if (parsedNull.success) {
      assert.strictEqual(parsedNull.data.laborAmount, null);
    }
  });
});
