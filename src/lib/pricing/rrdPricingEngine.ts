/**
 * GlassFit R.R.D. Client Pricing Engine (MS-21)
 *
 * Upstream Specifications: docs/plans/pricing_model.md, docs/implementation/ms21.md
 * Traceability Codes: PRD-F10, SDD-C7, ERD-E14, ERD-E17, BRD-M5, QAD-TC18, QAD-TC35, BAN-TYPE-05
 */

import type {
  GlassType,
  GlassColor,
  GlassThickness,
  RrdPricingAuditDetails,
} from "./types";

// ----------------------------------------------------------------------------
// 1. Constants and Approved Catalogs
// ----------------------------------------------------------------------------

export const STANDARD_STOCK_LENGTH_METERS = 6.0;
export const STANDARD_SHEET_WIDTH_FT = 4.0;
export const STANDARD_SHEET_HEIGHT_FT = 6.0;
export const STANDARD_SHEET_AREA_SQFT = 24.0;
export const SQFT_PER_SQM = 10.7639104;

export const STANDARD_ALUMINUM_COLORS = ["White", "Analok"] as const;

export interface SpecialColorDefinition {
  code: string;
  name: string;
  category: "PowderCoatedSpecial";
}

export const SPECIAL_ALUMINUM_COLORS: SpecialColorDefinition[] = [
  { code: "AL 1001", name: "Metallic Silver", category: "PowderCoatedSpecial" },
  { code: "AL 1002", name: "Bright Silver", category: "PowderCoatedSpecial" },
  { code: "AL 1003", name: "Champagne Silver", category: "PowderCoatedSpecial" },
  { code: "AL 1004", name: "Champagne Gold", category: "PowderCoatedSpecial" },
  { code: "AL 1005", name: "Bright Gold", category: "PowderCoatedSpecial" },
  { code: "AL 1006", name: "Jade Silver", category: "PowderCoatedSpecial" },
  { code: "AL 1007", name: "Blue Silver", category: "PowderCoatedSpecial" },
  { code: "AL 1008", name: "Copper", category: "PowderCoatedSpecial" },
  { code: "AL 1009", name: "Black", category: "PowderCoatedSpecial" },
  { code: "AL 1010", name: "Sparkling Black", category: "PowderCoatedSpecial" },
  { code: "AL 1011", name: "Pure White", category: "PowderCoatedSpecial" },
  { code: "AL 1012", name: "Ivory White", category: "PowderCoatedSpecial" },
  { code: "AL 1013", name: "Finland Green", category: "PowderCoatedSpecial" },
  { code: "AL 1014", name: "Leaf Green", category: "PowderCoatedSpecial" },
  { code: "AL 1015", name: "Forest Green", category: "PowderCoatedSpecial" },
  { code: "AL 1016", name: "Light Blue", category: "PowderCoatedSpecial" },
  { code: "AL 1017", name: "Postal Blue", category: "PowderCoatedSpecial" },
  { code: "AL 1018", name: "Glossy Blue", category: "PowderCoatedSpecial" },
  { code: "AL 1019", name: "Dark Blue", category: "PowderCoatedSpecial" },
  { code: "AL 1020", name: "Coffee", category: "PowderCoatedSpecial" },
  { code: "Champagne", name: "Champagne", category: "PowderCoatedSpecial" },
  { code: "Peacock Blue", name: "Peacock Blue", category: "PowderCoatedSpecial" },
];

export const STANDARD_GLASS_TYPES: GlassType[] = ["Regular", "Frosted", "Mirror"];
export const PREMIUM_GLASS_TYPES: GlassType[] = ["Tempered", "Reflective"];

export const STANDARD_GLASS_COLORS: GlassColor[] = ["Clear", "Bronze"];
export const PREMIUM_GLASS_COLORS: GlassColor[] = ["Silver", "Blue"];

// ----------------------------------------------------------------------------
// 2. Aluminum Rate & Multiplier Functions
// ----------------------------------------------------------------------------

/**
 * Checks if the specified aluminum color or code is a special powder-coated finish.
 * Returns true for any non-standard color (standard colors are White and Analok).
 */
export function isSpecialAluminumColor(colorNameOrCode: string): boolean {
  if (!colorNameOrCode || typeof colorNameOrCode !== "string") {
    return false;
  }
  const normalized = colorNameOrCode.trim().toLowerCase();
  if (normalized === "white" || normalized === "analok" || normalized === "powdercoatedwhite" || normalized === "mill" || normalized === "none") {
    return false;
  }
  return true;
}

/**
 * Returns the aluminum color multiplier: 2.0 for special/powder-coated colors, 1.0 for White/Analok.
 */
export function getAluminumColorMultiplier(colorNameOrCode: string): number {
  return isSpecialAluminumColor(colorNameOrCode) ? 2.0 : 1.0;
}

/**
 * Computes aluminum extrusion material cost given required length in meters and stock price.
 * Standard regular profile length is 6 meters.
 */
export function calculateAluminumProfileCost(
  reqLengthM: number,
  stockPriceRrd: number,
  stockLengthM: number = STANDARD_STOCK_LENGTH_METERS
): number {
  const safeLength = Math.max(0, reqLengthM);
  const safeStockLength = Math.max(0.001, stockLengthM);
  const pricePerMeter = stockPriceRrd / safeStockLength;
  return round2(safeLength * pricePerMeter);
}

// ----------------------------------------------------------------------------
// 3. Glass Classification, Rates & Thickness Functions
// ----------------------------------------------------------------------------

/**
 * Evaluates whether a glass type is in the Premium tier (Tempered or Reflective).
 */
export function isGlassTypePremium(glassType: string): boolean {
  if (!glassType) return false;
  const lower = glassType.toLowerCase();
  return lower.includes("tempered") || lower.includes("reflective");
}

/**
 * Evaluates whether a glass color is in the Premium tier (Silver or Blue).
 */
export function isGlassColorPremium(glassColor: string): boolean {
  if (!glassColor) return false;
  const lower = glassColor.toLowerCase();
  return lower.includes("silver") || lower.includes("blue");
}

/**
 * Checks if a glass configuration triggers the single x2 premium multiplier.
 * Returns true if either the glass type OR the glass color is premium.
 */
export function isGlassOverallPremium(glassType: string, glassColor: string): boolean {
  return isGlassTypePremium(glassType) || isGlassColorPremium(glassColor);
}

/**
 * Returns the glass premium multiplier: strictly 2.0 if either type or color is premium, 1.0 otherwise.
 * Invariant: Multiplier is never squared or compounded (e.g. Tempered Silver triggers 2.0x once).
 */
export function getGlassPremiumMultiplier(glassType: string, glassColor: string): number {
  return isGlassOverallPremium(glassType, glassColor) ? 2.0 : 1.0;
}

/**
 * Derives the glass price per square foot from a whole sheet stock price.
 */
export function deriveGlassRatePerSqFt(
  stockPriceRrd: number,
  widthFt: number = STANDARD_SHEET_WIDTH_FT,
  heightFt: number = STANDARD_SHEET_HEIGHT_FT
): number {
  const areaSqFt = Math.max(0.001, widthFt * heightFt);
  return round2(stockPriceRrd / areaSqFt);
}

/**
 * Derives the glass price per square meter from a whole sheet stock price (1 sqm = 10.7639104 sqft).
 */
export function deriveGlassRatePerSqm(
  stockPriceRrd: number,
  widthFt: number = STANDARD_SHEET_WIDTH_FT,
  heightFt: number = STANDARD_SHEET_HEIGHT_FT
): number {
  const ratePerSqFt = deriveGlassRatePerSqFt(stockPriceRrd, widthFt, heightFt);
  return round2(ratePerSqFt * SQFT_PER_SQM);
}

/**
 * Computes the thickness surcharge according to the R.R.D. Thickness Matrix.
 * 6mm: +0 (both Standard and Premium)
 * 8mm: +400 (Standard), +600 (Premium)
 * 12mm: +1000 (Standard), +1200 (Premium)
 * 3mm or unsupported thickness: Throws deterministic Error.
 */
export function getThicknessSurcharge(
  thicknessMm: number,
  isGlassPremium: boolean
): number {
  if (thicknessMm === 3) {
    throw new Error(
      "3mm glass is banned and prohibited for architectural openings per R.R.D. workshop standard."
    );
  }
  if (thicknessMm === 6) {
    return 0;
  }
  if (thicknessMm === 8) {
    return isGlassPremium ? 600 : 400;
  }
  if (thicknessMm === 12) {
    return isGlassPremium ? 1200 : 1000;
  }
  throw new Error(
    `Unsupported glass thickness: ${thicknessMm}mm. Allowed thicknesses are 6mm, 8mm, and 12mm.`
  );
}

// ----------------------------------------------------------------------------
// 4. End-to-End R.R.D. Product Calculation
// ----------------------------------------------------------------------------

export interface CalculateRrdProductPriceInput {
  baseProductPrice: number;
  aluminumColor: string;
  glassType: GlassType | string;
  glassColor: GlassColor | string;
  thicknessMm: GlassThickness | number;
}

export interface CalculateRrdProductPriceResult {
  finalPrice: number;
  audit: RrdPricingAuditDetails;
}

/**
 * Deterministic end-to-end R.R.D. client quotation calculator implementing docs/plans/pricing_model.md.
 */
export function calculateRrdProductPrice(
  input: CalculateRrdProductPriceInput
): CalculateRrdProductPriceResult {
  const basePrice = Math.max(0, input.baseProductPrice);
  const isSpecialColor = isSpecialAluminumColor(input.aluminumColor);
  const colorMultiplier = isSpecialColor ? 2.0 : 1.0;

  const isTypePrem = isGlassTypePremium(input.glassType);
  const isColPrem = isGlassColorPremium(input.glassColor);
  const isOverallPrem = isTypePrem || isColPrem;

  // Single-application multiplier invariant at product level:
  // If special color is applied (x2), glass multiplier does not duplicate; if color is standard and glass is premium, apply x2.
  let productMultiplier = colorMultiplier;
  if (isOverallPrem && productMultiplier === 1.0) {
    productMultiplier = 2.0;
  }

  const priceAfterMultipliers = round2(basePrice * productMultiplier);
  const thicknessSurcharge = getThicknessSurcharge(input.thicknessMm, isOverallPrem);
  const finalPrice = round2(priceAfterMultipliers + thicknessSurcharge);

  const normalizedGlassType: GlassType =
    input.glassType === "Tempered" ||
    input.glassType === "Reflective" ||
    input.glassType === "Frosted" ||
    input.glassType === "Mirror"
      ? (input.glassType as GlassType)
      : "Regular";

  const normalizedGlassColor: GlassColor =
    input.glassColor === "Bronze" ||
    input.glassColor === "Silver" ||
    input.glassColor === "Blue"
      ? (input.glassColor as GlassColor)
      : "Clear";

  const normalizedThickness: GlassThickness =
    input.thicknessMm === 8 || input.thicknessMm === 12 ? (input.thicknessMm as GlassThickness) : 6;

  const audit: RrdPricingAuditDetails = {
    baseProductPrice: basePrice,
    aluminumColor: {
      name: input.aluminumColor,
      isSpecial: isSpecialColor,
      multiplier: colorMultiplier,
    },
    glassConfig: {
      type: normalizedGlassType,
      color: normalizedGlassColor,
      thicknessMm: normalizedThickness,
      isTypePremium: isTypePrem,
      isColorPremium: isColPrem,
      isOverallPremium: isOverallPrem,
      multiplierApplied: isOverallPrem ? 2.0 : 1.0,
      thicknessSurcharge,
    },
    finalPrice,
  };

  return {
    finalPrice,
    audit,
  };
}

// ----------------------------------------------------------------------------
// 5. Numerical Helper Utilities
// ----------------------------------------------------------------------------

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
