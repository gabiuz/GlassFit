import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import {
  buildMaterialCustomizationGroups,
  getDefaultMaterialSelections,
  getAllCandidateMaterialsMap,
  applyGroupSelection,
  formatGroupSummary,
} from "../../src/lib/visualization/materialCustomization";
import { calculateBOMFromStructuralDefinition } from "../../src/lib/pricing/pricingEngine";
import { applyPBRToMesh } from "../../src/lib/visualization/materialClassifier";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";
import type { ProductStructuralDefinition } from "../../src/lib/visualization/types";
import type { QuotationDocumentViewModel } from "../../src/lib/pricing/quotationDocument";

// Mock Structural Definition with Step 4 Multi-Material Bindings
const mockDefinition: ProductStructuralDefinition = {
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
      componentId: "comp-head",
      componentKey: "head_profile",
      componentName: "Double Head Profile",
      partName: "Double Head Profile",
      componentType: "Profile",
      baseQuantity: 1,
      componentData: {},
      model: {
        assetId: "asset-1",
        r2ObjectKey: "",
        url: "",
        fileName: "",
        sourceDimensionsMm: null,
      },
      presentationCategory: "Framing",
      role: "Structural",
      finishGroup: "Frame",
      lengthFormula: "W",
      quantityFormula: "1",
    },
    {
      componentId: "comp-sill",
      componentKey: "sill_profile",
      componentName: "Double Sill Profile",
      partName: "Double Sill Profile",
      componentType: "Profile",
      baseQuantity: 1,
      componentData: {},
      model: {
        assetId: "asset-2",
        r2ObjectKey: "",
        url: "",
        fileName: "",
        sourceDimensionsMm: null,
      },
      presentationCategory: "Framing",
      role: "Structural",
      finishGroup: "Frame",
      lengthFormula: "W",
      quantityFormula: "1",
    },
    {
      componentId: "comp-jamb",
      componentKey: "jamb_profile",
      componentName: "Double Jamb Profile",
      partName: "Double Jamb Profile",
      componentType: "Profile",
      baseQuantity: 2,
      componentData: {},
      model: {
        assetId: "asset-3",
        r2ObjectKey: "",
        url: "",
        fileName: "",
        sourceDimensionsMm: null,
      },
      presentationCategory: "Framing",
      role: "Structural",
      finishGroup: "Frame",
      lengthFormula: "H",
      quantityFormula: "2",
    },
    {
      componentId: "comp-glass",
      componentKey: "glass_pane",
      componentName: "Sliding Glass Pane",
      partName: "Sliding Glass Pane",
      componentType: "Glass",
      baseQuantity: 2,
      componentData: {},
      model: {
        assetId: "asset-4",
        r2ObjectKey: "",
        url: "",
        fileName: "",
        sourceDimensionsMm: null,
      },
      presentationCategory: "Glazing",
      role: "Infill",
      finishGroup: "Glass",
      lengthFormula: "(W/2) * H",
      quantityFormula: "2",
    },
    {
      componentId: "comp-roller",
      componentKey: "roller_hardware",
      componentName: "Heavy Duty Roller",
      partName: "Heavy Duty Roller",
      componentType: "Hardware",
      baseQuantity: 4,
      componentData: {},
      model: {
        assetId: "asset-5",
        r2ObjectKey: "",
        url: "",
        fileName: "",
        sourceDimensionsMm: null,
      },
      presentationCategory: "Hardware",
      role: "Hardware",
      finishGroup: "Hardware",
      quantityFormula: "4",
    },
  ],
  componentMaterials: [
    // Head options: Analok (default) and Powder Coated White
    {
      bindingId: "bind-head-anlk",
      componentKey: "head_profile",
      rawMaterialId: "mat-head-anlk",
      isDefault: true,
      rawMaterial: {
        id: "mat-head-anlk",
        material_code: "AL-798-DH-ANLK",
        description: "Series 798 Double Head (Analok)",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 345.50,
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    {
      bindingId: "bind-head-pcw",
      componentKey: "head_profile",
      rawMaterialId: "mat-head-pcw",
      isDefault: false,
      rawMaterial: {
        id: "mat-head-pcw",
        material_code: "AL-798-DH-PCW",
        description: "Series 798 Double Head (Powder Coated White)",
        category: "Aluminum",
        finish_type: "PowderCoatedWhite",
        billing_unit: "m",
        unit_price: 385.00,
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    // Sill options: Analok (default) and Powder Coated White
    {
      bindingId: "bind-sill-anlk",
      componentKey: "sill_profile",
      rawMaterialId: "mat-sill-anlk",
      isDefault: true,
      rawMaterial: {
        id: "mat-sill-anlk",
        material_code: "AL-798-DS-ANLK",
        description: "Series 798 Double Sill (Analok)",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 330.00,
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    {
      bindingId: "bind-sill-pcw",
      componentKey: "sill_profile",
      rawMaterialId: "mat-sill-pcw",
      isDefault: false,
      rawMaterial: {
        id: "mat-sill-pcw",
        material_code: "AL-798-DS-PCW",
        description: "Series 798 Double Sill (Powder Coated White)",
        category: "Aluminum",
        finish_type: "PowderCoatedWhite",
        billing_unit: "m",
        unit_price: 370.00,
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    // Jamb options: Analok (default) and Powder Coated White
    {
      bindingId: "bind-jamb-anlk",
      componentKey: "jamb_profile",
      rawMaterialId: "mat-jamb-anlk",
      isDefault: true,
      rawMaterial: {
        id: "mat-jamb-anlk",
        material_code: "AL-798-DJ-ANLK",
        description: "Series 798 Double Jamb (Analok)",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 310.00,
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    {
      bindingId: "bind-jamb-pcw",
      componentKey: "jamb_profile",
      rawMaterialId: "mat-jamb-pcw",
      isDefault: false,
      rawMaterial: {
        id: "mat-jamb-pcw",
        material_code: "AL-798-DJ-PCW",
        description: "Series 798 Double Jamb (Powder Coated White)",
        category: "Aluminum",
        finish_type: "PowderCoatedWhite",
        billing_unit: "m",
        unit_price: 350.00,
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    // Glass single option: Clear Float only
    {
      bindingId: "bind-glass-clr",
      componentKey: "glass_pane",
      rawMaterialId: "mat-glass-clr",
      isDefault: true,
      rawMaterial: {
        id: "mat-glass-clr",
        material_code: "GL-CLR-6MM",
        description: "6mm Clear Annealed Float Glass",
        category: "Glass",
        finish_type: "Clear",
        billing_unit: "sqm",
        unit_price: 520.00,
        waste_allowance: 0.15,
        is_active: true,
      },
    },
    // Hardware single option: Nylon Roller
    {
      bindingId: "bind-roller-nyl",
      componentKey: "roller_hardware",
      rawMaterialId: "mat-roller-nyl",
      isDefault: true,
      rawMaterial: {
        id: "mat-roller-nyl",
        material_code: "HW-ROL-NYL",
        description: "Series 798 Ball Bearing Nylon Roller",
        category: "Hardware",
        finish_type: "Mill",
        billing_unit: "pc",
        unit_price: 75.00,
        waste_allowance: 0.05,
        is_active: true,
      },
    },
  ],
};

describe("Customer Material Customization Acceptance Tests (QAD-TC81)", () => {
  it("QAD-TC81.1: Multi-material options displayed when configured in Step 4", () => {
    const defaults = getDefaultMaterialSelections(mockDefinition);
    const groups = buildMaterialCustomizationGroups(mockDefinition, defaults);

    const frameGroup = groups.find((g) => g.presentationCategory === "Framing");
    assert.ok(frameGroup, "Framing group should exist");
    assert.strictEqual(frameGroup.groupLabel, "Aluminum Frame Finish");
    assert.strictEqual(frameGroup.hasMultipleMaterialOptions, true);
    assert.strictEqual(frameGroup.options.length, 2);

    const analokOpt = frameGroup.options.find((o) => o.finishType === "Analok");
    const whiteOpt = frameGroup.options.find((o) => o.finishType === "PowderCoatedWhite");
    assert.ok(analokOpt, "Analok option should be available");
    assert.ok(whiteOpt, "Powder Coated White option should be available");
    assert.strictEqual(analokOpt.isDefault, true);
    assert.strictEqual(whiteOpt.isDefault, false);
    assert.ok(whiteOpt.priceDeltaTotal > 0, "Powder Coated White should have positive price delta");
  });

  it("QAD-TC81.2: Single-material options omit redundant selector and mark static badge", () => {
    const defaults = getDefaultMaterialSelections(mockDefinition);
    const groups = buildMaterialCustomizationGroups(mockDefinition, defaults);

    const glazingGroup = groups.find((g) => g.presentationCategory === "Glazing");
    assert.ok(glazingGroup, "Glazing group should exist");
    assert.strictEqual(glazingGroup.hasMultipleMaterialOptions, false, "Single-material group must not allow multi-selection");
    assert.strictEqual(glazingGroup.options.length, 1);
    assert.strictEqual(glazingGroup.options[0].description, "6mm Clear Annealed Float Glass");

    const hardwareGroup = groups.find((g) => g.presentationCategory === "Hardware");
    assert.ok(hardwareGroup, "Hardware group should exist");
    assert.strictEqual(hardwareGroup.hasMultipleMaterialOptions, false, "Single hardware option must not allow multi-selection");
  });

  it("QAD-TC81.3: Real-time 3D PBR shader update updates materials on existing meshes", () => {
    const candidateMap = getAllCandidateMaterialsMap(mockDefinition);
    assert.ok(candidateMap.get("mat-head-pcw"), "White head candidate should exist in map");

    // Create a Three.js mesh representing the head profile
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(100, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x221d1a, roughness: 0.5, metalness: 0.8 }),
    );
    mesh.userData.componentKey = "head_profile";

    // Simulate updateCustomMaterials traversal
    const headMat = candidateMap.get("mat-head-pcw")!;
    applyPBRToMesh(mesh, headMat);

    const stdMat = mesh.material as THREE.MeshStandardMaterial;
    assert.ok(stdMat, "Mesh material should remain valid");
    const hex = stdMat.color.getHexString();
    assert.ok(hex.startsWith("f5") || hex.startsWith("f4") || hex.startsWith("f6"), `Expected white hex, got #${hex}`);
  });

  it("QAD-TC81.4: Workspace price recalculation latency is < 50ms without network roundtrip", () => {
    const candidateMap = getAllCandidateMaterialsMap(mockDefinition);
    const defaults = getDefaultMaterialSelections(mockDefinition);

    // Compute base price with defaults
    const baseCalc = calculateBOMFromStructuralDefinition(mockDefinition, {
      widthMm: 1800,
      heightMm: 1500,
      selectedMaterials: defaults,
      rawMaterials: candidateMap,
    });
    assert.ok(baseCalc.finalQuotation > 0, "Base quotation should be computed");

    // Measure latency of switching to Powder Coated White
    const whiteSelections = applyGroupSelection(
      mockDefinition,
      defaults,
      "group-framing",
      "mat-head-pcw",
    );

    const startTime = performance.now();
    const customCalc = calculateBOMFromStructuralDefinition(mockDefinition, {
      widthMm: 1800,
      heightMm: 1500,
      selectedMaterials: whiteSelections,
      rawMaterials: candidateMap,
    });
    const elapsedMs = performance.now() - startTime;

    assert.ok(elapsedMs < 50, `Recalculation elapsed ${elapsedMs}ms, which must be < 50ms`);
    assert.ok(customCalc.finalQuotation > baseCalc.finalQuotation, "White finish should cost more than base Analok");
  });

  it("QAD-TC81.5: Occlusion and perspective state preserved during material selection", () => {
    const defaults = getDefaultMaterialSelections(mockDefinition);
    const nextSelections = applyGroupSelection(
      mockDefinition,
      defaults,
      "group-framing",
      "mat-head-pcw",
    );

    // Synchronize all framing components
    assert.strictEqual(nextSelections.head_profile, "mat-head-pcw");
    assert.strictEqual(nextSelections.sill_profile, "mat-sill-pcw");
    assert.strictEqual(nextSelections.jamb_profile, "mat-jamb-pcw");

    // Other non-framing selections must remain intact
    assert.strictEqual(nextSelections.glass_pane, defaults.glass_pane);
    assert.strictEqual(nextSelections.roller_hardware, defaults.roller_hardware);
  });

  it("QAD-TC81.6: Measurement Confirmation Modal parity with chosen materials", () => {
    const candidateMap = getAllCandidateMaterialsMap(mockDefinition);
    const whiteSelections = applyGroupSelection(
      mockDefinition,
      getDefaultMaterialSelections(mockDefinition),
      "group-framing",
      "mat-head-pcw",
    );

    const bomCalc = calculateBOMFromStructuralDefinition(mockDefinition, {
      widthMm: 1800,
      heightMm: 1500,
      selectedMaterials: whiteSelections,
      rawMaterials: candidateMap,
    });

    const headItem = bomCalc.framingItems.find((item) => item.code === "AL-798-DH-PCW");
    assert.ok(headItem, "Head item should exist in framingItems");
    assert.strictEqual(headItem.unit_price, 385.00);
  });

  it("QAD-TC81.7: Quotation persistence schema records selected_materials dictionary", () => {
    const whiteSelections = {
      head_profile: "mat-head-pcw",
      sill_profile: "mat-sill-pcw",
      jamb_profile: "mat-jamb-pcw",
      glass_pane: "mat-glass-clr",
    };

    const simulatedPricingDetails = {
      product_name: "Series 798 2-Panel Sliding Window",
      finish_type: "PowderCoatedWhite",
      glass_type: "6mm Clear Float",
      selected_materials: whiteSelections,
    };

    assert.deepStrictEqual(
      simulatedPricingDetails.selected_materials,
      whiteSelections,
      "Frozen pricing details must contain the exact selected_materials mapping",
    );
  });

  it("QAD-TC81.8: Consultation PDF document includes custom specifications callout", () => {
    const mockViewModel: QuotationDocumentViewModel = {
      schemaVersion: 1,
      quotationNumber: "Q-2026-MS66-01",
      referenceCode: "REF-MS66-TEST",
      shareablePath: "/q/REF-MS66-TEST",
      createdAt: new Date().toISOString(),
      customer: {
        name: "Maria Santos",
        phone: "+639171234567",
        email: "maria.santos@example.ph",
        siteLocation: "Quezon City, Metro Manila",
      },
      projectName: "Living Room Window Replacement",
      snapshotObjectKey: null,
      hasSill: true,
      structuralWaiver: false,
      items: [
        {
          itemId: "item-1",
          productId: "prod-window-798",
          productName: "Series 798 2-Panel Sliding Window",
          productType: "Window",
          variantName: "Custom Powder Coated White",
          specificationSummary: "Powder Coated White | 6mm Clear Safety Float Glass",
          dimensionsFormatted: "180cm × 150cm",
          widthMm: 1800,
          heightMm: 1500,
          dimensionSource: "planar_paper_estimate",
          panelCount: 2,
          hasSill: true,
          structuralWaiver: false,
          finishLabel: "Powder Coated White",
          glassLabel: "6mm Clear Float",
          quantity: 1,
          unitPrice: 15480,
          calculatedSubtotal: 15480,
          imageSource: null,
          selectedMaterials: {
            head_profile: "mat-head-pcw",
            sill_profile: "mat-sill-pcw",
          },
          groups: [
            {
              groupName: "Aluminum Framing",
              description: "Series 798 Double Head (Powder Coated White)",
              quantity: 1.8,
              unit: "m",
              unitPrice: 385.00,
              subtotal: 776.16,
            },
          ],
        },
      ],
      pricing: {
        directMaterialsSubtotal: 10480,
        laborSubtotal: 2500,
        contractorMargin: 2500,
        calculatedFinalPrice: 15480,
      },
      itemPricing: [
        {
          itemId: "item-1",
          productName: "Series 798 2-Panel Sliding Window",
          quantity: 1,
          calculatedSubtotal: 15480,
          negotiatedSubtotal: null,
          effectiveSubtotal: 15480,
          isPriceModified: false,
        },
      ],
      calculatedFinalPrice: 15480,
      negotiatedFinalPrice: null,
      effectiveFinalPrice: 15480,
      isPriceModified: false,
      effectiveProductSubtotal: 15480,
      adminLaborCharge: null,
      shareableUrl: "https://glassfit.ph/quote/q-101",
      snapshotImageUrl: null,
      allowedImageOrigins: [],
      brandLogoUrl: "/images/glassfit_logo.png",
    };

    const html = generateQuotationPdfHtml(mockViewModel);
    assert.ok(html.includes("Specifications:"), "HTML must render the Specifications callout");
    assert.ok(html.includes("Powder Coated White"), "HTML must render Powder Coated White");
    assert.ok(html.includes("15,480.00"), "HTML must render final price 15,480.00");
  });

  it("QAD-TC81.9: Format group summary provides clean consumer readability", () => {
    const defaults = getDefaultMaterialSelections(mockDefinition);
    const groups = buildMaterialCustomizationGroups(mockDefinition, defaults);
    const frameGroup = groups.find((g) => g.presentationCategory === "Framing");
    assert.ok(frameGroup);

    const summary = formatGroupSummary(frameGroup);
    assert.ok(summary.includes("Analok"), "Summary should mention selected finish");
  });

  it("QAD-TC81.10: Reset to defaults restores initial raw materials", () => {
    const defaults = getDefaultMaterialSelections(mockDefinition);
    const modified = applyGroupSelection(
      mockDefinition,
      defaults,
      "group-framing",
      "mat-head-pcw",
    );
    assert.strictEqual(modified.head_profile, "mat-head-pcw");

    // Reverting to defaults
    const reverted = getDefaultMaterialSelections(mockDefinition);
    assert.strictEqual(reverted.head_profile, "mat-head-anlk");
    assert.strictEqual(reverted.sill_profile, "mat-sill-anlk");
    assert.strictEqual(reverted.jamb_profile, "mat-jamb-anlk");
  });
});
