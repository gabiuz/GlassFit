import { describe, it } from "node:test";
import assert from "node:assert";
import {
  UpsertRawMaterialInputSchema,
  BatchUpdateMaterialPricesInputSchema,
  RawMaterialsFilterSchema,
  type RawMaterial,
  type UpsertRawMaterialInput,
  type BatchUpdateMaterialPricesInput,
} from "../../src/lib/admin/materials/types.js";
import * as materialActions from "../../src/lib/admin/materials/materialActions.js";
import * as materialsFeature from "../../src/features/admin/materials/index.js";

describe("Milestone 2: Central Raw Materials Master Catalog Validation", () => {
  // --------------------------------------------------------------------------
  // 1. Schema & DTO Validation
  // --------------------------------------------------------------------------
  describe("Schema Validation (UpsertRawMaterialInputSchema)", () => {
    it("should validate a valid Aluminum extrusion input with standard 12% scrap", () => {
      const validAluminum: UpsertRawMaterialInput = {
        material_code: "mat_al_798_head_anlk",
        description: "Series 798 Double Head Track",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 90.0,
        waste_allowance: 0.12,
        is_active: true,
      };

      const result = UpsertRawMaterialInputSchema.safeParse(validAluminum);
      assert.strictEqual(result.success, true);
    });

    it("should validate a valid Glass stock input with 10% scrap", () => {
      const validGlass: UpsertRawMaterialInput = {
        material_code: "mat_gl_6mm_float_brz",
        description: "6mm Annealed Float Tinted Bronze",
        category: "Glass",
        finish_type: "Bronze",
        billing_unit: "sqm",
        unit_price: 780.0,
        waste_allowance: 0.1,
        is_active: true,
      };

      const result = UpsertRawMaterialInputSchema.safeParse(validGlass);
      assert.strictEqual(result.success, true);
    });

    it("should validate Hardware accessories with 0% scrap allowance", () => {
      const validHardware: UpsertRawMaterialInput = {
        material_code: "mat_hw_798_roller",
        description: "Series 798 Single POM Roller",
        category: "Hardware",
        finish_type: "Mill",
        billing_unit: "pc",
        unit_price: 25.0,
        waste_allowance: 0.0,
        is_active: true,
      };

      const result = UpsertRawMaterialInputSchema.safeParse(validHardware);
      assert.strictEqual(result.success, true);
    });

    it("should reject negative unit prices", () => {
      const invalid = {
        material_code: "mat_invalid_price",
        description: "Invalid Material",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: -45.5,
        waste_allowance: 0.12,
        is_active: true,
      };

      const result = UpsertRawMaterialInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it("should reject waste allowances greater than 1.0 (100%)", () => {
      const invalid = {
        material_code: "mat_invalid_waste",
        description: "Invalid Material",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 90.0,
        waste_allowance: 1.25,
        is_active: true,
      };

      const result = UpsertRawMaterialInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it("should reject invalid billing units", () => {
      const invalid = {
        material_code: "mat_invalid_unit",
        description: "Invalid Material",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "kilograms", // Not in allowed domain
        unit_price: 90.0,
        waste_allowance: 0.12,
        is_active: true,
      };

      const result = UpsertRawMaterialInputSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Batch Update Schema Validation
  // --------------------------------------------------------------------------
  describe("Batch Update Schema Validation", () => {
    it("should validate BatchUpdateMaterialPricesInputSchema with multiple items", () => {
      const batchInput: BatchUpdateMaterialPricesInput = {
        updates: [
          { id: "11111111-1111-4111-8111-111111111111", unit_price: 95.0 },
          { id: "22222222-2222-4222-8222-222222222222", unit_price: 115.5 },
          { id: "33333333-3333-4333-8333-333333333333", unit_price: 75.0 },
        ],
      };

      const result = BatchUpdateMaterialPricesInputSchema.safeParse(batchInput);
      assert.strictEqual(result.success, true);
    });

    it("should reject batch updates with negative prices", () => {
      const invalidBatch = {
        updates: [
          { id: "11111111-1111-4111-8111-111111111111", unit_price: -10.0 },
        ],
      };

      const result = BatchUpdateMaterialPricesInputSchema.safeParse(invalidBatch);
      assert.strictEqual(result.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Filter Schema Validation
  // --------------------------------------------------------------------------
  describe("Filter Schema Validation", () => {
    it("should parse valid filter parameters", () => {
      const filter = {
        category: "Aluminum",
        finish_type: "Analok",
        search: "798 Head",
        is_active: true,
      };

      const result = RawMaterialsFilterSchema.safeParse(filter);
      assert.strictEqual(result.success, true);
    });

    it("should allow partial filter parameters", () => {
      const filter = { search: "glass" };
      const result = RawMaterialsFilterSchema.safeParse(filter);
      assert.strictEqual(result.success, true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Mathematical Scrap & Effective Cost Calculations
  // --------------------------------------------------------------------------
  describe("Mathematical Scrap & Effective Rate Formulation", () => {
    const calculateEffectiveRate = (unitPrice: number, wasteAllowance: number): number => {
      return Math.round(unitPrice * (1 + wasteAllowance) * 100) / 100;
    };

    it("should calculate correct effective rates for Series 798 Analok extrusions (12% scrap)", () => {
      // Analok Head: 90.00 * 1.12 = 100.80
      assert.strictEqual(calculateEffectiveRate(90.0, 0.12), 100.8);
      // Analok Sill: 110.00 * 1.12 = 123.20
      assert.strictEqual(calculateEffectiveRate(110.0, 0.12), 123.2);
      // Analok Jamb: 70.00 * 1.12 = 78.40
      assert.strictEqual(calculateEffectiveRate(70.0, 0.12), 78.4);
      // Analok Rail: 72.00 * 1.12 = 80.64
      assert.strictEqual(calculateEffectiveRate(72.0, 0.12), 80.64);
      // Analok Stile: 78.00 * 1.12 = 87.36
      assert.strictEqual(calculateEffectiveRate(78.0, 0.12), 87.36);
    });

    it("should calculate correct effective rates for Series 798 Powder Coated White extrusions (12% scrap)", () => {
      // PCW Head: 105.00 * 1.12 = 117.60
      assert.strictEqual(calculateEffectiveRate(105.0, 0.12), 117.6);
      // PCW Sill: 125.00 * 1.12 = 140.00
      assert.strictEqual(calculateEffectiveRate(125.0, 0.12), 140.0);
      // PCW Jamb: 82.00 * 1.12 = 91.84
      assert.strictEqual(calculateEffectiveRate(82.0, 0.12), 91.84);
      // PCW Rail: 84.00 * 1.12 = 94.08
      assert.strictEqual(calculateEffectiveRate(84.0, 0.12), 94.08);
      // PCW Stile: 90.00 * 1.12 = 100.80
      assert.strictEqual(calculateEffectiveRate(90.0, 0.12), 100.8);
    });

    it("should calculate correct effective rates for Glass stock sheets", () => {
      // 6mm Bronze Float: 780.00 * 1.10 = 858.00
      assert.strictEqual(calculateEffectiveRate(780.0, 0.1), 858.0);
      // 6mm Clear Float: 650.00 * 1.10 = 715.00
      assert.strictEqual(calculateEffectiveRate(650.0, 0.1), 715.0);
      // 6mm Safety Tempered: 1650.00 * 1.05 = 1732.50
      assert.strictEqual(calculateEffectiveRate(1650.0, 0.05), 1732.5);
    });

    it("should preserve exact unit rate when scrap is 0% (Hardware & Consumables)", () => {
      // POM Roller: 25.00 * 1.00 = 25.00
      assert.strictEqual(calculateEffectiveRate(25.0, 0.0), 25.0);
      // Flush Lock: 65.00 * 1.00 = 65.00
      assert.strictEqual(calculateEffectiveRate(65.0, 0.0), 65.0);
      // Silicone Sealant: 220.00 * 1.00 = 220.00
      assert.strictEqual(calculateEffectiveRate(220.0, 0.0), 220.0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Batch Percentage Adjustment Algorithm
  // --------------------------------------------------------------------------
  describe("Batch Price Adjustment Simulation", () => {
    const mockMaterials: RawMaterial[] = [
      {
        id: "1",
        material_code: "mat_al_798_head_anlk",
        description: "Series 798 Double Head",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 90.0,
        waste_allowance: 0.12,
        is_active: true,
      },
      {
        id: "2",
        material_code: "mat_al_798_sill_anlk",
        description: "Series 798 Double Sill",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 110.0,
        waste_allowance: 0.12,
        is_active: true,
      },
      {
        id: "3",
        material_code: "mat_gl_6mm_float_brz",
        description: "6mm Tinted Bronze Glass",
        category: "Glass",
        finish_type: "Bronze",
        billing_unit: "sqm",
        unit_price: 780.0,
        waste_allowance: 0.1,
        is_active: true,
      },
    ];

    it("should calculate +5% price hike correctly across aluminum extrusions", () => {
      const percentage = 5;
      const factor = 1 + percentage / 100;

      const updated = mockMaterials
        .filter((m) => m.category === "Aluminum")
        .map((m) => ({
          id: m.id,
          new_price: Math.round(m.unit_price * factor * 100) / 100,
        }));

      // 90.00 * 1.05 = 94.50
      assert.strictEqual(updated[0].new_price, 94.5);
      // 110.00 * 1.05 = 115.50
      assert.strictEqual(updated[1].new_price, 115.5);
    });

    it("should calculate -3% supplier discount accurately", () => {
      const percentage = -3;
      const factor = 1 + percentage / 100;

      const glass = mockMaterials.find((m) => m.category === "Glass")!;
      const newPrice = Math.round(glass.unit_price * factor * 100) / 100;

      // 780.00 * 0.97 = 756.60
      assert.strictEqual(newPrice, 756.6);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Server Action & Component Module Exports Integrity
  // --------------------------------------------------------------------------
  describe("Module Exports & Architecture Integrity", () => {
    it("should export all required server actions from materialActions.ts", () => {
      assert.strictEqual(typeof materialActions.getRawMaterials, "function");
      assert.strictEqual(typeof materialActions.upsertRawMaterial, "function");
      assert.strictEqual(typeof materialActions.deleteRawMaterial, "function");
      assert.strictEqual(typeof materialActions.batchUpdateMaterialPrices, "function");
      assert.strictEqual(typeof materialActions.toggleRawMaterialStatus, "function");
    });

    it("should export all required UI components from materials feature index", () => {
      assert.strictEqual(typeof materialsFeature.MaterialsPage, "function");
      assert.strictEqual(typeof materialsFeature.MaterialsContent, "function");
      assert.strictEqual(typeof materialsFeature.MaterialModal, "function");
      assert.strictEqual(typeof materialsFeature.BatchPriceModal, "function");
      assert.strictEqual(typeof materialsFeature.DeleteMaterialModal, "function");
    });
  });
});
