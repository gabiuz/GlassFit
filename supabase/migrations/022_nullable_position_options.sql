-- Migration: 022_nullable_position_options.sql
-- Description: Drop NOT NULL constraint on position_options and disable handing toggles on framing/mesh components
-- Upstream Traceability: ERD-E6 (product_components), PRD-F5, IMP-MS78

ALTER TABLE public.product_components
ALTER COLUMN position_options DROP NOT NULL;

ALTER TABLE public.product_components
ALTER COLUMN position_options SET DEFAULT NULL;

-- Disable handing options on framing, mesh, sill, and structural parts that erroneously inherited the default
UPDATE public.product_components
SET position_options = '{
  "allowHorizontalToggle": false,
  "defaultHorizontal": "right",
  "horizontalOffsetMm": 45,
  "allowVerticalToggle": false,
  "defaultVertical": "up",
  "verticalOffsetMm": 1000
}'::jsonb
WHERE presentation_category = 'Framing'
   OR component_type IN ('Frame', 'Model')
   OR component_key ILIKE '%frame%'
   OR component_key ILIKE '%mesh%'
   OR component_key ILIKE '%sill%'
   OR component_key ILIKE '%bar%'
   OR component_key ILIKE '%louver%'
   OR component_key ILIKE '%linkage%'
   OR component_key ILIKE '%clip%';

-- Ensure screen_access_hatch has correct natural default horizontal position (right)
UPDATE public.product_components
SET position_options = '{
  "allowHorizontalToggle": true,
  "defaultHorizontal": "right",
  "horizontalOffsetMm": 45,
  "allowVerticalToggle": false,
  "defaultVertical": "up",
  "verticalOffsetMm": 1000
}'::jsonb
WHERE component_key = 'screen_access_hatch';

