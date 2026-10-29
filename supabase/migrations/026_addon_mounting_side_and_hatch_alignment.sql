-- Migration: 026_addon_mounting_side_and_hatch_alignment.sql
-- Description: Add allowed mounting sides and operator hatch alignment to product_compatible_addons
-- Upstream Traceability: PRD-F5, PRD-F14, SDD-C4, SDD-C9, ERD-E3, IMP-MS80

-- 1. Extend product_compatible_addons with mounting side constraints
ALTER TABLE public.product_compatible_addons
ADD COLUMN IF NOT EXISTS allowed_sides varchar(10) NOT NULL DEFAULT 'both'
CHECK (allowed_sides IN ('front', 'back', 'both'));

ALTER TABLE public.product_compatible_addons
ADD COLUMN IF NOT EXISTS default_side varchar(10) NOT NULL DEFAULT 'back'
CHECK (default_side IN ('front', 'back'));

-- 2. Add hatch operator alignment columns
ALTER TABLE public.product_compatible_addons
ADD COLUMN IF NOT EXISTS hatch_target_component_keys text[] DEFAULT NULL;

ALTER TABLE public.product_compatible_addons
ADD COLUMN IF NOT EXISTS hatch_alignment_config jsonb DEFAULT NULL;

-- 3. Update existing records: default awning and casement screens to 'back' only
UPDATE public.product_compatible_addons pca
SET allowed_sides = 'back', default_side = 'back'
FROM public.products p
WHERE pca.parent_product_id = p.product_id
  AND p.product_type IN ('Awning Window', 'Casement Window')
  AND pca.addon_type = 'screen';

-- 4. Comment on columns for schema governance
COMMENT ON COLUMN public.product_compatible_addons.allowed_sides IS 
'Permitted mounting locations: front (exterior only), back (interior only), or both (customer selectable)';

COMMENT ON COLUMN public.product_compatible_addons.default_side IS 
'Default mounting location: front (exterior) or back (interior)';

COMMENT ON COLUMN public.product_compatible_addons.hatch_target_component_keys IS 
'Array of host product component keys that screen access hatches automatically align to';

COMMENT ON COLUMN public.product_compatible_addons.hatch_alignment_config IS 
'Parametric configuration parameters for access hatch positioning and sizing';

-- Down Migration (Reversible Rollback):
-- ALTER TABLE public.product_compatible_addons DROP COLUMN IF EXISTS hatch_alignment_config;
-- ALTER TABLE public.product_compatible_addons DROP COLUMN IF EXISTS hatch_target_component_keys;
-- ALTER TABLE public.product_compatible_addons DROP COLUMN IF EXISTS default_side;
-- ALTER TABLE public.product_compatible_addons DROP COLUMN IF EXISTS allowed_sides;

