-- Migration: Add PERIMETER to product_components dimension_binding check constraint
-- Traceability: PRD-F14, SDD-C9, ERD-E6, DSD-UI10, QAD-TC95

ALTER TABLE public.product_components
  DROP CONSTRAINT IF EXISTS product_components_dimension_binding_check;

ALTER TABLE public.product_components
  ADD CONSTRAINT product_components_dimension_binding_check
  CHECK (dimension_binding IN ('WIDTH', 'HEIGHT', 'AREA', 'FIXED', 'GRILLE_LINEAR', 'PERIMETER'));
