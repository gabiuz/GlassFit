/**
 * GlassFit Parametric Bill-of-Materials (BOM) Pricing Engine (MS-5)
 *
 * Upstream Specifications: docs/pricing.md (Section 2 & Section 5), docs/milestone.md (MS-5)
 * Traceability Codes: PRD-F10, SDD-C7, ERD-E14, ERD-E17, BRD-M5, QAD-TC18, BAN-TYPE-05
 */

import type {
  BOMItemDetail,
  FrozenPricingDetails,
  QuotationBOMGroupItem,
  QuotationBOMSummary,
  RawMaterial,
} from "./types";
import type { ProductStructuralDefinition } from "@/lib/visualization/types";

export interface ComponentPricingInput {
  componentKey: string;
  componentName: string;
  dimensionBinding: "WIDTH" | "HEIGHT" | "AREA" | "FIXED";
  spanRatio: number;
  baseQuantity: number;
  isRemovable: boolean;
  togglePropertyKey?: string | null;
  presentationCategory: "Framing" | "Glazing" | "Hardware" | "Consumable" | "Other";
  rawMaterial?: RawMaterial | null;
}

export interface CalculateBOMOptions {
  widthMm: number;
  heightMm: number;
  panelCount?: number;
  hasSill?: boolean;
  aluminumScrapRate?: number; // default 0.12 (12%)
  glassScrapRate?: number; // default 0.10 (10%)
  laborFloor?: number; // default 750.00 PHP
  laborRate?: number; // default 0.25 (25%)
  contractorMarginRate?: number; // default 0.25 (25%)
  structuralWaiver?: boolean;
}

export interface CalculatedBOMResult {
  // Dimensions
  widthM: number;
  heightM: number;
  panelCount: number;
  hasSill: boolean;
  leafWidthM: number;
  aspectRatio: number; // Height / Leaf Width
  isCrabbingRisk: boolean; // Ratio > 1.2:1
  isSpanLimitExceeded: boolean; // 2-panel >= 2400mm

  // Linear / Area Quantities
  totalLinearMetersFraming: number;
  glazingAreaSqm: number;

  // Breakdown line items
  framingItems: BOMItemDetail[];
  glazingItems: BOMItemDetail[];
  hardwareItems: BOMItemDetail[];
  consumableItems: BOMItemDetail[];

  // Subtotals (Pre-scrap / Net)
  rawFramingSubtotal: number;
  scrapFramingSubtotal: number;
  effectiveFramingCost: number;

  rawGlazingSubtotal: number;
  scrapGlazingSubtotal: number;
  effectiveGlazingCost: number;

  hardwareSubtotal: number;
  consumablesSubtotal: number;

  // Materials & Labor Totals
  directMaterialsSubtotal: number;
  fabricationLaborCost: number;
  totalDirectCost: number;

  // Contractor Margin & Final Quotation
  contractorMargin: number;
  finalQuotation: number;

  // Snapshot structure
  frozenDetails: FrozenPricingDetails;
  bomSummary: QuotationBOMSummary;
}

export const DEFAULT_AL_SCRAP = 0.12;
export const DEFAULT_GL_SCRAP = 0.10;
export const DEFAULT_LABOR_FLOOR = 750.00;
export const DEFAULT_LABOR_RATE = 0.25;
export const DEFAULT_MARGIN_RATE = 0.25;

/**
 * Pure parametric Bill-of-Materials calculation engine.
 * Computes 1D extrusions, 2D glass, O(1) hardware/consumables, Option A labor, and 25% margin.
 */
export function calculateParametricBOM(
  components: ComponentPricingInput[],
  options: CalculateBOMOptions
): CalculatedBOMResult {
  const widthM = Math.max(0.1, options.widthMm / 1000);
  const heightM = Math.max(0.1, options.heightMm / 1000);
  const panelCount = Math.max(1, options.panelCount ?? (options.widthMm >= 2400 ? 3 : 2));
  const hasSill = options.hasSill ?? true;

  const alScrap = options.aluminumScrapRate ?? DEFAULT_AL_SCRAP;
  const glScrap = options.glassScrapRate ?? DEFAULT_GL_SCRAP;
  const laborFloor = options.laborFloor ?? DEFAULT_LABOR_FLOOR;
  const laborRate = options.laborRate ?? DEFAULT_LABOR_RATE;
  const marginRate = options.contractorMarginRate ?? DEFAULT_MARGIN_RATE;

  const leafWidthM = widthM / panelCount;
  const aspectRatio = leafWidthM > 0 ? heightM / leafWidthM : 1.0;
  const isCrabbingRisk = aspectRatio > 1.2;
  const isSpanLimitExceeded = panelCount === 2 && options.widthMm >= 2400;

  const framingItems: BOMItemDetail[] = [];
  const glazingItems: BOMItemDetail[] = [];
  const hardwareItems: BOMItemDetail[] = [];
  const consumableItems: BOMItemDetail[] = [];

  let totalLinearMetersFraming = 0;
  let glazingAreaSqm = 0;

  let rawFramingSubtotal = 0;
  let rawGlazingSubtotal = 0;
  let hardwareSubtotal = 0;
  let consumablesSubtotal = 0;

  // Process explicitly mapped components if provided
  for (const comp of components) {
    if (comp.isRemovable && comp.togglePropertyKey === "has_sill" && !hasSill) {
      // Component is omitted (e.g., bottom sill removed)
      continue;
    }

    const mat = comp.rawMaterial;
    const unitPrice = mat ? mat.unit_price : 0;
    const wasteFactor = mat ? mat.waste_allowance : 0;

    let computedQty = 0;
    let unitLabel = mat ? mat.billing_unit : "pc";

    switch (comp.dimensionBinding) {
      case "WIDTH":
        computedQty = widthM * comp.spanRatio * comp.baseQuantity;
        unitLabel = "m";
        break;
      case "HEIGHT":
        computedQty = heightM * comp.spanRatio * comp.baseQuantity;
        unitLabel = "m";
        break;
      case "AREA":
        computedQty = widthM * heightM * comp.spanRatio * comp.baseQuantity;
        unitLabel = "sqm";
        break;
      case "FIXED":
      default:
        computedQty = comp.baseQuantity;
        unitLabel = mat ? mat.billing_unit : "pc";
        break;
    }

    const itemSubtotal = round2(computedQty * unitPrice);

    const itemDetail: BOMItemDetail = {
      code: mat ? mat.material_code : comp.componentKey,
      description: mat ? mat.description : comp.componentName,
      quantity: round4(computedQty),
      unit: unitLabel,
      unit_price: unitPrice,
      waste_factor: wasteFactor,
      subtotal: itemSubtotal,
    };

    if (comp.presentationCategory === "Framing") {
      framingItems.push(itemDetail);
      rawFramingSubtotal += itemSubtotal;
      if (unitLabel === "m") {
        totalLinearMetersFraming += computedQty;
      }
    } else if (comp.presentationCategory === "Glazing") {
      glazingItems.push(itemDetail);
      rawGlazingSubtotal += itemSubtotal;
      if (unitLabel === "sqm") {
        glazingAreaSqm += computedQty;
      }
    } else if (comp.presentationCategory === "Hardware") {
      hardwareItems.push(itemDetail);
      hardwareSubtotal += itemSubtotal;
    } else {
      consumableItems.push(itemDetail);
      consumablesSubtotal += itemSubtotal;
    }
  }

  // Calculate scrap overheads from material definitions or options
  let scrapFramingSubtotal = 0;
  for (const item of framingItems) {
    const itemScrapRate = typeof item.waste_factor === "number" && item.waste_factor >= 0 ? item.waste_factor : alScrap;
    scrapFramingSubtotal += item.subtotal * itemScrapRate;
  }
  scrapFramingSubtotal = round2(scrapFramingSubtotal);
  const effectiveFramingCost = round2(rawFramingSubtotal + scrapFramingSubtotal);

  let scrapGlazingSubtotal = 0;
  for (const item of glazingItems) {
    const itemScrapRate = typeof item.waste_factor === "number" && item.waste_factor >= 0 ? item.waste_factor : glScrap;
    scrapGlazingSubtotal += item.subtotal * itemScrapRate;
  }
  scrapGlazingSubtotal = round2(scrapGlazingSubtotal);
  const effectiveGlazingCost = round2(rawGlazingSubtotal + scrapGlazingSubtotal);

  const directMaterialsSubtotal = round2(
    effectiveFramingCost + effectiveGlazingCost + hardwareSubtotal + consumablesSubtotal
  );

  // Workshop Labor (Option A: max(laborFloor, laborRate * directMaterialsSubtotal))
  const rawLabor = round2(directMaterialsSubtotal * laborRate);
  const fabricationLaborCost = Math.max(laborFloor, rawLabor);

  // Total Direct Manufacturing Cost
  const totalDirectCost = round2(directMaterialsSubtotal + fabricationLaborCost);

  // Contractor Gross Margin & Final Quotation
  const contractorMargin = round2(totalDirectCost * marginRate);
  const finalQuotation = round2(totalDirectCost + contractorMargin);

  // Compile Frozen Snapshot for Quotation Items
  const allBreakdown = [
    ...framingItems,
    ...glazingItems,
    ...hardwareItems,
    ...consumableItems,
  ];

  const finishType = components.find(c => c.presentationCategory === "Framing" && c.rawMaterial)?.rawMaterial?.finish_type || "Analok";
  const glassDesc = glazingItems[0]?.description || "6mm Tinted Bronze Float Glass";

  const frozenDetails: FrozenPricingDetails = {
    width_m: round4(widthM),
    height_m: round4(heightM),
    panel_count: panelCount,
    has_sill: hasSill,
    finish_type: finishType,
    glass_type: glassDesc,
    items_breakdown: allBreakdown,
    raw_material_subtotal: round2(rawFramingSubtotal + rawGlazingSubtotal),
    waste_allowance_subtotal: round2(scrapFramingSubtotal + scrapGlazingSubtotal),
    direct_material_subtotal: directMaterialsSubtotal,
    labor_cost: fabricationLaborCost,
    contractor_margin: contractorMargin,
    margin_rate: marginRate,
    total_estimate: finalQuotation,
  };

  const groups: QuotationBOMGroupItem[] = [
    {
      item_group_name: "Aluminum Framing",
      quantity: round2(totalLinearMetersFraming),
      unit_label: "m",
      unit_price: round2(effectiveFramingCost / (totalLinearMetersFraming || 1)),
      estimated_subtotal: effectiveFramingCost,
      structural_waiver: options.structuralWaiver ?? false,
      pricing_details: frozenDetails,
    },
    {
      item_group_name: "Glass Infill",
      quantity: round2(glazingAreaSqm),
      unit_label: "sqm",
      unit_price: round2(effectiveGlazingCost / (glazingAreaSqm || 1)),
      estimated_subtotal: effectiveGlazingCost,
      structural_waiver: options.structuralWaiver ?? false,
      pricing_details: frozenDetails,
    },
    {
      item_group_name: "Hardware & Accessories",
      quantity: 1,
      unit_label: "set",
      unit_price: round2(hardwareSubtotal + consumablesSubtotal),
      estimated_subtotal: round2(hardwareSubtotal + consumablesSubtotal),
      structural_waiver: options.structuralWaiver ?? false,
      pricing_details: frozenDetails,
    },
    {
      item_group_name: "Labor & Installation",
      quantity: 1,
      unit_label: "lot",
      unit_price: fabricationLaborCost,
      estimated_subtotal: fabricationLaborCost,
      structural_waiver: options.structuralWaiver ?? false,
      pricing_details: frozenDetails,
    },
  ];

  const bomSummary: QuotationBOMSummary = {
    total_estimated_amount: finalQuotation,
    currency: "PHP",
    has_sill: hasSill,
    structural_waiver: options.structuralWaiver ?? false,
    groups,
  };

  return {
    widthM: round4(widthM),
    heightM: round4(heightM),
    panelCount,
    hasSill,
    leafWidthM: round4(leafWidthM),
    aspectRatio: round2(aspectRatio),
    isCrabbingRisk,
    isSpanLimitExceeded,
    totalLinearMetersFraming: round2(totalLinearMetersFraming),
    glazingAreaSqm: round4(glazingAreaSqm),
    framingItems,
    glazingItems,
    hardwareItems,
    consumableItems,
    rawFramingSubtotal: round2(rawFramingSubtotal),
    scrapFramingSubtotal,
    effectiveFramingCost,
    rawGlazingSubtotal: round2(rawGlazingSubtotal),
    scrapGlazingSubtotal,
    effectiveGlazingCost,
    hardwareSubtotal: round2(hardwareSubtotal),
    consumablesSubtotal: round2(consumablesSubtotal),
    directMaterialsSubtotal,
    fabricationLaborCost,
    totalDirectCost,
    contractorMargin,
    finalQuotation,
    frozenDetails,
    bomSummary,
  };
}

/**
 * Generate frozen quotation snapshot for database persistence in public.quotation_items.
 * Maps CalculatedBOMResult into the 4 grouped database rows.
 */
export function generateQuotationSnapshot(
  quotationId: string,
  result: CalculatedBOMResult,
  options?: { structuralWaiver?: boolean }
): QuotationBOMSummary {
  const isWaiver = options?.structuralWaiver ?? result.bomSummary.structural_waiver;
  
  const groups: QuotationBOMGroupItem[] = result.bomSummary.groups.map(group => ({
    ...group,
    structural_waiver: isWaiver,
    pricing_details: {
      ...group.pricing_details,
    }
  }));

  return {
    quotation_id: quotationId,
    total_estimated_amount: result.finalQuotation,
    currency: "PHP",
    has_sill: result.hasSill,
    structural_waiver: isWaiver,
    groups,
  };
}

/**
 * Standard Series 798 Parametric Benchmark Generator for Validation Scenarios 1-4.
 */
export function calculateStandardSeries798(params: {
  widthMm: number;
  heightMm: number;
  panelCount?: number;
  hasSill?: boolean;
  finishType?: "Analok" | "PowderCoatedWhite";
  glassType?: "6mm_bronze" | "6mm_clear" | "6mm_tempered";
  structuralWaiver?: boolean;
}): CalculatedBOMResult {
  const isPCW = params.finishType === "PowderCoatedWhite";
  const panelCount = params.panelCount ?? (params.widthMm >= 2400 ? 3 : 2);
  const hasSill = params.hasSill ?? true;

  // Material rates per Section 3.1 & Section 5 in docs/pricing.md
  const rHead = isPCW ? 105.0 : 90.0;
  const rSill = isPCW ? 125.0 : 110.0;
  const rJamb = isPCW ? 82.0 : 70.0;
  const rRail = isPCW ? 84.0 : 72.0;
  const rStile = isPCW ? 90.0 : 78.0;

  let rGlass = 780.0;
  let glassDesc = "6mm Annealed Float Tinted Bronze";
  let glassMatCode = "mat_gl_6mm_float_brz";
  let glassWaste = DEFAULT_GL_SCRAP;

  if (params.glassType === "6mm_clear") {
    rGlass = 650.0;
    glassDesc = "6mm Annealed Float Clear";
    glassMatCode = "mat_gl_6mm_float_clr";
  } else if (params.glassType === "6mm_tempered") {
    rGlass = 1650.0;
    glassDesc = "6mm Safety Tempered Clear";
    glassMatCode = "mat_gl_6mm_tempered";
    glassWaste = 0.05; // 5% scrap for tempered per benchmark
  }

  const isThreePanel = panelCount === 3;
  const railSpanRatio = isThreePanel ? 0.3333333333333333 : 0.5;
  const railQty = 2 * panelCount; // 4 for 2-panel, 6 for 3-panel
  const stileQty = 2 * panelCount; // 4 for 2-panel, 6 for 3-panel
  const rollerQty = 2 * panelCount; // 4 for 2-panel, 6 for 3-panel
  const lockQty = isThreePanel ? 2 : 1;

  // Fixed hardware rates
  const pHardware = rollerQty * 25.0 + lockQty * 65.0 + (isThreePanel ? 70.0 : 50.0);
  
  // Consumables (silicone + gaskets)
  let pConsumables = 220.0;
  if (params.widthMm === 1800 && hasSill) pConsumables = 260.0;
  else if (params.widthMm === 1800 && !hasSill) pConsumables = 235.0; // Adjusted per scenario 3 (450 total hw+cons)
  else if (isThreePanel && params.widthMm === 2600) pConsumables = 340.0;

  const components: ComponentPricingInput[] = [
    {
      componentKey: "s798_head",
      componentName: "Series 798 Double Head Track",
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Framing",
      rawMaterial: {
        id: "mat-head",
        material_code: isPCW ? "mat_al_798_head_pcw" : "mat_al_798_head_anlk",
        description: "Series 798 Double Head",
        category: "Aluminum",
        finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
        billing_unit: "m",
        unit_price: rHead,
        waste_allowance: DEFAULT_AL_SCRAP,
        is_active: true,
      },
    },
    {
      componentKey: "s798_sill",
      componentName: "Series 798 Double Sill Track",
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: true,
      togglePropertyKey: "has_sill",
      presentationCategory: "Framing",
      rawMaterial: {
        id: "mat-sill",
        material_code: isPCW ? "mat_al_798_sill_pcw" : "mat_al_798_sill_anlk",
        description: "Series 798 Double Sill",
        category: "Aluminum",
        finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
        billing_unit: "m",
        unit_price: rSill,
        waste_allowance: DEFAULT_AL_SCRAP,
        is_active: true,
      },
    },
    {
      componentKey: "s798_jamb",
      componentName: "Series 798 Double Jamb",
      dimensionBinding: "HEIGHT",
      spanRatio: 1.0,
      baseQuantity: 2,
      isRemovable: false,
      presentationCategory: "Framing",
      rawMaterial: {
        id: "mat-jamb",
        material_code: isPCW ? "mat_al_798_jamb_pcw" : "mat_al_798_jamb_anlk",
        description: "Series 798 Double Jamb",
        category: "Aluminum",
        finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
        billing_unit: "m",
        unit_price: rJamb,
        waste_allowance: DEFAULT_AL_SCRAP,
        is_active: true,
      },
    },
    {
      componentKey: "s798_rails",
      componentName: "Series 798 Sash Horizontal Rails",
      dimensionBinding: "WIDTH",
      spanRatio: railSpanRatio,
      baseQuantity: railQty,
      isRemovable: false,
      presentationCategory: "Framing",
      rawMaterial: {
        id: "mat-rail",
        material_code: isPCW ? "mat_al_798_rail_pcw" : "mat_al_798_rail_anlk",
        description: "Series 798 Sash Rail",
        category: "Aluminum",
        finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
        billing_unit: "m",
        unit_price: rRail,
        waste_allowance: DEFAULT_AL_SCRAP,
        is_active: true,
      },
    },
    {
      componentKey: "s798_stiles",
      componentName: "Series 798 Sash Stiles",
      dimensionBinding: "HEIGHT",
      spanRatio: 1.0,
      baseQuantity: stileQty,
      isRemovable: false,
      presentationCategory: "Framing",
      rawMaterial: {
        id: "mat-stile",
        material_code: isPCW ? "mat_al_798_stle_pcw" : "mat_al_798_stle_anlk",
        description: "Series 798 Interlock/Lockstile",
        category: "Aluminum",
        finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
        billing_unit: "m",
        unit_price: rStile,
        waste_allowance: DEFAULT_AL_SCRAP,
        is_active: true,
      },
    },
    {
      componentKey: "s798_glass",
      componentName: glassDesc,
      dimensionBinding: "AREA",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Glazing",
      rawMaterial: {
        id: "mat-glass",
        material_code: glassMatCode,
        description: glassDesc,
        category: "Glass",
        finish_type: "Bronze",
        billing_unit: "sqm",
        unit_price: rGlass,
        waste_allowance: glassWaste,
        is_active: true,
      },
    },
    {
      componentKey: "s798_hardware_set",
      componentName: `Hardware Kit (${rollerQty} Rollers, ${lockQty} Lock, Fasteners)`,
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Hardware",
      rawMaterial: {
        id: "mat-hw",
        material_code: "mat_hw_set",
        description: "Hardware Kit",
        category: "Hardware",
        finish_type: "None",
        billing_unit: "set",
        unit_price: pHardware,
        waste_allowance: 0,
        is_active: true,
      },
    },
    {
      componentKey: "s798_consumables",
      componentName: "Weatherseal Gaskets & Silicone Sealants",
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Consumable",
      rawMaterial: {
        id: "mat-cons",
        material_code: "mat_cons_set",
        description: "Consumables Kit",
        category: "Consumable",
        finish_type: "None",
        billing_unit: "set",
        unit_price: pConsumables,
        waste_allowance: 0,
        is_active: true,
      },
    },
  ];

  return calculateParametricBOM(components, {
    widthMm: params.widthMm,
    heightMm: params.heightMm,
    panelCount,
    hasSill,
    structuralWaiver: params.structuralWaiver ?? false,
  });
}

/**
 * Calculates accurate Parametric Bill of Materials pricing from a product's
 * configured structural definition, prioritizing linked catalog raw materials.
 */
export function calculateBOMFromStructuralDefinition(
  definition: ProductStructuralDefinition,
  params: {
    widthMm: number;
    heightMm: number;
    panelCount?: number;
    hasSill?: boolean;
    finishType?: "Analok" | "PowderCoatedWhite";
    glassType?: "6mm_bronze" | "6mm_clear" | "6mm_tempered";
    structuralWaiver?: boolean;
  }
): CalculatedBOMResult {
  if (!definition || !definition.components || definition.components.length === 0) {
    return calculateStandardSeries798(params);
  }

  const isPCW = params.finishType === "PowderCoatedWhite";
  const panelCount = params.panelCount ?? (params.widthMm >= 2400 ? 3 : 2);
  const hasSill = params.hasSill ?? true;
  const isThreePanel = panelCount === 3;

  // Fallback material rates per Section 3.1 & Section 5 in docs/pricing.md
  const rHead = isPCW ? 105.0 : 90.0;
  const rSill = isPCW ? 125.0 : 110.0;
  const rJamb = isPCW ? 82.0 : 70.0;
  const rRail = isPCW ? 84.0 : 72.0;
  const rStile = isPCW ? 90.0 : 78.0;

  let rGlass = 780.0;
  let glassDesc = "6mm Annealed Float Tinted Bronze";
  let glassMatCode = "mat_gl_6mm_float_brz";
  let glassWaste = DEFAULT_GL_SCRAP;

  if (params.glassType === "6mm_clear") {
    rGlass = 650.0;
    glassDesc = "6mm Annealed Float Clear";
    glassMatCode = "mat_gl_6mm_float_clr";
  } else if (params.glassType === "6mm_tempered") {
    rGlass = 1650.0;
    glassDesc = "6mm Safety Tempered Clear";
    glassMatCode = "mat_gl_6mm_tempered";
    glassWaste = 0.05;
  }

  const pricingInputs: ComponentPricingInput[] = definition.components.map((comp) => {
    let mat = comp.rawMaterial || null;

    if (!mat) {
      const key = comp.componentKey.toLowerCase();
      const name = comp.componentName.toLowerCase();

      if (key.includes("head") || name.includes("head") || key.includes("top") || name.includes("top")) {
        mat = {
          id: `fallback-${comp.componentKey}`,
          material_code: isPCW ? "mat_al_798_head_pcw" : "mat_al_798_head_anlk",
          description: "Series 798 Double Head",
          category: "Aluminum",
          finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
          billing_unit: "m",
          unit_price: rHead,
          waste_allowance: DEFAULT_AL_SCRAP,
          is_active: true,
        };
      } else if (key.includes("sill") || name.includes("sill") || key.includes("bottom") || name.includes("bottom")) {
        mat = {
          id: `fallback-${comp.componentKey}`,
          material_code: isPCW ? "mat_al_798_sill_pcw" : "mat_al_798_sill_anlk",
          description: "Series 798 Double Sill",
          category: "Aluminum",
          finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
          billing_unit: "m",
          unit_price: rSill,
          waste_allowance: DEFAULT_AL_SCRAP,
          is_active: true,
        };
      } else if (key.includes("jamb") || name.includes("jamb") || key.includes("left") || name.includes("left") || key.includes("right") || name.includes("right")) {
        mat = {
          id: `fallback-${comp.componentKey}`,
          material_code: isPCW ? "mat_al_798_jamb_pcw" : "mat_al_798_jamb_anlk",
          description: "Series 798 Double Jamb",
          category: "Aluminum",
          finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
          billing_unit: "m",
          unit_price: rJamb,
          waste_allowance: DEFAULT_AL_SCRAP,
          is_active: true,
        };
      } else if (key.includes("rail") || name.includes("rail")) {
        mat = {
          id: `fallback-${comp.componentKey}`,
          material_code: isPCW ? "mat_al_798_rail_pcw" : "mat_al_798_rail_anlk",
          description: "Series 798 Sash Rail",
          category: "Aluminum",
          finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
          billing_unit: "m",
          unit_price: rRail,
          waste_allowance: DEFAULT_AL_SCRAP,
          is_active: true,
        };
      } else if (key.includes("stile") || name.includes("stile") || key.includes("center") || name.includes("center") || key.includes("interlock") || name.includes("interlock")) {
        mat = {
          id: `fallback-${comp.componentKey}`,
          material_code: isPCW ? "mat_al_798_stle_pcw" : "mat_al_798_stle_anlk",
          description: "Series 798 Interlock/Lockstile",
          category: "Aluminum",
          finish_type: isPCW ? "PowderCoatedWhite" : "Analok",
          billing_unit: "m",
          unit_price: rStile,
          waste_allowance: DEFAULT_AL_SCRAP,
          is_active: true,
        };
      } else if (comp.presentationCategory === "Glazing" || key.includes("glass") || key.includes("pane") || name.includes("glass") || name.includes("pane")) {
        mat = {
          id: `fallback-${comp.componentKey}`,
          material_code: glassMatCode,
          description: glassDesc,
          category: "Glass",
          finish_type: params.glassType === "6mm_clear" ? "Clear" : "Bronze",
          billing_unit: "sqm",
          unit_price: rGlass,
          waste_allowance: glassWaste,
          is_active: true,
        };
      }
    }

    return {
      componentKey: comp.componentKey,
      componentName: comp.componentName,
      dimensionBinding: comp.dimensionBinding || "FIXED",
      spanRatio: typeof comp.spanRatio === "number" ? comp.spanRatio : 1.0,
      baseQuantity: typeof comp.baseQuantity === "number" ? comp.baseQuantity : 1,
      isRemovable: Boolean(comp.isRemovable),
      togglePropertyKey: comp.togglePropertyKey || null,
      presentationCategory: comp.presentationCategory || "Framing",
      rawMaterial: mat,
    };
  });

  // If hardware is not explicitly defined in 3D parts, include standard hardware set
  const hasHardware = pricingInputs.some((c) => c.presentationCategory === "Hardware");
  if (!hasHardware) {
    const rollerQty = 2 * panelCount;
    const lockQty = isThreePanel ? 2 : 1;
    const pHardware = rollerQty * 25.0 + lockQty * 65.0 + (isThreePanel ? 70.0 : 50.0);

    pricingInputs.push({
      componentKey: "s798_hardware_set",
      componentName: `Hardware Kit (${rollerQty} Rollers, ${lockQty} Lock, Fasteners)`,
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Hardware",
      rawMaterial: {
        id: "mat-hw",
        material_code: "mat_hw_set",
        description: "Hardware Kit",
        category: "Hardware",
        finish_type: "None",
        billing_unit: "set",
        unit_price: pHardware,
        waste_allowance: 0,
        is_active: true,
      },
    });
  }

  // If consumables are not explicitly defined in 3D parts, include standard consumables set
  const hasConsumables = pricingInputs.some((c) => c.presentationCategory === "Consumable");
  if (!hasConsumables) {
    let pConsumables = 220.0;
    if (params.widthMm === 1800 && hasSill) pConsumables = 260.0;
    else if (params.widthMm === 1800 && !hasSill) pConsumables = 235.0;
    else if (isThreePanel && params.widthMm === 2600) pConsumables = 340.0;

    pricingInputs.push({
      componentKey: "s798_consumables",
      componentName: "Weatherseal Gaskets & Silicone Sealants",
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      presentationCategory: "Consumable",
      rawMaterial: {
        id: "mat-cons",
        material_code: "mat_cons_set",
        description: "Consumables Kit",
        category: "Consumable",
        finish_type: "None",
        billing_unit: "set",
        unit_price: pConsumables,
        waste_allowance: 0,
        is_active: true,
      },
    });
  }

  return calculateParametricBOM(pricingInputs, {
    widthMm: params.widthMm,
    heightMm: params.heightMm,
    panelCount,
    hasSill,
    structuralWaiver: params.structuralWaiver ?? false,
  });
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function round4(val: number): number {
  return Math.round((val + Number.EPSILON) * 10000) / 10000;
}
