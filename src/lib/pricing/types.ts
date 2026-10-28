/**
 * GlassFit Parametric Pricing Engine: Domain Types and Contracts
 *
 * Upstream Specifications: docs/pricing.md, docs/milestone.md (MS-1, MS-5)
 * Traceability Codes: ERD-E6, ERD-E7, ERD-E14, ERD-E17, BAN-TYPE-05
 */

import { z } from "zod";
import type { AccessoryCategory, AccessoryPositionOptions } from "@/lib/admin/products/types";

// ----------------------------------------------------------------------------
// 1. Raw Materials Master Catalog Enums & Schemas (ERD-E17)
// ----------------------------------------------------------------------------

export const RawMaterialCategorySchema = z.enum([
  "Aluminum",
  "Glass",
  "Hardware",
  "Consumable",
]);
export type RawMaterialCategory = z.infer<typeof RawMaterialCategorySchema>;

export const RawMaterialFinishTypeSchema = z.enum([
  "Mill",
  "Anodized",
  "Analok",
  "PowderCoatedWhite",
  "PowderCoatedBlack",
  "Clear",
  "Bronze",
  "Silver",
  "Blue",
  "None",
]);
export type RawMaterialFinishType = z.infer<typeof RawMaterialFinishTypeSchema>;

export const BillingUnitSchema = z.enum([
  "m",
  "sqm",
  "pc",
  "set",
  "tube",
  "lot",
]);
export type BillingUnit = z.infer<typeof BillingUnitSchema>;

export const GlassBillingUnitSchema = z.enum(["sqm", "pc"]);
export type GlassBillingUnit = z.infer<typeof GlassBillingUnitSchema>;

export const PricingTierSchema = z.enum(["Standard", "Premium"]);
export type PricingTier = z.infer<typeof PricingTierSchema>;

export const RawMaterialSchema = z.object({
  id: z.string().uuid(),
  material_code: z.string().min(1).max(50),
  description: z.string().min(1).max(255),
  category: RawMaterialCategorySchema,
  finish_type: z.string(),
  billing_unit: BillingUnitSchema,
  unit_price: z.number().nonnegative(),
  waste_allowance: z.number().min(0).max(1),
  is_active: z.boolean(),
  stock_length_meters: z.number().positive().optional(),
  stock_price_rrd: z.number().nonnegative().nullable().optional(),
  sheet_width_ft: z.number().positive().optional(),
  sheet_height_ft: z.number().positive().optional(),
  is_premium_trigger: z.boolean().optional(),
  pricing_tier: PricingTierSchema.optional(),
  supported_thicknesses: z.array(z.number()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type RawMaterial = z.infer<typeof RawMaterialSchema>;

// ----------------------------------------------------------------------------
// 1.1 R.R.D. Client Pricing & Finish Models (docs/plans/pricing_model.md, IMP-MS21)
// ----------------------------------------------------------------------------

export const AluminumColorTierSchema = z.enum(["Standard", "SpecialPowderCoated"]);
export type AluminumColorTier = z.infer<typeof AluminumColorTierSchema>;

export const AluminumColorSelectionSchema = z.object({
  colorName: z.string().min(1),
  colorCode: z.string().optional(),
  tier: AluminumColorTierSchema,
  multiplier: z.number().default(1.0),
});
export type AluminumColorSelection = z.infer<typeof AluminumColorSelectionSchema>;

export const GlassTypeSchema = z.enum([
  "Regular",
  "Frosted",
  "Mirror",
  "Tempered",
  "Reflective",
]);
export type GlassType = z.infer<typeof GlassTypeSchema>;

export const GlassColorSchema = z.enum([
  "Clear",
  "Bronze",
  "Silver",
  "Blue",
]);
export type GlassColor = z.infer<typeof GlassColorSchema>;

export const GlassThicknessSchema = z.union([
  z.literal(6),
  z.literal(8),
  z.literal(12),
]);
export type GlassThickness = z.infer<typeof GlassThicknessSchema>;

export const GlassSpecificationSchema = z.object({
  type: GlassTypeSchema,
  color: GlassColorSchema,
  thicknessMm: GlassThicknessSchema,
  isPremium: z.boolean(),
  thicknessSurcharge: z.number().nonnegative(),
});
export type GlassSpecification = z.infer<typeof GlassSpecificationSchema>;

export const RrdRawMaterialSchema = z.object({
  id: z.string().uuid(),
  material_code: z.string().min(1).max(50),
  description: z.string().min(1).max(255),
  category: RawMaterialCategorySchema,
  finish_type: z.string(),
  billing_unit: BillingUnitSchema,
  unit_price: z.number().nonnegative(),
  stock_length_meters: z.number().positive().default(6.0),
  stock_price_rrd: z.number().nonnegative().optional(),
  sheet_width_ft: z.number().positive().default(4.0),
  sheet_height_ft: z.number().positive().default(6.0),
  is_premium_trigger: z.boolean().default(false),
  pricing_tier: PricingTierSchema.default("Standard"),
  supported_thicknesses: z.array(z.number()).default([6, 8, 12]),
  waste_allowance: z.number().min(0).max(1).default(0.0),
  is_active: z.boolean().default(true),
});
export type RrdRawMaterial = z.infer<typeof RrdRawMaterialSchema>;

export interface RrdPricingAuditDetails {
  baseProductPrice: number;
  aluminumColor: {
    name: string;
    isSpecial: boolean;
    multiplier: number;
  };
  glassConfig: {
    type: GlassType;
    color: GlassColor;
    thicknessMm: GlassThickness;
    isTypePremium: boolean;
    isColorPremium: boolean;
    isOverallPremium: boolean;
    multiplierApplied: number;
    thicknessSurcharge: number;
  };
  finalPrice: number;
}


// ----------------------------------------------------------------------------
// 2. Product Components & Dimensional Binding Schemas (ERD-E6)
// ----------------------------------------------------------------------------

export const DimensionBindingSchema = z.enum([
  "WIDTH",
  "HEIGHT",
  "AREA",
  "FIXED",
  "GRILLE_LINEAR",
]);
export type DimensionBinding = z.infer<typeof DimensionBindingSchema>;

export const PresentationCategorySchema = z.enum([
  "Framing",
  "Glazing",
  "Hardware",
  "Consumable",
  "Other",
]);
export type PresentationCategory = z.infer<typeof PresentationCategorySchema>;

export const ComponentMaterialBindingSchema = z.object({
  id: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
  rawMaterialId: z.string().uuid(),
  isDefault: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  rawMaterial: RawMaterialSchema.optional(),
});

export interface ComponentMaterialBinding {
  id?: string;
  bindingId?: string;
  componentId?: string;
  componentKey?: string;
  rawMaterialId: string;
  isDefault: boolean;
  displayOrder?: number;
  rawMaterial?: RawMaterial;
}

export interface ProductComponent {
  id: string;
  productId: string;
  componentKey: string;
  componentName: string;
  componentType: string;
  assemblyGroup: string;
  baseQuantity: number;
  rawMaterialId: string | null;
  dimensionBinding: DimensionBinding;
  spanRatio: number;
  isRemovable: boolean;
  togglePropertyKey: string | null;
  presentationCategory: PresentationCategory;
  glbFileUrl?: string | null;
  allowedMaterials?: ComponentMaterialBinding[];
  defaultRawMaterialId?: string | null;
  isAccessorySlot?: boolean;
  accessoryCategory?: AccessoryCategory | null;
  allowedAccessoryIds?: string[] | null;
  positionOptions?: AccessoryPositionOptions;
  unitPrice?: number;
  pricingMethod?: string;
  handingMetadata?: import("@/lib/admin/products/types").ComponentHandingMetadata | null;
  componentData?: Record<string, unknown>;
}

export const ProductComponentBindingSchema = z.object({
  component_id: z.string().uuid().optional(),
  template_id: z.string().uuid(),
  component_key: z.string().min(1).max(50),
  component_name: z.string().min(1).max(100),
  raw_material_id: z.string().uuid().nullable().optional(),
  raw_material_code: z.string().optional(),
  dimension_binding: DimensionBindingSchema.default("FIXED"),
  span_ratio: z.number().min(0).max(10).default(1.0),
  base_quantity: z.number().int().nonnegative().default(1),
  is_removable: z.boolean().default(false),
  toggle_property_key: z.string().max(50).nullable().optional(),
  presentation_category: PresentationCategorySchema.default("Framing"),
  glb_file_url: z.string().nullable().optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  is_accessory_slot: z.boolean().default(false).optional(),
  accessory_category: z.enum(["handle", "lock", "hinge", "roller", "other"]).nullable().optional(),
  allowed_accessory_ids: z.array(z.string().uuid()).nullable().optional(),
  position_options: z.record(z.string(), z.unknown()).optional(),
});
export type ProductComponentBinding = z.infer<typeof ProductComponentBindingSchema>;

// ----------------------------------------------------------------------------
// 3. Structural Rules & Guardrail Payloads (ERD-E7)
// ----------------------------------------------------------------------------

export const RuleTriggerConditionSchema = z.object({
  parameter: z.string(),
  operator: z.enum([">=", "<=", "==", ">", "<", "!="]),
  value_mm: z.number().optional(),
  value: z.union([z.number(), z.string(), z.boolean()]).optional(),
});
export type RuleTriggerCondition = z.infer<typeof RuleTriggerConditionSchema>;

export const RuleComponentMutationSchema = z.object({
  target_category: z.string().optional(),
  target_component: z.string().optional(),
  target_component_key: z.string().optional(),
  update_span_ratio: z.number().optional(),
  update_base_quantity: z.number().optional(),
});
export type RuleComponentMutation = z.infer<typeof RuleComponentMutationSchema>;

export const StructuralRulePayloadSchema = z.object({
  rule_name: z.string(),
  trigger_condition: RuleTriggerConditionSchema,
  action_payload: z.object({
    enforce_panel_count: z.number().int().positive().optional(),
    ui_prompt: z.enum(["PROMPT_MODAL_BEHAVIOR_B", "INFO_BANNER", "NONE"]).optional(),
    mutations: z.array(RuleComponentMutationSchema).default([]),
  }),
});
export type StructuralRulePayload = z.infer<typeof StructuralRulePayloadSchema>;

// ----------------------------------------------------------------------------
// 4. Quotation Bill-of-Materials (BOM) & Frozen Snapshots (ERD-E14)
// ----------------------------------------------------------------------------

export const QuotationItemGroupNameSchema = z.enum([
  "Aluminum Framing",
  "Glass Infill",
  "Hardware & Accessories",
  "Labor & Installation",
  "Miscellaneous",
]);
export type QuotationItemGroupName = z.infer<typeof QuotationItemGroupNameSchema>;

export const BOMItemDetailSchema = z.object({
  code: z.string(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  waste_factor: z.number().optional(),
  subtotal: z.number(),
});
export type BOMItemDetail = z.infer<typeof BOMItemDetailSchema>;

export const FrozenPricingDetailsSchema = z.object({
  width_m: z.number(),
  height_m: z.number(),
  panel_count: z.number().int(),
  has_sill: z.boolean(),
  finish_type: z.string(),
  glass_type: z.string(),
  items_breakdown: z.array(BOMItemDetailSchema),
  raw_material_subtotal: z.number(),
  waste_allowance_subtotal: z.number(),
  direct_material_subtotal: z.number(),
  labor_cost: z.number(),
  contractor_margin: z.number(),
  margin_rate: z.number(),
  total_estimate: z.number(),
  admin_labor_charge: z.number().optional(),
});
export type FrozenPricingDetails = z.infer<typeof FrozenPricingDetailsSchema>;

export const QuotationBOMGroupItemSchema = z.object({
  item_group_name: QuotationItemGroupNameSchema,
  quantity: z.number().nonnegative(),
  unit_label: z.string(),
  unit_price: z.number().nonnegative(),
  estimated_subtotal: z.number().nonnegative(),
  structural_waiver: z.boolean().default(false),
  pricing_details: FrozenPricingDetailsSchema,
});
export type QuotationBOMGroupItem = z.infer<typeof QuotationBOMGroupItemSchema>;

export const QuotationBOMSummarySchema = z.object({
  quotation_id: z.string().uuid().optional(),
  total_estimated_amount: z.number().nonnegative(),
  currency: z.literal("PHP").default("PHP"),
  has_sill: z.boolean(),
  structural_waiver: z.boolean().default(false),
  groups: z.array(QuotationBOMGroupItemSchema),
});
export type QuotationBOMSummary = z.infer<typeof QuotationBOMSummarySchema>;

// ----------------------------------------------------------------------------
// 5. Parametric Calculation Results & Multi-Product Aggregation
// ----------------------------------------------------------------------------

export interface CalculatedBOMResult {
  widthM: number;
  heightM: number;
  panelCount: number;
  hasSill: boolean;
  finishType: string;
  glassType: string;
  leafWidthM: number;
  aspectRatio: number;
  isCrabbingRisk: boolean;
  isSpanLimitExceeded: boolean;

  // Linear / Surface Metrics
  totalLinearMetersFraming: number;
  glazingAreaSqm: number;

  // Itemized Arrays
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

export interface ItemizedProductQuotation {
  itemId: string;
  productId: string;
  productName: string;
  productType: string;
  variantName: string;
  specSummary: string;
  dimensionsFormatted: string;
  widthMm: number;
  heightMm: number;
  panelCount: number;
  hasSill: boolean;
  structuralWaiver: boolean;
  finishType: string;
  glassType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl: string;
  bomResult: CalculatedBOMResult;
  calibrationProvenance?: import("../visualization/measurementRecord").MeasurementRecord | null;
  dimensionSource?: string;
  paperStandard?: string | null;
  calibrationScaleCmPerPx?: number | null;
  userVerified?: boolean | null;
  calibrationMethod?: string | null;
  calibrationConfidence?: number | null;
  selectedMaterials?: Record<string, string>;
  selectedAddon?: "none" | "screen" | "grill";
  addonProductId?: string | null;
  addonName?: string | null;
  addonPrice?: number;
  baseUnitPrice?: number;
  addonAluminumFinish?: string;
  addonBOM?: import("./addonPricingEngine").AddonBOMResult | null;
  grilleBOM?: GrilleLinearBOMResult | null;
  swappedAccessories?: Record<string, import("../visualization/types").SelectedAccessoryState>;
  accessoryPriceDelta?: number;
}

export interface ConsolidatedQuotationSummary {
  items: ItemizedProductQuotation[];
  totalQuantity: number;
  totalFramingMeters: number;
  totalFramingCost: number;
  totalGlazingSqm: number;
  totalGlazingCost: number;
  totalHardwareCost: number;
  totalConsumablesCost: number;
  totalDirectMaterialsCost: number;
  totalLaborCost: number;
  totalDirectCost: number;
  totalContractorMargin: number;
  finalGrandTotal: number;
}

// ----------------------------------------------------------------------------
// 6. Parametric Linear Grille Pricing & Bar Metrics (IMP-MS71)
// ----------------------------------------------------------------------------

export type GrilleBarOrientation = "HORIZONTAL" | "VERTICAL";

export type GrillePatternType =
  | "grid" // Full-height vertical pickets + continuous horizontal rails
  | "louvers" // Continuous horizontal slats + vertical center mullion(s)
  | "staggered_brick" // Vertical pickets + alternating staggered horizontal tie bars
  | "custom_uploaded"; // Extracted from uploaded 3D GLB mesh

export interface GrilleBarMetric {
  id: string;
  name: string;
  orientation: GrilleBarOrientation;
  lengthMm: number; // Cut length of a single piece in millimeters
  lengthM: number; // Cut length in meters
  count: number; // Number of identical pieces
  totalLinearM: number; // lengthM * count
  rawMaterialId?: string | null;
  materialCode?: string;
  unitPricePerMeter: number;
  subtotalCost: number;
}

export interface GrilleLinearPricingInput {
  widthMm: number; // Aperture opening width
  heightMm: number; // Aperture opening height
  patternType?: GrillePatternType;
  nominalPitchColMm?: number; // Target vertical bar pitch (default: 140mm)
  nominalPitchRowMm?: number; // Target horizontal bar pitch (default: 191mm)
  horizontalBarCount?: number; // Optional explicit or geometry-detected horizontal bar count
  verticalBarCount?: number; // Optional explicit or geometry-detected vertical bar count
  frameProfileWidthMm?: number; // Perimeter frame face width (default: 20mm)
  includePerimeterFrame?: boolean; // True if grille includes outer frame rails (default: true)
  grilleRawMaterial: {
    id: string;
    material_code: string;
    description: string;
    unit_price: number; // PHP per linear meter
    waste_allowance?: number; // e.g. 0.12 (12%)
  };
  frameRawMaterial?: {
    id: string;
    material_code: string;
    description: string;
    unit_price: number; // PHP per linear meter
    waste_allowance?: number;
  } | null;
  laborRate?: number; // Default 0.25 (25% of material)
  laborFloor?: number; // Default PHP 650.00
  contractorMarginRate?: number; // Default 0.25 (25%)
}

export interface GrilleLinearBOMResult {
  patternType: GrillePatternType;
  totalPieces: number;
  totalLinearMeters: number;
  directMaterialCost: number;
  wasteAllowanceCost: number;
  laborCost: number;
  contractorMargin: number;
  finalPrice: number;
  perimeterRails: {
    topRail: GrilleBarMetric;
    bottomRail: GrilleBarMetric;
    leftJamb: GrilleBarMetric;
    rightJamb: GrilleBarMetric;
    totalLinearM: number;
    subtotalCost: number;
  } | null;
  verticalBars: {
    barCount: number;
    cutLengthMm: number;
    totalLinearM: number;
    subtotalCost: number;
    details: GrilleBarMetric[];
  };
  horizontalBars: {
    barCount: number;
    cutLengthMm: number;
    totalLinearM: number;
    subtotalCost: number;
    details: GrilleBarMetric[];
  };
  itemizedBreakdown: Array<{
    item: string;
    orientation: GrilleBarOrientation | "PERIMETER";
    pieces: number;
    lengthMm: number;
    totalMeters: number;
    unitRate: number;
    subtotal: number;
  }>;
}

