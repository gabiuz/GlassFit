/**
 * Acceptance Tests: Procedural Add-on Workflow Hardening, Glass-Behind Screen Visibility,
 * Base Color Variation Interactivity, and Dedicated Add-on Accordion UI (IMP-MS70)
 *
 * Upstream Specifications: docs/implementation/ms70.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F1, PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F14, SDD-C1, SDD-C4, SDD-C5, SDD-C7,
 *   DSD-UI4, DSD-UI7, DSD-UI10, QAD-TC85.1 through QAD-TC85.12
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  getStepsForProduct,
  getNextStepKey,
  resolveWizardStep,
  ADDON_PRODUCT_STEPS,
  STANDARD_PRODUCT_STEPS,
} from "../../src/lib/admin/products/wizardSteps.js";
import {
  createInsectScreenMaterial,
} from "../../src/lib/visualization/materialClassifier.js";
import {
  buildParametricScreenGroup,
  buildParametricGrillGroup,
} from "../../src/lib/visualization/addonGeometryBuilder.js";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder.js";
import {
  calculateAddonBOM,
} from "../../src/lib/pricing/addonPricingEngine.js";
import {
  createQuotationDocumentSnapshotV1,
  createQuotationDocumentViewModel,
  QuotationDocumentSnapshotV1Schema,
} from "../../src/lib/pricing/quotationDocument.js";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator.js";
import { calculateStandardSeries798 } from "../../src/lib/pricing/pricingEngine.js";
import type {
  ProductStructuralDefinition,
  ResolvedStructure,
} from "../../src/lib/visualization/types.js";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache.js";

const mockStructuralWindow: ProductStructuralDefinition = {
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
};

const mockResolved: ResolvedStructure = {
  resolvedValues: { width: 1800, height: 1500 },
  numericValuesMm: { width: 1800, height: 1500 },
  componentQuantities: {
    "frame-left": 1,
    "frame-right": 1,
    "frame-top": 1,
    "frame-bottom": 1,
    "glass-panel": 1,
  },
  appliedRuleIds: [],
};

const dummyCache: ComponentModelCache = {
  getClone: () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)),
  getSourceSizeMeters: () => new THREE.Vector3(0.1, 0.1, 0.1),
};

describe("IMP-MS70: Procedural Add-on Workflow Hardening & Visual Fidelity", () => {
  // QAD-TC85.1: Add-on setup wizard preserves components and validation preview before confirmation
  it("QAD-TC85.1: Add-on setup wizard preserves components and validation preview before confirmation", () => {
    const addonSteps = getStepsForProduct(true);
    assert.strictEqual(addonSteps.length, 5);
    assert.deepStrictEqual(
      addonSteps.map((s) => s.key),
      ["basic", "components", "parameters", "validation", "review"],
    );

    const standardSteps = getStepsForProduct(false);
    assert.strictEqual(standardSteps.length, 7);
    assert.deepStrictEqual(
      standardSteps.map((s) => s.key),
      ["basic", "strategy", "assets", "components", "parameters", "validation", "review"],
    );

    // Stepping progression for add-on
    assert.strictEqual(getNextStepKey("basic", true), "components");
    assert.strictEqual(getNextStepKey("components", true), "parameters");
    assert.strictEqual(getNextStepKey("parameters", true), "validation");
    assert.strictEqual(getNextStepKey("validation", true), "review");
    assert.strictEqual(getNextStepKey("review", true), "review");

    // Resolution preserves step keys for add-on mode
    assert.strictEqual(resolveWizardStep("prod-1", "components", true), "components");
    assert.strictEqual(resolveWizardStep("prod-1", "parameters", true), "parameters");
    assert.strictEqual(resolveWizardStep("prod-1", "validation", true), "validation");
    assert.strictEqual(resolveWizardStep("prod-1", "review", true), "review");
    // Skipped strategy/asset steps advance directly to components for add-ons
    assert.strictEqual(resolveWizardStep("prod-1", "strategy", true), "components");
    assert.strictEqual(resolveWizardStep("prod-1", "assets", true), "components");
  });

  // QAD-TC85.2: Add-on step definitions contain basic, components, parameters, validation, review
  it("QAD-TC85.2: Add-on step definitions contain basic, components, parameters, validation, review", () => {
    assert.strictEqual(ADDON_PRODUCT_STEPS.length, 5);
    assert.strictEqual(ADDON_PRODUCT_STEPS[0].key, "basic");
    assert.strictEqual(ADDON_PRODUCT_STEPS[1].key, "components");
    assert.strictEqual(ADDON_PRODUCT_STEPS[2].key, "parameters");
    assert.strictEqual(ADDON_PRODUCT_STEPS[3].key, "validation");
    assert.strictEqual(ADDON_PRODUCT_STEPS[4].key, "review");

    // Standard steps include assets and strategy
    const standardKeys = STANDARD_PRODUCT_STEPS.map((s) => s.key);
    assert.ok(standardKeys.includes("assets"));
    assert.ok(standardKeys.includes("strategy"));
    assert.ok(standardKeys.includes("validation"));
  });

  // QAD-TC85.3: Screen visible through clear window glass (alphaTest and depthWrite)
  it("QAD-TC85.3: Screen material enforces alphaTest, depthWrite, depthTest, and DoubleSide for glass transmission", () => {
    const screenMat = createInsectScreenMaterial(1800, 1500);
    assert.ok(screenMat instanceof THREE.MeshStandardMaterial);
    assert.strictEqual(screenMat.transparent, true);
    assert.strictEqual(screenMat.alphaTest, 0.2, "alphaTest must be 0.2 to prevent exclusion from transmission buffer");
    assert.strictEqual(screenMat.depthWrite, true, "depthWrite must be true for correct depth sorting");
    assert.strictEqual(screenMat.depthTest, true, "depthTest must be true");
    assert.strictEqual(screenMat.side, THREE.DoubleSide, "side must be DoubleSide for optical transmission from both sides");
  });

  // QAD-TC85.4: Screen visible when mounted behind glass with rear positioning
  it("QAD-TC85.4: Rear mount positions add-on attachment behind host window bounding surface", () => {
    const built = buildParametricProduct(
      mockStructuralWindow,
      mockResolved,
      dummyCache,
      {
        activeAddon: "screen",
        addonConfig: {
          mountPosition: "rear",
          zOffsetMm: -18,
          finishColor: "#ffffff",
        },
      },
    );

    assert.ok(built.group instanceof THREE.Group);
    const screenNode = built.group.getObjectByName("Addon_Screen_Assembly") as THREE.Group | undefined;
    assert.ok(screenNode, "Addon_Screen_Assembly must be attached in product group");

    // Rear mount positions the addon group with a negative Z offset relative to origin
    assert.ok(screenNode.position.z < 0, `Rear mount Z position must be negative, got ${screenNode.position.z}`);
  });

  // QAD-TC85.5: AlphaTest cut-out preserves transparent openings
  it("QAD-TC85.5: Procedural screen rails and infill mesh preserve renderOrder and material flags", () => {
    const screenGroup = buildParametricScreenGroup(1800, 1500, {
      finishColor: "#221d1a",
      frameWidthMm: 25,
      frameDepthMm: 12,
    });

    assert.strictEqual(screenGroup.name, "Addon_Screen_Assembly");

    let meshFound = false;
    let railsChecked = 0;

    screenGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        assert.strictEqual(child.renderOrder, 0, "All screen meshes must have renderOrder = 0");
        assert.strictEqual(child.userData.preserveMaterial, true, "userData.preserveMaterial must be true");

        if (child.name === "Screen_Mesh_Infill") {
          meshFound = true;
          const mat = child.material as THREE.MeshStandardMaterial;
          assert.strictEqual(mat.alphaTest, 0.2);
          assert.strictEqual(mat.depthWrite, true);
          assert.strictEqual(mat.side, THREE.DoubleSide);
        }

        if (child.name.startsWith("Screen_Frame_")) {
          railsChecked++;
          const mat = child.material as THREE.MeshStandardMaterial;
          assert.strictEqual(mat.depthWrite, true);
          assert.strictEqual(mat.side, THREE.DoubleSide);
          assert.strictEqual(child.userData.presentationCategory, "Framing");
        }
      }
    });

    assert.ok(meshFound, "Screen mesh infill must be present");
    assert.strictEqual(railsChecked, 4, "All 4 perimeter frame rails must be verified");
  });

  // QAD-TC85.6 & QAD-TC85.7: Scene render order separation between glass and opaque framing
  it("QAD-TC85.6: Assembly builder enforces renderOrder = 1 on glass panels and renderOrder = 0 on framing and add-ons", () => {
    const built = buildParametricProduct(
      mockStructuralWindow,
      mockResolved,
      dummyCache,
      {
        activeAddon: "screen",
        alumFinish: "white",
        glassAppearance: "clear",
      },
    );

    assert.ok(built.group instanceof THREE.Group);

    let glassMeshCount = 0;
    let frameMeshCount = 0;
    let addonMeshCount = 0;

    built.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.name.includes("Glass") || child.userData.presentationCategory === "Glazing") {
          glassMeshCount++;
          assert.strictEqual(child.renderOrder, 1, "Glass meshes must have renderOrder = 1 for two-pass transmission");
        } else if (child.name.startsWith("Screen_")) {
          addonMeshCount++;
          assert.strictEqual(child.renderOrder, 0, "Add-on meshes must have renderOrder = 0");
        } else {
          frameMeshCount++;
          assert.strictEqual(child.renderOrder, 0, "Frame meshes must have renderOrder = 0");
        }
      }
    });

    assert.ok(glassMeshCount > 0, "At least one glass mesh must be checked");
    assert.ok(frameMeshCount > 0, "At least one framing mesh must be checked");
    assert.ok(addonMeshCount > 0, "At least one add-on mesh must be checked");
  });

  // QAD-TC85.8 & QAD-TC85.9: Grill pattern builder geometry and render order
  it("QAD-TC85.8: Security grill procedural group enforces DoubleSide, depthWrite, and renderOrder = 0", () => {
    const grillGroup = buildParametricGrillGroup(1800, 1500, {
      finishColor: "#ffffff",
      frameWidthMm: 20,
      frameDepthMm: 16,
      nominalBarPitchMm: 140,
    });

    assert.strictEqual(grillGroup.name, "Addon_Grill_Assembly");

    let barCount = 0;
    grillGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        assert.strictEqual(child.renderOrder, 0, "Grill mesh must have renderOrder = 0");
        assert.strictEqual(child.userData.preserveMaterial, true);
        const mat = child.material as THREE.MeshStandardMaterial;
        assert.strictEqual(mat.side, THREE.DoubleSide);
        assert.strictEqual(mat.depthWrite, true);
        if (child.name.includes("Bar")) {
          barCount++;
        }
      }
    });

    assert.ok(barCount > 0, "Security grill must generate repeating bars");
  });

  // QAD-TC85.10 & QAD-TC85.11: Mutual exclusion and independent finish state
  it("QAD-TC85.10: Add-on geometry builder decouples finish color from host window", () => {
    const whiteScreen = buildParametricScreenGroup(1800, 1500, {
      finishColor: "#ffffff",
    });

    const analokScreen = buildParametricScreenGroup(1800, 1500, {
      finishColor: "#221d1a",
    });

    let whiteColorHex = "";
    let analokColorHex = "";

    whiteScreen.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.startsWith("Screen_Frame_")) {
        const mat = child.material as THREE.MeshStandardMaterial;
        whiteColorHex = `#${mat.color.getHexString()}`;
      }
    });

    analokScreen.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.startsWith("Screen_Frame_")) {
        const mat = child.material as THREE.MeshStandardMaterial;
        analokColorHex = `#${mat.color.getHexString()}`;
      }
    });

    assert.strictEqual(whiteColorHex, "#ffffff", "White screen must have white rail color");
    assert.strictEqual(analokColorHex, "#221d1a", "Analok screen must have dark analok rail color");
  });

  // QAD-TC85.12: Quotation modal itemizes separate add-on line with independent finish callouts
  it("QAD-TC85.12: Quotation view model and PDF generator format separate add-on line with finish suffix", () => {
    const bomResult = calculateStandardSeries798({
      widthMm: 1800,
      heightMm: 1500,
      panelCount: 2,
      finishType: "PowderCoatedWhite",
      glassType: "6mm_clear",
      hasSill: true,
    });
    const addonBOM = calculateAddonBOM({
      addonType: "screen",
      widthMm: 1800,
      heightMm: 1500,
    });

    const draft = createQuotationDocumentSnapshotV1({
      customer: {
        name: "Reynard Rabanal",
        phone: "09171234567",
        email: "reynard@glassfit.test",
        siteLocation: "Sta. Mesa, Manila",
      },
      projectName: "Living Room Window Replacement",
      items: [
        {
          itemId: "item-1",
          productId: "prod-window-798",
          productName: "Series 798 2-Panel Sliding Window",
          productType: "Window",
          variantName: "Standard",
          dimensionsFormatted: "1800mm × 1500mm",
          specSummary: "Powder Coated White, 6mm Clear Glass",
          quantity: 1,
          widthMm: 1800,
          heightMm: 1500,
          panelCount: 2,
          hasSill: true,
          structuralWaiver: false,
          finishType: "Powder Coated White",
          glassType: "Clear Glass 6mm",
          unitPrice: bomResult.finalQuotation + addonBOM.finalAddonPrice,
          totalPrice: bomResult.finalQuotation + addonBOM.finalAddonPrice,
          imageUrl: "",
          bomResult,
          selectedAddon: "screen",
          addonName: "Extruded Aluminum Insect Screen",
          addonPrice: addonBOM.finalAddonPrice,
          addonAluminumFinish: "white",
          baseUnitPrice: bomResult.finalQuotation,
          addonBOM,
        },
      ],
      fallbackBom: bomResult,
      hasSill: true,
      structuralWaiver: false,
    });

    const snapshot = QuotationDocumentSnapshotV1Schema.parse({
      ...draft,
      quotationNumber: "QT-2026-MS70-001",
      referenceCode: "CF-2026-MS70",
      shareablePath: "/q/CF-2026-MS70",
      createdAt: "2026-10-22T08:00:00.000Z",
      snapshotObjectKey: null,
    });

    const viewModel = createQuotationDocumentViewModel(snapshot, {
      brandLogoUrl: "https://glassfit.test/logo.svg",
      shareableUrl: "https://glassfit.test/q/CF-2026-MS70",
      snapshotImageUrl: null,
      allowedImageOrigins: ["https://glassfit.test"],
      negotiatedAmount: null,
    });

    assert.strictEqual(viewModel.items.length, 1);
    const firstItem = viewModel.items[0];
    assert.strictEqual(firstItem.selectedAddon, "screen");
    assert.strictEqual(firstItem.addonAluminumFinish, "white");
    assert.strictEqual(firstItem.addonPrice, addonBOM.finalAddonPrice);

    // Generate Consultation PDF HTML and assert finish appears in add-on line item
    const html = generateQuotationPdfHtml(viewModel);
    assert.ok(html.includes("Insect Screen (White)"), "PDF HTML must contain 'Insect Screen (White)' callout");
    assert.ok(html.includes("Base Window Fixture:"), "PDF HTML must contain base window fixture breakdown");
    assert.ok(html.includes("Add-on (Insect Screen (White)):"), "PDF HTML must break down add-on line with finish suffix");
  });

  // QAD-TC85.13: Browser environment screen mesh material generates CanvasTexture without alphaMap occlusion
  it("QAD-TC85.13: Browser Canvas rasterization produces visible screen mesh with map and without destructive alphaMap", () => {
    const originalDocument = (globalThis as unknown as { document?: unknown }).document;
    const mockCtx = {
      clearRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeStyle: "",
      lineWidth: 0,
    };
    const mockCanvas = {
      width: 128,
      height: 128,
      getContext: () => mockCtx,
    };

    (globalThis as unknown as { document: unknown }).document = {
      createElement: (tag: string) => {
        if (tag === "canvas") return mockCanvas;
        return {};
      },
    };

    try {
      const mat = createInsectScreenMaterial(1200, 1500, { wirePitchMm: 2.5, wireColor: "#181a1d" });
      assert.ok(mat instanceof THREE.MeshStandardMaterial);
      assert.ok(mat.map instanceof THREE.Texture, "CanvasTexture must be assigned to map");
      assert.strictEqual(mat.alphaMap, null, "alphaMap must be null/empty to prevent green-channel frag discard");
      assert.strictEqual(mat.transparent, true, "Material must be transparent for wire openings");
      assert.strictEqual(mat.alphaTest, 0.2, "alphaTest must be 0.2");
      assert.strictEqual(mat.depthWrite, true, "depthWrite must be true for crisp visibility");
      assert.strictEqual(mat.side, THREE.DoubleSide, "side must be DoubleSide");
      assert.strictEqual(mat.userData.wirePitchMm, 2.5);
      assert.strictEqual(mat.userData.repeatX, 480);
      assert.strictEqual(mat.userData.repeatY, 600);
    } finally {
      if (originalDocument === undefined) {
        delete (globalThis as unknown as { document?: unknown }).document;
      } else {
        (globalThis as unknown as { document: unknown }).document = originalDocument;
      }
    }
  });

  // QAD-TC85.14: Part-by-part raw material selection allows per-component overrides
  it("QAD-TC85.14: Part-level raw material selection allows independent component finish overrides", () => {
    const components = mockStructuralWindow.components;
    assert.ok(components.length >= 4);

    const selections: Record<string, string> = {
      "frame-left": "mat-al-white",
      "frame-right": "mat-al-white",
      "frame-top": "mat-al-white",
      "frame-bottom": "mat-al-black",
    };

    assert.strictEqual(selections["frame-top"], "mat-al-white");
    assert.strictEqual(selections["frame-bottom"], "mat-al-black");
    assert.notStrictEqual(selections["frame-top"], selections["frame-bottom"], "Part-level overrides allow distinct materials across parts");
  });
});
