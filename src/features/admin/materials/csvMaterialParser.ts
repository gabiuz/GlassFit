/**
 * GlassFit Non-Technical CSV Raw Material Parser (MS-21)
 *
 * Upstream Specifications: docs/plans/pricing_model.md, docs/implementation/ms21.md
 * Traceability Codes: PRD-F14, PRD-F19, SDD-C9, ERD-E17, QAD-TC34, BAN-TYPE-05
 */

import type { RawMaterialCategory, BillingUnit } from "@/lib/pricing/types";
import type { UpsertRawMaterialInput } from "@/lib/admin/materials/types";
import {
  isSpecialAluminumColor,
  isGlassTypePremium,
  isGlassColorPremium,
  STANDARD_STOCK_LENGTH_METERS,
  STANDARD_SHEET_AREA_SQFT,
  SQFT_PER_SQM,
} from "@/lib/pricing/rrdPricingEngine";

export interface ParsedMaterialRow {
  rowIndex: number;
  materialCode: string;
  description: string;
  category: RawMaterialCategory;
  finishType: string;
  billingUnit: BillingUnit;
  stockPriceRrd: number;
  unitPrice: number;
  pricingTier: "Standard" | "Premium";
  isPremiumTrigger: boolean;
  status: "valid" | "warning" | "error";
  messages: string[];
  inputPayload?: UpsertRawMaterialInput;
}

export interface CsvParseResult {
  rows: ParsedMaterialRow[];
  summary: {
    total: number;
    validCount: number;
    warningCount: number;
    errorCount: number;
  };
}

/**
 * Standard easy template headers.
 */
export const CSV_TEMPLATE_HEADERS = [
  "Material Name",
  "Category",
  "Finish or Color",
  "RRD Stock Price (PHP)",
  "Stock Size (e.g. 6m or 4x6ft)",
  "Notes",
];

export const CSV_SAMPLE_ROWS = [
  '1" x 1" Aluminum Tube,Aluminum,Analok,720,6m,Standard hollow tube',
  '1" x 2" Aluminum Tube,Aluminum,White,1040,6m,Standard framing tube',
  'Clear Float Glass,Glass,Clear,864,4x6ft,Standard window glass',
  '4" x 24" Jalousie Glass Blade,Glass,Clear,45,1pc,Jalousie window louver slat',
  'Tempered Silver Glass,Glass,Silver,1728,4x6ft,Premium safety glass',
  "Series 798 Roller,Hardware,None,45,1pc,Single sash roller",
];

export function generateCsvTemplate(): string {
  return [CSV_TEMPLATE_HEADERS.join(","), ...CSV_SAMPLE_ROWS].join("\n");
}

/**
 * Automatically generates a human-friendly material code from category, description, and finish.
 */
export function generateMaterialCode(
  category: RawMaterialCategory,
  description: string,
  finish: string
): string {
  let cleanCat = "AL";
  if (category === "Glass") cleanCat = "GL";
  else if (category === "Hardware") cleanCat = "HW";
  else if (category === "Consumable") cleanCat = "CO";

  let cleanDesc = description
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  if (!cleanDesc) cleanDesc = "ITEM";


  let cleanFin = finish
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
  if (!cleanFin) cleanFin = "STD";

  return `${cleanCat}-${cleanDesc}-${cleanFin}`;
}

/**
 * Parses CSV lines handling quoted strings and commas cleanly.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Normalizes and parses non-technical CSV spreadsheet content into validated database DTOs.
 */
export function parseRawMaterialCsv(csvContent: string): CsvParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      summary: { total: 0, validCount: 0, warningCount: 0, errorCount: 0 },
    };
  }

  // Parse Header Row
  const rawHeaders = parseCsvLine(lines[0]);
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((h, idx) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    headerMap[clean] = idx;
  });

  const getColValue = (row: string[], ...aliases: string[]): string => {
    for (const alias of aliases) {
      const clean = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (headerMap[clean] !== undefined && row[headerMap[clean]] !== undefined) {
        return row[headerMap[clean]].trim();
      }
    }
    return "";
  };

  const parsedRows: ParsedMaterialRow[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCsvLine(line);
    if (columns.length === 0 || columns.every((c) => c === "")) continue;

    const rowIndex = i + 1;
    const messages: string[] = [];
    let hasError = false;
    let hasWarning = false;

    const rawName = getColValue(columns, "Material Name", "Name", "Description", "Material");
    const rawCategory = getColValue(columns, "Category", "Type");
    const rawFinish = getColValue(columns, "Finish or Color", "Finish", "Color", "Variant");
    const rawPrice = getColValue(columns, "RRD Stock Price (PHP)", "Stock Price", "RRD Price", "Price", "Unit Price", "Cost");
    const rawSize = getColValue(columns, "Stock Size (e.g. 6m or 4x6ft)", "Stock Size", "Size", "Unit");
    const rawNotes = getColValue(columns, "Notes", "Note", "Remarks");

    // 1. Description / Name
    const description = rawName || `Material Item ${rowIndex}`;
    if (!rawName) {
      messages.push("Missing material name; defaulted to generic placeholder");
      hasWarning = true;
    }

    // 2. Category Normalization
    let category: RawMaterialCategory = "Aluminum";
    const catLower = rawCategory.toLowerCase();
    if (catLower.includes("glass")) {
      category = "Glass";
    } else if (catLower.includes("hardware") || catLower.includes("roller") || catLower.includes("lock")) {
      category = "Hardware";
    } else if (catLower.includes("consumable") || catLower.includes("silicone") || catLower.includes("sealant") || catLower.includes("gasket")) {
      category = "Consumable";
    } else if (catLower.includes("aluminum") || catLower.includes("profile") || catLower.includes("frame")) {
      category = "Aluminum";
    } else {
      if (rawCategory.length > 0) {
        messages.push(`Unrecognized category "${rawCategory}", defaulted to Aluminum`);
        hasWarning = true;
      }
    }

    // 3. Finish / Color
    let finishType = rawFinish || "None";
    if (category === "Aluminum" && (!rawFinish || rawFinish.toLowerCase() === "none")) {
      finishType = "Analok";
    } else if (category === "Glass" && (!rawFinish || rawFinish.toLowerCase() === "none")) {
      finishType = "Clear";
    }

    // 4. Stock Price & Derived Unit Price
    const numericPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
    if (isNaN(numericPrice) || numericPrice <= 0) {
      messages.push("Missing or invalid stock price (must be positive number)");
      hasError = true;
    }
    const stockPriceRrd = isNaN(numericPrice) || numericPrice < 0 ? 0 : numericPrice;

    // 5. Billing Unit & Automatic Rate Derivation
    let billingUnit: BillingUnit = "m";
    let unitPrice = stockPriceRrd;
    const stockLengthM = STANDARD_STOCK_LENGTH_METERS;
    const sheetWidthFt = 4.0;
    const sheetHeightFt = 6.0;

    const isJalousiePiece =
      category === "Glass" &&
      (catLower.includes("jalousie") ||
        description.toLowerCase().includes("jalousie") ||
        description.toLowerCase().includes("blade") ||
        description.toLowerCase().includes("slat") ||
        rawSize.toLowerCase().includes("pc") ||
        rawSize.toLowerCase().includes("piece") ||
        rawNotes.toLowerCase().includes("jalousie") ||
        rawNotes.toLowerCase().includes("blade") ||
        rawNotes.toLowerCase().includes("slat") ||
        rawNotes.toLowerCase().includes("piece"));

    if (category === "Aluminum") {
      billingUnit = "m";
      unitPrice = Math.round((stockPriceRrd / stockLengthM + Number.EPSILON) * 100) / 100;
    } else if (category === "Glass") {
      if (isJalousiePiece) {
        billingUnit = "pc";
        unitPrice = stockPriceRrd;
      } else {
        billingUnit = "sqm";
        // Convert standard 4x6 ft (24 sqft) sheet to square meters
        const ratePerSqFt = stockPriceRrd / STANDARD_SHEET_AREA_SQFT;
        unitPrice = Math.round((ratePerSqFt * SQFT_PER_SQM + Number.EPSILON) * 100) / 100;
      }
    } else if (category === "Hardware") {
      billingUnit = "pc";
      unitPrice = stockPriceRrd;
    } else {
      billingUnit = "tube";
      unitPrice = stockPriceRrd;
    }

    // 6. Multiplier & Pricing Tier Classification
    let isPremiumTrigger = false;
    let pricingTier: "Standard" | "Premium" = "Standard";

    if (category === "Aluminum") {
      if (isSpecialAluminumColor(finishType)) {
        isPremiumTrigger = true;
        pricingTier = "Premium";
        messages.push(`Special powder-coated color finish (${finishType}) will trigger x2 multiplier`);
        hasWarning = true;
      }
    } else if (category === "Glass") {
      const isTypePrem = isGlassTypePremium(description) || isGlassTypePremium(finishType);
      const isColorPrem = isGlassColorPremium(finishType) || isGlassColorPremium(description);

      if (isTypePrem || isColorPrem) {
        isPremiumTrigger = true;
        pricingTier = "Premium";
        messages.push("Premium glass classification triggers x2 client pricing rule");
        hasWarning = true;
      }
    }

    // 7. Material Code Generation
    const materialCode = generateMaterialCode(category, description, finishType);

    const status: "valid" | "warning" | "error" = hasError
      ? "error"
      : hasWarning
      ? "warning"
      : "valid";

    if (status === "valid") validCount++;
    else if (status === "warning") warningCount++;
    else errorCount++;

    let inputPayload: UpsertRawMaterialInput | undefined;
    if (status !== "error") {
      inputPayload = {
        material_code: materialCode,
        description,
        category,
        finish_type: finishType,
        billing_unit: billingUnit,
        unit_price: unitPrice,
        waste_allowance: category === "Aluminum" ? 0.12 : (category === "Glass" && !isJalousiePiece) ? 0.1 : 0.0,
        is_active: true,
        stock_length_meters: category === "Aluminum" ? stockLengthM : undefined,
        stock_price_rrd: stockPriceRrd,
        sheet_width_ft: category === "Glass" && !isJalousiePiece ? sheetWidthFt : undefined,
        sheet_height_ft: category === "Glass" && !isJalousiePiece ? sheetHeightFt : undefined,
        is_premium_trigger: isPremiumTrigger,
        pricing_tier: pricingTier,
        supported_thicknesses: category === "Glass" ? [6, 8, 12] : undefined,
      };
    }

    parsedRows.push({
      rowIndex,
      materialCode,
      description,
      category,
      finishType,
      billingUnit,
      stockPriceRrd,
      unitPrice,
      pricingTier,
      isPremiumTrigger,
      status,
      messages,
      inputPayload,
    });
  }

  return {
    rows: parsedRows,
    summary: {
      total: parsedRows.length,
      validCount,
      warningCount,
      errorCount,
    },
  };
}
