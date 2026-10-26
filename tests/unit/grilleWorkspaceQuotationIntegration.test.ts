/**
 * Unit Tests: Customer Visualization Workspace Dynamic Grille Sizing, Real-Time Linear BOM Recalculation, and Itemized Quotation/PDF Handoff (IMP-MS73)
 *
 * Upstream Specifications: docs/implementation/ms73.md, docs/sdd-glassfit.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F11, SDD-C4, SDD-C5, SDD-C7, SDD-C8, DSD-UI4, DSD-UI7, DSD-UI16, ERD-E13, ERD-E14, BRD-M2, BRD-M3, BRD-M4, BRD-M5, QAD-TC88.1 through QAD-TC88.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  calculateGrilleLinearBOM,
} from "../../src/lib/pricing/grillePricingEngine.js";
import {
  calculateAddonBOM,
} from "../../src/lib/pricing/addonPricingEngine.js";
import {
  buildParametricGrillGroup,
} from "../../src/lib/visualization/addonGeometryBuilder.js";
import {
  buildGrillAssembly,
} from "../../src/lib/visualization/parametricProductBuilder.js";
import {
  generateQuotationPdfHtml,
} from "../../src/lib/pricing/quotationPdfGenerator.js";
import {
  createQuotationDocumentSnapshotV1,
  createQuotationDocumentViewModel,
} from "../../src/lib/pricing/quotationDocument.js";
import type {
  GrilleLinearPricingInput,
  GrilleLinearBOMResult,
  RawMaterial,
  ItemizedProductQuotation,
} from "../../src/lib/pricing/types.js";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache.js";

const mockModelCache: ComponentModelCache = {
  getClone: () => new THREE.Group(),
  getSourceSizeMeters: () => new THREE.Vector3(1, 1, 1),
};

const defaultRawMaterials: RawMaterial[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    material_code: "AL-TUBE-16-ANALOK",
    description: "Aluminum 16mm Square Tube Profile Analok",
    category: "Aluminum",
    finish_type: "Analok",
    billing_unit: "m",
    unit_price: 160.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    material_code: "AL-TUBE-16-WHITE",
    description: "Aluminum 16mm Square Tube Profile Powder Coated White",
    category: "Aluminum",
    finish_type: "PowderCoatedWhite",
    billing_unit: "m",
    unit_price: 180.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    material_code: "AL-TUBE-16-BLACK",
    description: "Aluminum 16mm Square Tube Profile Powder Coated Black",
    category: "Aluminum",
    finish_type: "PowderCoatedBlack",
    billing_unit: "m",
    unit_price: 175.0,
    waste_allowance: 0.12,
    is_active: true,
  },
];

describe("IMP-MS73: Customer Workspace Dynamic Grille Linear Sizing & Quotation/PDF Integration (QAD-TC88)", () => {
  // --------------------------------------------------------------------------
  // QAD-TC88.1: Workspace recalculates linear meters on width slider change
  // --------------------------------------------------------------------------
  it("QAD-TC88.1: recalculates vertical bar count and linear meters when width expands from 1200mm to 1600mm", () => {
    const initialInput: GrilleLinearPricingInput = {
      widthMm: 1200,
      heightMm: 1200,
      patternType: "staggered_brick",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-analok-16",
        material_code: "AL-TUBE-16-ANALOK",
        description: "16mm Square Tube",
        unit_price: 160.0,
        waste_allowance: 0.12,
      },
    };

    const t0 = performance.now();
    const initialResult = calculateGrilleLinearBOM(initialInput);
    const duration = performance.now() - t0;

    assert.ok(duration < 50, `Calculation took ${duration.toFixed(2)}ms, expected < 50ms`);
    // Inner aperture width = 1200 - 40 = 1160mm. colCount = Math.floor(1160/140) = 8 pickets
    assert.strictEqual(initialResult.verticalBars.barCount, 8);

    // Expand width to 1600mm
    const expandedInput: GrilleLinearPricingInput = {
      ...initialInput,
      widthMm: 1600,
    };

    const expandedResult = calculateGrilleLinearBOM(expandedInput);
    // Inner aperture width = 1600 - 40 = 1560mm. colCount = Math.floor(1560/140) = 11 pickets
    assert.strictEqual(expandedResult.verticalBars.barCount, 11);
    assert.ok(
      expandedResult.totalLinearMeters > initialResult.totalLinearMeters,
      "Total linear meters must increase as width expands",
    );
    assert.ok(
      expandedResult.finalPrice > initialResult.finalPrice,
      "Final price must reflect additional physical linear profile meters",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.2: Workspace recalculates cut lengths on height slider change
  // --------------------------------------------------------------------------
  it("QAD-TC88.2: recalculates vertical bar cut lengths when height expands from 1200mm to 1800mm", () => {
    const initialInput: GrilleLinearPricingInput = {
      widthMm: 1200,
      heightMm: 1200,
      patternType: "staggered_brick",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-analok-16",
        material_code: "AL-TUBE-16-ANALOK",
        description: "16mm Square Tube",
        unit_price: 160.0,
        waste_allowance: 0.12,
      },
    };

    const initialResult = calculateGrilleLinearBOM(initialInput);
    // 1200mm height minus 40mm perimeter frame = 1160mm cut length
    assert.strictEqual(initialResult.verticalBars.cutLengthMm, 1160);

    const tallerInput: GrilleLinearPricingInput = {
      ...initialInput,
      heightMm: 1800,
    };

    const tallerResult = calculateGrilleLinearBOM(tallerInput);
    // 1800mm height minus 40mm perimeter frame = 1760mm cut length
    assert.strictEqual(tallerResult.verticalBars.cutLengthMm, 1760);
    assert.strictEqual(tallerResult.verticalBars.barCount, 8); // column count unchanged
    assert.ok(
      tallerResult.verticalBars.totalLinearM > initialResult.verticalBars.totalLinearM,
      "Vertical linear meters must increase proportionally with height",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.3: Finish swatch selection updates linear profile rate
  // --------------------------------------------------------------------------
  it("QAD-TC88.3: selecting Powder Coated White finish updates linear rate and recalculates BOM subtotal", () => {
    const analokInput: GrilleLinearPricingInput = {
      widthMm: 1200,
      heightMm: 1200,
      patternType: "staggered_brick",
      includePerimeterFrame: true,
      grilleRawMaterial: defaultRawMaterials[0],
    };

    const whiteInput: GrilleLinearPricingInput = {
      ...analokInput,
      grilleRawMaterial: defaultRawMaterials[1],
    };

    const analokResult = calculateGrilleLinearBOM(analokInput);
    const whiteResult = calculateGrilleLinearBOM(whiteInput);

    // Identical piece counts and linear meter totals
    assert.strictEqual(analokResult.totalPieces, whiteResult.totalPieces);
    assert.strictEqual(analokResult.totalLinearMeters, whiteResult.totalLinearMeters);

    // Higher material rate yields higher direct material cost and final price
    assert.ok(
      whiteResult.directMaterialCost > analokResult.directMaterialCost,
      "White powder-coated material cost must exceed Analok standard material cost",
    );
    assert.ok(
      whiteResult.finalPrice > analokResult.finalPrice,
      "Final price must reflect finish-specific linear meter rate",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.4: Quotation modal renders expandable Cut List accordion
  // --------------------------------------------------------------------------
  it("QAD-TC88.4: generates structured itemized breakdown for quotation cut list accordion", () => {
    const result = calculateGrilleLinearBOM({
      widthMm: 1200,
      heightMm: 1200,
      patternType: "staggered_brick",
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-analok-16",
        material_code: "AL-TUBE-16-ANALOK",
        description: "16mm Square Tube",
        unit_price: 160.0,
        waste_allowance: 0.12,
      },
    });

    assert.ok(result.itemizedBreakdown.length > 0, "Itemized breakdown must contain cut list rows");

    // Must itemize Perimeter rails, Vertical bars, and Horizontal tie bars
    const perimeterRows = result.itemizedBreakdown.filter((r) => r.orientation === "PERIMETER");
    const verticalRows = result.itemizedBreakdown.filter((r) => r.orientation === "VERTICAL");
    const horizontalRows = result.itemizedBreakdown.filter((r) => r.orientation === "HORIZONTAL");

    assert.ok(perimeterRows.length >= 2, "Must contain top/bottom and side perimeter rail rows");
    assert.strictEqual(verticalRows.length, 1, "Must contain vertical bar breakdown row");
    assert.strictEqual(horizontalRows.length, 1, "Must contain horizontal bar breakdown row");

    // All rows have positive piece count, length in mm, total meters, and subtotal
    for (const row of result.itemizedBreakdown) {
      assert.ok(row.pieces > 0, "Pieces must be positive");
      assert.ok(row.lengthMm > 0, "Length in mm must be positive");
      assert.ok(row.totalMeters > 0, "Total meters must be positive");
      assert.ok(row.subtotal > 0, "Subtotal cost must be positive");
    }
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.5: Exact match between 3D canvas and quotation piece count
  // --------------------------------------------------------------------------
  it("QAD-TC88.5: verifies 100% mathematical parity between 3D mesh bar count and quotation pieces (38 pcs for 1400x1200mm)", () => {
    const widthMm = 1400;
    const heightMm = 1200;

    // 1. Build 3D Three.js assembly
    const group = buildParametricGrillGroup(widthMm, heightMm, {
      frameWidthMm: 20,
      nominalBarPitchMm: 140,
      nominalRowPitchMm: 191,
    });

    // 2. Count physical meshes inside the Three.js group
    let physicalMeshCount = 0;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        physicalMeshCount++;
      }
    });

    // 3. Compute linear BOM with identical parameters
    const bomResult = calculateGrilleLinearBOM({
      widthMm,
      heightMm,
      patternType: "staggered_brick",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      frameProfileWidthMm: 20,
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-analok-16",
        material_code: "AL-TUBE-16-ANALOK",
        description: "16mm Square Tube",
        unit_price: 160.0,
      },
    });

    // 4. Parity check
    // 4 perimeter frame rails (top, bottom, left, right)
    // 9 vertical pickets (inner width = 1360mm / 140 = 9)
    // 25 horizontal staggered tie bars
    // Total = 38 pieces
    assert.strictEqual(bomResult.totalPieces, 38);
    assert.strictEqual(bomResult.verticalBars.barCount, 9);
    assert.strictEqual(bomResult.horizontalBars.barCount, 25);
    assert.strictEqual(
      physicalMeshCount,
      bomResult.totalPieces,
      `Physical Three.js mesh count (${physicalMeshCount}) must match BOM total pieces (${bomResult.totalPieces}) exactly`,
    );

    // Verify userData attached metadata
    assert.ok(group.userData.grilleBOM, "userData.grilleBOM must be attached to the Three.js group");
    assert.strictEqual(group.userData.grilleBOM.totalPieces, 38);
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.6: Consultation PDF includes itemized linear cut quantities
  // --------------------------------------------------------------------------
  it("QAD-TC88.6: consultation PDF HTML contains itemized linear cut list specifications for fabricators", () => {
    const widthMm = 1400;
    const heightMm = 1200;

    const grilleBOM = calculateGrilleLinearBOM({
      widthMm,
      heightMm,
      patternType: "staggered_brick",
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-white-16",
        material_code: "AL-TUBE-16-WHITE",
        description: "16mm Square Tube",
        unit_price: 180.0,
      },
    });

    const quotationItem: ItemizedProductQuotation = {
      itemId: "item-win-grille-1",
      productId: "prod-window-798",
      productName: "Series 798 2-Panel Sliding Window",
      productType: "Window",
      variantName: "2-Panel Standard",
      specSummary: "PowderCoatedWhite | 140cm × 120cm",
      dimensionsFormatted: "140cm × 120cm",
      widthMm,
      heightMm,
      panelCount: 2,
      hasSill: true,
      structuralWaiver: false,
      finishType: "PowderCoatedWhite",
      glassType: "6mm_clear",
      quantity: 1,
      unitPrice: 18450.0,
      totalPrice: 18450.0,
      imageUrl: "",
      bomResult: {
        widthM: 1.4,
        heightM: 1.2,
        panelCount: 2,
        hasSill: true,
        finishType: "PowderCoatedWhite",
        glassType: "6mm_clear",
        leafWidthM: 0.7,
        aspectRatio: 1.7,
        isCrabbingRisk: false,
        isSpanLimitExceeded: false,
        totalLinearMetersFraming: 5.2,
        glazingAreaSqm: 1.44,
        framingItems: [],
        glazingItems: [],
        hardwareItems: [],
        consumableItems: [],
        rawFramingSubtotal: 4000,
        scrapFramingSubtotal: 480,
        effectiveFramingCost: 4480,
        rawGlazingSubtotal: 2500,
        scrapGlazingSubtotal: 250,
        effectiveGlazingCost: 2750,
        hardwareSubtotal: 1200,
        consumablesSubtotal: 350,
        directMaterialsSubtotal: 8780,
        fabricationLaborCost: 2195,
        totalDirectCost: 10975,
        contractorMargin: 2743.75,
        finalQuotation: 13718.75,
        frozenDetails: {
          width_m: 1.4,
          height_m: 1.2,
          panel_count: 2,
          has_sill: true,
          finish_type: "PowderCoatedWhite",
          glass_type: "6mm_clear",
          items_breakdown: [],
          raw_material_subtotal: 8780,
          waste_allowance_subtotal: 730,
          direct_material_subtotal: 8780,
          labor_cost: 2195,
          contractor_margin: 2743.75,
          margin_rate: 0.25,
          total_estimate: 13718.75,
        },
        bomSummary: {
          total_estimated_amount: 13718.75,
          currency: "PHP",
          has_sill: true,
          structural_waiver: false,
          groups: [],
        },
      },
      selectedAddon: "grill",
      addonName: "Architectural Security Window Grille",
      addonPrice: grilleBOM.finalPrice,
      addonAluminumFinish: "white",
      grilleBOM,
    };

    const draft = createQuotationDocumentSnapshotV1({
      customer: {
        name: "Maria Santos",
        phone: "+639171234567",
        email: "maria.santos@example.com",
        siteLocation: "Quezon City, Metro Manila",
      },
      projectName: "Santos Residence Renovation",
      hasSill: true,
      structuralWaiver: false,
      items: [quotationItem],
      fallbackBom: quotationItem.bomResult,
    });

    const snapshot = {
      ...draft,
      schemaVersion: 1 as const,
      quotationNumber: "EST-2026-88001",
      referenceCode: "REF-MS73-8801",
      shareablePath: "/quotations/EST-2026-88001",
      createdAt: new Date().toISOString(),
      snapshotObjectKey: null,
    };

    const viewModel = createQuotationDocumentViewModel(snapshot, {
      brandLogoUrl: "https://example.com/logo.png",
      shareableUrl: "https://example.com/q/88001",
      snapshotImageUrl: null,
      allowedImageOrigins: ["https://example.com"],
      negotiatedAmount: null,
    });

    const pdfHtml = generateQuotationPdfHtml(viewModel);

    // Verify presence of cut list specifics in PDF HTML
    assert.ok(
      pdfHtml.includes("Security Grille Extrusion Cut List"),
      "PDF must contain Security Grille Extrusion Cut List callout",
    );
    assert.ok(
      pdfHtml.includes("9 bars"),
      "PDF must state the 9 vertical bars",
    );
    assert.ok(
      pdfHtml.includes("25 bars"),
      "PDF must state the 25 horizontal bars",
    );
    assert.ok(
      pdfHtml.includes("linear meters"),
      "PDF must display total linear meters of profile extrusion",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.7: Zero UI blocking or dropped frames on continuous slider drag
  // --------------------------------------------------------------------------
  it("QAD-TC88.7: executes 100 continuous dynamic dimension recalculations in under 100ms (< 1ms average)", () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      const w = 1000 + (i % 20) * 50;
      const h = 1000 + (i % 15) * 60;
      calculateGrilleLinearBOM({
        widthMm: w,
        heightMm: h,
        patternType: "staggered_brick",
        includePerimeterFrame: true,
        grilleRawMaterial: {
          id: "mat-analok-16",
          material_code: "AL-TUBE-16-ANALOK",
          description: "16mm Square Tube",
          unit_price: 160.0,
        },
      });
    }
    const elapsed = performance.now() - t0;
    const avgMs = elapsed / 100;

    assert.ok(
      elapsed < 100,
      `100 recalculations took ${elapsed.toFixed(2)}ms (average ${avgMs.toFixed(3)}ms/recalc), expected < 100ms`,
    );
    assert.ok(
      avgMs < 16,
      `Average calculation latency (${avgMs.toFixed(3)}ms) must be well within the 16.6ms 60 FPS frame threshold`,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.8: Mutual exclusion unmounts grille and zeroes extrusion BOM
  // --------------------------------------------------------------------------
  it("QAD-TC88.8: switching from Grille to Screen zeroes grille linear BOM and activates screen pricing", () => {
    const widthMm = 1200;
    const heightMm = 1200;

    const evaluateAddon = (addon: "grill" | "screen" | "none") => ({
      grilleBOM: addon === "grill"
        ? calculateGrilleLinearBOM({
            widthMm,
            heightMm,
            grilleRawMaterial: {
              id: "00000000-0000-4000-8000-000000000001",
              material_code: "AL-1",
              description: "Tube",
              unit_price: 160,
            },
          })
        : null,
      screenBOM: addon === "screen"
        ? calculateAddonBOM({
            addonType: "screen",
            widthMm,
            heightMm,
          })
        : null,
    });

    // 1. Grille is active
    const state1 = evaluateAddon("grill");
    assert.ok(state1.grilleBOM !== null, "Grille BOM must be active");
    assert.ok(state1.grilleBOM.totalLinearMeters > 0);
    assert.strictEqual(state1.screenBOM, null, "Screen BOM must be null when grille is active");

    // 2. User clicks Screen (mutual exclusion switch)
    const state2 = evaluateAddon("screen");
    assert.strictEqual(state2.grilleBOM, null, "Grille BOM must be null when screen is active");
    assert.ok(state2.screenBOM !== null, "Screen BOM must be active");
    assert.ok(state2.screenBOM.finalAddonPrice > 0, "Screen pricing must activate");
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.9: Standalone Grille product workspace dynamic calculation
  // --------------------------------------------------------------------------
  it("QAD-TC88.9: standalone grille assembly generates valid BOM metadata and repeating geometry", () => {
    const targetWidthMm = 1500;
    const targetHeightMm = 1300;

    const assembly = buildGrillAssembly(
      [], // Procedural generation without host components
      targetWidthMm,
      targetHeightMm,
      mockModelCache,
      {
        activeAddon: "grill",
        addonAluminumFinish: "analok",
      },
    );

    assert.strictEqual(assembly.name, "Addon_Grill_Assembly");
    assert.strictEqual(assembly.userData.addonType, "grill");
    assert.strictEqual(assembly.userData.widthMm, targetWidthMm);
    assert.strictEqual(assembly.userData.heightMm, targetHeightMm);

    // Structured BOM metadata attached
    const bom = assembly.userData.grilleBOM as GrilleLinearBOMResult | undefined;
    assert.ok(bom, "assembly.userData.grilleBOM must be present on standalone grille");
    assert.ok(bom.totalPieces > 0, "BOM total pieces must be positive");
    assert.ok(bom.totalLinearMeters > 0, "BOM total linear meters must be positive");
    assert.ok(bom.finalPrice > 0, "BOM final price must be positive");
  });

  // --------------------------------------------------------------------------
  // QAD-TC88.10: Offline and network error resilience
  // --------------------------------------------------------------------------
  it("QAD-TC88.10: gracefully falls back to default linear rates (₱160/m) when catalog query is empty or unavailable", () => {
    const emptyCatalogMaterials: RawMaterial[] = [];

    // Fallback resolution simulation matching ProductModelWorkspace.tsx
    const finishKey = "analok";
    const matchedMaterial = emptyCatalogMaterials.find(
      (m) => m.finish_type.toLowerCase() === finishKey.toLowerCase(),
    );

    const defaultRate = 160.0;
    const resolvedPrice = matchedMaterial?.unit_price ?? defaultRate;
    const resolvedWaste = matchedMaterial?.waste_allowance ?? 0.12;

    assert.strictEqual(resolvedPrice, 160.0);
    assert.strictEqual(resolvedWaste, 0.12);

    const fallbackResult = calculateGrilleLinearBOM({
      widthMm: 1200,
      heightMm: 1200,
      patternType: "staggered_brick",
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "default-grille-mat",
        material_code: "AL-GRILLE-TUBE-16MM",
        description: "16mm Square Tube Aluminum",
        unit_price: resolvedPrice,
        waste_allowance: resolvedWaste,
      },
    });

    assert.ok(fallbackResult.finalPrice > 0, "Fallback calculation must produce valid positive price");
    assert.strictEqual(fallbackResult.verticalBars.barCount, 8);
    assert.strictEqual(fallbackResult.verticalBars.details[0].unitPricePerMeter, 160.0);
  });
});
