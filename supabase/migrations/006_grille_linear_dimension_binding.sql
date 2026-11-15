-- Migration: Add GRILLE_LINEAR to product_components dimension_binding check constraint
-- Traceability: IMP-MS72, ERD-E6, PRD-F14, QAD-TC87.10

ALTER TABLE public.product_components
  DROP CONSTRAINT IF EXISTS product_components_dimension_binding_check;

ALTER TABLE public.product_components
  ADD CONSTRAINT product_components_dimension_binding_check
  CHECK (dimension_binding IN ('WIDTH', 'HEIGHT', 'AREA', 'FIXED', 'GRILLE_LINEAR'));
