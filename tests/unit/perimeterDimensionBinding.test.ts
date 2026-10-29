/**
 * PERIMETER Dimension Binding Tests
 *
 * Upstream Specifications: PRD-F14, SDD-C9, DSD-UI10, ERD-E6
 * Traceability Codes: QAD-TC95
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  DimensionBindingSchema,
  ProductComponentBindingSchema,
  type DimensionBinding,
} from "@/lib/pricing/types";
import { autoDetectComponentSettings } from "@/lib/admin/products/autoDetection";
import { calculateParametricBOM } from "@/lib/pricing/pricingEngine";

describe("PERIMETER Dimension Driver (QAD-TC95)", () => {
  it("TC95.1: DimensionBindingSchema and ProductComponentBindingSchema accept 'PERIMETER'", () => {
    const parsed = DimensionBindingSchema.parse("PERIMETER");
    assert.strictEqual(parsed, "PERIMETER");

    const validPayload = {
      template_id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      component_key: "outer_tubular_subframe",
      component_name: "Outer Tubular Subframe",
      dimension_binding: "PERIMETER",
      raw_material_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      span_ratio: 1.0,
      base_quantity: 1,
      presentation_category: "Framing",
    };

    const parsedComponent = ProductComponentBindingSchema.safeParse(validPayload);
    assert.strictEqual(parsedComponent.success, true);
    if (parsedComponent.success) {
      assert.strictEqual(parsedComponent.data.dimension_binding, "PERIMETER");
    }
  });

  it("TC95.2: auto-detects dimensionBinding = 'PERIMETER' and presentationCategory = 'Framing' from file names", () => {
    const testCases = [
      "outer_frame.glb",
      "window_perimeter.glb",
      "tubular_subframe.glb",
      "sub_frame_tube.glb",
      "casing_frame.glb",
      "outer_casing.glb",
      "perimeter_tube.glb",
      "frame_perimeter.glb",
      "window_surround.glb",
    ];

    testCases.forEach((fileName) => {
      const result = autoDetectComponentSettings(fileName);
      assert.strictEqual(
        result.dimensionBinding,
        "PERIMETER",
        `Expected ${fileName} to be auto-detected as PERIMETER`
      );
      assert.strictEqual(
        result.presentationCategory,
        "Framing",
        `Expected ${fileName} presentation category to be Framing`
      );
      assert.strictEqual(
        result.componentType,
        "Frame",
        `Expected ${fileName} component type to be Frame`
      );
    });
  });

  it("TC95.3: directional frame files are not misclassified as PERIMETER", () => {
    const directionalCases = [
      { name: "frame_left.glb", expected: "HEIGHT" },
      { name: "frame_right.glb", expected: "HEIGHT" },
      { name: "frame_top.glb", expected: "WIDTH" },
      { name: "frame_bottom.glb", expected: "WIDTH" },
      { name: "series798_double_sill.glb", expected: "WIDTH" },
      { name: "window_glass_pane.glb", expected: "AREA" },
      { name: "center_grille.glb", expected: "GRILLE_LINEAR" },
    ];

    directionalCases.forEach(({ name, expected }) => {
      const result = autoDetectComponentSettings(name);
      assert.strictEqual(
        result.dimensionBinding,
        expected,
        `Expected ${name} to be detected as ${expected}, not PERIMETER`
      );
    });
  });

  it("TC95.4: calculateParametricBOM accurately computes linear meters using 2 * (Width + Height)", () => {
    const rawMaterial = {
      id: "mat-tube-134x3",
      material_code: "AL-134X3ALUMI",
      category: "Aluminum" as const,
      description: "1-3/4\" x 3\" Aluminum Tube",
      unit_price: 300.0,
      billing_unit: "m" as const,
      waste_allowance: 0.1,
      finish_type: "PowderCoatedWhite",
      is_active: true,
    };

    const components = [
      {
        componentKey: "perimeter_frame",
        componentName: "Outer Perimeter Tube Frame",
        dimensionBinding: "PERIMETER" as DimensionBinding,
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Framing" as const,
        rawMaterial,
      },
    ];

    // Case 1: 1200mm W x 1500mm H -> 1.2m W x 1.5m H
    // Expected Linear Meters: 2 * (1.2 + 1.5) = 5.4m
    const bom1 = calculateParametricBOM(components, {
      widthMm: 1200,
      heightMm: 1500,
    });

    const item1 = bom1.framingItems.find((i) => i.code === "AL-134X3ALUMI");
    assert.ok(item1, "BOM item must exist");
    assert.strictEqual(item1.quantity, 5.4);
    assert.strictEqual(item1.unit, "m");
    assert.strictEqual(item1.unit_price, 300);
    assert.strictEqual(item1.subtotal, 1620.0);

    // Case 2: Changing height to 2000mm -> 1.2m W x 2.0m H
    // Expected Linear Meters: 2 * (1.2 + 2.0) = 6.4m
    const bom2 = calculateParametricBOM(components, {
      widthMm: 1200,
      heightMm: 2000,
    });

    const item2 = bom2.framingItems.find((i) => i.code === "AL-134X3ALUMI");
    assert.ok(item2, "BOM item must exist");
    assert.strictEqual(item2.quantity, 6.4);
    assert.strictEqual(item2.subtotal, 1920.0);
  });

  it("TC95.5: calculateParametricBOM respects spanRatio on PERIMETER driver", () => {
    const rawMaterial = {
      id: "mat-tube-134x3",
      material_code: "AL-134X3ALUMI",
      category: "Aluminum" as const,
      description: "1-3/4\" x 3\" Aluminum Tube",
      unit_price: 300.0,
      billing_unit: "m" as const,
      waste_allowance: 0.0,
      finish_type: "PowderCoatedWhite",
      is_active: true,
    };

    const components = [
      {
        componentKey: "perimeter_frame_half",
        componentName: "Outer Perimeter Tube Half Span",
        dimensionBinding: "PERIMETER" as DimensionBinding,
        spanRatio: 0.5,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Framing" as const,
        rawMaterial,
      },
    ];

    // 1000mm W x 1000mm H -> 2 * (1.0 + 1.0) * 0.5 = 2.0m
    const bom = calculateParametricBOM(components, {
      widthMm: 1000,
      heightMm: 1000,
    });

    const item = bom.framingItems.find((i) => i.code === "AL-134X3ALUMI");
    assert.ok(item);
    assert.strictEqual(item.quantity, 2.0);
    assert.strictEqual(item.subtotal, 600.0);
  });

  it("TC95.6: SQL migration 025_perimeter_dimension_binding.sql exists and specifies constraint", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/025_perimeter_dimension_binding.sql"
    );
    assert.ok(fs.existsSync(migrationPath), "Migration 025 must exist");

    const sql = fs.readFileSync(migrationPath, "utf-8");
    assert.ok(
      sql.includes("CHECK (dimension_binding IN ('WIDTH', 'HEIGHT', 'AREA', 'FIXED', 'GRILLE_LINEAR', 'PERIMETER'))"),
      "SQL migration must update check constraint to include 'PERIMETER'"
    );
  });
});
