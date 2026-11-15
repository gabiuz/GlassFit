-- Migration: 019_accessories_product_role.sql
-- Description: Adds is_accessory flag, accessory_category, and accessory_mounting_type to public.products
-- Upstream Traceability: ERD-E3 (products), PRD-F1, PRD-F14, SDD-C1, SDD-C9, IMP-MS74

-- 1. Extend public.products with accessory classification columns
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_accessory BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS accessory_category VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS accessory_mounting_type VARCHAR(50) NULL;

-- 2. Enforce mutual exclusivity: a product cannot be both an add-on and an accessory
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS check_product_role_mutual_exclusion;

ALTER TABLE public.products
ADD CONSTRAINT check_product_role_mutual_exclusion
CHECK (
  NOT (is_addon = true AND is_accessory = true)
);

-- 3. Enforce valid accessory categories when is_accessory is true
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS check_valid_accessory_category;

ALTER TABLE public.products
ADD CONSTRAINT check_valid_accessory_category
CHECK (
  (is_accessory = false AND accessory_category IS NULL) OR
  (is_accessory = true AND accessory_category IN ('handle', 'lock', 'hinge', 'roller', 'other'))
);

-- 4. Index for fast filtered catalog queries
CREATE INDEX IF NOT EXISTS idx_products_is_accessory
ON public.products (is_accessory, accessory_category)
WHERE is_accessory = true;
