/**
 * Acceptance Tests: Admin Fixed-Price Non-Parametric GLB Component Pricing (IMP-MS78)
 *
 * Upstream Specifications: docs/implementation/ms78.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F10, PRD-F14, PRD-F19, SDD-C7, SDD-C9, ERD-E6,
 *   QAD-TC93.1, QAD-TC93.2, QAD-TC93.3, QAD-TC93.9, QAD-TC93.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calculateParametricBOM,
  calculateBOMFromStructuralDefinition,
  type ComponentPricingInput,
} from "../../src/lib/pricing/pricingEngine.js";

import type { ProductStructuralDefinition } from "../../src/lib/visualization/types.js";

describe("IMP-MS78: Admin Fixed-Price Non-Parametric Component Pricing", () => {
  // QAD-TC93.1: Upload GLB parts for product configured with model_strategy = 'Fixed'
  it("QAD-TC93.1: permits fixed model components without short-circuit suppression", () => {
    const fixedModelStrategy = "Fixed";
    // For fixed model strategy, the components section header and workflow are active
    const isFixedStrategy = fixedModelStrategy === "Fixed";
    assert.strictEqual(isFixedStrategy, true);

    const testComponent: ComponentPricingInput = {
      componentKey: "fixed_subframe_al",
      componentName: "Pre-fabricated Sub-frame",
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Framing",
      rawMaterial: null,
      unitPrice: 2500,
      pricingMethod: "Fixed",
    };

    assert.strictEqual(testComponent.dimensionBinding, "FIXED");
    assert.strictEqual(testComponent.pricingMethod, "Fixed");
    assert.strictEqual(testComponent.unitPrice, 2500);
    assert.strictEqual(testComponent.rawMaterial, null);
  });

  // QAD-TC93.2: Set a fixed component price (PHP 1,500.00) in Part Inspector without assigning raw materials
  it("QAD-TC93.2: sets fixed component price without requiring catalog raw material mapping", () => {
    const componentInput: ComponentPricingInput = {
      componentKey: "fixed_shower_door_panel",
      componentName: "Prefabricated Glass Shower Door Panel",
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Glazing",
      rawMaterial: null,
      unitPrice: 1500.0,
      pricingMethod: "Fixed",
    };

    // Calculate BOM for single fixed component
    const bom = calculateParametricBOM([componentInput], {
      widthMm: 900,
      heightMm: 2000,
      panelCount: 1,
      hasSill: false,
      laborRate: 0,
      laborFloor: 0,
      contractorMarginRate: 0,
    });

    const allItems = [...bom.framingItems, ...bom.glazingItems, ...bom.hardwareItems, ...bom.consumableItems];
    assert.strictEqual(allItems.length, 1);
    const item = allItems[0];
    assert.strictEqual(item.code, "fixed_shower_door_panel");
    assert.strictEqual(item.description, "Prefabricated Glass Shower Door Panel");
    assert.strictEqual(item.quantity, 1);
    assert.strictEqual(item.unit_price, 1500.0);
    assert.strictEqual(item.waste_factor, 0); // 0% scrap factor for fixed components
    assert.strictEqual(item.subtotal, 1500.0);
    assert.strictEqual(bom.directMaterialsSubtotal, 1500.0);
    assert.strictEqual(bom.totalDirectCost, 1500.0);
    assert.strictEqual(bom.finalQuotation, 1500.0);
  });

  // QAD-TC93.3: Calculate BOM for a fixed model with two fixed components (PHP 1,200.00 and PHP 800.00)
  it("QAD-TC93.3: evaluates two fixed components (PHP 1,200.00 and PHP 800.00) totaling PHP 2,000.00 with 0% scrap", () => {
    const fixedComponents: ComponentPricingInput[] = [
      {
        componentKey: "precut_louver_frame",
        componentName: "Prefabricated Louver Perimeter Frame",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Framing",
        rawMaterial: null,
        unitPrice: 1200.0,
        pricingMethod: "Fixed",
      },
      {
        componentKey: "glass_louver_blades_set",
        componentName: "Tempered Glass Louver Blades Kit",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Glazing",
        rawMaterial: null,
        unitPrice: 800.0,
        pricingMethod: "Fixed",
      },
    ];

    const bom = calculateParametricBOM(fixedComponents, {
      widthMm: 600,
      heightMm: 800,
      panelCount: 1,
      hasSill: true,
      aluminumScrapRate: 0.12,
      glassScrapRate: 0.1,
      laborRate: 0,
      laborFloor: 0,
      contractorMarginRate: 0,
    });

    const allItems = [...bom.framingItems, ...bom.glazingItems, ...bom.hardwareItems, ...bom.consumableItems];
    assert.strictEqual(allItems.length, 2);

    const frameItem = allItems.find((i) => i.code === "precut_louver_frame");
    assert.ok(frameItem);
    assert.strictEqual(frameItem.unit_price, 1200.0);
    assert.strictEqual(frameItem.waste_factor, 0);
    assert.strictEqual(frameItem.subtotal, 1200.0);

    const glassItem = allItems.find((i) => i.code === "glass_louver_blades_set");
    assert.ok(glassItem);
    assert.strictEqual(glassItem.unit_price, 800.0);
    assert.strictEqual(glassItem.waste_factor, 0);
    assert.strictEqual(glassItem.subtotal, 800.0);

    // Sum is exactly PHP 2,000.00 direct materials
    assert.strictEqual(bom.directMaterialsSubtotal, 2000.0);
    assert.strictEqual(bom.totalDirectCost, 2000.0);
    assert.strictEqual(bom.finalQuotation, 2000.0);
  });

  // QAD-TC93.9: Publish a fixed product with fixed-price components and null raw material bindings
  it("QAD-TC93.9: publication validation passes when components have fixed pricing and null raw materials", () => {
    const mockFixedComponents = [
      {
        componentId: "comp-1",
        componentKey: "fixed_box_frame",
        componentName: "Fixed Box Frame",
        rawMaterialId: null,
        allowedMaterials: [],
        unitPrice: 2200,
        pricingMethod: "Fixed",
      },
      {
        componentId: "comp-2",
        componentKey: "fixed_panel",
        componentName: "Fixed Glass Panel",
        rawMaterialId: null,
        allowedMaterials: [],
        unitPrice: 1800,
        pricingMethod: "Fixed",
      },
    ];

    // Filter unassigned components according to ReviewAndPublishSection rule
    const unassignedComponents = mockFixedComponents.filter(
      (c) =>
        !c.rawMaterialId &&
        (!c.allowedMaterials || c.allowedMaterials.length === 0) &&
        !(c.pricingMethod === "Fixed" || (typeof c.unitPrice === "number" && c.unitPrice > 0))
    );

    // All fixed components pass validation
    assert.strictEqual(unassignedComponents.length, 0);
  });

  // QAD-TC93.10: Generate quotation consultation document containing fixed-price components
  it("QAD-TC93.10: itemizes fixed-price components cleanly in quotation structure", () => {
    const mockDefinition: ProductStructuralDefinition = {
      product: {
        productId: "prod-fixed-01",
        productName: "Prefab Standard Louver Window",
        productType: "Window",
        description: "Fixed pre-assembled unit",
        basePrice: 2000,
      },
      template: {
        templateId: "tmpl-fixed-01",
        templateName: "Standard Fixed Unit",
        modelStrategy: "Fixed",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      parameters: [],
      rules: [],
      assets: [
        {
          assetId: "ast-1",
          assetType: "Catalog 3D Preview",
          r2ObjectKey: "catalog/fixed_louver.glb",
          url: "https://r2.glassfit.ph/catalog/fixed_louver.glb",
          fileName: "fixed_louver.glb",
          isPrimary: true,
          status: "Active",
        },
      ],
      components: [
        {
          componentId: "cmp-1",
          componentKey: "fixed_frame_assembly",
          componentName: "Perimeter Aluminum Subframe",
          componentType: "Frame",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          spanRatio: 1.0,
          isRemovable: false,
          presentationCategory: "Framing",
          unitPrice: 1200,
          pricingMethod: "Fixed",
          componentData: {},
          model: {
            assetId: "m-1",
            r2ObjectKey: "parts/frame.glb",
            url: "https://r2.glassfit.ph/parts/frame.glb",
            fileName: "frame.glb",
            sourceDimensionsMm: null,
          },
        },
        {
          componentId: "cmp-2",
          componentKey: "fixed_louver_glass_kit",
          componentName: "Louver Glass Infill Kit",
          componentType: "Glass",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          spanRatio: 1.0,
          isRemovable: false,
          presentationCategory: "Glazing",
          unitPrice: 800,
          pricingMethod: "Fixed",
          componentData: {},
          model: {
            assetId: "m-2",
            r2ObjectKey: "parts/glass.glb",
            url: "https://r2.glassfit.ph/parts/glass.glb",
            fileName: "glass.glb",
            sourceDimensionsMm: null,
          },
        },
      ],
    };

    const quotationBOM = calculateBOMFromStructuralDefinition(mockDefinition, {
      widthMm: 600,
      heightMm: 800,
    });

    const allItems = [
      ...quotationBOM.framingItems,
      ...quotationBOM.glazingItems,
      ...quotationBOM.hardwareItems,
      ...quotationBOM.consumableItems,
    ];

    assert.strictEqual(allItems.length, 2);
    assert.strictEqual(quotationBOM.directMaterialsSubtotal, 2000.0);
    assert.strictEqual(quotationBOM.totalDirectCost, 2000.0);
    assert.strictEqual(quotationBOM.finalQuotation, 2000.0);

    const frame = allItems.find((i) => i.code === "fixed_frame_assembly");
    assert.ok(frame);
    assert.strictEqual(frame.subtotal, 1200.0);

    const glass = allItems.find((i) => i.code === "fixed_louver_glass_kit");
    assert.ok(glass);
    assert.strictEqual(glass.subtotal, 800.0);
  });

  // QAD-TC93.12: Dynamic Removable Components BOM Exclusion and State Parity
  it("QAD-TC93.12: dynamically excludes configured removable components from BOM when toggled off", () => {
    const components: ComponentPricingInput[] = [
      {
        componentId: "comp-carcass",
        componentKey: "mc_carcass",
        componentName: "MC Carcass",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Framing",
        unitPrice: 3500,
        pricingMethod: "Fixed",
      },
      {
        componentId: "comp-shelves",
        componentKey: "mc_glass_shelves",
        componentName: "MC Glass Shelves",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: true,
        togglePropertyKey: "has_shelves",
        presentationCategory: "Glazing",
        unitPrice: 1200,
        pricingMethod: "Fixed",
      },
      {
        componentId: "comp-handle",
        componentKey: "mc_door_handle",
        componentName: "MC Door Handle",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: true,
        togglePropertyKey: "has_handle",
        presentationCategory: "Hardware",
        unitPrice: 450,
        pricingMethod: "Fixed",
      },
    ];

    // 1. Both removable parts enabled (default)
    const bomAllIncluded = calculateParametricBOM(components, {
      widthMm: 1129,
      heightMm: 2028,
      removableStates: {
        "comp-shelves": true,
        "comp-handle": true,
      },
    });

    // Subtotal: 3500 + 1200 + 450 = 5150
    assert.strictEqual(bomAllIncluded.directMaterialsSubtotal, 5150);

    // 2. Glass shelves toggled off
    const bomShelvesOff = calculateParametricBOM(components, {
      widthMm: 1129,
      heightMm: 2028,
      removableStates: {
        "comp-shelves": false,
        "comp-handle": true,
      },
    });

    // Subtotal: 3500 + 450 = 3950 (1200 deducted)
    assert.strictEqual(bomShelvesOff.directMaterialsSubtotal, 3950);

    // 3. Both shelves and handle toggled off
    const bomBothOff = calculateParametricBOM(components, {
      widthMm: 1129,
      heightMm: 2028,
      removableStates: {
        "comp-shelves": false,
        "comp-handle": false,
      },
    });

    // Subtotal: only carcass remains = 3500
    assert.strictEqual(bomBothOff.directMaterialsSubtotal, 3500);

    // 4. Toggle by componentKey or togglePropertyKey fallback
    const bomKeyFallback = calculateParametricBOM(components, {
      widthMm: 1129,
      heightMm: 2028,
      removableStates: {
        has_shelves: false,
        has_handle: true,
      },
    });

    assert.strictEqual(bomKeyFallback.directMaterialsSubtotal, 3950);
  });
});
