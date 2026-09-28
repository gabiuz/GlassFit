-- Migration: 008_rrd_pricing_model.sql
-- Description: Extend raw_materials to support R.R.D. stock-unit pricing and premium triggers
-- Upstream Specifications: docs/plans/pricing_model.md, docs/implementation/ms21.md
-- Traceability: PRD-F10, PRD-F14, PRD-F19, SDD-C7, SDD-C9, ERD-E17, QAD-TC34, QAD-TC35

ALTER TABLE "public"."raw_materials"
  ADD COLUMN IF NOT EXISTS "stock_length_meters" NUMERIC(6,3) DEFAULT 6.000,
  ADD COLUMN IF NOT EXISTS "stock_price_rrd" NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "sheet_width_ft" NUMERIC(5,2) DEFAULT 4.00,
  ADD COLUMN IF NOT EXISTS "sheet_height_ft" NUMERIC(5,2) DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS "is_premium_trigger" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pricing_tier" VARCHAR(20) NOT NULL DEFAULT 'Standard',
  ADD COLUMN IF NOT EXISTS "supported_thicknesses" INTEGER[] DEFAULT ARRAY[6, 8, 12];

COMMENT ON COLUMN "public"."raw_materials"."stock_length_meters" IS 'Commercial stock profile length in meters (default 6.0m for aluminum extrusions)';
COMMENT ON COLUMN "public"."raw_materials"."stock_price_rrd" IS 'Authoritative R.R.D. client selling price per whole stock unit (e.g. per 6m bar or per glass sheet)';
COMMENT ON COLUMN "public"."raw_materials"."sheet_width_ft" IS 'Glass sheet stock width in feet';
COMMENT ON COLUMN "public"."raw_materials"."sheet_height_ft" IS 'Glass sheet stock height in feet';
COMMENT ON COLUMN "public"."raw_materials"."is_premium_trigger" IS 'Flag indicating if selecting this material triggers the 2.0x premium multiplier';
COMMENT ON COLUMN "public"."raw_materials"."pricing_tier" IS 'Pricing tier: Standard or Premium';
COMMENT ON COLUMN "public"."raw_materials"."supported_thicknesses" IS 'Supported glass thicknesses in millimeters (e.g. 6, 8, 12)';

-- Remove scrap allowance overhead by setting default to 0.00
ALTER TABLE "public"."raw_materials" ALTER COLUMN "waste_allowance" SET DEFAULT 0.00;
UPDATE "public"."raw_materials" SET "waste_allowance" = 0.00;

