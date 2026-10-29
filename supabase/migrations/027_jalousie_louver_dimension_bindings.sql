-- Migration: 027_jalousie_louver_dimension_bindings.sql
-- Description: Add LOUVER_BLADE and LOUVER_OPERATOR to product_components dimension_binding check constraint and add jalousie_config column
-- Upstream Traceability: PRD-F5, PRD-F10, PRD-F14, PRD-F19, SDD-C4, SDD-C7, SDD-C9, ERD-E6, IMP-MS81, QAD-TC96

-- 1. Update dimension_binding check constraint
ALTER TABLE public.product_components
  DROP CONSTRAINT IF EXISTS product_components_dimension_binding_check;

ALTER TABLE public.product_components
  ADD CONSTRAINT product_components_dimension_binding_check
  CHECK (dimension_binding IN ('WIDTH', 'HEIGHT', 'AREA', 'FIXED', 'GRILLE_LINEAR', 'PERIMETER', 'LOUVER_BLADE', 'LOUVER_OPERATOR'));

-- 2. Add jalousie_config column for pitch and bank configuration
ALTER TABLE public.product_components
  ADD COLUMN IF NOT EXISTS jalousie_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.product_components.jalousie_config IS
'Structured configuration for parametric jalousies: pitch_mm, blade_height_mm, blades_per_operator, base_blade_count, base_operator_count';

-- Down Migration (Reversible Rollback):
-- ALTER TABLE public.product_components DROP COLUMN IF EXISTS jalousie_config;
-- ALTER TABLE public.product_components DROP CONSTRAINT IF EXISTS product_components_dimension_binding_check;
-- ALTER TABLE public.product_components ADD CONSTRAINT product_components_dimension_binding_check CHECK (dimension_binding IN ('WIDTH', 'HEIGHT', 'AREA', 'FIXED', 'GRILLE_LINEAR', 'PERIMETER'));

