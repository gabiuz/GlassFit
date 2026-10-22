/**
 * Unit Tests: Modular Grille Add-on Dynamic Pattern Repetition & Non-Stretching Geometry
 *
 * Upstream Specifications: docs/implementation/ms68.md, docs/implementation/ms70.md
 * Traceability Codes: PRD-F2, PRD-F5, SDD-C4, QAD-TC83.3, QAD-TC85.8
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  buildDynamicGrillPatternGroup,
} from "../../src/lib/visualization/addonGeometryBuilder.js";
import {
  buildGrillAssembly,
  buildParametricProduct,
} from "../../src/lib/visualization/parametricProductBuilder.js";
import type {
  ProductComponentDefinition,
  ProductStructuralDefinition,
  ResolvedStructure,
} from "../../src/lib/visualization/types.js";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache.js";

describe("Grille Dynamic Pattern Repetition & Constant Bar Cross-Sections", () => {
  // --------------------------------------------------------------------------
  // Test 1: Constant 14mm bar cross-section when width and height vary
  // --------------------------------------------------------------------------
  it("preserves constant 14mm bar cross-section without stretching across varied dimensions", () => {
    const dimensions = [
      { w: 0.9, h: 0.9 },
      { w: 1.2, h: 1.2 },
      { w: 1.8, h: 1.5 },
      { w: 2.4, h: 2.1 },
    ];

    for (const { w, h } of dimensions) {
      const group = buildDynamicGrillPatternGroup(w, h, {
        grillBarWidthMm: 14,
        nominalBarPitchMm: 230,
        nominalRowPitchMm: 191,
      });

      // Find first vertical bar
      const vBar = group.getObjectByName("Grill_Bar_V_1") as THREE.Mesh | undefined;
      assert.ok(vBar, `Must contain Grill_Bar_V_1 at ${w}x${h}m`);
      const vGeo = vBar.geometry as THREE.BoxGeometry;
      assert.strictEqual(
        Number(vGeo.parameters.width.toFixed(4)),
        0.014,
        `Vertical bar width must remain exactly 14mm (0.014m) at ${w}m width`,
      );
      assert.strictEqual(
        Number(vGeo.parameters.depth.toFixed(4)),
        0.014,
        `Vertical bar depth must remain exactly 14mm (0.014m) at ${w}m width`,
      );

      // Find first horizontal bar
      let hBar: THREE.Mesh | undefined = undefined;
      group.traverse((child) => {
        if (!hBar && child instanceof THREE.Mesh && child.name.startsWith("Grill_Bar_H_")) {
          hBar = child;
        }
      });
      assert.ok(hBar, `Must contain at least one horizontal tie bar at ${w}x${h}m`);
      const hGeo = (hBar as THREE.Mesh).geometry as THREE.BoxGeometry;
      assert.strictEqual(
        Number(hGeo.parameters.height.toFixed(4)),
        0.014,
        `Horizontal bar height must remain exactly 14mm (0.014m) at ${h}m height`,
      );
      assert.strictEqual(
        Number(hGeo.parameters.depth.toFixed(4)),
        0.014,
        `Horizontal bar depth must remain exactly 14mm (0.014m) at ${h}m height`,
      );
    }
  });

  // --------------------------------------------------------------------------
  // Test 2: Repeating bar pattern count increases when opening expands
  // --------------------------------------------------------------------------
  it("repeats the pattern with increasing bar counts instead of stretching existing bars", () => {
    const group1200 = buildDynamicGrillPatternGroup(1.144, 1.144, {
      grillBarWidthMm: 14,
      nominalBarPitchMm: 230,
      nominalRowPitchMm: 191,
    });
    const group2400 = buildDynamicGrillPatternGroup(2.344, 1.144, {
      grillBarWidthMm: 14,
      nominalBarPitchMm: 230,
      nominalRowPitchMm: 191,
    });
    const groupTall = buildDynamicGrillPatternGroup(1.144, 2.144, {
      grillBarWidthMm: 14,
      nominalBarPitchMm: 230,
      nominalRowPitchMm: 191,
    });

    const vCount1200 = group1200.userData.verticalBarCount as number;
    const vCount2400 = group2400.userData.verticalBarCount as number;
    const hCount1200 = group1200.userData.horizontalBarCount as number;
    const hCountTall = groupTall.userData.horizontalBarCount as number;

    assert.ok(
      vCount2400 > vCount1200,
      `Vertical bar count at 2.344m (${vCount2400}) must exceed 1.144m (${vCount1200})`,
    );
    assert.ok(
      hCountTall > hCount1200,
      `Horizontal tie bar count at 2.144m height (${hCountTall}) must exceed 1.144m (${hCount1200})`,
    );

    // Verify 1200x1200 produces 4 vertical bars and 12 staggered horizontal bars matching Lab_Grill_Middle_Bars.glb
    assert.strictEqual(vCount1200, 4, "1144mm inner width must produce exactly 4 vertical picket bars");
    assert.strictEqual(hCount1200, 12, "1144mm inner height must produce exactly 12 staggered horizontal crossbars");
  });

  // --------------------------------------------------------------------------
  // Test 3: Staggered alternating brick pattern alignment
  // --------------------------------------------------------------------------
  it("places horizontal crossbars in a staggered alternating pattern matching Lab_Grill_Middle_Bars", () => {
    const group = buildDynamicGrillPatternGroup(1.144, 1.144, {
      grillBarWidthMm: 14,
      nominalBarPitchMm: 230,
      nominalRowPitchMm: 191,
    });

    // In 5 columns (c = 0..4):
    // Column 0 should have bars at even levels (2, 4)
    // Column 1 should have bars at odd levels (1, 3, 5)
    // Column 2 should have bars at even levels (2, 4)
    const barC0_L2 = group.getObjectByName("Grill_Bar_H_0_2");
    const barC0_L4 = group.getObjectByName("Grill_Bar_H_0_4");
    const barC0_L1 = group.getObjectByName("Grill_Bar_H_0_1");

    const barC1_L1 = group.getObjectByName("Grill_Bar_H_1_1");
    const barC1_L3 = group.getObjectByName("Grill_Bar_H_1_3");
    const barC1_L5 = group.getObjectByName("Grill_Bar_H_1_5");
    const barC1_L2 = group.getObjectByName("Grill_Bar_H_1_2");

    assert.ok(barC0_L2, "Column 0 must have crossbar at level 2");
    assert.ok(barC0_L4, "Column 0 must have crossbar at level 4");
    assert.strictEqual(barC0_L1, undefined, "Column 0 must NOT have crossbar at level 1 (staggered)");

    assert.ok(barC1_L1, "Column 1 must have crossbar at level 1");
    assert.ok(barC1_L3, "Column 1 must have crossbar at level 3");
    assert.ok(barC1_L5, "Column 1 must have crossbar at level 5");
    assert.strictEqual(barC1_L2, undefined, "Column 1 must NOT have crossbar at level 2 (staggered)");
  });

  // --------------------------------------------------------------------------
  // Test 4: buildGrillAssembly with uploaded Lab_Grill components
  // --------------------------------------------------------------------------
  it("buildGrillAssembly correctly sizes frame rails and repeats middle bars pattern", () => {
    const mockComponents: ProductComponentDefinition[] = [
      {
        componentId: "comp-top",
        componentKey: "lab_grill_frame_top",
        componentName: "Lab Grill Frame Top",
        componentType: "Model",
        baseQuantity: 1,
        componentData: {},
        dimensionBinding: "WIDTH",
        model: { assetId: "a-1", r2ObjectKey: "", url: "", fileName: "", sourceDimensionsMm: null },
      },
      {
        componentId: "comp-bottom",
        componentKey: "lab_grill_frame_bottom",
        componentName: "Lab Grill Frame Bottom",
        componentType: "Model",
        baseQuantity: 1,
        componentData: {},
        dimensionBinding: "WIDTH",
        model: { assetId: "a-2", r2ObjectKey: "", url: "", fileName: "", sourceDimensionsMm: null },
      },
      {
        componentId: "comp-left",
        componentKey: "lab_grill_frame_left",
        componentName: "Lab Grill Frame Left",
        componentType: "Model",
        baseQuantity: 1,
        componentData: {},
        dimensionBinding: "HEIGHT",
        model: { assetId: "a-3", r2ObjectKey: "", url: "", fileName: "", sourceDimensionsMm: null },
      },
      {
        componentId: "comp-right",
        componentKey: "lab_grill_frame_right",
        componentName: "Lab Grill Frame Right",
        componentType: "Model",
        baseQuantity: 1,
        componentData: {},
        dimensionBinding: "HEIGHT",
        model: { assetId: "a-4", r2ObjectKey: "", url: "", fileName: "", sourceDimensionsMm: null },
      },
      {
        componentId: "comp-middle",
        componentKey: "lab_grill_middle_bars",
        componentName: "Lab Grill Middle Bars",
        componentType: "Model",
        baseQuantity: 1,
        componentData: {},
        dimensionBinding: "AREA",
        model: { assetId: "a-5", r2ObjectKey: "", url: "", fileName: "", sourceDimensionsMm: null },
      },
    ];

    const mockCache: ComponentModelCache = {
      getClone: (id: string) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, 1.2, 0.025));
        mesh.name = `Cloned_${id}`;
        return mesh;
      },
      getSourceSizeMeters: (id: string) => {
        if (id.includes("top") || id.includes("bottom")) {
          return new THREE.Vector3(1.144, 0.028, 0.025);
        }
        if (id.includes("left") || id.includes("right")) {
          return new THREE.Vector3(0.028, 1.2, 0.025);
        }
        return new THREE.Vector3(1.144, 1.144, 0.014);
      },
    };

    const targetWidthMm = 1800;
    const targetHeightMm = 1500;

    const grillAssembly = buildGrillAssembly(
      mockComponents,
      targetWidthMm,
      targetHeightMm,
      mockCache,
      { activeAddon: "grill" },
    );

    assert.strictEqual(grillAssembly.name, "Addon_Grill_Assembly");
    assert.strictEqual(grillAssembly.userData.addonType, "grill");

    // Frame left should span full height (1.5m)
    const leftFrame = grillAssembly.getObjectByName("lab_grill_frame_left") as THREE.Group;
    assert.ok(leftFrame, "Must contain lab_grill_frame_left");
    // Scale along Y should match 1500 / 1200 = 1.25
    assert.strictEqual(Number(leftFrame.scale.y.toFixed(2)), 1.25);
    // Scale along X should remain 1 (no profile width distortion)
    assert.strictEqual(leftFrame.scale.x, 1);

    // Frame top should span inner width (1800 - 56 = 1744mm)
    const topFrame = grillAssembly.getObjectByName("lab_grill_frame_top") as THREE.Group;
    assert.ok(topFrame, "Must contain lab_grill_frame_top");
    // Scale along Y should remain 1 (no profile height distortion)
    assert.strictEqual(topFrame.scale.y, 1);

    // Middle bars must exist and have repeating pattern
    const middlePattern = grillAssembly.getObjectByName("lab_grill_middle_bars") as THREE.Group;
    assert.ok(middlePattern, "Must contain lab_grill_middle_bars");
    const vCount = middlePattern.userData.verticalBarCount as number;
    // 1744 / 230 -> 8 columns -> 7 vertical bars
    assert.strictEqual(vCount, 7, "1800mm width must produce 7 repeating vertical bars");
  });

  // --------------------------------------------------------------------------
  // Test 5: Integration in buildParametricProduct for Add-on Product in Admin Validation
  // --------------------------------------------------------------------------
  it("buildParametricProduct builds dynamic grill assembly when isAddon = true", () => {
    const addonDefinition: ProductStructuralDefinition = {
      product: {
        productId: "p-grill-addon",
        productName: "Alternate Grille",
        productType: "Other",
        isAddon: true,
        addonType: "grill",
      },
      template: {
        templateId: "t-grill",
        templateName: "Grille Template",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {
          is_addon: true,
          addon_type: "grill",
        },
      },
      parameters: [],
      rules: [],
      components: [
        {
          componentId: "comp-mid",
          componentKey: "lab_grill_middle_bars",
          componentName: "Lab Grill Middle Bars",
          componentType: "Model",
          baseQuantity: 1,
          componentData: {},
          dimensionBinding: "AREA",
          model: { assetId: "a-mid", r2ObjectKey: "", url: "", fileName: "", sourceDimensionsMm: null },
        },
      ],
    };

    const mockCache: ComponentModelCache = {
      getClone: (_id: string) => new THREE.Mesh(new THREE.BoxGeometry(1.144, 1.144, 0.014)),
      getSourceSizeMeters: () => new THREE.Vector3(1.144, 1.144, 0.014),
    };

    const dummyResolved: ResolvedStructure = {
      resolvedValues: { width: 1800, height: 1500 },
      numericValuesMm: { width: 1800, height: 1500 },
      componentQuantities: {},
      appliedRuleIds: [],
    };

    const built = buildParametricProduct(addonDefinition, dummyResolved, mockCache, {
      addonAluminumFinish: "analok",
    });

    assert.strictEqual(built.group.name, "Addon_Grill_Assembly");
    assert.strictEqual(built.group.userData.addonType, "grill");

    const middlePattern = built.group.getObjectByName("lab_grill_middle_bars");
    assert.ok(middlePattern, "Must contain lab_grill_middle_bars repeating pattern");
  });
});
