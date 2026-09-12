import { describe, it } from "node:test";
import assert from "node:assert";
import {
  resolveRendererKey,
  mapDatabaseProductToCatalog,
} from "../../src/lib/products/productRendererAdapter.js";
import {
  ProductComponentBindingSchema,
  StructuralRulePayloadSchema,
} from "../../src/lib/pricing/types.js";
import type { DatabaseProduct } from "../../src/lib/products/types.js";

describe("Products Domain: Adapters, Renderers & Relational Bindings", () => {
  // --------------------------------------------------------------------------
  // 1. resolveRendererKey
  // --------------------------------------------------------------------------
  describe("resolveRendererKey", () => {
    it("should correctly resolve supported renderer strategies", () => {
      assert.strictEqual(resolveRendererKey("Window"), "window");
      assert.strictEqual(resolveRendererKey("Cabinet"), "cabinet");
    });

    it("should return null for currently unsupported or custom product types", () => {
      assert.strictEqual(resolveRendererKey("Partition"), null);
      assert.strictEqual(resolveRendererKey("Door"), null);
      assert.strictEqual(resolveRendererKey("Other"), null);
    });
  });

  // --------------------------------------------------------------------------
  // 2. mapDatabaseProductToCatalog
  // --------------------------------------------------------------------------
  describe("mapDatabaseProductToCatalog", () => {
    it("should map a raw database product row into UI-ready catalog format", () => {
      const dbProduct: DatabaseProduct = {
        product_id: "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6a",
        product_name: "Series 798 2-Panel Sliding Window",
        product_type: "Window",
        description: "Heavy duty residential aluminum sliding window",
        base_price: 4362.93,
        catalog_image_r2_key: "products/series798.webp",
        status: "Active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const catalogItem = mapDatabaseProductToCatalog(dbProduct);
      assert.strictEqual(catalogItem.id, "7b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6a");
      assert.strictEqual(catalogItem.name, "Series 798 2-Panel Sliding Window");
      assert.strictEqual(catalogItem.type, "Window");
      assert.strictEqual(catalogItem.rendererKey, "window");
      assert.strictEqual(catalogItem.basePrice, 4362.93);
      // In test environment without NEXT_PUBLIC_R2_ASSET_BASE_URL, getR2AssetUrl returns null safely
      assert.strictEqual(catalogItem.imageUrl, null);
    });
  });

  // --------------------------------------------------------------------------
  // 3. ProductComponentBindingSchema
  // --------------------------------------------------------------------------
  describe("ProductComponentBindingSchema Validation", () => {
    it("should validate a valid component with width dimension binding and span ratio", () => {
      const validComponent = {
        component_id: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6b",
        template_id: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6c",
        component_key: "frame_head",
        component_name: "Head Track",
        dimension_binding: "WIDTH" as const,
        span_ratio: 1.0,
        base_quantity: 1,
        is_removable: false,
        presentation_category: "Framing" as const,
      };

      const parsed = ProductComponentBindingSchema.safeParse(validComponent);
      assert.strictEqual(parsed.success, true);
    });

    it("should reject invalid dimension bindings outside domain", () => {
      const invalid = {
        component_id: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6b",
        template_id: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6c",
        component_key: "frame_head",
        component_name: "Head Track",
        dimension_binding: "VOLUME", // Invalid
        span_ratio: 1.0,
        base_quantity: 1,
        is_removable: false,
        presentation_category: "Framing",
      };

      const parsed = ProductComponentBindingSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. StructuralRulePayloadSchema
  // --------------------------------------------------------------------------
  describe("StructuralRulePayloadSchema Validation", () => {
    it("should validate a Behavior B 2400mm width trigger rule payload", () => {
      const rulePayload = {
        rule_name: "2400mm Width Structural Limit",
        trigger_condition: {
          parameter: "widthMm",
          operator: ">=" as const,
          value_mm: 2400,
        },
        action_payload: {
          enforce_panel_count: 3,
          ui_prompt: "PROMPT_MODAL_BEHAVIOR_B" as const,
          mutations: [
            { target_component_key: "frame_rail", update_span_ratio: 0.3333, update_base_quantity: 6 },
            { target_component_key: "frame_stile", update_base_quantity: 6 },
          ],
        },
      };

      const parsed = StructuralRulePayloadSchema.safeParse(rulePayload);
      assert.strictEqual(parsed.success, true);
    });
  });
});
