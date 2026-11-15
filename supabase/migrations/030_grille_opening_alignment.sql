-- Migration: 030_grille_opening_alignment.sql
-- Description: Add operator handle opening configuration for security grilles to product_compatible_addons
-- Upstream Traceability: PRD-F5, PRD-F10, PRD-F14, SDD-C4, SDD-C7, SDD-C9, ERD-E3, ERD-E6, ERD-E14, IMP-MS86

-- 1. Add grille opening target component keys and dimensional config
ALTER TABLE public.product_compatible_addons
ADD COLUMN IF NOT EXISTS grille_opening_target_component_keys text[] DEFAULT NULL;

ALTER TABLE public.product_compatible_addons
ADD COLUMN IF NOT EXISTS grille_opening_config jsonb DEFAULT NULL;

-- 2. Add documentation comments for schema governance
COMMENT ON COLUMN public.product_compatible_addons.grille_opening_target_component_keys IS
'List of host product component keys (handles, operators) requiring framed rectangular clearance openings in security grilles';

COMMENT ON COLUMN public.product_compatible_addons.grille_opening_config IS
'JSON configuration for grille clearance openings: { cutoutWidthMm: number, cutoutHeightMm: number, enabled: boolean }';

-- Down Migration (Reversible Rollback):
-- ALTER TABLE public.product_compatible_addons DROP COLUMN IF EXISTS grille_opening_config;
-- ALTER TABLE public.product_compatible_addons DROP COLUMN IF EXISTS grille_opening_target_component_keys;

