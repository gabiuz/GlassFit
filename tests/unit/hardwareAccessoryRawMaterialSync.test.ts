/**
 * Unit Test Suite: Hardware Accessories Raw Materials Sync & Part Price Connection (IMP-MS78)
 *
 * Upstream Specifications: docs/sdd-glassfit.md, docs/prd-glassfit.md
 * Acceptance Catalog: QAD-TC93.14 through QAD-TC93.18
 * Traceability Codes: PRD-F14, SDD-C9, ERD-E6, ERD-E17, IMP-MS78
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateHardwareMaterialCode,
  syncHardwareAccessoryToRawMaterial,
} from "../../src/lib/admin/materials/hardwareSync";
import {
  calculateParametricBOM,
  type ComponentPricingInput,
} from "../../src/lib/pricing/pricingEngine";
import type { RawMaterial } from "../../src/lib/pricing/types";

describe("IMP-MS78: Hardware Accessories Raw Material Sync & Part Pricing", () => {
  it("QAD-TC93.14: generates clean deterministic hardware material code from accessory product", () => {
    const code1 = generateHardwareMaterialCode("Screen Access Hatch Lock", "ece06b1a-6be3-4b09-892c-ccbbc75fd7b9");
    assert.strictEqual(code1, "HW-SCREENACCESSHATC-ECE06B");

    const code2 = generateHardwareMaterialCode("Lever Handle (Black)", "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d");
    assert.strictEqual(code2, "HW-LEVERHANDLEBLACK-A1B2C3");
  });

  it("QAD-TC93.15: synchronizes hardware accessory product to raw_materials under category Hardware", async () => {
    const insertedRows: Record<string, unknown>[] = [];
    const updatedRows: Record<string, unknown>[] = [];

    const mockSupabase = {
      from: (table: string) => {
        assert.strictEqual(table, "raw_materials");
        return {
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            insertedRows.push(payload);
            return {
              select: () => ({
                single: async () => ({ data: payload, error: null }),
              }),
            };
          },
          update: (payload: Record<string, unknown>) => {
            updatedRows.push(payload);
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: payload, error: null }),
                }),
              }),
            };
          },
        };
      },
    };

    const result = await syncHardwareAccessoryToRawMaterial(mockSupabase as unknown as SupabaseClient, {
      productId: "ece06b1a-6be3-4b09-892c-ccbbc75fd7b9",
      productName: "Screen Access Hatch Lock",
      basePrice: 450,
      status: "Active",
    });

    assert.ok(result);
    assert.strictEqual(insertedRows.length, 1);
    assert.strictEqual(insertedRows[0].category, "Hardware");
    assert.strictEqual(insertedRows[0].billing_unit, "pc");
    assert.strictEqual(insertedRows[0].unit_price, 450);
    assert.strictEqual(insertedRows[0].id, "ece06b1a-6be3-4b09-892c-ccbbc75fd7b9");
    assert.strictEqual(insertedRows[0].description, "Screen Access Hatch Lock");
    assert.strictEqual(insertedRows[0].is_active, true);
  });

  it("QAD-TC93.16: updates raw material unit price when hardware accessory base price changes", async () => {
    const existingRawMaterial = {
      id: "ece06b1a-6be3-4b09-892c-ccbbc75fd7b9",
      material_code: "HW-SCREENACCESSHATC-ECE06B",
      description: "Screen Access Hatch Lock",
      category: "Hardware",
      finish_type: "Standard",
      billing_unit: "pc",
      unit_price: 450,
      waste_allowance: 0,
      is_active: true,
    };

    let updatedPayload: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: (table: string) => {
        assert.strictEqual(table, "raw_materials");
        return {
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({ data: existingRawMaterial }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updatedPayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { ...existingRawMaterial, ...payload }, error: null }),
                }),
              }),
            };
          },
        };
      },
    };

    const result = await syncHardwareAccessoryToRawMaterial(mockSupabase as unknown as SupabaseClient, {
      productId: "ece06b1a-6be3-4b09-892c-ccbbc75fd7b9",
      productName: "Screen Access Hatch Lock Deluxe",
      basePrice: 550,
      status: "Active",
    });

    assert.ok(result);
    assert.ok(updatedPayload);
    const payload = updatedPayload as Record<string, unknown>;
    assert.strictEqual(payload.unit_price, 550);
    assert.strictEqual(payload.description, "Screen Access Hatch Lock Deluxe");
    assert.strictEqual(payload.category, "Hardware");
  });

  it("QAD-TC93.17: evaluates part price using connected hardware accessory raw material in BOM", () => {
    const hardwareAccessoryMaterial: RawMaterial = {
      id: "ece06b1a-6be3-4b09-892c-ccbbc75fd7b9",
      material_code: "HW-SCREENACCESSHATC-ECE06B",
      description: "Screen Access Hatch Lock",
      category: "Hardware",
      finish_type: "Standard",
      billing_unit: "pc",
      unit_price: 450.0,
      waste_allowance: 0.0,
      is_active: true,
    };

    const components: ComponentPricingInput[] = [
      {
        componentKey: "screen_access_hatch",
        componentName: "Screen Access Hatch",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Hardware",
        rawMaterial: hardwareAccessoryMaterial,
        pricingMethod: "Material",
      },
    ];

    const bom = calculateParametricBOM(components, {
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
    });

    assert.strictEqual(bom.hardwareItems.length, 1);
    assert.strictEqual(bom.hardwareItems[0].code, "HW-SCREENACCESSHATC-ECE06B");
    assert.strictEqual(bom.hardwareItems[0].description, "Screen Access Hatch Lock");
    assert.strictEqual(bom.hardwareItems[0].unit, "pc");
    assert.strictEqual(bom.hardwareItems[0].unit_price, 450.0);
    assert.strictEqual(bom.hardwareItems[0].quantity, 1);
    assert.strictEqual(bom.hardwareItems[0].subtotal, 450.0);
    assert.strictEqual(bom.hardwareSubtotal, 450.0);
  });

  it("QAD-TC93.18: automatically categorizes part under Hardware in BOM when linked to Hardware material", () => {
    const lockMaterial: RawMaterial = {
      id: "lock-acc-001",
      material_code: "HW-ACC-LEVERLOCK-001",
      description: "Heavy Duty Lever Lock",
      category: "Hardware",
      finish_type: "Standard",
      billing_unit: "pc",
      unit_price: 850.0,
      waste_allowance: 0.0,
      is_active: true,
    };

    // Component presentationCategory was left as Model, but material is Hardware
    const components: ComponentPricingInput[] = [
      {
        componentKey: "sliding_lock_body",
        componentName: "Sliding Lock Body",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 2,
        isRemovable: false,
        presentationCategory: "Other",
        rawMaterial: lockMaterial,
        pricingMethod: "Material",
      },
    ];

    const bom = calculateParametricBOM(components, {
      widthMm: 1200,
      heightMm: 1200,
    });

    assert.strictEqual(bom.hardwareItems.length, 1);
    assert.strictEqual(bom.hardwareItems[0].quantity, 2);
    assert.strictEqual(bom.hardwareItems[0].unit_price, 850.0);
    assert.strictEqual(bom.hardwareItems[0].subtotal, 1700.0);
    assert.strictEqual(bom.hardwareSubtotal, 1700.0);
    assert.strictEqual(bom.consumableItems.length, 0);
  });
});
