-- IMP-MS77 / ERD-E6: legacy open-category slots require administrator review.
-- Preserve affected row identities so the normalization can be reversed exactly.
CREATE TABLE IF NOT EXISTS public.ms77_legacy_null_accessory_slots (
  component_id UUID PRIMARY KEY
);

ALTER TABLE public.ms77_legacy_null_accessory_slots ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ms77_legacy_null_accessory_slots (component_id)
SELECT component_id
FROM public.product_components
WHERE is_accessory_slot = true AND allowed_accessory_ids IS NULL
ON CONFLICT (component_id) DO NOTHING;

UPDATE public.product_components
SET allowed_accessory_ids = ARRAY[]::UUID[]
WHERE is_accessory_slot = true AND allowed_accessory_ids IS NULL;

COMMENT ON TABLE public.ms77_legacy_null_accessory_slots IS
  'IMP-MS77 rollback inventory for legacy category-wide accessory slots; remove after release acceptance.';
