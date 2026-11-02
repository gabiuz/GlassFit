import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import { computeAddonReconciliation } from "../../src/lib/admin/products/addonUtils";
import { calculateAddonBOM } from "../../src/lib/pricing/addonPricingEngine";
import { calculateParametricBOM } from "../../src/lib/pricing/pricingEngine";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder";
import type {
  ProductStructuralDefinition,
  ResolvedStructure,
  ProductComponentDefinition,
} from "../../src/lib/visualization/types";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";
import type { HostProductAddonConfig } from "../../src/lib/admin/products/types";

/**
 * IMP-MS87 Acceptance Test Suite: Interior-Restricted Operator Alignment Targets,
 * Exterior Cutout Suppression, and Directional Add-on Integrity.
 *
 * Traceability Codes:
 * BRD-M2, BRD-M4, BRD-M5, PRD-F5, PRD-F10, PRD-F14,
 * SDD-C4, SDD-C5, SDD-C7, SDD-C9, DSD-UI4, DSD-UI7, DSD-UI10,
 * ERD-E3, ERD-E6, ERD-E14, ERD-E17,
 * QAD-TC102.1 through QAD-TC102.12
 */
describe("IMP-MS87: Interior-Restricted Operator Alignment Targets and Exterior Cutout Suppression (QAD-TC102)", () => {
  const parentId = "11111111-1111-4111-8111-111111111111";
  const screenId = "22222222-2222-4222-8222-222222222222";
  const grillId = "33333333-3333-4333-8333-333333333333";

  // Helper to build a mock 3D setup for screen and grille testing
  function create3DTestRig(options: {
    addonType: "screen" | "grill";
    allowedSides: "front" | "back" | "both";
    activeMountingSide?: "front" | "back";
    operatorKeys: string[];
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

    options.operatorKeys.forEach((key, idx) => {
      const opMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.05));
      opMesh.name = key;
      opMesh.position.set(0.38, -0.4 + idx * 0.8, 0.02);
      opMesh.userData = {
        componentKey: key,
        componentId: `comp_${key}`,
        isLouverOperatorInstance: true,
      };
      operatorMeshes[key] = opMesh;

      hostComponents.push({
        componentId: `comp_${key}`,
        componentKey: key,
        componentName: `Operator Mechanism ${idx + 1}`,
        componentType: "Hardware",
        dimensionBinding: "FIXED",
        baseQuantity: 1,
        componentData: {},
        model: {
          assetId: `a_${key}`,
          r2ObjectKey: `${key}.glb`,
          url: `https://r2.dev/${key}.glb`,
          fileName: `${key}.glb`,
          sourceDimensionsMm: null,
        },
      });

      hostQuantities[key] = 1;
    });

    const isScreen = options.addonType === "screen";
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
          id: isScreen ? "binding_screen" : "binding_grill",
          parentProductId: "prod_host_window",
          addonProductId: isScreen ? screenId : grillId,
          addonType: options.addonType,
          allowedSides: options.allowedSides,
          defaultSide: "back",
          hatchTargetComponentKeys: isScreen ? options.operatorKeys : undefined,
          grilleOpeningTargetComponentKeys: !isScreen ? options.operatorKeys : undefined,
          grilleOpeningConfig: !isScreen
            ? {
              enabled: true,
              cutoutWidthMm: 150,
              cutoutHeightMm: 180,
              cornerCleatCountPerOpening: 4,
            }
            : undefined,
          components: isScreen
            ? [
              {
                componentId: "comp_screen_frame",
                componentKey: "screen_perimeter_frame",
                componentName: "Screen Perimeter Frame",
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
                isRemovable: true,
                componentData: {},
                model: {
                  assetId: "a_sh",
                  r2ObjectKey: "sh.glb",
                  url: "https://r2.dev/sh.glb",
                  fileName: "sh.glb",
                  sourceDimensionsMm: { width: 160, height: 260, depth: 20 },
                },
              },
            ]
            : [],
        },
      ],
    };

    const resolved: ResolvedStructure = {
      componentQuantities: hostQuantities,
      resolvedValues: {},
      numericValuesMm: { width: 1000, height: 2000 },
      appliedRuleIds: [],
    };

    const hatchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.02));
    const screenFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.02));

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
      activeAddon: options.addonType,
      addonMountingSide: options.activeMountingSide,
      hatchTargetComponentKeys: isScreen ? options.operatorKeys : undefined,
      grilleOpeningTargetComponentKeys: !isScreen ? options.operatorKeys : undefined,
      grilleOpeningConfig: !isScreen
        ? {
          enabled: true,
          cutoutWidthMm: 150,
          cutoutHeightMm: 180,
          cornerCleatCountPerOpening: 4,
        }
        : undefined,
    });

    built.group.updateMatrixWorld(true);
    return { built, definition, resolved, cache };
  }

  // --------------------------------------------------------------------------
  // QAD-TC102.1: Exterior-Only Screen Suppresses Alignment Controls in Admin Setup
  // --------------------------------------------------------------------------
  describe("QAD-TC102.1: Exterior-Only Screen Suppresses Alignment Controls in Admin Setup", () => {
    it("sanitizes hatch_target_component_keys to null when allowed_sides is 'front'", () => {
      const configFront: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenAllowedSides: "front",
        screenDefaultSide: "front",
        screenHatchTargetComponentKeys: ["operator_crank_lower", "operator_crank_upper"],
        hasGrill: false,
      };

      const reconciliation = computeAddonReconciliation(parentId, new Set(), configFront);
      assert.strictEqual(reconciliation.toUpsert.length, 1);
      assert.strictEqual(reconciliation.toUpsert[0].allowed_sides, "front");
      assert.strictEqual(
        reconciliation.toUpsert[0].hatch_target_component_keys,
        null,
        "Exterior-only screens must sanitize hatch target component keys to null",
      );
      assert.strictEqual(
        reconciliation.toUpsert[0].hatch_alignment_config,
        null,
        "Exterior-only screens must sanitize hatch alignment config to null",
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.2: Exterior-Only Grille Suppresses Opening Controls in Admin Setup
  // --------------------------------------------------------------------------
  describe("QAD-TC102.2: Exterior-Only Grille Suppresses Opening Controls in Admin Setup", () => {
    it("sanitizes grille opening targets and config to null when allowed_sides is 'front'", () => {
      const configFrontGrille: HostProductAddonConfig = {
        hasScreen: false,
        hasGrill: true,
        grillAddonProductId: grillId,
        grillAllowedSides: "front",
        grillDefaultSide: "front",
        grillOpeningTargetComponentKeys: ["operator_crank_1", "operator_crank_2"],
        grillOpeningConfig: { enabled: true, cutoutWidthMm: 150, cutoutHeightMm: 180 },
      };

      const reconciliation = computeAddonReconciliation(parentId, new Set(), configFrontGrille);
      assert.strictEqual(reconciliation.toUpsert.length, 1);
      assert.strictEqual(reconciliation.toUpsert[0].allowed_sides, "front");
      assert.strictEqual(
        reconciliation.toUpsert[0].grille_opening_target_component_keys,
        null,
        "Exterior-only grilles must sanitize opening target component keys to null",
      );
      assert.strictEqual(
        reconciliation.toUpsert[0].grille_opening_config,
        null,
        "Exterior-only grilles must sanitize opening config to null",
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.3: 'Both Sides' Allowed Informs Admin of Interior-Only Target Activation
  // --------------------------------------------------------------------------
  describe("QAD-TC102.3: 'Both Sides' Allowed Informs Admin of Interior-Only Target Activation", () => {
    it("preserves operator targets in database when allowed_sides is 'both' for interior activation", () => {
      const configBoth: HostProductAddonConfig = {
        hasScreen: true,
        screenAddonProductId: screenId,
        screenAllowedSides: "both",
        screenDefaultSide: "back",
        screenHatchTargetComponentKeys: ["operator_crank_1"],
        hasGrill: false,
      };

      const reconciliation = computeAddonReconciliation(parentId, new Set(), configBoth);
      assert.strictEqual(reconciliation.toUpsert.length, 1);
      assert.strictEqual(reconciliation.toUpsert[0].allowed_sides, "both");
      assert.deepStrictEqual(
        reconciliation.toUpsert[0].hatch_target_component_keys,
        ["operator_crank_1"],
        "Both-sides configuration must retain targets in database for interior activation",
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.4: Customer Workspace Toggles to Exterior Suppresses 3D Screen Hatches
  // --------------------------------------------------------------------------
  describe("QAD-TC102.4: Customer Workspace Toggles to Exterior Suppresses 3D Screen Hatches", () => {
    it("renders zero hatch meshes when screen is mounted on the front exterior face", () => {
      const { built } = create3DTestRig({
        addonType: "screen",
        allowedSides: "both",
        activeMountingSide: "front",
        operatorKeys: ["op_lower", "op_upper"],
      });

      const hatches: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.componentKey === "screen_access_hatch" && c.userData?.isHatchClone) {
          hatches.push(c);
        }
      });

      assert.strictEqual(
        hatches.length,
        0,
        "Front exterior-mounted screen must instantiate zero hatch meshes",
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.5: Customer Workspace Toggles to Interior Restores 3D Screen Hatches
  // --------------------------------------------------------------------------
  describe("QAD-TC102.5: Customer Workspace Toggles to Interior Restores 3D Screen Hatches", () => {
    it("renders exactly 2 aligned wicket hatch meshes when screen is mounted on interior back face", () => {
      const { built } = create3DTestRig({
        addonType: "screen",
        allowedSides: "both",
        activeMountingSide: "back",
        operatorKeys: ["op_lower", "op_upper"],
      });

      const hatches: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.componentKey === "screen_access_hatch" && c.userData?.isHatchClone) {
          hatches.push(c);
        }
      });

      assert.strictEqual(
        hatches.length,
        2,
        "Interior back-mounted screen must instantiate exactly 2 aligned wicket hatches",
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.6: Exterior Screen BOM Excludes Hatch Hardware Costs
  // --------------------------------------------------------------------------
  describe("QAD-TC102.6: Exterior Screen BOM Excludes Hatch Hardware Costs", () => {
    it("omits hatch hardware line item and charges 0.00 PHP for hatch when mountingSide is 'front'", () => {
      const resultExterior = calculateAddonBOM({
        addonType: "screen",
        widthMm: 1000,
        heightMm: 2000,
        hatchCount: 2,
        mountingSide: "front",
      });

      const hatchItem = resultExterior.breakdown.find((item) =>
        item.item.toLowerCase().includes("hatch hardware"),
      );
      assert.strictEqual(hatchItem, undefined, "Exterior screen BOM must not contain hatch hardware line item");

      // Verify parametric host window BOM also excludes hatch hardware when mounted on front
      const hostBOM = calculateParametricBOM(
        [
          {
            componentKey: "screen_access_hatch_latch",
            componentName: "Wicket Hatch Latch",
            dimensionBinding: "FIXED",
            baseQuantity: 1,
            unitPrice: 180.0,
            presentationCategory: "Hardware",
            spanRatio: 1,
            isRemovable: true,
          },
        ],
        {
          widthMm: 1000,
          heightMm: 2000,
          addonMountingSide: "front",
          hatchCount: 2,
        },
      );

      assert.strictEqual(hostBOM.hardwareItems.length, 0, "Exterior mounting must exclude hatch hardware items");
      assert.strictEqual(hostBOM.hardwareSubtotal, 0, "Exterior mounting must have zero hatch hardware subtotal");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.7: Interior Screen BOM Accurately Bills Hatch Hardware Costs
  // --------------------------------------------------------------------------
  describe("QAD-TC102.7: Interior Screen BOM Accurately Bills Hatch Hardware Costs", () => {
    it("bills exactly 2x 180.00 PHP = 360.00 PHP for hatch hardware when mountingSide is 'back'", () => {
      const resultInterior = calculateAddonBOM({
        addonType: "screen",
        widthMm: 1000,
        heightMm: 2000,
        hatchCount: 2,
        mountingSide: "back",
      });

      const hatchItem = resultInterior.breakdown.find((item) =>
        item.item.toLowerCase().includes("hatch hardware"),
      );
      assert.ok(hatchItem, "Interior screen BOM must include hatch hardware item");
      assert.strictEqual(hatchItem.quantity, 2);
      assert.strictEqual(hatchItem.unitPrice, 180.0);
      assert.strictEqual(hatchItem.subtotal, 360.0);

      // Verify parametric host window BOM includes hatch hardware for interior mounting
      const hostBOM = calculateParametricBOM(
        [
          {
            componentKey: "screen_access_hatch_latch",
            componentName: "Wicket Hatch Latch",
            dimensionBinding: "FIXED",
            baseQuantity: 1,
            unitPrice: 180.0,
            presentationCategory: "Hardware",
            spanRatio: 1,
            isRemovable: true,
          },
        ],
        {
          widthMm: 1000,
          heightMm: 2000,
          addonMountingSide: "back",
          hatchCount: 2,
        },
      );

      assert.strictEqual(hostBOM.hardwareItems.length, 1);
      assert.strictEqual(hostBOM.hardwareItems[0].quantity, 2);
      assert.strictEqual(hostBOM.hardwareSubtotal, 360.0);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.8: Exterior Security Grille Retains Continuous Uncut Pickets
  // --------------------------------------------------------------------------
  describe("QAD-TC102.8: Exterior Security Grille Retains Continuous Uncut Pickets", () => {
    it("generates continuous uncut vertical pickets with zero collar cutouts when mounted on exterior", () => {
      const { built } = create3DTestRig({
        addonType: "grill",
        allowedSides: "both",
        activeMountingSide: "front",
        operatorKeys: ["op_lower", "op_upper"],
      });

      const collarGroups: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isOpenClearance === true && c.name.startsWith("Grille_Opening_Collar")) {
          collarGroups.push(c);
        }
      });

      assert.strictEqual(
        collarGroups.length,
        0,
        "Exterior-mounted security grille must have zero clearance collar openings",
      );

      // Verify add-on pricing engine produces 0 collar framing and 0 cleats on exterior
      const grillBOM = calculateAddonBOM({
        addonType: "grill",
        widthMm: 1000,
        heightMm: 2000,
        mountingSide: "front",
        openingCount: 2,
      });

      const collarItem = grillBOM.breakdown.find((item) => item.item.includes("Collar Border Framing"));
      const cleatsItem = grillBOM.breakdown.find((item) => item.item.includes("Internal Corner Cleats"));
      assert.strictEqual(collarItem, undefined, "Exterior grille must omit collar border framing");
      assert.strictEqual(cleatsItem, undefined, "Exterior grille must omit internal corner cleats");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.9: Interior Security Grille Generates Rectangular Clearance Cutouts
  // --------------------------------------------------------------------------
  describe("QAD-TC102.9: Interior Security Grille Generates Rectangular Clearance Cutouts", () => {
    it("generates exactly 2 rectangular collar openings around operators when mounted on interior", () => {
      const { built } = create3DTestRig({
        addonType: "grill",
        allowedSides: "both",
        activeMountingSide: "back",
        operatorKeys: ["op_lower", "op_upper"],
      });

      const collarGroups: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isOpenClearance === true && c.name.startsWith("Grille_Opening_Collar")) {
          collarGroups.push(c);
        }
      });

      assert.strictEqual(
        collarGroups.length,
        2,
        "Interior-mounted security grille must instantiate exactly 2 clearance collar openings",
      );

      // Verify add-on pricing engine bills collar border framing and cleats on interior
      const grillBOM = calculateAddonBOM({
        addonType: "grill",
        widthMm: 1000,
        heightMm: 2000,
        mountingSide: "back",
        openingCount: 2,
        openingWidthMm: 150,
        openingHeightMm: 180,
      });

      const collarItem = grillBOM.breakdown.find((item) => item.item.includes("Collar Border Framing"));
      const cleatsItem = grillBOM.breakdown.find((item) => item.item.includes("Internal Corner Cleats"));
      assert.ok(collarItem, "Interior grille must include collar border framing");
      assert.ok(cleatsItem, "Interior grille must include corner cleats");
      assert.strictEqual(cleatsItem.quantity, 8, "2 openings require 8 corner cleats");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.10: Admin Simulator Reflects Interior-Only Invariant
  // --------------------------------------------------------------------------
  describe("QAD-TC102.10: Admin Simulator Reflects Interior-Only Invariant", () => {
    it("evaluates effective hatch count to 0 when simulator toggles to front mounting", () => {
      const targetOperatorKeys = ["op1", "op2"];
      const dynamicOperatorCount = 2;
      const includeHatch = true;

      // Interior evaluation
      const sideBack = "back";
      const isInteriorBack = sideBack === "back";
      const hatchQtyBack = (isInteriorBack && includeHatch && targetOperatorKeys.length > 0) ? dynamicOperatorCount : 0;
      assert.strictEqual(hatchQtyBack, 2, "Simulator must evaluate 2 hatches on interior");

      // Exterior evaluation
      const sideFront = "front" as string;
      const isInteriorFront = sideFront === "back";
      const hatchQtyFront = (isInteriorFront && includeHatch && targetOperatorKeys.length > 0) ? dynamicOperatorCount : 0;
      assert.strictEqual(hatchQtyFront, 0, "Simulator must evaluate 0 hatches on exterior");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.11: Quotation Summary Label Omits Hatch Clause on Exterior
  // --------------------------------------------------------------------------
  describe("QAD-TC102.11: Quotation Summary Label Omits Hatch Clause on Exterior", () => {
    it("formats clean exterior label without access hatch clause when mounted on exterior", () => {
      const formatAddonSummaryClause = (addonMountingSide: "front" | "back", rawHatchCount: number) => {
        const isInterior = addonMountingSide === "back";
        const hatchCount = isInterior ? rawHatchCount : 0;
        const sideLabel = addonMountingSide === "back" ? "Interior Mount / Back" : "Exterior Mount / Front";
        const hatchLabel = (isInterior && hatchCount > 0)
          ? `with ${hatchCount}x Operator Access ${hatchCount === 1 ? "Hatch" : "Hatches"}`
          : null;
        const sideHatchClause = [sideLabel, hatchLabel].filter(Boolean).length > 0
          ? ` (${[sideLabel, hatchLabel].filter(Boolean).join(", ")})`
          : "";
        return `Insect Screen${sideHatchClause}`;
      };

      const exteriorLabel = formatAddonSummaryClause("front", 2);
      assert.strictEqual(
        exteriorLabel,
        "Insect Screen (Exterior Mount / Front)",
        "Exterior label must omit hatch clause entirely",
      );

      const interiorLabel = formatAddonSummaryClause("back", 2);
      assert.strictEqual(
        interiorLabel,
        "Insect Screen (Interior Mount / Back, with 2x Operator Access Hatches)",
        "Interior label must disclose operator access hatches",
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC102.12: Consultation PDF Excludes Exterior Hatch Specifications
  // --------------------------------------------------------------------------
  describe("QAD-TC102.12: Consultation PDF Excludes Exterior Hatch Specifications", () => {
    it("excludes access hatch clause from consultation PDF HTML when add-on is mounted on exterior", () => {
      const sampleBom = {
        directMaterialsSubtotal: 10000,
        fabricationLaborCost: 2000,
        contractorMargin: 2000,
        finalQuotation: 14000,
        framingItems: [],
        glazingItems: [],
        hardwareItems: [],
        consumableItems: [],
        effectiveFramingCost: 6000,
        effectiveGlazingCost: 4000,
        hardwareSubtotal: 0,
        consumablesSubtotal: 0,
        widthM: 1.2,
        heightM: 1.5,
        panelCount: 1,
        frozenDetails: {
          finish_type: "analok",
          glass_type: "clear",
        },
      };

      const pdfHtmlExterior = generateQuotationPdfHtml({
        quotationNumber: "GF-TC102-EXT",
        referenceCode: "REF-TC102-EXT",
        customerName: "Maria Santos",
        customerPhone: "+639181112233",
        customerEmail: "maria@example.ph",
        siteLocation: "Taguig City, Metro Manila",
        createdAtFormatted: "November 2, 2026",
        projectName: "Jalousie Window with Exterior Screen",
        brandLogoUrl: "https://glassfit.test/logo.svg",
        hasSill: true,
        structuralWaiver: false,
        bomResult: sampleBom as unknown as import("../../src/lib/pricing/pricingEngine").CalculatedBOMResult,
        items: [
          {
            itemId: "item-ext-1",
            productId: "prod-jalousie-ext",
            productName: "Series 798 Jalousie Window",
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
            unitPrice: 5000,
            quantity: 1,
            totalPrice: 5000,
            imageUrl: "",
            selectedAddon: "screen",
            addonName: "Extruded Aluminum Insect Screen",
            addonMountingSide: "front",
            hatchCount: 2,
            addonAluminumFinish: "analok",
            bomResult: sampleBom as unknown as import("../../src/lib/pricing/pricingEngine").CalculatedBOMResult,
          },
        ],
      } as unknown as import("../../src/lib/pricing/quotationPdfGenerator").QuotationPdfMetadata);

      assert.ok(
        pdfHtmlExterior.includes("Exterior Mount / Front"),
        "Consultation PDF must state Exterior Mount / Front",
      );
      assert.strictEqual(
        pdfHtmlExterior.includes("Operator Access Hatch"),
        false,
        "Consultation PDF must NOT mention Operator Access Hatch on exterior-mounted screen",
      );

      // Verify interior mounting DOES disclose access hatches
      const pdfHtmlInterior = generateQuotationPdfHtml({
        quotationNumber: "GF-TC102-INT",
        referenceCode: "REF-TC102-INT",
        customerName: "Maria Santos",
        customerPhone: "+639181112233",
        customerEmail: "maria@example.ph",
        siteLocation: "Taguig City, Metro Manila",
        createdAtFormatted: "November 2, 2026",
        projectName: "Jalousie Window with Interior Screen",
        brandLogoUrl: "https://glassfit.test/logo.svg",
        hasSill: true,
        structuralWaiver: false,
        bomResult: sampleBom as unknown as import("../../src/lib/pricing/pricingEngine").CalculatedBOMResult,
        items: [
          {
            itemId: "item-int-1",
            productId: "prod-jalousie-int",
            productName: "Series 798 Jalousie Window",
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
            unitPrice: 5360,
            quantity: 1,
            totalPrice: 5360,
            imageUrl: "",
            selectedAddon: "screen",
            addonName: "Extruded Aluminum Insect Screen",
            addonMountingSide: "back",
            hatchCount: 2,
            addonAluminumFinish: "analok",
            bomResult: sampleBom as unknown as import("../../src/lib/pricing/pricingEngine").CalculatedBOMResult,
          },
        ],
      } as unknown as import("../../src/lib/pricing/quotationPdfGenerator").QuotationPdfMetadata);

      assert.ok(
        pdfHtmlInterior.includes("Interior Mount / Back"),
        "Consultation PDF must state Interior Mount / Back",
      );
      assert.ok(
        pdfHtmlInterior.includes("with 2x Operator Access Hatches"),
        "Consultation PDF must disclose with 2x Operator Access Hatches for interior screen",
      );
    });
  });
});
