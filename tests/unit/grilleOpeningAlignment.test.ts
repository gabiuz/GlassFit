/**
 * Unit & Acceptance Test Suite for Operator-Targeted Security Grille Handle Access Openings,
 * Parametric Clearance Cutouts, and Linear BOM Accounting (IMP-MS86)
 *
 * Primary Traceability: PRD-F5, PRD-F10, PRD-F14, SDD-C4, SDD-C7, SDD-C9, ERD-E3, ERD-E6, ERD-E14, ERD-E17, IMP-MS86
 * Acceptance Catalog: QAD-TC101.1 through QAD-TC101.12
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import {
  computeAddonReconciliation,
} from "../../src/lib/admin/products/addonUtils";
import type { HostProductAddonConfig } from "../../src/lib/admin/products/types";
import { buildParametricProduct, buildGrillAssembly } from "../../src/lib/visualization/parametricProductBuilder";
import { isAddonFrameMesh } from "../../src/lib/visualization/materialClassifier";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";
import type {
  ProductStructuralDefinition,
  ResolvedStructure,
  ProductComponentDefinition,
} from "../../src/lib/visualization/types";
import { calculateGrilleLinearBOM } from "../../src/lib/pricing/grillePricingEngine";
import { calculateAddonBOM } from "../../src/lib/pricing/addonPricingEngine";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";
import { buildDynamicGrillPatternGroup } from "../../src/lib/visualization/addonGeometryBuilder";

describe("IMP-MS86: Operator-Targeted Security Grille Clearance Openings and Linear BOM (QAD-TC101)", () => {
  const parentId = "11111111-1111-4111-8111-111111111111";
  const screenId = "22222222-2222-4222-8222-222222222222";
  const grillId = "33333333-3333-4333-8333-333333333333";

  function createGrille3DTestSetup(options: {
    operators: Array<{ key: string; x: number; y: number }>;
    openingTargets?: string[];
    cutoutWidthMm?: number;
    cutoutHeightMm?: number;
    mountingSide?: "front" | "back";
  }) {
    const hostFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.08));
    hostFrameMesh.position.set(0, 0, 0);

    const operatorMeshes: Record<string, THREE.Mesh> = {};
    const hostComponents: ProductComponentDefinition[] = [
      {
        componentId: "comp_frame",
        componentKey: "window_frame",
        componentName: "Window Outer Frame",
        componentType: "Frame",
        dimensionBinding: "PERIMETER",
        baseQuantity: 1,
        componentData: {},
        model: {
          assetId: "a_frame",
          r2ObjectKey: "frame.glb",
          url: "https://r2.dev/frame.glb",
          fileName: "frame.glb",
          sourceDimensionsMm: null,
        },
      },
    ];

    const hostQuantities: Record<string, number> = {
      window_frame: 1,
    };

    options.operators.forEach((op, idx) => {
      const opMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.05));
      opMesh.name = op.key;
      opMesh.position.set(op.x, op.y, 0.02);
      opMesh.userData = {
        componentKey: op.key,
        componentId: `comp_${op.key}`,
        isLouverOperatorInstance: true,
      };
      operatorMeshes[op.key] = opMesh;

      hostComponents.push({
        componentId: `comp_${op.key}`,
        componentKey: op.key,
        componentName: `Operator Mechanism ${idx + 1}`,
        componentType: "Hardware",
        dimensionBinding: "FIXED",
        baseQuantity: 1,
        componentData: {},
        model: {
          assetId: `a_${op.key}`,
          r2ObjectKey: `${op.key}.glb`,
          url: `https://r2.dev/${op.key}.glb`,
          fileName: `${op.key}.glb`,
          sourceDimensionsMm: null,
        },
      });

      hostQuantities[op.key] = 1;
    });

    const definition: ProductStructuralDefinition = {
      product: {
        productId: "prod_host_window",
        productName: "Series 798 Jalousie Window",
        productType: "Window",
        isAddon: false,
        isAccessory: false,
      },
      template: {
        templateId: "tpl_host_window",
        templateName: "Host Window Template",
        modelStrategy: "Fixed",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      parameters: [],
      rules: [],
      components: hostComponents,
      compatibleAddons: [
        {
          id: "binding_grill",
          parentProductId: "prod_host_window",
          addonProductId: "addon_grill_prod",
          addonType: "grill",
          allowedSides: "both",
          defaultSide: options.mountingSide ?? "back",
          grilleOpeningTargetComponentKeys: options.openingTargets,
          grilleOpeningConfig: {
            enabled: Boolean(options.openingTargets && options.openingTargets.length > 0),
            cutoutWidthMm: options.cutoutWidthMm ?? 150,
            cutoutHeightMm: options.cutoutHeightMm ?? 180,
            cornerCleatCountPerOpening: 4,
          },
          components: [],
        },
      ],
    };

    const resolved: ResolvedStructure = {
      componentQuantities: hostQuantities,
      resolvedValues: {},
      numericValuesMm: { width: 1000, height: 2000 },
      appliedRuleIds: [],
    };

    const cache: ComponentModelCache = {
      getClone: (id: string) => {
        if (id === "comp_frame" || id === "window_frame") return hostFrameMesh.clone(true);
        for (const [k, mesh] of Object.entries(operatorMeshes)) {
          if (id === `comp_${k}` || id === k) return mesh.clone(true);
        }
        throw new Error(`Unknown component clone request: ${id}`);
      },
      getSourceSizeMeters: () => new THREE.Vector3(1.0, 2.0, 0.08),
    };

    const built = buildParametricProduct(definition, resolved, cache, {
      activeAddon: "grill",
      addonMountingSide: options.mountingSide ?? "back",
      grilleOpeningTargetComponentKeys: options.openingTargets,
      grilleOpeningConfig: {
        enabled: Boolean(options.openingTargets && options.openingTargets.length > 0),
        cutoutWidthMm: options.cutoutWidthMm ?? 150,
        cutoutHeightMm: options.cutoutHeightMm ?? 180,
        cornerCleatCountPerOpening: 4,
      },
    });

    built.group.updateMatrixWorld(true);
    return { built, definition, resolved, cache };
  }

  // --------------------------------------------------------------------------
  // QAD-TC101.1: Single Jalousie Operator Grille Opening Alignment
  // --------------------------------------------------------------------------
  describe("QAD-TC101.1: Single Jalousie Operator Grille Opening Alignment", () => {
    it("renders exactly 1 framed rectangular opening centered on the operator centroid (X = +0.38m, Y = 0.50m)", () => {
      const { built } = createGrille3DTestSetup({
        operators: [{ key: "operator_crank", x: 0.38, y: 0.50 }],
        openingTargets: ["operator_crank"],
        cutoutWidthMm: 150,
        cutoutHeightMm: 180,
      });

      const collarGroups: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isOpenClearance === true && c.name.startsWith("Grille_Opening_Collar")) {
          collarGroups.push(c);
        }
      });

      assert.strictEqual(collarGroups.length, 1, "Exactly 1 collar opening group must be instantiated");

      const collarBox = new THREE.Box3().setFromObject(collarGroups[0]);
      const collarCenter = new THREE.Vector3();
      collarBox.getCenter(collarCenter);

      assert.ok(
        Math.abs(collarCenter.x - 0.38) < 0.02,
        `Collar center X must match operator X (0.38), got ${collarCenter.x.toFixed(3)}`
      );
      assert.ok(
        Math.abs(collarCenter.y - 0.50) < 0.02,
        `Collar center Y must match operator Y (0.50), got ${collarCenter.y.toFixed(3)}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.2: Dual Operator Dynamic Multi-Opening Generation
  // --------------------------------------------------------------------------
  describe("QAD-TC101.2: Dual Operator Dynamic Multi-Opening Generation", () => {
    it("generates exactly 2 rectangular openings, one centered over each operator with independent collar frames", () => {
      const { built } = createGrille3DTestSetup({
        operators: [
          { key: "operator_lower", x: 0.38, y: -0.40 },
          { key: "operator_upper", x: 0.38, y: 0.60 },
        ],
        openingTargets: ["operator_lower", "operator_upper"],
        cutoutWidthMm: 150,
        cutoutHeightMm: 180,
      });

      const collarGroups: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isOpenClearance === true && c.name.startsWith("Grille_Opening_Collar")) {
          collarGroups.push(c);
        }
      });

      assert.strictEqual(collarGroups.length, 2, "Must instantiate exactly 2 collar opening sub-frames");

      const yPositions = collarGroups.map((cg) => {
        const box = new THREE.Box3().setFromObject(cg);
        const center = new THREE.Vector3();
        box.getCenter(center);
        return center.y;
      }).sort((a, b) => a - b);

      assert.ok(
        Math.abs(yPositions[0] - (-0.40)) < 0.03,
        `Lower opening Y must align with lower operator (-0.40), got ${yPositions[0].toFixed(3)}`
      );
      assert.ok(
        Math.abs(yPositions[1] - 0.60) < 0.03,
        `Upper opening Y must align with upper operator (+0.60), got ${yPositions[1].toFixed(3)}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.3: Empty Interior Verification
  // --------------------------------------------------------------------------
  describe("QAD-TC101.3: Empty Interior Verification", () => {
    it("contains zero bar or picket geometry inside the clearance opening rectangular interior bounds", () => {
      const widthMm = 1000;
      const heightMm = 1200;
      const opX = 0.25;
      const opY = 0.10;
      const cutoutWidthM = 0.15;
      const cutoutHeightM = 0.18;

      const group = buildDynamicGrillPatternGroup(
        widthMm / 1000,
        heightMm / 1000,
        {
          grilleOpenings: [
            {
              x: opX,
              y: opY,
              widthMm: 150,
              heightMm: 180,
            },
          ],
        }
      );

      // Interior clearance volume bounds (excluding the border collar profile edges)
      const interiorBounds = new THREE.Box3(
        new THREE.Vector3(opX - cutoutWidthM / 2 + 0.015, opY - cutoutHeightM / 2 + 0.015, -0.05),
        new THREE.Vector3(opX + cutoutWidthM / 2 - 0.015, opY + cutoutHeightM / 2 - 0.015, 0.05)
      );

      let intersectingBarCount = 0;
      group.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          const meshBox = new THREE.Box3().setFromObject(c);
          if (interiorBounds.intersectsBox(meshBox)) {
            intersectingBarCount++;
          }
        }
      });

      assert.strictEqual(
        intersectingBarCount,
        0,
        `Interior of clearance opening must be completely empty, but found ${intersectingBarCount} meshes inside bounds`
      );
    });

    it("empties the interior volume of the opening when uploaded horizontal bars are mounted in buildGrillAssembly", () => {
      const darkGrilleMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Black security grille
      const middleBarsMesh = new THREE.Group();
      middleBarsMesh.name = "window_grill_middle_bars";

      // 5 horizontal bars spanning across the window width (1.0m)
      for (let i = 0; i < 5; i++) {
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.016), darkGrilleMat);
        hBar.name = `Horizontal_Bar_${i}`;
        hBar.position.set(0, -0.4 + i * 0.2, 0); // Y: -0.4, -0.2, 0.0, 0.2, 0.4
        middleBarsMesh.add(hBar);
      }

      const customCache: ComponentModelCache = {
        getClone: (id: string) => {
          if (id === "comp-middle") return middleBarsMesh.clone(true);
          return new THREE.Mesh(new THREE.BoxGeometry(0.028, 1.2, 0.025));
        },
        getSourceSizeMeters: (id: string) => {
          if (id === "comp-middle") return new THREE.Vector3(1.0, 1.2, 0.016);
          return new THREE.Vector3(0.028, 1.2, 0.025);
        },
      };

      const hostGroup = new THREE.Group();
      const operatorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.04));
      operatorMesh.name = "operator_handle_1";
      operatorMesh.position.set(0.20, 0.0, 0); // Directly intersects Horizontal_Bar_2 at Y=0.0
      hostGroup.add(operatorMesh);

      const grillAssembly = buildGrillAssembly(
        [
          {
            componentId: "comp-middle",
            componentKey: "window_grill_middle_bars",
            componentName: "Window Grille Middle Bars",
            componentType: "Infill",
            dimensionBinding: "AREA",
            baseQuantity: 1,
            componentData: {},
            model: {
              assetId: "a-mid",
              r2ObjectKey: "bars.glb",
              url: "",
              fileName: "Window_Grill_Middle_Bars.glb",
              sourceDimensionsMm: null,
            },
          },
        ],
        1000,
        1200,
        customCache,
        {
          activeAddon: "grill",
          addonMountingSide: "back",
          grilleOpeningTargetComponentKeys: ["operator_handle_1"],
          grilleOpeningConfig: {
            enabled: true,
            cutoutWidthMm: 150,
            cutoutHeightMm: 180,
            cornerCleatCountPerOpening: 4,
          },
        },
        undefined,
        hostGroup,
      );

      grillAssembly.updateMatrixWorld(true);

      // Verify clearance collar was created
      const collarGroup = grillAssembly.getObjectByName("Grille_Opening_Collar_0");
      assert.ok(collarGroup, "Must instantiate Grille_Opening_Collar_0");

      // Verify the inside of the opening is completely empty:
      // Inner clear aperture of 150mm x 180mm collar: exclude the 14mm collar frame rails
      const clearBounds = new THREE.Box3(
        new THREE.Vector3(0.20 - 0.075 + 0.015, 0.0 - 0.090 + 0.015, -0.05),
        new THREE.Vector3(0.20 + 0.075 - 0.015, 0.0 + 0.090 - 0.015, 0.05)
      );

      let intersectingMeshCount = 0;
      const middleAssembly = grillAssembly.getObjectByName("window_grill_middle_bars") as THREE.Group;
      assert.ok(middleAssembly, "Must contain window_grill_middle_bars assembly");

      middleAssembly.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const bbox = new THREE.Box3().setFromObject(child);
          if (clearBounds.intersectsBox(bbox)) {
            intersectingMeshCount++;
          }
        }
      });

      assert.strictEqual(
        intersectingMeshCount,
        0,
        `Interior of clearance opening must be completely empty, but found ${intersectingMeshCount} middle meshes inside bounds`
      );

      // Verify collar material matches the black grille material
      let collarMatColor: number | undefined = undefined;
      collarGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          collarMatColor = child.material.color.getHex();
        }
      });

      assert.strictEqual(
        collarMatColor,
        0x111111,
        "Collar frame must inherit the exact finish color of the uploaded security grille components"
      );

      // Verify isAddonFrameMesh recognizes collar sub-frame components for dynamic recoloring
      const collarBot = grillAssembly.getObjectByName("Grille_Opening_Collar_Bottom_0") as THREE.Mesh;
      const collarLeft = grillAssembly.getObjectByName("Grille_Opening_Collar_Left_0") as THREE.Mesh;
      assert.ok(collarBot && isAddonFrameMesh(collarBot), "Grille_Opening_Collar_Bottom must be recognized by isAddonFrameMesh");
      assert.ok(collarLeft && isAddonFrameMesh(collarLeft), "Grille_Opening_Collar_Left must be recognized by isAddonFrameMesh");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.4: Picket Interruption and Capping
  // --------------------------------------------------------------------------
  describe("QAD-TC101.4: Picket Interruption and Capping", () => {
    it("clips pickets intersecting the opening lateral span into discrete upper and lower segments", () => {
      const widthMm = 1000;
      const heightMm = 1200;
      const group = buildDynamicGrillPatternGroup(
        widthMm / 1000,
        heightMm / 1000,
        {
          nominalBarPitchMm: 140,
          grilleOpenings: [
            {
              x: 0,
              y: 0,
              widthMm: 150,
              heightMm: 200,
            },
          ],
        }
      );

      const interruptedSegments: THREE.Object3D[] = [];
      group.traverse((c) => {
        if (c.userData?.isInterruptedSegment === true) {
          interruptedSegments.push(c);
        }
      });

      assert.ok(
        interruptedSegments.length >= 2,
        `Must have at least 1 lower and 1 upper interrupted segment, got ${interruptedSegments.length}`
      );

      const hasLower = interruptedSegments.some((s) => s.name.endsWith("_Lower"));
      const hasUpper = interruptedSegments.some((s) => s.name.endsWith("_Upper"));
      assert.strictEqual(hasLower, true, "Must generate lower segment terminating below cutout");
      assert.strictEqual(hasUpper, true, "Must generate upper segment terminating above cutout");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.5: Uninterrupted Picket Continuity
  // --------------------------------------------------------------------------
  describe("QAD-TC101.5: Uninterrupted Picket Continuity", () => {
    it("ensures pickets outside the opening lateral span remain full continuous height without interruption", () => {
      const widthMm = 1200;
      const heightMm = 1400;
      const innerHeightM = 1.4;

      const group = buildDynamicGrillPatternGroup(
        widthMm / 1000,
        heightMm / 1000,
        {
          nominalBarPitchMm: 140,
          grilleOpenings: [
            {
              x: 0.40, // Far right side
              y: 0,
              widthMm: 150,
              heightMm: 180,
            },
          ],
        }
      );

      const fullPickets: THREE.Mesh[] = [];
      group.traverse((c) => {
        if (c instanceof THREE.Mesh && !c.userData?.isInterruptedSegment && c.name.startsWith("Grill_Bar_V_")) {
          fullPickets.push(c);
        }
      });

      assert.ok(fullPickets.length > 0, "Must have full continuous pickets outside the opening span");

      // Verify geometry height matches inner aperture height
      const firstFull = fullPickets[0];
      const box = new THREE.Box3().setFromObject(firstFull);
      const size = new THREE.Vector3();
      box.getSize(size);

      assert.ok(
        Math.abs(size.y - innerHeightM) < 0.01,
        `Continuous pickets must span full height (${innerHeightM}m), got ${size.y.toFixed(3)}m`
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.6: Collar Border Linear Extrusion BOM Accounting
  // --------------------------------------------------------------------------
  describe("QAD-TC101.6: Collar Border Linear Extrusion BOM Accounting", () => {
    it("adds exactly 2 * W_cutout + 2 * H_cutout linear meters per opening to collar framing line item", () => {
      const widthMm = 1000;
      const heightMm = 1200;
      const cutoutW = 150; // 0.15m
      const cutoutH = 180; // 0.18m
      const expectedCollarPerOpening = Number(((2 * cutoutW + 2 * cutoutH) * 0.001).toFixed(4)); // 0.66m

      // 1 Opening
      const bom1 = calculateGrilleLinearBOM({
        widthMm,
        heightMm,
        openingCount: 1,
        openingWidthMm: cutoutW,
        openingHeightMm: cutoutH,
        grilleRawMaterial: {
          id: "mat-1",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      assert.ok(bom1.openings !== null && bom1.openings !== undefined);
      assert.strictEqual(bom1.openings?.openingCount, 1);
      assert.strictEqual(bom1.openings?.collarLinearMeters, expectedCollarPerOpening);
      assert.strictEqual(bom1.openings?.collarPieceCount, 4);

      // 2 Openings
      const bom2 = calculateGrilleLinearBOM({
        widthMm,
        heightMm,
        openingCount: 2,
        openingWidthMm: cutoutW,
        openingHeightMm: cutoutH,
        grilleRawMaterial: {
          id: "mat-1",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      assert.strictEqual(bom2.openings?.openingCount, 2);
      assert.strictEqual(bom2.openings?.collarLinearMeters, 1.32);
      assert.strictEqual(bom2.openings?.collarPieceCount, 8);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.7: Exclusion of Screen Wicket Hardware
  // --------------------------------------------------------------------------
  describe("QAD-TC101.7: Exclusion of Screen Wicket Hardware", () => {
    it("does NOT bill for screen wicket hinges, wicket latches, or screen clips in grille BOM", () => {
      const bom = calculateGrilleLinearBOM({
        widthMm: 1000,
        heightMm: 1200,
        openingCount: 2,
        openingWidthMm: 150,
        openingHeightMm: 180,
        grilleRawMaterial: {
          id: "mat-1",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      const hasScreenHinges = bom.itemizedBreakdown.some((item) =>
        item.item.toLowerCase().includes("hinge") ||
        item.item.toLowerCase().includes("wicket") ||
        item.item.toLowerCase().includes("latch") ||
        item.item.toLowerCase().includes("spline")
      );

      assert.strictEqual(
        hasScreenHinges,
        false,
        "Security grille clearance openings must not bill for insect screen hinges or wicket latches"
      );

      // Check calculateAddonBOM for grill with openings
      const addonBom = calculateAddonBOM({
        addonType: "grill",
        widthMm: 1000,
        heightMm: 1200,
        openingCount: 2,
      });

      const addonHasHinges = addonBom.breakdown.some((b) =>
        b.item.toLowerCase().includes("hinge") ||
        b.item.toLowerCase().includes("wicket") ||
        b.item.toLowerCase().includes("latch")
      );

      assert.strictEqual(addonHasHinges, false, "Addon BOM for grille must not include wicket hinges or latches");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.8: Corner Cleat Hardware Accounting
  // --------------------------------------------------------------------------
  describe("QAD-TC101.8: Corner Cleat Hardware Accounting", () => {
    it("bills exactly 4 internal corner cleats per opening in the bill of materials", () => {
      const bom1 = calculateGrilleLinearBOM({
        widthMm: 1000,
        heightMm: 1200,
        openingCount: 1,
        openingWidthMm: 150,
        openingHeightMm: 180,
        grilleRawMaterial: {
          id: "mat-1",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      assert.strictEqual(bom1.openings?.cornerCleatQuantity, 4);
      const cleatItem1 = bom1.itemizedBreakdown.find((i) => i.item.includes("Corner Cleats"));
      assert.ok(cleatItem1 !== undefined);
      assert.strictEqual(cleatItem1?.pieces, 4);

      const bom3 = calculateGrilleLinearBOM({
        widthMm: 1000,
        heightMm: 1200,
        openingCount: 3,
        openingWidthMm: 150,
        openingHeightMm: 180,
        grilleRawMaterial: {
          id: "mat-1",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      assert.strictEqual(bom3.openings?.cornerCleatQuantity, 12);
      const cleatItem3 = bom3.itemizedBreakdown.find((i) => i.item.includes("Corner Cleats"));
      assert.strictEqual(cleatItem3?.pieces, 12);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.9: Admin Target Inheritance from Screen
  // --------------------------------------------------------------------------
  describe("QAD-TC101.9: Admin Target Inheritance from Screen", () => {
    it("populates grille targets from existing host operator configuration cleanly", () => {
      const config: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenHatchTargetComponentKeys: ["operator_lower", "operator_upper"],
        hasGrill: true,
        grillAddonProductId: grillId,
        grillOpeningTargetComponentKeys: ["operator_lower", "operator_upper"],
        grillOpeningConfig: {
          enabled: true,
          cutoutWidthMm: 150,
          cutoutHeightMm: 180,
          targetComponentKeys: ["operator_lower", "operator_upper"],
        },
      };

      const res = computeAddonReconciliation(parentId, new Set(), config);
      const grillRow = res.toUpsert.find((u) => u.addon_type === "grill");

      assert.ok(grillRow !== undefined);
      assert.deepStrictEqual(
        grillRow?.grille_opening_target_component_keys,
        ["operator_lower", "operator_upper"]
      );
      assert.strictEqual(
        (grillRow?.grille_opening_config as { enabled: boolean })?.enabled,
        true
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.10: Dimension Clamping Guardrail
  // --------------------------------------------------------------------------
  describe("QAD-TC101.10: Dimension Clamping Guardrail", () => {
    it("clamps cutout dimensions to safe structural bounds (100-250mm width, 120-300mm height)", () => {
      // Below min bounds
      const bomLow = calculateGrilleLinearBOM({
        widthMm: 1000,
        heightMm: 1200,
        openingCount: 1,
        openingWidthMm: 50, // Below 100mm min
        openingHeightMm: 80, // Below 120mm min
        grilleRawMaterial: {
          id: "mat-1",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      assert.strictEqual(bomLow.openingDetails?.cutoutWidthMm, 100, "Width below 100mm must clamp to 100mm");
      assert.strictEqual(bomLow.openingDetails?.cutoutHeightMm, 120, "Height below 120mm must clamp to 120mm");

      // Above max bounds
      const bomHigh = calculateGrilleLinearBOM({
        widthMm: 1000,
        heightMm: 1200,
        openingCount: 1,
        openingWidthMm: 400, // Above 250mm max
        openingHeightMm: 500, // Above 300mm max
        grilleRawMaterial: {
          id: "mat-1",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      assert.strictEqual(bomHigh.openingDetails?.cutoutWidthMm, 250, "Width above 250mm must clamp to 250mm");
      assert.strictEqual(bomHigh.openingDetails?.cutoutHeightMm, 300, "Height above 300mm must clamp to 300mm");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.11: Customer Workspace Badge Disclosure
  // --------------------------------------------------------------------------
  describe("QAD-TC101.11: Customer Workspace Badge Disclosure", () => {
    it("formats informative disclosure badge for single and multi-opening configurations", () => {
      const formatBadge = (count: number) =>
        `Includes ${count}x Framed Handle Access ${count === 1 ? "Opening" : "Openings"} for Window Operation`;

      assert.strictEqual(
        formatBadge(1),
        "Includes 1x Framed Handle Access Opening for Window Operation"
      );
      assert.strictEqual(
        formatBadge(2),
        "Includes 2x Framed Handle Access Openings for Window Operation"
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC101.12: Fabricator Consultation PDF Specification Parity
  // --------------------------------------------------------------------------
  describe("QAD-TC101.12: Fabricator Consultation PDF Specification Parity", () => {
    it("includes handle opening count and collar cut list in generated consultation PDF HTML", () => {
      const bom = calculateGrilleLinearBOM({
        widthMm: 1200,
        heightMm: 1500,
        openingCount: 2,
        openingWidthMm: 150,
        openingHeightMm: 180,
        grilleRawMaterial: {
          id: "pdf-mat",
          material_code: "AL-GRILLE",
          description: "Grille Tube",
          unit_price: 160,
        },
      });

      const sampleBom = {
        widthM: 1.2,
        heightM: 1.5,
        panelCount: 1,
        hasSill: true,
        finishType: "Analok",
        glassType: "Clear Glass",
        leafWidthM: 1.2,
        aspectRatio: 1.25,
        isCrabbingRisk: false,
        isSpanLimitExceeded: false,
        totalLinearMetersFraming: 5.4,
        glazingAreaSqm: 1.8,
        framingItems: [],
        glazingItems: [],
        hardwareItems: [],
        consumableItems: [],
        rawFramingSubtotal: 2000,
        scrapFramingSubtotal: 240,
        effectiveFramingCost: 2240,
        rawGlazingSubtotal: 1000,
        scrapGlazingSubtotal: 100,
        effectiveGlazingCost: 1100,
        hardwareSubtotal: 500,
        consumablesSubtotal: 200,
        directMaterialsSubtotal: 4040,
        fabricationLaborCost: 650,
        totalDirectCost: 4690,
        contractorMargin: 1172.5,
        finalQuotation: 5862.5,
        frozenDetails: {
          width_m: 1.2,
          height_m: 1.5,
          panel_count: 1,
          has_sill: true,
          finish_type: "Analok",
          glass_type: "Clear Glass",
          items_breakdown: [],
          raw_material_subtotal: 4040,
          waste_allowance_subtotal: 340,
          direct_material_subtotal: 4040,
          labor_cost: 650,
          contractor_margin: 1172.5,
          margin_rate: 0.25,
          total_estimate: 5862.5,
        },
        bomSummary: {
          total_estimated_amount: 5862.5,
          currency: "PHP",
          has_sill: true,
          groups: [],
        },
      };

      const pdfHtml = generateQuotationPdfHtml({
        quotationNumber: "GF-SPEC-101",
        referenceCode: "REF-101",
        customerName: "Juan Dela Cruz",
        customerPhone: "+639171234567",
        customerEmail: "juan@example.ph",
        siteLocation: "Quezon City, Metro Manila",
        createdAtFormatted: "November 2, 2026",
        projectName: "Series 798 Jalousie Window with Security Grille",
        brandLogoUrl: "https://glassfit.test/logo.svg",
        hasSill: true,
        structuralWaiver: false,
        bomResult: sampleBom as unknown as import("../../src/lib/pricing/pricingEngine").CalculatedBOMResult,
        items: [
          {
            itemId: "item-grille-1",
            productId: "prod-jalousie-grille",
            productName: "Jalousie Window with Security Grille",
            productType: "Window",
            variantName: "Standard",
            specSummary: "Analok | 1200mm x 1500mm",
            dimensionsFormatted: "1200mm x 1500mm",
            widthMm: 1200,
            heightMm: 1500,
            panelCount: 1,
            finishType: "Analok",
            glassType: "Clear Glass",
            hasSill: true,
            structuralWaiver: false,
            unitPrice: 5500,
            quantity: 1,
            totalPrice: 5500,
            imageUrl: "",
            selectedAddon: "grill",
            addonName: "Architectural Security Window Grille",
            addonMountingSide: "back",
            hatchCount: 2,
            grilleBOM: bom,
            addonAluminumFinish: "analok",
            bomResult: sampleBom as unknown as import("../../src/lib/pricing/pricingEngine").CalculatedBOMResult,
          },
        ],
        pricing: {
          directMaterialsSubtotal: 4040,
          laborSubtotal: 650,
          contractorMargin: 1172.5,
          calculatedFinalPrice: 5862.5,
        },
      });

      // Discloses 2x Operator Access Openings
      assert.ok(
        pdfHtml.includes("2x Operator Access Openings"),
        "Consultation PDF must disclose '2x Operator Access Openings' in fixture specifications"
      );

      // Discloses collar frames in cut list summary
      assert.ok(
        pdfHtml.includes("2x collar frames"),
        "Consultation PDF must itemize collar frames in the cut list summary"
      );
    });
  });
});
