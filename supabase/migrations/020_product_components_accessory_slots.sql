-- Migration: 020_product_components_accessory_slots.sql
-- Description: Adds accessory slot flags, target categories, and position options to public.product_components
-- Upstream Traceability: ERD-E6 (product_components), PRD-F5, PRD-F14, SDD-C4, SDD-C9, IMP-MS75, IMP-MS76

ALTER TABLE public.product_components
ADD COLUMN IF NOT EXISTS is_accessory_slot BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS accessory_category VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS allowed_accessory_ids UUID[] NULL,
ADD COLUMN IF NOT EXISTS position_options JSONB NOT NULL DEFAULT '{
  "allowHorizontalToggle": true,
  "defaultHorizontal": "right",
  "horizontalOffsetMm": 45,
  "allowVerticalToggle": false,
  "defaultVertical": "up",
  "verticalOffsetMm": 1000
}'::jsonb;

-- Validate accessory category constraint
ALTER TABLE public.product_components
DROP CONSTRAINT IF EXISTS check_component_accessory_category;

ALTER TABLE public.product_components
ADD CONSTRAINT check_component_accessory_category
CHECK (
  (is_accessory_slot = false AND accessory_category IS NULL) OR
  (is_accessory_slot = true AND accessory_category IN ('handle', 'lock', 'hinge', 'roller', 'other'))
);

-- Index for querying products with swappable hardware slots
CREATE INDEX IF NOT EXISTS idx_product_components_accessory_slots
ON public.product_components (template_id, is_accessory_slot)
WHERE is_accessory_slot = true;
