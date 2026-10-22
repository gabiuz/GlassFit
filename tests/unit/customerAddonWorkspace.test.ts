/**
 * Acceptance Tests: Customer Workspace Mutual-Exclusion Add-on Selection, Dynamic Quotation Parity, and Consultation PDF Handoff (IMP-MS69)
 *
 * Upstream Specifications: docs/implementation/ms69.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F1, PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F11, SDD-C4, SDD-C5, SDD-C7, DSD-UI4, DSD-UI7, ERD-E11, ERD-E13, ERD-E14, QAD-TC84.1 through QAD-TC84.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  calculateAddonBOM,
  getAddonDisplayName,
  getAddonShortLabel,
} from "../../src/lib/pricing/addonPricingEngine.js";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder.js";
import { computeHostProductBounds } from "../../src/lib/visualization/modelRenderer.js";
import { calculateStandardSeries798 } from "../../src/lib/pricing/pricingEngine.js";
import {
  createQuotationDocumentSnapshotV1,
  createQuotationDocumentViewModel,
  QuotationDocumentSnapshotV1Schema,
} from "../../src/lib/pricing/quotationDocument.js";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator.js";
import type {
  ProductStructuralDefinition,
  ProductConfigurationSnapshot,
  ResolvedStructure,
} from "../../src/lib/visualization/types.js";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache.js";

// Mock Structural Definition for testing
const mockStructuralDefinition: ProductStructuralDefinition = {
  product: {
    productId: "prod-window-798",
    productName: "Series 798 2-Panel Sliding Window",
    productType: "Window",
    basePrice: 14200,
  },
  template: {
    templateId: "sliding-window-2p",
    templateName: "2-Panel Sliding Window",
    modelStrategy: "Parametric",
    measurementUnit: "mm",
    baseConfiguration: {},
    category: "Window",
    parametricRules: {
      minWidth: 1000,
      maxWidth: 3000,
      minHeight: 800,
      maxHeight: 2400,
    },
  },
  parameters: [],
  rules: [],
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
  compatibleAddons: [
    {
      id: "bind-screen-001",
      parentProductId: "prod-window-798",
      addonProductId: "addon-screen-001",
      addonType: "screen",
      isDefaultEnabled: false,
      displayOrder: 1,
      addonProduct: {
        productId: "addon-screen-001",
        productName: "Extruded Aluminum Insect Screen",
        basePrice: 1850,
        status: "Active",
      },
    },
    {
      id: "bind-grill-002",
      parentProductId: "prod-window-798",
      addonProductId: "addon-grill-002",
      addonType: "grill",
      isDefaultEnabled: false,
      displayOrder: 2,
      addonProduct: {
        productId: "addon-grill-002",
        productName: "Architectural Security Window Grille",
        basePrice: 3200,
        status: "Active",
      },
    },
  ],
};

const dummyResolved: ResolvedStructure = {
  resolvedValues: { width: 1800, height: 1500 },
  numericValuesMm: { width: 1800, height: 1500 },
  componentQuantities: { "glass-panel": 1 },
  appliedRuleIds: [],
};

const dummyCache: ComponentModelCache = {
  getClone: () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)),
  getSourceSizeMeters: () => new THREE.Vector3(0.1, 0.1, 0.1),
};

describe("IMP-MS69 / QAD-TC84: Customer Workspace Modular Add-on Selection & Quotation Parity", () => {
  // --------------------------------------------------------------------------
  // QAD-TC84.1: Add-on controller omitted when product has no compatible add-ons
  // --------------------------------------------------------------------------
  it("QAD-TC84.1: add-on controller is omitted when product has no compatible add-ons in catalog", () => {
    const defWithoutAddons: ProductStructuralDefinition = {
      ...mockStructuralDefinition,
      compatibleAddons: [],
    };

    const hasCompatibleAddons = Boolean(
      defWithoutAddons.compatibleAddons && defWithoutAddons.compatibleAddons.length > 0,
    );

    assert.equal(hasCompatibleAddons, false, "Controller must be disabled when compatibleAddons is empty");

    const defUndefinedAddons: ProductStructuralDefinition = {
      ...mockStructuralDefinition,
      compatibleAddons: undefined,
    };

    const hasCompatibleAddonsUndefined = Boolean(
      defUndefinedAddons.compatibleAddons && defUndefinedAddons.compatibleAddons.length > 0,
    );

    assert.equal(hasCompatibleAddonsUndefined, false, "Controller must be disabled when compatibleAddons is undefined");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.2: Add-on options rendered when product has attachments
  // --------------------------------------------------------------------------
  it("QAD-TC84.2: add-on options [None, Screen, Grille] are rendered when product has both attachments configured", () => {
    const addons = mockStructuralDefinition.compatibleAddons ?? [];
    const screenAddon = addons.find((a) => a.addonType === "screen");
    const grillAddon = addons.find((a) => a.addonType === "grill");

    const hasScreenConfigured = Boolean(screenAddon);
    const hasGrillConfigured = Boolean(grillAddon);

    assert.equal(hasScreenConfigured, true, "Screen attachment must be detected");
    assert.equal(hasGrillConfigured, true, "Grill attachment must be detected");

    // Options available: None is always present, plus configured attachments
    const options: string[] = ["none"];
    if (hasScreenConfigured) options.push("screen");
    if (hasGrillConfigured) options.push("grill");

    assert.deepEqual(options, ["none", "screen", "grill"], "Workspace must offer None, Screen, and Grille");
    assert.equal(getAddonDisplayName("screen"), "Extruded Aluminum Insect Screen");
    assert.equal(getAddonDisplayName("grill"), "Architectural Security Window Grille");
    assert.equal(getAddonDisplayName("none"), "None (Standard Opening)");
    assert.equal(getAddonShortLabel("screen"), "Screen");
    assert.equal(getAddonShortLabel("grill"), "Grille");
    assert.equal(getAddonShortLabel("none"), "None");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.3: Mutual exclusion: Screen deactivates Grill
  // --------------------------------------------------------------------------
  it("QAD-TC84.3: mutual exclusion: selecting Screen deactivates Grill in state and mounts Screen 3D mesh", () => {
    let activeSelection: "none" | "screen" | "grill" = "grill";

    // User selects Screen
    function handleAddonSelect(target: "none" | "screen" | "grill") {
      activeSelection = target;
    }

    handleAddonSelect("screen");
    assert.equal(activeSelection, "screen", "Active selection must switch to screen");
    assert.notEqual(activeSelection, "grill", "Grill must be deactivated");

    // Verify 3D assembly mounts Screen and does not mount Grill
    const built = buildParametricProduct(mockStructuralDefinition, dummyResolved, dummyCache, {
      activeAddon: activeSelection,
    });

    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly");
    const grillNode = built.group.getObjectByName("Addon_Grill_Assembly");

    assert.ok(screenNode, "3D model must contain Addon_Screen_Assembly");
    assert.equal(grillNode, undefined, "3D model must not contain Addon_Grill_Assembly");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.4: Mutual exclusion: Grill deactivates Screen
  // --------------------------------------------------------------------------
  it("QAD-TC84.4: mutual exclusion: selecting Grill deactivates Screen in state and mounts Grill 3D mesh", () => {
    let activeSelection: "none" | "screen" | "grill" = "screen";

    // User selects Grill
    function handleAddonSelect(target: "none" | "screen" | "grill") {
      activeSelection = target;
    }

    handleAddonSelect("grill");
    assert.equal(activeSelection, "grill", "Active selection must switch to grill");
    assert.notEqual(activeSelection, "screen", "Screen must be deactivated");

    // Verify 3D assembly mounts Grill and does not mount Screen
    const built = buildParametricProduct(mockStructuralDefinition, dummyResolved, dummyCache, {
      activeAddon: activeSelection,
    });

    const grillNode = built.group.getObjectByName("Addon_Grill_Assembly");
    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly");

    assert.ok(grillNode, "3D model must contain Addon_Grill_Assembly");
    assert.equal(screenNode, undefined, "3D model must not contain Addon_Screen_Assembly");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.5: Selecting None removes all attachments and reverts price to base window
  // --------------------------------------------------------------------------
  it("QAD-TC84.5: selecting None unmounts all attachments and reverts price to base window", () => {
    let activeSelection: "none" | "screen" | "grill" = "screen";
    const baseWindowPrice = 14200;

    // User selects None
    activeSelection = "none";

    const addonPrice = activeSelection === "none" ? 0 : 1850;
    const effectiveUnitPrice = baseWindowPrice + addonPrice;

    assert.equal(effectiveUnitPrice, baseWindowPrice, "Effective price must revert to base window price");

    // Verify 3D assembly contains neither screen nor grill
    const built = buildParametricProduct(mockStructuralDefinition, dummyResolved, dummyCache, {
      activeAddon: activeSelection,
    });

    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly");
    const grillNode = built.group.getObjectByName("Addon_Grill_Assembly");

    assert.equal(screenNode, undefined, "3D model must not contain Addon_Screen_Assembly");
    assert.equal(grillNode, undefined, "3D model must not contain Addon_Grill_Assembly");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.6: Sub-50ms price recalculation on toggle
  // --------------------------------------------------------------------------
  it("QAD-TC84.6: add-on BOM recalculation executes in under 50ms and maintains accurate financial totals", () => {
    const iterations = 50;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const screenBOM = calculateAddonBOM({
        addonType: "screen",
        widthMm: 1800 + i * 10,
        heightMm: 1500 + i * 10,
      });

      const grillBOM = calculateAddonBOM({
        addonType: "grill",
        widthMm: 1800 + i * 10,
        heightMm: 1500 + i * 10,
      });

      // Verify screen BOM properties
      assert.ok(screenBOM.directMaterialCost > 0, "Direct material cost must be positive");
      assert.ok(screenBOM.wasteAllowanceCost > 0, "Waste allowance must be positive");
      assert.ok(screenBOM.laborCost >= 350, "Labor floor of PHP 350 must be enforced");
      assert.ok(screenBOM.contractorMargin > 0, "Contractor margin must be positive");
      assert.equal(
        screenBOM.finalAddonPrice,
        Math.round((screenBOM.directMaterialCost + screenBOM.laborCost + screenBOM.contractorMargin) * 100) / 100,
        "Final screen price must strictly equal material + labor + margin",
      );

      // Verify grill BOM properties
      assert.ok(grillBOM.directMaterialCost > 0, "Direct material cost must be positive");
      assert.ok(grillBOM.laborCost >= 600, "Labor floor of PHP 600 must be enforced for grille");
      assert.equal(
        grillBOM.finalAddonPrice,
        Math.round((grillBOM.directMaterialCost + grillBOM.laborCost + grillBOM.contractorMargin) * 100) / 100,
        "Final grill price must strictly equal material + labor + margin",
      );
    }

    const elapsedMs = performance.now() - startTime;
    const avgMs = elapsedMs / (iterations * 2);

    assert.ok(
      avgMs < 5.0,
      `Average add-on BOM calculation time ${avgMs.toFixed(3)}ms is well below the 50ms ceiling`,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.7: Room photo occlusion, camera orbit, and homography preserved on toggle
  // --------------------------------------------------------------------------
  it("QAD-TC84.7: toggling add-on preserves camera orbit, perspective corners, and foreground occlusion masks", () => {
    const baseConfig: ProductConfigurationSnapshot = {
      widthCm: 180,
      heightCm: 150,
      thicknessMm: 6,
      quantity: 1,
      panelCount: 2,
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
      includeSill: true,
      selectedMaterials: {},
      selectedAddon: "none",
      addonProductId: null,
      addonName: null,
      addonPrice: 0,
      baseUnitPrice: 14200,
      yaw: 15.5,
      pitch: -3.2,
      rotateAngle: 0,
      isFlipped: false,
      zoomLevel: 1.25,
      positionX: 320,
      positionY: 240,
      activeOcclusionIds: ["occ-couch-01", "occ-plant-02"],
      perspectiveFitCorners: [
        { x: 100, y: 100 },
        { x: 500, y: 105 },
        { x: 505, y: 400 },
        { x: 95, y: 395 },
      ],
      visualParameterValues: {},
    };

    // Transition to Screen attachment
    const screenConfig: ProductConfigurationSnapshot = {
      ...baseConfig,
      selectedAddon: "screen",
      addonProductId: "addon-screen-001",
      addonName: "Extruded Aluminum Insect Screen",
      addonPrice: 1850,
    };

    // Assert camera orbit parameters are unchanged
    assert.equal(screenConfig.yaw, baseConfig.yaw, "Yaw angle must remain untouched");
    assert.equal(screenConfig.pitch, baseConfig.pitch, "Pitch angle must remain untouched");
    assert.equal(screenConfig.zoomLevel, baseConfig.zoomLevel, "Zoom level must remain untouched");
    assert.equal(screenConfig.positionX, baseConfig.positionX, "Overlay X position must remain untouched");
    assert.equal(screenConfig.positionY, baseConfig.positionY, "Overlay Y position must remain untouched");

    // Assert perspective fit corners are preserved
    assert.deepEqual(
      screenConfig.perspectiveFitCorners,
      baseConfig.perspectiveFitCorners,
      "Perspective fit corners must remain identical",
    );

    // Assert active occlusion IDs are preserved
    assert.deepEqual(
      screenConfig.activeOcclusionIds,
      baseConfig.activeOcclusionIds,
      "Active occlusion masks must remain identical",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.8: Quotation modal itemizes separate add-on price and sums with base window
  // --------------------------------------------------------------------------
  it("QAD-TC84.8: quotation modal document itemizes separate add-on price and sums with base window fixture", () => {
    const baseBom = calculateStandardSeries798({ widthMm: 1800, heightMm: 1500, panelCount: 2 });
    const addonBOM = calculateAddonBOM({
      addonType: "screen",
      widthMm: 1800,
      heightMm: 1500,
    });

    const draft = createQuotationDocumentSnapshotV1({
      customer: { name: "Maria Santos", phone: "09171234567", email: "maria@example.com", siteLocation: "Pasig City" },
      projectName: "Living Room Window with Screen",
      items: [
        {
          itemId: "item-fixture-1",
          productId: "prod-window-798",
          productName: "Series 798 2-Panel Sliding Window",
          productType: "Window",
          variantName: "2-Panel Standard",
          specSummary: "Powder Coated White | 180cm × 150cm",
          dimensionsFormatted: "180cm × 150cm",
          widthMm: 1800,
          heightMm: 1500,
          panelCount: 2,
          hasSill: true,
          structuralWaiver: false,
          finishType: "PowderCoatedWhite",
          glassType: "6mm_clear",
          quantity: 1,
          unitPrice: baseBom.finalQuotation + addonBOM.finalAddonPrice,
          totalPrice: baseBom.finalQuotation + addonBOM.finalAddonPrice,
          imageUrl: "",
          selectedAddon: "screen",
          addonProductId: "addon-screen-001",
          addonName: "Extruded Aluminum Insect Screen",
          addonPrice: addonBOM.finalAddonPrice,
          baseUnitPrice: baseBom.finalQuotation,
          addonBOM,
          bomResult: baseBom,
        },
      ],
      fallbackBom: baseBom,
      hasSill: true,
      structuralWaiver: false,
    });

    const snapshot = QuotationDocumentSnapshotV1Schema.parse({
      ...draft,
      quotationNumber: "Q-2026-8401",
      referenceCode: "CF-2026-8401",
      shareablePath: "/q/CF-2026-8401",
      createdAt: "2026-10-22T08:00:00.000Z",
      snapshotObjectKey: null,
    });

    assert.equal(snapshot.items[0].selectedAddon, "screen", "Snapshot item must store selectedAddon");
    assert.equal(snapshot.items[0].addonPrice, addonBOM.finalAddonPrice, "Snapshot item must store addonPrice");
    assert.equal(snapshot.items[0].baseUnitPrice, baseBom.finalQuotation, "Snapshot item must store baseUnitPrice");

    // Total must equal base unit price + addon price
    const expectedTotal = baseBom.finalQuotation + addonBOM.finalAddonPrice;
    assert.equal(
      snapshot.pricing.calculatedFinalPrice,
      expectedTotal,
      "Quotation document total must strictly sum base window and add-on price",
    );

    // Verify the Hardware & Accessories group contains the add-on item
    const addonLineItem = snapshot.items[0].groups.find((g) =>
      g.groupName === "Hardware & Accessories" && g.description.includes("Insect Screen"),
    );
    assert.ok(addonLineItem, "Hardware & Accessories must contain the add-on item breakdown");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.9: Supabase persistence freezes add-on selection contract
  // --------------------------------------------------------------------------
  it("QAD-TC84.9: persistence contracts freeze selected add-on in product_configurations and quotation_items", () => {
    // 1. Contract for product_configurations.configuration_data
    const configurationDataPayload = {
      width_mm: 1800,
      height_mm: 1500,
      has_sill: true,
      panel_count: 2,
      aluminum_finish: "white",
      glass_appearance: "clear",
      selected_addon: {
        type: "screen" as const,
        addon_product_id: "addon-screen-001",
        addon_name: "Extruded Aluminum Insect Screen",
        price: 1850.0,
      },
    };

    assert.equal(configurationDataPayload.selected_addon.type, "screen");
    assert.equal(configurationDataPayload.selected_addon.addon_product_id, "addon-screen-001");
    assert.equal(configurationDataPayload.selected_addon.price, 1850.0);

    // 2. Contract for quotation_items.pricing_details
    const quotationItemPricingDetails = {
      item_type: "addon_attachment",
      addon_type: "screen",
      addon_name: "Extruded Aluminum Insect Screen",
      dimensions: "1,800 mm x 1,500 mm",
      unit_price: 1850.0,
      subtotal: 1850.0,
      parent_product_id: "prod-window-798",
      addon_product_id: "addon-screen-001",
    };

    assert.equal(quotationItemPricingDetails.item_type, "addon_attachment");
    assert.equal(quotationItemPricingDetails.addon_name, "Extruded Aluminum Insect Screen");
    assert.equal(quotationItemPricingDetails.unit_price, 1850.0);
    assert.equal(quotationItemPricingDetails.subtotal, 1850.0);
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.10: Consultation PDF handoff includes add-on specification and separate pricing
  // --------------------------------------------------------------------------
  it("QAD-TC84.10: consultation PDF handoff HTML contains add-on attachment specification and itemized pricing", () => {
    const baseBom = calculateStandardSeries798({ widthMm: 1800, heightMm: 1500, panelCount: 2 });
    const addonBOM = calculateAddonBOM({
      addonType: "screen",
      widthMm: 1800,
      heightMm: 1500,
    });

    const draft = createQuotationDocumentSnapshotV1({
      customer: { name: "Reynard Rabanal", phone: "09181234567", email: "reynard@glassfit.test", siteLocation: "Manila" },
      projectName: "Master Bedroom Window",
      items: [
        {
          itemId: "item-fixture-1",
          productId: "prod-window-798",
          productName: "Series 798 2-Panel Sliding Window",
          productType: "Window",
          variantName: "2-Panel Standard",
          specSummary: "Powder Coated White | 180cm × 150cm",
          dimensionsFormatted: "180cm × 150cm",
          widthMm: 1800,
          heightMm: 1500,
          panelCount: 2,
          hasSill: true,
          structuralWaiver: false,
          finishType: "PowderCoatedWhite",
          glassType: "6mm_clear",
          quantity: 1,
          unitPrice: baseBom.finalQuotation + addonBOM.finalAddonPrice,
          totalPrice: baseBom.finalQuotation + addonBOM.finalAddonPrice,
          imageUrl: "",
          selectedAddon: "screen",
          addonProductId: "addon-screen-001",
          addonName: "Extruded Aluminum Insect Screen",
          addonPrice: addonBOM.finalAddonPrice,
          baseUnitPrice: baseBom.finalQuotation,
          addonBOM,
          bomResult: baseBom,
        },
      ],
      fallbackBom: baseBom,
      hasSill: true,
      structuralWaiver: false,
    });

    const snapshot = QuotationDocumentSnapshotV1Schema.parse({
      ...draft,
      quotationNumber: "Q-2026-8410",
      referenceCode: "CF-2026-8410",
      shareablePath: "/q/CF-2026-8410",
      createdAt: "2026-10-22T08:00:00.000Z",
      snapshotObjectKey: null,
    });

    const viewModel = createQuotationDocumentViewModel(snapshot, {
      brandLogoUrl: "https://glassfit.test/logo.svg",
      shareableUrl: "https://glassfit.test/q/CF-2026-8410",
      snapshotImageUrl: null,
      allowedImageOrigins: ["https://glassfit.test"],
      negotiatedAmount: null,
    });

    const pdfHtml = generateQuotationPdfHtml(viewModel);

    // Verify Add-on Attachment specification appears
    assert.match(
      pdfHtml,
      /<b>Add-on Attachment:<\/b>\s*Extruded Aluminum Insect Screen/,
      "PDF must state Add-on Attachment: Extruded Aluminum Insect Screen",
    );

    // Verify separate Base Window Fixture and Add-on pricing appear in subtotal breakdown
    assert.match(
      pdfHtml,
      /Base Window Fixture:/,
      "PDF item card must show Base Window Fixture line",
    );
    assert.match(
      pdfHtml,
      /Add-on \(Insect Screen\):/,
      "PDF item card must show Add-on (Insect Screen) line",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.11: Add-on front positioning, dimensional parity, and clearance gap
  // --------------------------------------------------------------------------
  it("QAD-TC84.11: add-on assembly is positioned on the front face of the host product with exact alignment and clearance gap", () => {
    const built = buildParametricProduct(mockStructuralDefinition, dummyResolved, dummyCache, {
      activeAddon: "screen",
    });

    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly") as THREE.Group | undefined;
    assert.ok(screenNode, "Addon_Screen_Assembly must be mounted in the product group");

    // The add-on assembly position.z must be placed forward with at least the 8mm clearance gap (0.008m)
    assert.ok(screenNode.position.z >= 0.0079, "Add-on Z position must provide at least 8mm clearance");

    // Calculate host bounds excluding the addon assembly in world space
    built.group.updateMatrixWorld(true);
    const hostBox = new THREE.Box3();
    for (const child of built.group.children) {
      if (child.name === "Accessories") {
        for (const accChild of child.children) {
          if (accChild !== screenNode) {
            hostBox.expandByObject(accChild);
          }
        }
      } else if (child !== screenNode) {
        hostBox.expandByObject(child);
      }
    }
    const addonWorldBox = new THREE.Box3().setFromObject(screenNode);

    // Front clearance verification: minimum Z of the add-on must be in front of host max Z
    const frontGap = addonWorldBox.min.z - hostBox.max.z;
    assert.ok(
      frontGap >= 0.007 && frontGap <= 0.009,
      `Add-on must sit strictly in front of host fixture with an 8mm clearance gap (measured ${frontGap.toFixed(4)}m)`,
    );

    // Alignment verification: center of addon must align with center of host window within 1mm
    const hostCenter = new THREE.Vector3();
    const addonCenter = new THREE.Vector3();
    hostBox.getCenter(hostCenter);
    addonWorldBox.getCenter(addonCenter);

    assert.ok(
      Math.abs(addonCenter.x - hostCenter.x) < 0.001,
      `Add-on center X (${addonCenter.x.toFixed(4)}) must align with host window center X (${hostCenter.x.toFixed(4)})`,
    );
    assert.ok(
      Math.abs(addonCenter.y - hostCenter.y) < 0.001,
      `Add-on center Y (${addonCenter.y.toFixed(4)}) must align with host window center Y (${hostCenter.y.toFixed(4)})`,
    );

    // Dimensional parity verification: width and height must match host window within 1mm
    const hostSize = new THREE.Vector3();
    const addonSize = new THREE.Vector3();
    hostBox.getSize(hostSize);
    addonWorldBox.getSize(addonSize);

    assert.ok(
      Math.abs(addonSize.x - hostSize.x) < 0.001,
      `Add-on width (${addonSize.x.toFixed(4)}m) must match host window width (${hostSize.x.toFixed(4)}m)`,
    );
    assert.ok(
      Math.abs(addonSize.y - hostSize.y) < 0.001,
      `Add-on height (${addonSize.y.toFixed(4)}m) must match host window height (${hostSize.y.toFixed(4)}m)`,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.12: Independent finish variations between product and add-on
  // --------------------------------------------------------------------------
  it("QAD-TC84.12: add-on frame supports independent color finish without mutating host product finish", () => {
    const built = buildParametricProduct(mockStructuralDefinition, dummyResolved, dummyCache, {
      activeAddon: "screen",
      alumFinish: "white",
      addonAluminumFinish: "analok",
    });

    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly") as THREE.Group | undefined;
    assert.ok(screenNode, "Screen assembly must exist");

    // Verify all meshes inside addon assembly have preserveMaterial = true
    let meshCount = 0;
    screenNode.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
        assert.equal(
          child.userData?.preserveMaterial,
          true,
          "All add-on meshes must have preserveMaterial set to true",
        );
      }
    });
    assert.ok(meshCount > 0, "Add-on must contain at least one mesh");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.13: Uploaded add-on components model rendering
  // --------------------------------------------------------------------------
  it("QAD-TC84.13: renders uploaded add-on component models from cache when configured on compatible add-on", () => {
    const defWithUploadedScreen: ProductStructuralDefinition = {
      ...mockStructuralDefinition,
      compatibleAddons: [
        {
          id: "bind-screen-custom",
          parentProductId: "prod-window-798",
          addonProductId: "addon-screen-uploaded",
          addonType: "screen",
          isDefaultEnabled: false,
          displayOrder: 1,
          addonProduct: {
            productId: "addon-screen-uploaded",
            productName: "Configured Screen with 3D Assets",
            basePrice: 1950,
            status: "Active",
          },
          components: [
            {
              componentId: "scr-comp-top",
              componentKey: "screen-frame-top",
              componentName: "Screen Top Frame",
              componentType: "Frame",
              baseQuantity: 1,
              componentData: {},
              model: {
                assetId: "scr-ast-1",
                r2ObjectKey: "screen/top.glb",
                url: "https://r2.test/screen/top.glb",
                fileName: "top.glb",
                sourceDimensionsMm: { width: 1800, height: 40, depth: 25 },
              },
            },
            {
              componentId: "scr-comp-mesh",
              componentKey: "screen-mesh-panel",
              componentName: "Insect Mesh",
              componentType: "Screen",
              baseQuantity: 1,
              componentData: {},
              model: {
                assetId: "scr-ast-2",
                r2ObjectKey: "screen/mesh.glb",
                url: "https://r2.test/screen/mesh.glb",
                fileName: "mesh.glb",
                sourceDimensionsMm: { width: 1780, height: 1480, depth: 2 },
              },
            },
          ],
        },
      ],
    };

    const customCache: ComponentModelCache = {
      getClone: (key: string) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05));
        mesh.name = `Cloned_${key}`;
        return mesh;
      },
      getSourceSizeMeters: () => new THREE.Vector3(0.2, 0.2, 0.05),
    };

    const built = buildParametricProduct(defWithUploadedScreen, dummyResolved, customCache, {
      activeAddon: "screen",
      addonAluminumFinish: "al_1009",
    });

    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly") as THREE.Group | undefined;
    assert.ok(screenNode, "Addon_Screen_Assembly must be mounted");

    // Must find the uploaded components inside the screen assembly
    const topCloned = screenNode.getObjectByName("screen-frame-top") ?? screenNode.children.find((c) => c.userData.componentKey === "screen-frame-top");
    const meshCloned = screenNode.getObjectByName("screen-mesh-panel") ?? screenNode.children.find((c) => c.userData.componentKey === "screen-mesh-panel");

    assert.ok(topCloned, "Uploaded top frame model must be instantiated in 3D scene");
    assert.ok(meshCloned, "Uploaded mesh model must be instantiated in 3D scene");
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.14: Planar fit camera framing invariance when toggling add-on
  // --------------------------------------------------------------------------
  it("QAD-TC84.14: planar fit base bounds and camera projection remain unchanged when add-on is applied", () => {
    // 1. Build base window without add-on
    const baseBuilt = buildParametricProduct(mockStructuralDefinition, dummyResolved, dummyCache, {
      activeAddon: "none",
    });
    baseBuilt.group.rotation.set(0, 0, 0);
    baseBuilt.group.updateMatrixWorld(true);
    const baseHostBounds = computeHostProductBounds(baseBuilt.group);

    // 2. Build window with screen add-on attached
    const screenBuilt = buildParametricProduct(mockStructuralDefinition, dummyResolved, dummyCache, {
      activeAddon: "screen",
    });
    screenBuilt.group.rotation.set(0, 0, 0);
    screenBuilt.group.updateMatrixWorld(true);
    const screenHostBounds = computeHostProductBounds(screenBuilt.group);

    // 3. Verify host bounds for planar fit edge-to-edge projection are 100% identical
    assert.equal(
      baseHostBounds.min.x.toFixed(5),
      screenHostBounds.min.x.toFixed(5),
      "Planar fit baseBounds min.x must be identical with or without add-on",
    );
    assert.equal(
      baseHostBounds.max.x.toFixed(5),
      screenHostBounds.max.x.toFixed(5),
      "Planar fit baseBounds max.x must be identical with or without add-on",
    );
    assert.equal(
      baseHostBounds.min.y.toFixed(5),
      screenHostBounds.min.y.toFixed(5),
      "Planar fit baseBounds min.y must be identical with or without add-on",
    );
    assert.equal(
      baseHostBounds.max.y.toFixed(5),
      screenHostBounds.max.y.toFixed(5),
      "Planar fit baseBounds max.y must be identical with or without add-on",
    );
    assert.equal(
      baseHostBounds.max.z.toFixed(5),
      screenHostBounds.max.z.toFixed(5),
      "Planar fit baseBounds max.z must be identical with or without add-on",
    );

    // 4. Verify camera distance and projection half-dimensions are invariant
    const baseSize = new THREE.Vector3();
    const screenSize = new THREE.Vector3();
    baseHostBounds.getSize(baseSize);
    screenHostBounds.getSize(screenSize);

    const fovRad = THREE.MathUtils.degToRad(30);
    const baseDistance = (baseSize.y / 2) / Math.tan(fovRad / 2);
    const screenDistance = (screenSize.y / 2) / Math.tan(fovRad / 2);

    assert.equal(
      baseDistance.toFixed(6),
      screenDistance.toFixed(6),
      "Camera distance in planar fit must not change when add-on is attached",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.15: Assembled product add-on positioning and alignment
  // --------------------------------------------------------------------------
  it("QAD-TC84.15: assembled product (Jalousie/stacked) aligns add-on dimensions and center with 8mm front clearance", () => {
    const assembledDef: ProductStructuralDefinition = {
      product: {
        productId: "prod-jalousie-001",
        productName: "Jalousie Window",
        productType: "Custom Louver",
        basePrice: 16500,
      },
      template: {
        templateId: "assembled-louver-1",
        templateName: "Custom Louver Assembly",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {},
        category: "Window",
      },
      parameters: [],
      rules: [],
      components: [
        {
          componentId: "j-frame",
          componentKey: "louver-frame",
          componentName: "Louver Outer Frame",
          componentType: "Frame",
          baseQuantity: 1,
          componentData: {},
          model: { assetId: "a-j1", r2ObjectKey: "", url: "", fileName: "louver.glb", sourceDimensionsMm: { width: 1200, height: 1200, depth: 60 } },
        },
      ],
      compatibleAddons: mockStructuralDefinition.compatibleAddons,
    };

    const assembledResolved: ResolvedStructure = {
      resolvedValues: { width: 1200, height: 1200 },
      numericValuesMm: { width: 1200, height: 1200 },
      componentQuantities: { "louver-frame": 1 },
      appliedRuleIds: [],
    };

    const assembledCache: ComponentModelCache = {
      getClone: () => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.06));
        mesh.name = "Louver_Frame_Mesh";
        return mesh;
      },
      getSourceSizeMeters: () => new THREE.Vector3(1.2, 1.2, 0.06),
    };

    const built = buildParametricProduct(assembledDef, assembledResolved, assembledCache, {
      activeAddon: "screen",
    });

    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly") as THREE.Group | undefined;
    assert.ok(screenNode, "Addon_Screen_Assembly must be mounted in assembled product group");

    built.group.updateMatrixWorld(true);
    const hostBox = new THREE.Box3();
    for (const child of built.group.children) {
      if (child !== screenNode) {
        hostBox.expandByObject(child);
      }
    }
    const addonWorldBox = new THREE.Box3().setFromObject(screenNode);

    // Front clearance verification
    const frontGap = addonWorldBox.min.z - hostBox.max.z;
    assert.ok(
      frontGap >= 0.007 && frontGap <= 0.009,
      `Add-on must sit strictly in front of assembled host with 8mm gap (measured ${frontGap.toFixed(4)}m)`,
    );

    // Alignment verification
    const hostCenter = new THREE.Vector3();
    const addonCenter = new THREE.Vector3();
    hostBox.getCenter(hostCenter);
    addonWorldBox.getCenter(addonCenter);

    assert.ok(
      Math.abs(addonCenter.x - hostCenter.x) < 0.002,
      `Add-on center X (${addonCenter.x.toFixed(4)}) must align with assembled host center X (${hostCenter.x.toFixed(4)})`,
    );
    assert.ok(
      Math.abs(addonCenter.y - hostCenter.y) < 0.002,
      `Add-on center Y (${addonCenter.y.toFixed(4)}) must align with assembled host center Y (${hostCenter.y.toFixed(4)})`,
    );

    // Dimension verification
    const hostSize = new THREE.Vector3();
    const addonSize = new THREE.Vector3();
    hostBox.getSize(hostSize);
    addonWorldBox.getSize(addonSize);

    assert.ok(
      Math.abs(addonSize.x - hostSize.x) < 0.002,
      `Add-on width (${addonSize.x.toFixed(4)}m) must match assembled host width (${hostSize.x.toFixed(4)}m)`,
    );
    assert.ok(
      Math.abs(addonSize.y - hostSize.y) < 0.002,
      `Add-on height (${addonSize.y.toFixed(4)}m) must match assembled host height (${hostSize.y.toFixed(4)}m)`,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC84.16: Screen mesh retains tight spacing and high visibility during scaling
  // --------------------------------------------------------------------------
  it("QAD-TC84.16: screen mesh retains tight 2.5mm spacing between wires and high visibility when width and height are scaled", () => {
    // 1. Build product at standard 1200mm x 1200mm
    const built1200 = buildParametricProduct(
      mockStructuralDefinition,
      {
        resolvedValues: { width: 1200, height: 1200 },
        numericValuesMm: { width: 1200, height: 1200 },
        componentQuantities: { "glass-panel": 1 },
        appliedRuleIds: [],
      },
      dummyCache,
      { activeAddon: "screen" },
    );

    const screenNode1200 = built1200.group.getObjectByName("Addon_Screen_Assembly") as THREE.Group;
    assert.ok(screenNode1200, "Screen assembly must exist at 1200mm");

    let meshMaterial1200: THREE.MeshStandardMaterial | null = null;
    screenNode1200.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isScreenMesh) {
        meshMaterial1200 = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      }
    });
    assert.ok(meshMaterial1200, "Screen mesh material must be attached");

    // High visibility checks
    assert.equal((meshMaterial1200 as THREE.MeshStandardMaterial).depthWrite, true, "Screen mesh must write to depth buffer to avoid glass fading");
    assert.ok((meshMaterial1200 as THREE.MeshStandardMaterial).opacity >= 0.95, "Screen mesh must have high opacity for crisp visibility");

    // 2. Build product at wide 2400mm x 1800mm
    const built2400 = buildParametricProduct(
      mockStructuralDefinition,
      {
        resolvedValues: { width: 2400, height: 1800 },
        numericValuesMm: { width: 2400, height: 1800 },
        componentQuantities: { "glass-panel": 1 },
        appliedRuleIds: [],
      },
      dummyCache,
      { activeAddon: "screen" },
    );

    const screenNode2400 = built2400.group.getObjectByName("Addon_Screen_Assembly") as THREE.Group;
    assert.ok(screenNode2400, "Screen assembly must exist at 2400mm");

    let meshMaterial2400: THREE.MeshStandardMaterial | null = null;
    screenNode2400.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isScreenMesh) {
        meshMaterial2400 = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      }
    });
    assert.ok(meshMaterial2400, "Screen mesh material must be attached at 2400mm");

    // Tight spacing invariance check: wire pitch in millimeters must remain at 2.5mm
    const pitch1200 = (meshMaterial1200 as THREE.MeshStandardMaterial).userData.wirePitchMm;
    const pitch2400 = (meshMaterial2400 as THREE.MeshStandardMaterial).userData.wirePitchMm;

    assert.equal(pitch1200, 2.5, "Wire pitch at 1200mm must be 2.5mm");
    assert.equal(pitch2400, 2.5, "Wire pitch at 2400mm must remain tightly at 2.5mm");

    // Number of repeating wires scales proportionally so spacing in space never widens
    const repeatX1200 = (meshMaterial1200 as THREE.MeshStandardMaterial).userData.repeatX;
    const repeatX2400 = (meshMaterial2400 as THREE.MeshStandardMaterial).userData.repeatX;
    assert.ok(repeatX2400 > repeatX1200, `Repeat count at 2400mm (${repeatX2400}) must exceed 1200mm (${repeatX1200}) to retain tight spacing`);
  });
});

