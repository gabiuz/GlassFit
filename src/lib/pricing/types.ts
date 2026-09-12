/**
 * GlassFit Parametric Pricing Engine: Domain Types and Contracts
 *
 * Upstream Specifications: docs/pricing.md, docs/milestone.md (MS-1, MS-5)
 * Traceability Codes: ERD-E6, ERD-E7, ERD-E14, ERD-E17, BAN-TYPE-05
 */

import { z } from "zod";

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

export const RawMaterialSchema = z.object({
  id: z.string().uuid(),
  material_code: z.string().min(1).max(50),
  description: z.string().min(1).max(255),
  category: RawMaterialCategorySchema,
  finish_type: RawMaterialFinishTypeSchema,
  billing_unit: BillingUnitSchema,
  unit_price: z.number().nonnegative(),
  waste_allowance: z.number().min(0).max(1),
  is_active: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type RawMaterial = z.infer<typeof RawMaterialSchema>;

// ----------------------------------------------------------------------------
// 2. Product Components & Dimensional Binding Schemas (ERD-E6)
// ----------------------------------------------------------------------------

export const DimensionBindingSchema = z.enum([
  "WIDTH",
  "HEIGHT",
  "AREA",
  "FIXED",
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
