/** IMP-MS09 unit coverage. Traceability: PRD-F1, PRD-F2, PRD-F7, QAD-TC2, QAD-TC7. */
import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import {
  ALUMINUM_FINISH_OPTIONS,
  DEFAULT_PRODUCT_PREVIEW_CONFIGURATION,
  GLASS_COLOR_OPTIONS,
  GLASS_THICKNESS_OPTIONS,
  GLASS_TYPE_OPTIONS,
  findFinishOption,
  findGlassColorOption,
  findGlassThicknessOption,
  findGlassTypeOption,
  mapGlassTypeToAppearanceMode,
} from "../../src/lib/products/materialMapping.js";
import {
  calculateModelTransform,
  calculatePreviewLayoutPositions,
  getPreviewOverflowLabel,
  getVisiblePreviewModelCount,
  normalizeProductQuantity,
  validateDimensionPair,
} from "../../src/lib/products/productPreviewConfiguration.js";
import { applyPresentationMaterials, createMaterialPalette } from "../../src/lib/visualization/materialClassifier.js";

describe("IMP-MS09 product preview configuration", () => {
  it("defines the complete R.R.D. option catalog and classifications", () => {
    assert.strictEqual(DEFAULT_PRODUCT_PREVIEW_CONFIGURATION.aluminumFinish, "white");
    assert.strictEqual(ALUMINUM_FINISH_OPTIONS.length, 24);
    assert.strictEqual(GLASS_TYPE_OPTIONS.length, 5);
    assert.strictEqual(GLASS_COLOR_OPTIONS.length, 4);
    assert.deepStrictEqual(GLASS_THICKNESS_OPTIONS.map((option) => option.value), [6, 8, 12]);
    assert.strictEqual(findGlassThicknessOption(3), null);
    assert.deepStrictEqual(
      ALUMINUM_FINISH_OPTIONS.filter((option) => option.pricingClass === "Standard").map((option) => option.id),
      ["white", "analok"],
    );
    assert.deepStrictEqual(
      GLASS_TYPE_OPTIONS.filter((option) => option.pricingClass === "Premium").map((option) => option.id),
      ["tempered", "reflective"],
    );
    assert.deepStrictEqual(
      GLASS_COLOR_OPTIONS.filter((option) => option.pricingClass === "Premium").map((option) => option.id),
      ["silver", "blue"],
    );
  });

  it("resolves every catalog ID and rejects unknown runtime IDs", () => {
    ALUMINUM_FINISH_OPTIONS.forEach((option) => assert.strictEqual(findFinishOption(option.id)?.id, option.id));
    assert.strictEqual(findFinishOption("unknown"), null);
    assert.strictEqual(findGlassTypeOption("unknown"), null);
    assert.strictEqual(findGlassColorOption("unknown"), null);
    assert.throws(() => createMaterialPalette({
      aluminumFinish: "unknown" as "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    }), /Unknown aluminum finish/);
  });

  it("maps every glass type to its optical appearance", () => {
    assert.strictEqual(mapGlassTypeToAppearanceMode("regular"), "clear");
    assert.strictEqual(mapGlassTypeToAppearanceMode("frosted"), "frosted");
    assert.strictEqual(mapGlassTypeToAppearanceMode("mirror"), "reflective");
    assert.strictEqual(mapGlassTypeToAppearanceMode("tempered"), "clear");
    assert.strictEqual(mapGlassTypeToAppearanceMode("reflective"), "reflective");
  });

  it("validates dimension pairs and calculates landscape and portrait transforms", () => {
    assert.deepStrictEqual(validateDimensionPair("", ""), { status: "empty" });
    assert.strictEqual(validateDimensionPair("100", "").status, "invalid");
    assert.strictEqual(validateDimensionPair("1000", "10").status, "invalid");
    const landscape = calculateModelTransform({ x: 1, y: 1, z: 0.1 }, { x: 0, y: 0, z: 0 }, { widthCm: 200, heightCm: 100 });
    const portrait = calculateModelTransform({ x: 1, y: 1, z: 0.1 }, { x: 0, y: 0, z: 0 }, { widthCm: 100, heightCm: 200 });
    assert.ok(landscape);
    assert.ok(portrait);
    assert.strictEqual(landscape.scale.x / landscape.scale.y, 2);
    assert.strictEqual(portrait.scale.x / portrait.scale.y, 0.5);
    const source = calculateModelTransform({ x: 4, y: 2, z: 1 }, { x: 2, y: 1, z: 0.5 });
    assert.deepStrictEqual(source?.scale, { x: 0.5, y: 0.5, z: 0.5 });
    assert.strictEqual(calculateModelTransform({ x: 0, y: 2, z: 1 }, { x: 0, y: 0, z: 0 }), null);
  });

  it("normalizes quantity, centers layouts, caps instances, and reports overflow", () => {
    assert.strictEqual(normalizeProductQuantity(""), 1);
    assert.strictEqual(normalizeProductQuantity(3.9), 3);
    assert.strictEqual(normalizeProductQuantity(-4), 1);
    assert.strictEqual(normalizeProductQuantity(Infinity), 1);
    assert.strictEqual(normalizeProductQuantity(5000), 999);
    assert.strictEqual(getVisiblePreviewModelCount(999), 5);
    assert.deepStrictEqual(calculatePreviewLayoutPositions(3, 2), [-2.3, 0, 2.3]);
    assert.strictEqual(getPreviewOverflowLabel(6), "+1 more");
    assert.strictEqual(getPreviewOverflowLabel(999), "+994 more");
  });

  it("isolates aluminum and glass presentation changes", () => {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1));
    frame.name = "aluminum_frame";
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.01));
    glass.name = "glass_panel";
    group.add(frame, glass);
    applyPresentationMaterials(group, {
      aluminumFinish: "al_1005",
      glassAppearance: "reflective",
      glassColor: "blue",
      glassThicknessMm: 12,
    });
    const frameMaterial = frame.material as THREE.MeshPhysicalMaterial;
    const glassMaterial = glass.material as THREE.MeshPhysicalMaterial;
    assert.strictEqual(frameMaterial.color.getHexString().toUpperCase(), "D4AF37");
    assert.strictEqual(frameMaterial.metalness, 0.8);
    assert.strictEqual(glassMaterial.color.getHexString().toUpperCase(), "7FA9C4");
    assert.strictEqual(glassMaterial.thickness, 0.012);
    assert.strictEqual(glassMaterial.attenuationDistance, 1.2);
  });

  it("sets the specified optical thickness and attenuation for every thickness", () => {
    for (const option of GLASS_THICKNESS_OPTIONS) {
      const palette = createMaterialPalette({
        aluminumFinish: "analok",
        glassAppearance: "clear",
        glassColor: "bronze",
        glassThicknessMm: option.value,
      });
      const glass = palette.glassMaterial as THREE.MeshPhysicalMaterial;
      assert.strictEqual(glass.thickness, option.value / 1000);
      assert.strictEqual(glass.attenuationDistance, option.attenuationDistance);
      palette.frameMaterial.dispose();
      palette.glassMaterial.dispose();
      palette.hardwareMaterial.dispose();
    }
  });
});
