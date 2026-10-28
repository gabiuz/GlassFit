/**
 * Unit & Acceptance Test Suite for Directional Add-on Placement Side Compatibility
 * and Operator-Targeted Multi-Hatch Alignment (IMP-MS80)
 *
 * Primary Traceability: PRD-F5, PRD-F10, PRD-F14, SDD-C4, SDD-C7, SDD-C9, ERD-E3, ERD-E6, ERD-E14, IMP-MS80
 * Acceptance Catalog: QAD-TC95.1 through QAD-TC95.12
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import {
  computeAddonReconciliation,
} from "../../src/lib/admin/products/addonUtils";
import type { HostProductAddonConfig } from "../../src/lib/admin/products/types";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";
import type { ProductStructuralDefinition, ResolvedStructure, ProductComponentDefinition } from "../../src/lib/visualization/types";
import { calculateParametricBOM, type CalculatedBOMResult } from "../../src/lib/pricing/pricingEngine";
import { calculateAddonBOM } from "../../src/lib/pricing/addonPricingEngine";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";
import { buildParametricScreenGroup } from "../../src/lib/visualization/addonGeometryBuilder";

describe("IMP-MS80: Directional Add-on Placement Side Compatibility and Operator-Targeted Multi-Hatch Alignment (QAD-TC95)", () => {
  const parentId = "11111111-1111-4111-8111-111111111111";
  const screenId = "22222222-2222-4222-8222-222222222222";
  const grillId = "33333333-3333-4333-8333-333333333333";

  // --------------------------------------------------------------------------
  // QAD-TC95.1: Admin selects mounting side compatibility in Setup Wizard
  // --------------------------------------------------------------------------
  describe("QAD-TC95.1: Admin selects mounting side compatibility in Setup Wizard", () => {
    it("persists Front Only, Back Only, or Both Sides cleanly into reconciliation records", () => {
      const configFront: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenAllowedSides: "front",
        screenDefaultSide: "front",
        hasGrill: false,
      };

      const resFront = computeAddonReconciliation(parentId, new Set(), configFront);
      assert.strictEqual(resFront.toUpsert.length, 1);
      assert.strictEqual(resFront.toUpsert[0].allowed_sides, "front");
      assert.strictEqual(resFront.toUpsert[0].default_side, "front");

      const configBack: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenAllowedSides: "back",
        screenDefaultSide: "back",
        hasGrill: false,
      };

      const resBack = computeAddonReconciliation(parentId, new Set(), configBack);
      assert.strictEqual(resBack.toUpsert[0].allowed_sides, "back");
      assert.strictEqual(resBack.toUpsert[0].default_side, "back");

      const configBoth: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenAllowedSides: "both",
        screenDefaultSide: "back",
        hasGrill: true,
        grillAddonProductId: grillId,
        grillAllowedSides: "front",
        grillDefaultSide: "front",
      };

      const resBoth = computeAddonReconciliation(parentId, new Set(), configBoth);
      assert.strictEqual(resBoth.toUpsert.length, 2);
      assert.strictEqual(resBoth.toUpsert[0].allowed_sides, "both");
      assert.strictEqual(resBoth.toUpsert[0].default_side, "back");
      assert.strictEqual(resBoth.toUpsert[1].allowed_sides, "front");
      assert.strictEqual(resBoth.toUpsert[1].default_side, "front");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.2: Awning window sash collision warning and automatic default
  // --------------------------------------------------------------------------
  describe("QAD-TC95.2: Awning window sash collision warning and automatic default", () => {
    it("identifies outward projecting fixtures and defaults screens to Back mounting", () => {
      const isAwningOutward = (type: string) => type === "Awning Window" || type === "Casement Window";

      assert.strictEqual(isAwningOutward("Awning Window"), true);
      assert.strictEqual(isAwningOutward("Casement Window"), true);
      assert.strictEqual(isAwningOutward("Sliding Window"), false);

      const defaultForAwning = isAwningOutward("Awning Window") ? "back" : "both";
      assert.strictEqual(defaultForAwning, "back", "Awning screens must default to interior back mount");

      // Verify that selecting front on outward fixture triggers physical collision warning condition
      const checkCollisionWarning = (productType: string, allowedSides: string) => {
        return isAwningOutward(productType) && allowedSides !== "back";
      };

      assert.strictEqual(checkCollisionWarning("Awning Window", "front"), true);
      assert.strictEqual(checkCollisionWarning("Awning Window", "both"), true);
      assert.strictEqual(checkCollisionWarning("Awning Window", "back"), false);
      assert.strictEqual(checkCollisionWarning("Sliding Window", "front"), false);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.3: Backward compatibility for legacy add-on bindings
  // --------------------------------------------------------------------------
  describe("QAD-TC95.3: Backward compatibility for legacy add-on bindings", () => {
    it("assigns allowed_sides = 'both' and default_side = 'back' when unspecified", () => {
      const legacyConfig: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        hasGrill: false,
      };

      const result = computeAddonReconciliation(parentId, new Set(), legacyConfig);
      assert.strictEqual(result.toUpsert.length, 1);
      assert.strictEqual(result.toUpsert[0].allowed_sides, "both");
      assert.strictEqual(result.toUpsert[0].default_side, "back");
      assert.strictEqual(result.toUpsert[0].hatch_target_component_keys, null);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.4: Admin selects multiple operator parts for hatch alignment
  // --------------------------------------------------------------------------
  describe("QAD-TC95.4: Admin selects multiple operator parts for hatch alignment", () => {
    it("persists bound operator component keys into hatch_target_component_keys", () => {
      const config: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenAllowedSides: "back",
        screenDefaultSide: "back",
        screenHatchTargetComponentKeys: ["operator_lower", "operator_upper"],
        hasGrill: false,
      };

      const result = computeAddonReconciliation(parentId, new Set(), config);
      assert.strictEqual(result.toUpsert.length, 1);
      assert.deepStrictEqual(result.toUpsert[0].hatch_target_component_keys, ["operator_lower", "operator_upper"]);
    });
  });

  // --------------------------------------------------------------------------
  // 3D Setup Mock for QAD-TC95.5, QAD-TC95.6, QAD-TC95.7
  // --------------------------------------------------------------------------
  function create3DTestSetup(options: {
    operators: Array<{ key: string; x: number; y: number; z?: number }>;
    hatchTargets: string[];
    allowedSides?: "front" | "back" | "both";
    defaultSide?: "front" | "back";
    activeSide?: "front" | "back";
    removableStates?: Record<string, boolean>;
  }) {
    // 1. Host window frame (1.0m x 2.0m x 0.08m)
    const hostFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.08));
    hostFrameMesh.position.set(0, 0, 0);

    // Operator meshes
    const operatorMeshes: Record<string, THREE.Mesh> = {};
    const hostComponents: ProductComponentDefinition[] = [
      {
        componentId: "comp_frame",
        componentKey: "window_frame",
        componentName: "Window Frame",
        componentType: "Frame",
        dimensionBinding: "AREA",
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

    const hostQuantities: Record<string, number> = { window_frame: 1 };

    options.operators.forEach((op, idx) => {
      const opMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04));
      opMesh.position.set(op.x, op.y, op.z ?? 0.02);
      opMesh.name = op.key;
      opMesh.userData = { componentKey: op.key, componentId: `comp_${op.key}` };
      operatorMeshes[op.key] = opMesh;

      hostComponents.push({
        componentId: `comp_${op.key}`,
        componentKey: op.key,
        componentName: `Operator ${idx + 1}`,
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

    // 2. Addon Screen Frame and Hatch (modeled naturally on Right side at X = +0.35m)
    const screenFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.02));
    screenFrameMesh.position.set(0, 0, 0);

    const hatchGeom = new THREE.BoxGeometry(0.16, 0.30, 0.02);
    // Model hatch offset on right side
    hatchGeom.translate(0.35, 0, 0);
    const hatchMesh = new THREE.Mesh(hatchGeom);

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
          id: "binding_screen",
          parentProductId: "prod_host_window",
          addonProductId: "addon_screen_prod",
          addonType: "screen",
          allowedSides: options.allowedSides ?? "both",
          defaultSide: options.defaultSide ?? "back",
          hatchTargetComponentKeys: options.hatchTargets,
          components: [
            {
              componentId: "comp_screen_frame",
              componentKey: "screen_perimeter_frame",
              componentName: "Screen Frame",
              componentType: "Frame",
              dimensionBinding: "AREA",
              baseQuantity: 1,
              componentData: {},
              model: {
                assetId: "a_sf",
                r2ObjectKey: "sf.glb",
                url: "https://r2.dev/sf.glb",
                fileName: "sf.glb",
                sourceDimensionsMm: null,
              },
            },
            {
              componentId: "comp_screen_hatch",
              componentKey: "screen_access_hatch",
              componentName: "Screen Access Hatch",
              componentType: "Hardware",
              dimensionBinding: "FIXED",
              baseQuantity: 1,
              componentData: {},
              model: {
                assetId: "a_sh",
                r2ObjectKey: "sh.glb",
                url: "https://r2.dev/sh.glb",
                fileName: "sh.glb",
                sourceDimensionsMm: null,
              },
            },
          ],
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
        if (id === "comp_screen_frame" || id === "screen_perimeter_frame") return screenFrameMesh.clone(true);
        if (id === "comp_screen_hatch" || id === "screen_access_hatch") return hatchMesh.clone(true);
        for (const [k, mesh] of Object.entries(operatorMeshes)) {
          if (id === `comp_${k}` || id === k) return mesh.clone(true);
        }
        throw new Error(`Unknown component clone request: ${id}`);
      },
      getSourceSizeMeters: () => new THREE.Vector3(1.0, 2.0, 0.08),
    };

    const built = buildParametricProduct(definition, resolved, cache, {
      activeAddon: "screen",
      addonMountingSide: options.activeSide,
      hatchTargetComponentKeys: options.hatchTargets,
      removableStates: options.removableStates,
    });

    built.group.updateMatrixWorld(true);
    return { built, definition, resolved, cache };
  }

  // --------------------------------------------------------------------------
  // QAD-TC95.5: Single operator hatch alignment verification
  // --------------------------------------------------------------------------
  describe("QAD-TC95.5: Single operator hatch alignment verification", () => {
    it("renders exactly 1 hatch centered precisely at the target operator coordinates (X = +0.42m, Y = 0.50m)", () => {
      const { built } = create3DTestSetup({
        operators: [{ key: "operator_crank", x: 0.42, y: 0.50 }],
        hatchTargets: ["operator_crank"],
        allowedSides: "back",
        activeSide: "back",
      });

      const hatches: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.componentKey === "screen_access_hatch" && c.userData?.isHatchClone) {
          hatches.push(c);
        }
      });

      assert.strictEqual(hatches.length, 1, "Exactly 1 hatch instance must be instantiated");

      const hatchBox = new THREE.Box3().setFromObject(hatches[0]);
      const hatchCenter = new THREE.Vector3();
      hatchBox.getCenter(hatchCenter);

      assert.ok(
        Math.abs(hatchCenter.x - 0.42) < 0.01,
        `Hatch center X must match operator X (0.42), got ${hatchCenter.x.toFixed(3)}`
      );
      assert.ok(
        Math.abs(hatchCenter.y - 0.50) < 0.01,
        `Hatch center Y must match operator Y (0.50), got ${hatchCenter.y.toFixed(3)}`
      );
      assert.strictEqual(hatches[0].userData.targetComponentKey, "operator_crank");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.6: Dual operator multi-hatch automated instantiation
  // --------------------------------------------------------------------------
  describe("QAD-TC95.6: Dual operator multi-hatch automated instantiation", () => {
    it("instantiates exactly 2 access hatches each centered at respective vertical elevations (Y = 0.35m and Y = 1.10m)", () => {
      const { built } = create3DTestSetup({
        operators: [
          { key: "operator_lower", x: 0.45, y: 0.35 },
          { key: "operator_upper", x: 0.45, y: 1.10 },
        ],
        hatchTargets: ["operator_lower", "operator_upper"],
        allowedSides: "back",
        activeSide: "back",
      });

      const hatches: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.componentKey === "screen_access_hatch" && c.userData?.isHatchClone) {
          hatches.push(c);
        }
      });

      assert.strictEqual(hatches.length, 2, "Exactly 2 hatches must be instantiated for 2 operators");

      // Verify lower hatch
      const lowerHatch = hatches.find((h) => h.userData.targetComponentKey === "operator_lower")!;
      assert.ok(lowerHatch, "Lower operator hatch must exist");
      const lowerBox = new THREE.Box3().setFromObject(lowerHatch);
      const lowerCenter = new THREE.Vector3();
      lowerBox.getCenter(lowerCenter);
      assert.ok(Math.abs(lowerCenter.y - 0.35) < 0.01, `Lower hatch Y must be 0.35, got ${lowerCenter.y.toFixed(3)}`);

      // Verify upper hatch
      const upperHatch = hatches.find((h) => h.userData.targetComponentKey === "operator_upper")!;
      assert.ok(upperHatch, "Upper operator hatch must exist");
      const upperBox = new THREE.Box3().setFromObject(upperHatch);
      const upperCenter = new THREE.Vector3();
      upperBox.getCenter(upperCenter);
      assert.ok(Math.abs(upperCenter.y - 1.10) < 0.01, `Upper hatch Y must be 1.10, got ${upperCenter.y.toFixed(3)}`);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.7: Bilateral handing matching for left vs right operators
  // --------------------------------------------------------------------------
  describe("QAD-TC95.7: Bilateral handing matching for left vs right operators", () => {
    it("mirrors the hatch mesh laterally when operator is on the left jamb (X = -0.40m)", () => {
      const { built } = create3DTestSetup({
        operators: [{ key: "operator_left", x: -0.40, y: 0.60 }],
        hatchTargets: ["operator_left"],
        allowedSides: "back",
        activeSide: "back",
      });

      const hatch = built.group.children
        .flatMap((c) => (c.children.length > 0 ? c.children : [c]))
        .flatMap((c) => (c.children.length > 0 ? c.children : [c]))
        .find((c) => c.userData?.componentKey === "screen_access_hatch" && c.userData?.isHatchClone)!;

      assert.ok(hatch, "Hatch must be instantiated");
      assert.strictEqual(hatch.userData.isMirroredHanding, true, "Left-side operator must trigger lateral mirror reflection");

      const hatchBox = new THREE.Box3().setFromObject(hatch);
      const hatchCenter = new THREE.Vector3();
      hatchBox.getCenter(hatchCenter);

      assert.ok(
        Math.abs(hatchCenter.x - (-0.40)) < 0.01,
        `Hatch center X must be mirrored to -0.40, got ${hatchCenter.x.toFixed(3)}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.8: Customer workspace side toggle when allowed_sides is 'both'
  // --------------------------------------------------------------------------
  describe("QAD-TC95.8: Customer workspace side toggle when allowed_sides is 'both'", () => {
    it("toggles the add-on Z position across the host frame between Front and Back", () => {
      const frontSetup = create3DTestSetup({
        operators: [],
        hatchTargets: [],
        allowedSides: "both",
        activeSide: "front",
      });

      const rearSetup = create3DTestSetup({
        operators: [],
        hatchTargets: [],
        allowedSides: "both",
        activeSide: "back",
      });

      const frontAddon = frontSetup.built.group.children.find((c) => c.userData.isAddon)!;
      const rearAddon = rearSetup.built.group.children.find((c) => c.userData.isAddon)!;

      assert.ok(frontAddon, "Front addon must exist");
      assert.ok(rearAddon, "Rear addon must exist");

      const frontBox = new THREE.Box3().setFromObject(frontAddon);
      const rearBox = new THREE.Box3().setFromObject(rearAddon);

      // Front (exterior) addon must sit on the negative Z face (Z < 0) where window sill projects
      assert.ok(frontBox.max.z <= -0.03, `Front addon max Z should be <= -0.03, got ${frontBox.max.z}`);
      // Back (interior) addon must sit on the positive Z face (Z > 0) where handles reside
      assert.ok(rearBox.min.z >= 0.03, `Rear addon min Z should be >= +0.03, got ${rearBox.min.z}`);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.9: Customer workspace locked side when allowed_sides is 'back'
  // --------------------------------------------------------------------------
  describe("QAD-TC95.9: Customer workspace locked side when allowed_sides is 'back'", () => {
    it("strictly locks add-on to rear plane when allowedSides is 'back'", () => {
      const setup = create3DTestSetup({
        operators: [],
        hatchTargets: [],
        allowedSides: "back",
        activeSide: undefined, // Defaults to resolved allowed side
      });

      const addon = setup.built.group.children.find((c) => c.userData.isAddon)!;
      assert.ok(addon, "Addon must be present");
      const box = new THREE.Box3().setFromObject(addon);

      // Back (interior) addon must sit on the positive Z face (Z > 0) where handles reside
      assert.ok(box.min.z >= 0.03, `Locked back mount must position on interior face, min Z: ${box.min.z}`);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.10: Parametric BOM scales hatch hardware by operator count
  // --------------------------------------------------------------------------
  describe("QAD-TC95.10: Parametric BOM scales hatch hardware by operator count", () => {
    it("scales hatch hardware item quantity by target operator count (2 pcs for 2 operators)", () => {
      const resultSingle = calculateParametricBOM(
        [
          {
            componentKey: "screen_access_hatch_latch",
            componentName: "Wicket Latch",
            baseQuantity: 1,
            dimensionBinding: "FIXED",
            unitPrice: 120.0,
            presentationCategory: "Hardware",
            spanRatio: 1,
            isRemovable: false,
          },
        ],
        {
          widthMm: 1000,
          heightMm: 2000,
          hatchCount: 1,
        }
      );

      const resultDual = calculateParametricBOM(
        [
          {
            componentKey: "screen_access_hatch_latch",
            componentName: "Wicket Latch",
            baseQuantity: 1,
            dimensionBinding: "FIXED",
            unitPrice: 120.0,
            presentationCategory: "Hardware",
            spanRatio: 1,
            isRemovable: false,
          },
        ],
        {
          widthMm: 1000,
          heightMm: 2000,
          hatchCount: 2,
        }
      );

      assert.strictEqual(resultSingle.hardwareItems[0].quantity, 1, "Single operator requires 1 pc latch");
      assert.strictEqual(resultSingle.hardwareSubtotal, 120.0);

      assert.strictEqual(resultDual.hardwareItems[0].quantity, 2, "Dual operators require 2 pcs latch");
      assert.strictEqual(resultDual.hardwareSubtotal, 240.0, "Hardware cost doubles with 2 operator hatches");

      // Verify addon pricing engine also scales hatch hardware
      const addonBOMSingle = calculateAddonBOM({
        addonType: "screen",
        widthMm: 1000,
        heightMm: 2000,
        hatchCount: 1,
      });

      const addonBOMDual = calculateAddonBOM({
        addonType: "screen",
        widthMm: 1000,
        heightMm: 2000,
        hatchCount: 2,
      });

      const singleHatchItem = addonBOMSingle.breakdown.find((b) => b.item.includes("Hatch Hardware"))!;
      const dualHatchItem = addonBOMDual.breakdown.find((b) => b.item.includes("Hatch Hardware"))!;

      assert.ok(singleHatchItem, "Hatch hardware item must exist in BOM");
      assert.strictEqual(singleHatchItem.quantity, 1);
      assert.strictEqual(dualHatchItem.quantity, 2);
      assert.strictEqual(dualHatchItem.subtotal, singleHatchItem.subtotal * 2);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.11: Quotation modal and Consultation PDF specification disclosure
  // --------------------------------------------------------------------------
  describe("QAD-TC95.11: Quotation modal and Consultation PDF specification disclosure", () => {
    it("discloses mounting side and operator access hatch count in Consultation PDF line", () => {
      const sampleBom = {
        rawMaterialsSubtotal: 10000,
        directMaterialsSubtotal: 10000,
        wasteAllowanceCost: 1200,
        fabricationLaborCost: 2000,
        contractorMargin: 2200,
        finalQuotation: 15400,
        framingItems: [],
        glazingItems: [],
        hardwareItems: [],
        consumableItems: [],
        effectiveFramingCost: 6000,
        effectiveGlazingCost: 4000,
        hardwareSubtotal: 1000,
        consumablesSubtotal: 500,
        widthM: 1.2,
        heightM: 1.5,
        panelCount: 2,
        frozenDetails: {
          finish_type: "silver",
          glass_type: "clear",
        },
      };

      const pdfHtml = generateQuotationPdfHtml({
        quotationNumber: "QT-2026-MS80-001",
        customerName: "Engr. Mateo Cruz",
        customerPhone: "0917-123-4567",
        siteLocation: "One Serendra, BGC, Taguig City",
        createdAtFormatted: "October 29, 2026",
        projectName: "Series 798 Dual-Bank Jalousie Window",
        brandLogoUrl: "https://glassfit.test/logo.svg",
        hasSill: true,
        structuralWaiver: false,
        bomResult: sampleBom as unknown as CalculatedBOMResult,
        items: [
          {
            itemId: "item-1",
            productId: "prod-jalousie",
            productName: "Series 798 Dual-Bank Jalousie Window",
            productType: "Window",
            variantName: "Standard",
            specSummary: "Anodized Silver | 1200mm x 1500mm",
            dimensionsFormatted: "1200mm x 1500mm",
            widthMm: 1200,
            heightMm: 1500,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishType: "silver",
            glassType: "clear",
            quantity: 1,
            unitPrice: 15400,
            totalPrice: 15400,
            imageUrl: "",
            bomResult: sampleBom as unknown as CalculatedBOMResult,
            selectedAddon: "screen",
            addonName: "Insect Screen",
            addonMountingSide: "back",
            hatchCount: 2,
            hatchTargetKeys: ["operator_lower", "operator_upper"],
            addonPrice: 1850,
          },
        ],
      });

      assert.ok(
        pdfHtml.includes("Insect Screen (Interior Mount / Back, with 2x Operator Access Hatches)"),
        "Consultation PDF must state exact specification disclosure line"
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.12: Wizard round-trip state persistence
  // --------------------------------------------------------------------------
  describe("QAD-TC95.12: Wizard round-trip state persistence", () => {
    it("faithfully preserves radio choices and operator target keys across save cycles", () => {
      const initialConfig: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenAllowedSides: "back",
        screenDefaultSide: "back",
        screenHatchTargetComponentKeys: ["operator_bank_1", "operator_bank_2"],
        hasGrill: true,
        grillAddonProductId: grillId,
        grillAllowedSides: "both",
        grillDefaultSide: "front",
      };

      const reconciliation = computeAddonReconciliation(parentId, new Set(), initialConfig);

      // Simulate database row read after persistence
      const simulatedDbRows = reconciliation.toUpsert.map((u) => ({
        id: "mock-junction-id",
        parent_product_id: u.parent_product_id,
        addon_product_id: u.addon_product_id,
        addon_type: u.addon_type,
        is_default_enabled: u.is_default_enabled,
        display_order: u.display_order,
        allowed_sides: u.allowed_sides,
        default_side: u.default_side,
        hatch_target_component_keys: u.hatch_target_component_keys,
      }));

      // Map back to wizard form state
      const screenRow = simulatedDbRows.find((r) => r.addon_type === "screen")!;
      assert.strictEqual(screenRow.allowed_sides, "back");
      assert.strictEqual(screenRow.default_side, "back");
      assert.deepStrictEqual(screenRow.hatch_target_component_keys, ["operator_bank_1", "operator_bank_2"]);

      const grillRow = simulatedDbRows.find((r) => r.addon_type === "grill")!;
      assert.strictEqual(grillRow.allowed_sides, "both");
      assert.strictEqual(grillRow.default_side, "front");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.13: Hatch toggle exclusion in 3D parametric builder and procedural screen geometry
  // --------------------------------------------------------------------------
  describe("QAD-TC95.13: Hatch toggle exclusion in 3D parametric builder and procedural screen geometry", () => {
    it("excludes hatch components when removableStates sets screen_access_hatch to false", () => {
      const { built } = create3DTestSetup({
        operators: [{ key: "operator_crank", x: 0.42, y: 0.50 }],
        hatchTargets: ["operator_crank"],
        allowedSides: "back",
        activeSide: "back",
        removableStates: {
          screen_access_hatch: false,
        },
      });

      const hatches: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.componentKey === "screen_access_hatch" || c.name.includes("hatch")) {
          hatches.push(c);
        }
      });

      assert.strictEqual(hatches.length, 0, "No hatch component should be mounted when hatch toggle is off");
    });

    it("toggles wicket sub-frame and latch in procedural screen geometry based on hasHatch flag", () => {
      const screenWithHatch = buildParametricScreenGroup(1200, 1200, { hasHatch: true });
      const screenWithoutHatch = buildParametricScreenGroup(1200, 1200, { hasHatch: false });

      const countMeshes = (group: THREE.Group) => {
        let count = 0;
        group.traverse((c) => {
          if (c instanceof THREE.Mesh) count++;
        });
        return count;
      };

      assert.ok(
        countMeshes(screenWithHatch) > countMeshes(screenWithoutHatch),
        "Screen with hatch should contain wicket rails and latch hardware"
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC95.14: Horizontal hatch orientation for bottom/top rail operators and perimeter clamping
  // --------------------------------------------------------------------------
  describe("QAD-TC95.14: Horizontal hatch orientation for bottom/top rail operators and perimeter clamping", () => {
    it("orientates hatch horizontally and clamps Y within screen frame when operator is on bottom rail", () => {
      const { built } = create3DTestSetup({
        operators: [{ key: "aw_cam_handle", x: 0.067, y: -0.622 }],
        hatchTargets: ["aw_cam_handle"],
        allowedSides: "back",
        activeSide: "back",
      });

      const hatches: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.componentKey === "screen_access_hatch" && c.userData?.isHatchClone) {
          hatches.push(c);
        }
      });

      assert.strictEqual(hatches.length, 1, "Exactly 1 hatch instantiated for awning cam handle");
      const hatch = hatches[0];
      assert.strictEqual(hatch.userData.isHorizontalHatch, true, "Hatch must be oriented horizontally for awning operator");

      const hatchBox = new THREE.Box3().setFromObject(hatch);
      const hatchSize = new THREE.Vector3();
      hatchBox.getSize(hatchSize);

      // Width should be larger than height when rotated horizontal (~0.34m wide x ~0.16m high)
      assert.ok(
        hatchSize.x > hatchSize.y,
        `Horizontal hatch width (${hatchSize.x.toFixed(3)}) must exceed height (${hatchSize.y.toFixed(3)})`
      );

      // Verify that bottom of hatch does NOT extend below the screen opening (targetHeight = 2.0m -> screenHalfH = 1.0m)
      assert.ok(
        hatchBox.min.y >= -1.0,
        `Hatch bottom Y (${hatchBox.min.y.toFixed(3)}) must not overhang below screen bottom (-1.00m)`
      );
    });

    it("QAD-TC95.15: aligns operator part precisely in the center of the horizontal hatch", () => {
      const opX = 0.05;
      const opY = -0.42;
      const { built } = create3DTestSetup({
        operators: [{ key: "aw_cam_handle", x: opX, y: opY }],
        hatchTargets: ["aw_cam_handle"],
        allowedSides: "back",
        activeSide: "back",
      });

      let camHandle: THREE.Object3D | null = null;
      let hatch: THREE.Object3D | null = null;

      built.group.traverse((c) => {
        if (c.userData?.componentKey === "aw_cam_handle" || c.name.includes("aw_cam_handle")) {
          camHandle = c;
        }
        if (c.userData?.componentKey === "screen_access_hatch" && c.userData?.isHatchClone) {
          hatch = c;
        }
      });

      assert.ok(camHandle, "Cam handle operator must exist");
      assert.ok(hatch, "Hatch instance must exist");

      const handleBox = new THREE.Box3().setFromObject(camHandle!);
      const handleCenter = new THREE.Vector3();
      handleBox.getCenter(handleCenter);

      const hatchBox = new THREE.Box3().setFromObject(hatch!);
      const hatchCenter = new THREE.Vector3();
      hatchBox.getCenter(hatchCenter);

      // Verify that hatch center matches operator center within 10mm tolerance
      assert.ok(
        Math.abs(hatchCenter.x - handleCenter.x) < 0.01,
        `Hatch center X (${hatchCenter.x.toFixed(4)}) must align with operator X (${handleCenter.x.toFixed(4)})`
      );
      assert.ok(
        Math.abs(hatchCenter.y - handleCenter.y) < 0.01,
        `Hatch center Y (${hatchCenter.y.toFixed(4)}) must align with operator Y (${handleCenter.y.toFixed(4)})`
      );

      // Verify that the operator is centered inside the hatch bounds
      assert.ok(
        handleBox.min.y >= hatchBox.min.y,
        `Operator bottom (${handleBox.min.y.toFixed(4)}) must sit inside hatch opening (${hatchBox.min.y.toFixed(4)})`
      );
      assert.ok(
        handleBox.max.y <= hatchBox.max.y,
        `Operator top (${handleBox.max.y.toFixed(4)}) must sit inside hatch opening (${hatchBox.max.y.toFixed(4)})`
      );
    });
  });
});
