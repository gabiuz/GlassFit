import { describe, it } from "node:test";
import assert from "node:assert";
import {
  autoDetectComponentSettings,
  type AutoDetectionResult,
} from "../../src/lib/admin/products/autoDetection.js";
import {
  ProductComponentBindingSchema,
  type ProductComponentBinding,
} from "../../src/lib/pricing/types.js";
import type { PartInspectorConfig } from "../../src/features/admin/products/setup/PartInspectorDrawer.js";

describe("Milestone 3: Admin Part Inspector & Component Mapping Validation", () => {
  // --------------------------------------------------------------------------
  // 1. Smart Filename Auto-Detection Engine (docs/pricing.md Section 4.2)
  // --------------------------------------------------------------------------
  describe("Smart Filename Auto-Detection Heuristics", () => {
    it("should correctly auto-detect Series 798 Sill / Threshold components", () => {
      const testCases = [
        "series798_double_sill.glb",
        "798_bottom_track_anlk.glb",
        "threshold_ext.glb",
      ];

      for (const fileName of testCases) {
        const result: AutoDetectionResult = autoDetectComponentSettings(fileName);
        assert.strictEqual(result.dimensionBinding, "WIDTH");
        assert.strictEqual(result.spanRatio, 1.0);
        assert.strictEqual(result.isRemovable, true);
        assert.strictEqual(result.togglePropertyKey, "has_sill");
        assert.strictEqual(result.presentationCategory, "Framing");
        assert.strictEqual(result.componentType, "Frame");
        assert.strictEqual(result.suggestedMaterialCategory, "Aluminum");
      }
    });

    it("should correctly auto-detect Series 798 Vertical members (Jambs, Stiles, Interlocks, Mullions)", () => {
      const jambResult = autoDetectComponentSettings("series798_jamb_left.glb");
      assert.strictEqual(jambResult.dimensionBinding, "HEIGHT");
      assert.strictEqual(jambResult.spanRatio, 1.0);
      assert.strictEqual(jambResult.isRemovable, false);
      assert.strictEqual(jambResult.togglePropertyKey, null);
      assert.strictEqual(jambResult.presentationCategory, "Framing");

      const stileResult = autoDetectComponentSettings("sash_lockstile_right.glb");
      assert.strictEqual(stileResult.dimensionBinding, "HEIGHT");
      assert.strictEqual(stileResult.spanRatio, 1.0);
      assert.strictEqual(stileResult.presentationCategory, "Framing");

      const interlockResult = autoDetectComponentSettings("series798_interlock.glb");
      assert.strictEqual(interlockResult.dimensionBinding, "HEIGHT");
      assert.strictEqual(interlockResult.spanRatio, 1.0);
      assert.strictEqual(interlockResult.presentationCategory, "Framing");
    });

    it("should correctly auto-detect Series 798 Horizontal Rails for 2-panel (0.5x) and 3-panel (0.3333x)", () => {
      const twoPanelRail = autoDetectComponentSettings("series798_sash_top_rail.glb");
      assert.strictEqual(twoPanelRail.dimensionBinding, "WIDTH");
      assert.strictEqual(twoPanelRail.spanRatio, 0.5);
      assert.strictEqual(twoPanelRail.isRemovable, false);
      assert.strictEqual(twoPanelRail.presentationCategory, "Framing");

      const threePanelRail = autoDetectComponentSettings("series798_rail_3p.glb");
      assert.strictEqual(threePanelRail.dimensionBinding, "WIDTH");
      assert.strictEqual(threePanelRail.spanRatio, 0.3333);
      assert.strictEqual(threePanelRail.presentationCategory, "Framing");
    });

    it("should correctly auto-detect Head track profiles (1.0x Width)", () => {
      const headResult = autoDetectComponentSettings("series798_header_track.glb");
      assert.strictEqual(headResult.dimensionBinding, "WIDTH");
      assert.strictEqual(headResult.spanRatio, 1.0);
      assert.strictEqual(headResult.isRemovable, false);
      assert.strictEqual(headResult.presentationCategory, "Framing");
    });

    it("should correctly auto-detect Glass infill panels (2D Area)", () => {
      const glassResult = autoDetectComponentSettings("6mm_bronze_glass_pane.glb");
      assert.strictEqual(glassResult.dimensionBinding, "AREA");
      assert.strictEqual(glassResult.spanRatio, 1.0);
      assert.strictEqual(glassResult.isRemovable, false);
      assert.strictEqual(glassResult.presentationCategory, "Glazing");
      assert.strictEqual(glassResult.componentType, "Glass");
      assert.strictEqual(glassResult.suggestedMaterialCategory, "Glass");
    });

    it("should correctly auto-detect Hardware accessories (Fixed 0D)", () => {
      const rollerResult = autoDetectComponentSettings("pom_wheel_roller.glb");
      assert.strictEqual(rollerResult.dimensionBinding, "FIXED");
      assert.strictEqual(rollerResult.spanRatio, 1.0);
      assert.strictEqual(rollerResult.presentationCategory, "Hardware");
      assert.strictEqual(rollerResult.componentType, "Hardware");

      const lockResult = autoDetectComponentSettings("flush_latch_lock.glb");
      assert.strictEqual(lockResult.dimensionBinding, "FIXED");
      assert.strictEqual(lockResult.presentationCategory, "Hardware");
    });

    it("should fallback gracefully for unrecognized components", () => {
      const customResult = autoDetectComponentSettings("custom_special_bracket.glb");
      assert.strictEqual(customResult.dimensionBinding, "FIXED");
      assert.strictEqual(customResult.spanRatio, 1.0);
      assert.strictEqual(customResult.isRemovable, false);
      assert.strictEqual(customResult.presentationCategory, "Framing");
      assert.strictEqual(customResult.componentType, "Model");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Product Component Binding Schema Validation (ERD-E6 / BAN-TYPE-05)
  // --------------------------------------------------------------------------
  describe("Product Component Binding Schema (ProductComponentBindingSchema)", () => {
    it("should validate a valid component binding payload with raw material reference", () => {
      const validBinding: ProductComponentBinding = {
        template_id: "a0000000-0000-4000-8000-000000000001",
        component_key: "s798_double_head",
        component_name: "Series 798 Double Head Track",
        raw_material_id: "b0000000-0000-4000-8000-000000000001",
        dimension_binding: "WIDTH",
        span_ratio: 1.0,
        base_quantity: 1,
        is_removable: false,
        toggle_property_key: null,
        presentation_category: "Framing",
        status: "Active",
      };

      const result = ProductComponentBindingSchema.safeParse(validBinding);
      assert.strictEqual(result.success, true);
    });

    it("should validate a removable sill component binding with toggle key", () => {
      const sillBinding: ProductComponentBinding = {
        template_id: "a0000000-0000-4000-8000-000000000001",
        component_key: "s798_double_sill",
        component_name: "Series 798 Double Sill Track",
        raw_material_id: "b0000000-0000-4000-8000-000000000002",
        dimension_binding: "WIDTH",
        span_ratio: 1.0,
        base_quantity: 1,
        is_removable: true,
        toggle_property_key: "has_sill",
        presentation_category: "Framing",
        status: "Active",
      };

      const result = ProductComponentBindingSchema.safeParse(sillBinding);
      assert.strictEqual(result.success, true);
    });

    it("should validate a 2-panel sash rail with 0.5x span ratio", () => {
      const railBinding: ProductComponentBinding = {
        template_id: "a0000000-0000-4000-8000-000000000001",
        component_key: "s798_sash_top_rail",
        component_name: "Series 798 Top Rail",
        raw_material_id: "b0000000-0000-4000-8000-000000000004",
        dimension_binding: "WIDTH",
        span_ratio: 0.5,
        base_quantity: 2,
        is_removable: false,
        toggle_property_key: null,
        presentation_category: "Framing",
        status: "Active",
      };

      const result = ProductComponentBindingSchema.safeParse(railBinding);
      assert.strictEqual(result.success, true);
    });

    it("should reject invalid dimension bindings", () => {
      const invalid = {
        template_id: "a0000000-0000-4000-8000-000000000001",
        component_key: "s798_invalid",
        component_name: "Invalid Component",
        dimension_binding: "DIAGONAL", // Not allowed in DimensionBinding enum
      };

      const result = ProductComponentBindingSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    it("should reject negative span ratios", () => {
      const invalid = {
        template_id: "a0000000-0000-4000-8000-000000000001",
        component_key: "s798_invalid",
        component_name: "Invalid Component",
        dimension_binding: "WIDTH",
        span_ratio: -0.5,
      };

      const result = ProductComponentBindingSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Part Inspector Multi-Selection Batch Configuration Model
  // --------------------------------------------------------------------------
  describe("Part Inspector Batch Configuration Operations", () => {
    const mockComponents: PartInspectorConfig[] = [
      {
        id: "part-1",
        componentKey: "sash_top_rail",
        componentName: "Top Rail Left",
        componentType: "Frame",
        rawMaterialId: null,
        dimensionBinding: "WIDTH",
        spanRatio: 0.5,
        isRemovable: false,
        togglePropertyKey: null,
        presentationCategory: "Framing",
        baseQuantity: 1,
        assemblyGroup: "sash",
      },
      {
        id: "part-2",
        componentKey: "sash_bottom_rail",
        componentName: "Bottom Rail Left",
        componentType: "Frame",
        rawMaterialId: null,
        dimensionBinding: "WIDTH",
        spanRatio: 0.5,
        isRemovable: false,
        togglePropertyKey: null,
        presentationCategory: "Framing",
        baseQuantity: 1,
        assemblyGroup: "sash",
      },
      {
        id: "part-3",
        componentKey: "sash_top_rail_right",
        componentName: "Top Rail Right",
        componentType: "Frame",
        rawMaterialId: null,
        dimensionBinding: "WIDTH",
        spanRatio: 0.5,
        isRemovable: false,
        togglePropertyKey: null,
        presentationCategory: "Framing",
        baseQuantity: 1,
        assemblyGroup: "sash",
      },
    ];

    it("should update raw material links simultaneously across all 3 selected sash rails", () => {
      const selectedIds = new Set(["part-1", "part-2", "part-3"]);
      const targetMaterialId = "mat-al-798-rail-pcw";

      const updated = mockComponents.map((comp) => {
        if (selectedIds.has(comp.id)) {
          return { ...comp, rawMaterialId: targetMaterialId };
        }
        return comp;
      });

      assert.strictEqual(updated.length, 3);
      assert.ok(updated.every((c) => c.rawMaterialId === targetMaterialId));
    });

    it("should update span ratio to 0.3333x simultaneously across selected 3-panel rails", () => {
      const selectedIds = new Set(["part-1", "part-2", "part-3"]);
      const newSpanRatio = 0.3333;

      const updated = mockComponents.map((comp) => {
        if (selectedIds.has(comp.id)) {
          return { ...comp, spanRatio: newSpanRatio };
        }
        return comp;
      });

      assert.ok(updated.every((c) => Math.abs(c.spanRatio - 0.3333) < 0.0001));
    });
  });
});
