import { describe, it } from "node:test";
import assert from "node:assert";
import {
  normalizeAluminumFinish,
  getAlternateAluminumFinish,
  getAluminumVariationTitle,
  ALUMINUM_COLOR_VARIATIONS,
} from "../../src/lib/visualization/colorVariations.js";
import {
  resolveProductStructure,
  normalizeComponentKey,
} from "../../src/lib/visualization/structuralResolver.js";
import type { ProductStructuralDefinition } from "../../src/lib/visualization/types.js";

describe("Visualization Domain: Color Variations & Structural Resolver", () => {
  // --------------------------------------------------------------------------
  // 1. Aluminum Color Variations & Finish Normalization
  // --------------------------------------------------------------------------
  describe("Aluminum Finish Variations", () => {
    it("should define white, black, and silver color variations with labels and swatches", () => {
      assert.strictEqual(ALUMINUM_COLOR_VARIATIONS.length, 3);
      const keys = ALUMINUM_COLOR_VARIATIONS.map((v) => v.key);
      assert.deepStrictEqual(keys, ["white", "black", "silver"]);
    });

    it("should normalize recognized finishes and default unknown values to white", () => {
      assert.strictEqual(normalizeAluminumFinish("white"), "white");
      assert.strictEqual(normalizeAluminumFinish("black"), "black");
      assert.strictEqual(normalizeAluminumFinish("silver"), "silver");

      assert.strictEqual(normalizeAluminumFinish(null), "white");
      assert.strictEqual(normalizeAluminumFinish(undefined), "white");
      assert.strictEqual(normalizeAluminumFinish("gold"), "white");
    });

    it("should return alternate finishes for toggle actions", () => {
      const altFromWhite = getAlternateAluminumFinish("white");
      assert.notStrictEqual(altFromWhite, "white");
    });

    it("should return proper variation titles", () => {
      assert.strictEqual(getAluminumVariationTitle("white"), "White Aluminum");
      assert.strictEqual(getAluminumVariationTitle("black"), "Black Aluminum");
      assert.strictEqual(getAluminumVariationTitle("silver"), "Silver Aluminum");
      assert.strictEqual(getAluminumVariationTitle("unknown"), "White Aluminum");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Component Key Normalization
  // --------------------------------------------------------------------------
  describe("normalizeComponentKey", () => {
    it("should lowercase, trim, and replace underscores with hyphens", () => {
      assert.strictEqual(normalizeComponentKey("frame_head"), "frame-head");
      assert.strictEqual(normalizeComponentKey("  Sash_Rail_Top  "), "sash-rail-top");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Structural Resolver Logic
  // --------------------------------------------------------------------------
  describe("Structural Resolver: resolveProductStructure", () => {
    const mockDefinition: ProductStructuralDefinition = {
      product: {
        productId: "mock-prod-1",
        productName: "Test Window",
        productType: "Window",
        description: "Test description",
        catalogImageUrl: null,
      },
      template: {
        templateId: "mock-temp-1",
        templateName: "Window Template",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {
          hasSill: true,
        },
      },
      parameters: [
        {
          parameterId: "param-w",
          parameterKey: "widthMm",
          parameterName: "Width",
          parameterType: "Number",
          defaultValue: 1200,
          minimumValue: 600,
          maximumValue: 3000,
          stepValue: 10,
          unit: "mm",
          affectsStructure: true,
          displayOrder: 1,
        },
        {
          parameterId: "param-h",
          parameterKey: "heightMm",
          parameterName: "Height",
          parameterType: "Number",
          defaultValue: 1200,
          minimumValue: 400,
          maximumValue: 2400,
          stepValue: 10,
          unit: "mm",
          affectsStructure: true,
          displayOrder: 2,
        },
      ],
      components: [
        {
          componentId: "comp-head",
          componentKey: "frame_head",
          componentName: "Head",
          componentType: "Frame",
          baseQuantity: 1,
          componentData: {},
          model: {
            assetId: "asset-1",
            r2ObjectKey: "key-1",
            url: "http://example.com/head.glb",
            fileName: "head.glb",
            sourceDimensionsMm: null,
          },
        },
        {
          componentId: "comp-sill",
          componentKey: "frame_sill",
          componentName: "Sill",
          componentType: "Frame",
          baseQuantity: 1,
          componentData: {},
          model: {
            assetId: "asset-2",
            r2ObjectKey: "key-2",
            url: "http://example.com/sill.glb",
            fileName: "sill.glb",
            sourceDimensionsMm: null,
          },
        },
      ],
      rules: [
        {
          ruleId: "rule-width-panels",
          ruleName: "Wide Span Panels",
          priority: 1,
          conditionData: {
            parameter: "widthMm",
            operator: ">=",
            value: 2400,
          },
          actionData: {
            set: {
              panelCount: 3,
            },
          },
        },
      ],
    };

    it("should resolve default parameters and clamp within min/max bounds", () => {
      const resolved = resolveProductStructure({
        definition: mockDefinition,
        values: {
          widthMm: 5000, // Exceeds max (3000)
          heightMm: 200,  // Subceeds min (400)
        },
      });

      assert.strictEqual(resolved.resolvedValues.widthMm, 3000);
      assert.strictEqual(resolved.resolvedValues.heightMm, 400);
      assert.strictEqual(resolved.resolvedValues.hasSill, true);
    });

    it("should trigger conditional rule actions when thresholds are crossed", () => {
      // Normal width: rule not triggered
      const normalResolved = resolveProductStructure({
        definition: mockDefinition,
        values: { widthMm: 1800 },
      });
      assert.strictEqual(normalResolved.resolvedValues.panelCount, undefined);

      // Width >= 2400: rule triggers setting panelCount = 3
      const wideResolved = resolveProductStructure({
        definition: mockDefinition,
        values: { widthMm: 2600 },
      });
      assert.strictEqual(wideResolved.resolvedValues.panelCount, 3);
      assert.ok(wideResolved.appliedRuleIds.includes("rule-width-panels"));
    });

    it("should compute component quantities and numeric values in millimeters", () => {
      const resolved = resolveProductStructure({
        definition: mockDefinition,
        values: { widthMm: 1500, heightMm: 1200 },
      });

      assert.strictEqual(resolved.numericValuesMm.widthMm, 1500);
      assert.strictEqual(resolved.numericValuesMm.heightMm, 1200);
      assert.strictEqual(resolved.componentQuantities["frame-head"], 1);
      assert.strictEqual(resolved.componentQuantities["frame-sill"], 1);
    });
  });
});
