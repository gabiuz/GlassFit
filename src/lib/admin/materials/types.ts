/**
 * Raw Materials Master Catalog: Admin Types and Data Transfer Objects (DTOs)
 *
 * Upstream Specifications: docs/pricing.md, docs/milestone.md (MS-1, MS-2)
 * Traceability Codes: PRD-F14, PRD-F19, SDD-C9, ERD-E17, BAN-TYPE-05
 */

import { z } from "zod";
import {
  RawMaterialSchema,
  RawMaterialCategorySchema,
  RawMaterialFinishTypeSchema,
  BillingUnitSchema,
  type RawMaterial,
  type RawMaterialCategory,
  type RawMaterialFinishType,
  type BillingUnit,
} from "@/lib/pricing/types";

export {
  RawMaterialSchema,
  RawMaterialCategorySchema,
  RawMaterialFinishTypeSchema,
  BillingUnitSchema,
  type RawMaterial,
  type RawMaterialCategory,
  type RawMaterialFinishType,
  type BillingUnit,
};

// ----------------------------------------------------------------------------
// Admin Form Input Validation Schemas
// ----------------------------------------------------------------------------

export const UpsertRawMaterialInputSchema = z.object({
  id: z.string().uuid().optional(),
  material_code: z
    .string()
    .min(3, "Material code must be at least 3 characters")
    .max(50, "Material code cannot exceed 50 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Material code must contain only alphanumeric characters, underscores, and hyphens"),
  description: z.string().min(3, "Description is required").max(255),
  category: RawMaterialCategorySchema,
  finish_type: z.string(),
  billing_unit: BillingUnitSchema,
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  waste_allowance: z
    .number()
    .min(0, "Waste allowance must be between 0.00 and 1.00")
    .max(1, "Waste allowance must be between 0.00 and 1.00")
    .default(0.0),
  is_active: z.boolean().default(true),
  stock_length_meters: z.number().positive().optional(),
  stock_price_rrd: z.number().nonnegative().nullable().optional(),
  sheet_width_ft: z.number().positive().optional(),
  sheet_height_ft: z.number().positive().optional(),
  is_premium_trigger: z.boolean().optional(),
  pricing_tier: z.enum(["Standard", "Premium"]).optional(),
  supported_thicknesses: z.array(z.number()).optional(),
});
export type UpsertRawMaterialInput = z.infer<typeof UpsertRawMaterialInputSchema>;

export const BatchUpsertRawMaterialsInputSchema = z.object({
  items: z.array(UpsertRawMaterialInputSchema),
});
export type BatchUpsertRawMaterialsInput = z.infer<typeof BatchUpsertRawMaterialsInputSchema>;

export const BatchUpdateMaterialPricesInputSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      unit_price: z.number().min(0),
    })
  ),
});
export type BatchUpdateMaterialPricesInput = z.infer<typeof BatchUpdateMaterialPricesInputSchema>;


export const RawMaterialsFilterSchema = z.object({
  category: RawMaterialCategorySchema.optional(),
  finish_type: RawMaterialFinishTypeSchema.optional(),
  search: z.string().optional(),
  is_active: z.boolean().optional(),
});
export type RawMaterialsFilter = z.infer<typeof RawMaterialsFilterSchema>;
