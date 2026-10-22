/**
 * Acceptance Tests: Parametric Procedural 3D Add-on Generation & Pattern Repetition Engine (QAD-TC83)
 *
 * Upstream Specifications: docs/implementation/ms68.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F2, PRD-F5, PRD-F6, SDD-C4, SDD-C5, SDD-C9, DSD-UI4, DSD-UI10, QAD-TC83.1 through QAD-TC83.8
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import {
  buildParametricScreenGroup,
  buildParametricGrillGroup,
  computeGrillPattern,
} from "../../src/lib/visualization/addonGeometryBuilder.js";
import { createMaterialPalette } from "../../src/lib/visualization/materialClassifier.js";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder.js";
import type {
  ProductStructuralDefinition,
  ResolvedStructure,
} from "../../src/lib/visualization/types.js";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache.js";

function getGroupBoundingBox(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

describe("IMP-MS68 / QAD-TC83: Procedural 3D Add-on Generation & Pattern Repetition", () => {
  // --------------------------------------------------------------------------
  // QAD-TC83.1: Screen frame outer dimensions match host product aperture
  // --------------------------------------------------------------------------
  it("QAD-TC83.1: screen frame outer dimensions strictly match product width and height within 0.1mm", () => {
    const widthMm = 1800;
    const heightMm = 1500;
    const screen = buildParametricScreenGroup(widthMm, heightMm);

    const bounds = getGroupBoundingBox(screen);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    const measuredWidthMm = size.x * 1000;
    const measuredHeightMm = size.y * 1000;

    assert.ok(
      Math.abs(measuredWidthMm - widthMm) <= 0.1,
      `Screen width ${measuredWidthMm}mm should match ${widthMm}mm within 0.1mm tolerance`,
    );
    assert.ok(
      Math.abs(measuredHeightMm - heightMm) <= 0.1,
      `Screen height ${measuredHeightMm}mm should match ${heightMm}mm within 0.1mm tolerance`,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC83.2: Screen mesh completely fills frame aperture
  // --------------------------------------------------------------------------
  it("QAD-TC83.2: screen mesh plane completely spans interior frame opening without gaps or overlap", () => {
    const widthMm = 1800;
    const heightMm = 1500;
    const frameWidthMm = 25;
    const screen = buildParametricScreenGroup(widthMm, heightMm, { frameWidthMm });

    const meshPlane = screen.getObjectByName("Screen_Mesh_Infill") as THREE.Mesh | undefined;
    assert.ok(meshPlane, "Screen group must contain Screen_Mesh_Infill mesh");

    const planeGeo = meshPlane.geometry as THREE.PlaneGeometry;
    const expectedInnerWidthM = (widthMm - 2 * frameWidthMm) / 1000;
    const expectedInnerHeightM = (heightMm - 2 * frameWidthMm) / 1000;

    const geoWidth = planeGeo.parameters.width;
    const geoHeight = planeGeo.parameters.height;

    assert.ok(
      Math.abs(geoWidth - expectedInnerWidthM) < 0.0001,
      `Mesh width ${geoWidth}m should match inner aperture ${expectedInnerWidthM}m`,
    );
    assert.ok(
      Math.abs(geoHeight - expectedInnerHeightM) < 0.0001,
      `Mesh height ${geoHeight}m should match inner aperture ${expectedInnerHeightM}m`,
    );
    assert.strictEqual(meshPlane.userData.preserveMaterial, true);
    assert.strictEqual(meshPlane.userData.isScreenMesh, true);
  });

  // --------------------------------------------------------------------------
  // QAD-TC83.3: Grill bar cross-section remains constant during dimensional scaling
  // --------------------------------------------------------------------------
  it("QAD-TC83.3: grill bar cross-section remains constant at 14mm while bar count increases from 900mm to 2400mm", () => {
    const targetBarWidthMm = 14;
    const grill900 = buildParametricGrillGroup(900, 1200, {
      grillBarWidthMm: targetBarWidthMm,
      nominalBarPitchMm: 140,
    });
    const grill2400 = buildParametricGrillGroup(2400, 1200, {
      grillBarWidthMm: targetBarWidthMm,
      nominalBarPitchMm: 140,
    });

    const vBar900 = grill900.getObjectByName("Grill_Bar_V_1") as THREE.Mesh | undefined;
    const vBar2400 = grill2400.getObjectByName("Grill_Bar_V_1") as THREE.Mesh | undefined;

    assert.ok(vBar900, "Grill 900mm should contain vertical bar V_1");
    assert.ok(vBar2400, "Grill 2400mm should contain vertical bar V_1");

    const geo900 = vBar900.geometry as THREE.BoxGeometry;
    const geo2400 = vBar2400.geometry as THREE.BoxGeometry;

    const barWidthM = targetBarWidthMm / 1000;
    assert.strictEqual(geo900.parameters.width, barWidthM);
    assert.strictEqual(geo900.parameters.depth, barWidthM);
    assert.strictEqual(geo2400.parameters.width, barWidthM);
    assert.strictEqual(geo2400.parameters.depth, barWidthM);

    const count900 = grill900.userData.verticalBarCount as number;
    const count2400 = grill2400.userData.verticalBarCount as number;

    assert.strictEqual(count900, 6, "900mm width should yield 6 vertical picket bars");
    assert.ok(
      count2400 >= 16 && count2400 <= 17,
      `2400mm width should yield 16 to 17 vertical bars (got ${count2400})`,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC83.4: Uniform grill bar pitch during scaling across non-standard widths
  // --------------------------------------------------------------------------
  it("QAD-TC83.4: computes uniform grill pitch between 120mm and 150mm across arbitrary dimensions", () => {
    const testWidths = [900, 950, 1150, 1420, 1720, 2150, 2400, 2750];

    for (const w of testWidths) {
      const pattern = computeGrillPattern(w, 1200, { nominalBarPitchMm: 140 });
      assert.ok(
        pattern.actualPitchMm >= 120 && pattern.actualPitchMm <= 150,
        `Width ${w}mm actual pitch ${pattern.actualPitchMm.toFixed(1)}mm should stay between 120mm and 150mm`,
      );
      assert.ok(
        pattern.verticalBarCount >= 1,
        `Width ${w}mm should produce at least 1 bar`,
      );
    }
  });

  // --------------------------------------------------------------------------
  // QAD-TC83.5: Deterministic front-layer Z-offset
  // --------------------------------------------------------------------------
  it("QAD-TC83.5: enforces deterministic front-layer Z-offsets (+18mm for screen, +22mm for grill)", () => {
    const screen = buildParametricScreenGroup(1200, 1200);
    const grill = buildParametricGrillGroup(1200, 1200);

    const topScreenRail = screen.getObjectByName("Screen_Frame_Top") as THREE.Mesh;
    const meshInfill = screen.getObjectByName("Screen_Mesh_Infill") as THREE.Mesh;
    const topGrillRail = grill.getObjectByName("Grill_Frame_Top") as THREE.Mesh;
    const grillVBar = grill.getObjectByName("Grill_Bar_V_1") as THREE.Mesh;

    assert.ok(Math.abs(topScreenRail.position.z - 0.018) < 1e-5, "Screen top rail Z position should be +18mm (0.018m)");
    assert.ok(Math.abs(meshInfill.position.z - 0.018) < 1e-5, "Screen mesh infill Z position should be +18mm (0.018m)");

    assert.ok(Math.abs(topGrillRail.position.z - 0.022) < 1e-5, "Grill top rail Z position should be +22mm (0.022m)");
    assert.ok(Math.abs(grillVBar.position.z - 0.022) < 1e-5, "Grill bar Z position should be +22mm (0.022m)");
  });

  // --------------------------------------------------------------------------
  // QAD-TC83.6: Sub-16ms geometry recalculation performance
  // --------------------------------------------------------------------------
  it("QAD-TC83.6: recalculates procedural add-on geometry in under 16ms (60 FPS maintaining)", () => {
    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const dynamicWidth = 1000 + i * 20;
      const dynamicHeight = 1000 + (i % 10) * 50;
      buildParametricScreenGroup(dynamicWidth, dynamicHeight);
      buildParametricGrillGroup(dynamicWidth, dynamicHeight);
    }

    const elapsed = performance.now() - start;
    const avgTimePerFrame = elapsed / iterations;

    assert.ok(
      avgTimePerFrame < 16.0,
      `Average add-on generation latency per frame was ${avgTimePerFrame.toFixed(2)}ms (must be < 16.0ms)`,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC83.7: Step 6 sandbox toggle reactivity
  // --------------------------------------------------------------------------
  it("QAD-TC83.7: seamlessly mounts and detaches add-on attachments in buildParametricProduct", () => {
    const dummyDefinition: ProductStructuralDefinition = {
      product: {
        productId: "p-test-window",
        productName: "Test 2-Panel Sliding Window",
        productType: "Window",
      },
      template: {
        templateId: "t-window",
        templateName: "Sliding Window Template",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      parameters: [
        {
          parameterId: "param-w",
          parameterKey: "width",
          parameterName: "Width",
          parameterType: "Number",
          minimumValue: 600,
          maximumValue: 3600,
          defaultValue: 1800,
          stepValue: 10,
          unit: "mm",
          affectsStructure: true,
          displayOrder: 1,
        },
        {
          parameterId: "param-h",
          parameterKey: "height",
          parameterName: "Height",
          parameterType: "Number",
          minimumValue: 600,
          maximumValue: 2400,
          defaultValue: 1500,
          stepValue: 10,
          unit: "mm",
          affectsStructure: true,
          displayOrder: 2,
        },
      ],
      components: [
        {
          componentId: "c-left",
          componentKey: "frame-left",
          componentName: "Left Jamb",
          componentType: "Frame",
          baseQuantity: 1,
          componentData: {},
          model: { assetId: "a-1", r2ObjectKey: "", url: "", fileName: "left.glb", sourceDimensionsMm: { width: 50, height: 1500, depth: 40 } },
        },
        {
          componentId: "c-right",
          componentKey: "frame-right",
          componentName: "Right Jamb",
          componentType: "Frame",
          baseQuantity: 1,
          componentData: {},
          model: { assetId: "a-2", r2ObjectKey: "", url: "", fileName: "right.glb", sourceDimensionsMm: { width: 50, height: 1500, depth: 40 } },
        },
        {
          componentId: "c-top",
          componentKey: "frame-top",
          componentName: "Top Rail",
          componentType: "Frame",
          baseQuantity: 1,
          componentData: {},
          model: { assetId: "a-3", r2ObjectKey: "", url: "", fileName: "top.glb", sourceDimensionsMm: { width: 1800, height: 50, depth: 40 } },
        },
        {
          componentId: "c-bot",
          componentKey: "frame-bottom",
          componentName: "Bottom Rail",
          componentType: "Frame",
          baseQuantity: 1,
          componentData: {},
          model: { assetId: "a-4", r2ObjectKey: "", url: "", fileName: "bottom.glb", sourceDimensionsMm: { width: 1800, height: 50, depth: 40 } },
        },
        {
          componentId: "c-glass",
          componentKey: "glass-panel",
          componentName: "Glass Panel",
          componentType: "Glass",
          baseQuantity: 1,
          componentData: {},
          model: { assetId: "a-5", r2ObjectKey: "", url: "", fileName: "glass.glb", sourceDimensionsMm: { width: 1700, height: 1400, depth: 6 } },
        },
      ],
      rules: [],
    };

    const resolved: ResolvedStructure = {
      resolvedValues: { width: 1800, height: 1500 },
      numericValuesMm: { width: 1800, height: 1500 },
      componentQuantities: { "glass-panel": 1 },
      appliedRuleIds: [],
    };

    const cache: ComponentModelCache = {
      getClone: () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)),
      getSourceSizeMeters: () => new THREE.Vector3(0.1, 0.1, 0.1),
    };

    // 1. None toggle
    const builtNone = buildParametricProduct(dummyDefinition, resolved, cache, {
      activeAddon: "none",
    });
    assert.strictEqual(builtNone.group.getObjectByName("Addon_Screen_Assembly"), undefined);
    assert.strictEqual(builtNone.group.getObjectByName("Addon_Grill_Assembly"), undefined);

    // 2. Screen toggle
    const builtScreen = buildParametricProduct(dummyDefinition, resolved, cache, {
      activeAddon: "screen",
    });
    const screenNode = builtScreen.group.getObjectByName("Addon_Screen_Assembly");
    assert.ok(screenNode, "Screen assembly must be attached when activeAddon is screen");
    assert.strictEqual(builtScreen.group.getObjectByName("Addon_Grill_Assembly"), undefined);

    // 3. Grill toggle
    const builtGrill = buildParametricProduct(dummyDefinition, resolved, cache, {
      activeAddon: "grill",
    });
    const grillNode = builtGrill.group.getObjectByName("Addon_Grill_Assembly");
    assert.ok(grillNode, "Grill assembly must be attached when activeAddon is grill");
    assert.strictEqual(builtGrill.group.getObjectByName("Addon_Screen_Assembly"), undefined);
  });

  // --------------------------------------------------------------------------
  // QAD-TC83.8: Aluminum finish synchronization
  // --------------------------------------------------------------------------
  it("QAD-TC83.8: synchronizes add-on frame and bar materials with the window aluminum finish", () => {
    const paletteWhite = createMaterialPalette("white");
    const screenWhite = buildParametricScreenGroup(1200, 1200, {}, paletteWhite.framing);
    const grillWhite = buildParametricGrillGroup(1200, 1200, {}, paletteWhite.framing);

    const screenTopRail = screenWhite.getObjectByName("Screen_Frame_Top") as THREE.Mesh;
    const grillTopRail = grillWhite.getObjectByName("Grill_Frame_Top") as THREE.Mesh;
    const grillBar = grillWhite.getObjectByName("Grill_Bar_V_1") as THREE.Mesh;

    const screenMat = screenTopRail.material as THREE.MeshPhysicalMaterial;
    const grillMat = grillTopRail.material as THREE.MeshPhysicalMaterial;
    const barMat = grillBar.material as THREE.MeshPhysicalMaterial;

    const expectedHex = paletteWhite.framing.color.getHexString().toLowerCase();
    assert.strictEqual(screenMat.color.getHexString().toLowerCase(), expectedHex);
    assert.strictEqual(grillMat.color.getHexString().toLowerCase(), expectedHex);
    assert.strictEqual(barMat.color.getHexString().toLowerCase(), expectedHex);
  });
});
