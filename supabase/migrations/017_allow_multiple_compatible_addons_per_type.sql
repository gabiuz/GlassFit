-- Migration 017: Allow multiple compatible add-ons of the same type per parent host product
-- Traceability: PRD-F14, ERD-E3, SDD-C9

alter table public.product_compatible_addons
  drop constraint if exists uq_parent_addon_type;
