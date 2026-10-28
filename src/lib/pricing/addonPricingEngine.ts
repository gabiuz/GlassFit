/**
 * Dedicated Parametric Add-on Pricing Engine (IMP-MS69)
 *
 * Upstream Specifications: docs/implementation/ms69.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F10, PRD-F11, SDD-C7, ERD-E13, ERD-E14, BRD-M2, BRD-M5, QAD-TC84.1 through QAD-TC84.10
 */

export interface AddonPricingInput {
  addonType: "screen" | "grill";
  widthMm: number;
  heightMm: number;
  finishType?: string;
  customProfileRate?: number; // PHP per linear meter
  customMeshRate?: number; // PHP per square meter
  hatchCount?: number;
  mountingSide?: "front" | "back";
  allowedSides?: "front" | "back" | "both";
  hatchTargetKeys?: string[];
}

export interface AddonBOMResult {
  addonType: "screen" | "grill";
  addonName: string;
  directMaterialCost: number;
  wasteAllowanceCost: number;
  laborCost: number;
  contractorMargin: number;
  finalAddonPrice: number;
  breakdown: Array<{
    item: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    subtotal: number;
  }>;
}

const SCRAP_ALUMINUM = 0.12; // 12% offcut allowance
const SCRAP_MESH = 0.10; // 10% mesh cut-off allowance
const CONTRACTOR_MARGIN_RATE = 0.25; // 25% margin

/**
 * Calculates itemized Bill of Materials (BOM) and final quotation price
 * for a modular add-on attachment (screen or grill).
 */
export function calculateAddonBOM(input: AddonPricingInput): AddonBOMResult {
  const widthM = input.widthMm / 1000;
  const heightM = input.heightMm / 1000;
  const breakdown: AddonBOMResult["breakdown"] = [];

  if (input.addonType === "screen") {
    // 1. Frame Extrusions (Perimeter: 2 * (W + H))
    const frameLinearM = 2 * (widthM + heightM);
    const frameNetRate = input.customProfileRate ?? 145.0; // PHP/m for screen channel extrusion
    const frameGrossCost = frameLinearM * (1 + SCRAP_ALUMINUM) * frameNetRate;

    breakdown.push({
      item: "Screen Frame Extrusion (Aluminum)",
      quantity: Math.round(frameLinearM * (1 + SCRAP_ALUMINUM) * 100) / 100,
      unit: "m",
      unitPrice: frameNetRate,
      subtotal: Math.round(frameGrossCost * 100) / 100,
    });

    // 2. Insect Wire Mesh (Area: W * H)
    const meshAreaSqm = widthM * heightM;
    const meshNetRate = input.customMeshRate ?? 220.0; // PHP/sqm for vinyl-coated fiberglass / wire mesh
    const meshGrossCost = meshAreaSqm * (1 + SCRAP_MESH) * meshNetRate;

    breakdown.push({
      item: "Insect Wire Mesh Screen",
      quantity: Math.round(meshAreaSqm * (1 + SCRAP_MESH) * 100) / 100,
      unit: "sqm",
      unitPrice: meshNetRate,
      subtotal: Math.round(meshGrossCost * 100) / 100,
    });

    // 3. Hardware (4 Corner Keys + Spline Rubber)
    const cornerKeysCost = 80.0; // 4 pcs @ 20.00
    const splineCost = frameLinearM * 15.0; // Rubber spline gasket
    let hardwareSubtotal = cornerKeysCost + splineCost;

    breakdown.push({
      item: "Spline & Corner Key Hardware",
      quantity: 1,
      unit: "set",
      unitPrice: Math.round(hardwareSubtotal * 100) / 100,
      subtotal: Math.round(hardwareSubtotal * 100) / 100,
    });

    const hatchCount = input.hatchCount ?? 0;
    if (hatchCount > 0) {
      const hatchHardwareUnitPrice = 180.0; // PHP per hatch wicket latch and pivot hinges set
      const hatchHardwareSubtotal = hatchCount * hatchHardwareUnitPrice;
      hardwareSubtotal += hatchHardwareSubtotal;
      breakdown.push({
        item: `Screen Access Hatch Hardware (${hatchCount}x operator ${hatchCount === 1 ? "hatch" : "hatches"})`,
        quantity: hatchCount,
        unit: "set",
        unitPrice: hatchHardwareUnitPrice,
        subtotal: hatchHardwareSubtotal,
      });
    }

    const materialSubtotal = frameGrossCost + meshGrossCost + hardwareSubtotal;
    const directMaterialCost = Math.round(materialSubtotal * 100) / 100;
    const laborCost = Math.max(350.0, materialSubtotal * 0.20);
    const laborCostRounded = Math.round(laborCost * 100) / 100;
    const margin = (materialSubtotal + laborCost) * CONTRACTOR_MARGIN_RATE;
    const contractorMargin = Math.round(margin * 100) / 100;
    const finalPrice = Math.round((directMaterialCost + laborCostRounded + contractorMargin) * 100) / 100;

    return {
      addonType: "screen",
      addonName: "Extruded Aluminum Insect Screen",
      directMaterialCost,
      wasteAllowanceCost:
        Math.round(
          (frameGrossCost - frameLinearM * frameNetRate + (meshGrossCost - meshAreaSqm * meshNetRate)) * 100,
        ) / 100,
      laborCost: laborCostRounded,
      contractorMargin,
      finalAddonPrice: finalPrice,
      breakdown,
    };
  } else {
    // Security Grille Pricing
    // 1. Perimeter Frame
    const frameLinearM = 2 * (widthM + heightM);
    const frameNetRate = 185.0; // PHP/m for tubular mounting frame
    const frameGrossCost = frameLinearM * (1 + SCRAP_ALUMINUM) * frameNetRate;

    breakdown.push({
      item: "Grille Mounting Perimeter Frame",
      quantity: Math.round(frameLinearM * (1 + SCRAP_ALUMINUM) * 100) / 100,
      unit: "m",
      unitPrice: frameNetRate,
      subtotal: Math.round(frameGrossCost * 100) / 100,
    });

    // 2. Repeating Structural Bars (Vertical Pickets at 140mm pitch)
    const colCount = Math.max(1, Math.round(input.widthMm / 140));
    const totalBarLinearM = colCount * heightM;
    const barNetRate = 160.0; // PHP/m for square tube bars
    const barGrossCost = totalBarLinearM * (1 + SCRAP_ALUMINUM) * barNetRate;

    breakdown.push({
      item: `Security Grille Bars (${colCount} pickets)`,
      quantity: Math.round(totalBarLinearM * (1 + SCRAP_ALUMINUM) * 100) / 100,
      unit: "m",
      unitPrice: barNetRate,
      subtotal: Math.round(barGrossCost * 100) / 100,
    });

    // 3. Mounting Anchors & Fasteners
    const anchorCost = 150.0;
    breakdown.push({
      item: "Heavy-Duty Wall Mounting Anchors",
      quantity: 1,
      unit: "set",
      unitPrice: anchorCost,
      subtotal: anchorCost,
    });

    const materialSubtotal = frameGrossCost + barGrossCost + anchorCost;
    const directMaterialCost = Math.round(materialSubtotal * 100) / 100;
    const laborCost = Math.max(600.0, materialSubtotal * 0.25);
    const laborCostRounded = Math.round(laborCost * 100) / 100;
    const margin = (materialSubtotal + laborCost) * CONTRACTOR_MARGIN_RATE;
    const contractorMargin = Math.round(margin * 100) / 100;
    const finalPrice = Math.round((directMaterialCost + laborCostRounded + contractorMargin) * 100) / 100;

    return {
      addonType: "grill",
      addonName: "Architectural Security Window Grille",
      directMaterialCost,
      wasteAllowanceCost:
        Math.round(
          (frameGrossCost - frameLinearM * frameNetRate + (barGrossCost - totalBarLinearM * barNetRate)) * 100,
        ) / 100,
      laborCost: laborCostRounded,
      contractorMargin,
      finalAddonPrice: finalPrice,
      breakdown,
    };
  }
}

/**
 * Returns canonical full display name for an add-on attachment.
 */
export function getAddonDisplayName(addonType: "screen" | "grill" | "none"): string {
  if (addonType === "screen") return "Extruded Aluminum Insect Screen";
  if (addonType === "grill") return "Architectural Security Window Grille";
  return "None (Standard Opening)";
}

/**
 * Returns short UI label for segmented toggle buttons.
 */
export function getAddonShortLabel(addonType: "screen" | "grill" | "none"): string {
  if (addonType === "screen") return "Screen";
  if (addonType === "grill") return "Grille";
  return "None";
}
