-- Migration: 023_hardware_accessories_raw_materials.sql
-- Description: Synchronize hardware accessories into raw_materials under category Hardware for component pricing
-- Upstream Traceability: PRD-F14, SDD-C9, ERD-E6, ERD-E17, IMP-MS78

-- 1. Add product_id column to raw_materials (nullable, cascades on product deletion)
ALTER TABLE public.raw_materials
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(product_id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_materials_product_id
ON public.raw_materials(product_id)
WHERE product_id IS NOT NULL;

-- 2. Trigger function to automatically sync hardware accessories to raw_materials
CREATE OR REPLACE FUNCTION public.sync_hardware_accessory_to_raw_materials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code varchar(50);
  v_clean_name varchar(50);
  v_existing_id uuid;
BEGIN
  IF NEW.is_accessory IS TRUE THEN
    -- Generate clean deterministic material code (e.g. HW-LEVERHANDLE-A1B2C3)
    v_clean_name := upper(regexp_replace(coalesce(NEW.product_name, 'ACC'), '[^a-zA-Z0-9]', '', 'g'));
    IF length(v_clean_name) > 16 THEN
      v_clean_name := substring(v_clean_name from 1 for 16);
    END IF;
    v_code := 'HW-' || v_clean_name || '-' || upper(substring(replace(NEW.product_id::text, '-', '') from 1 for 6));

    SELECT id INTO v_existing_id FROM public.raw_materials WHERE product_id = NEW.product_id OR id = NEW.product_id;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.raw_materials
      SET
        product_id = NEW.product_id,
        description = NEW.product_name,
        category = 'Hardware',
        finish_type = 'Standard',
        billing_unit = 'pc',
        unit_price = coalesce(NEW.base_price, 0),
        waste_allowance = 0.000,
        is_active = TRUE,
        updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.raw_materials (
        id,
        product_id,
        material_code,
        description,
        category,
        finish_type,
        billing_unit,
        unit_price,
        waste_allowance,
        is_active
      ) VALUES (
        NEW.product_id,
        NEW.product_id,
        v_code,
        NEW.product_name,
        'Hardware',
        'Standard',
        'pc',
        coalesce(NEW.base_price, 0),
        0.000,
        TRUE
      );
    END IF;
  ELSE
    -- If product is not or no longer an accessory, delete any synced raw material
    DELETE FROM public.raw_materials WHERE product_id = NEW.product_id OR id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_hardware_accessory_raw_materials ON public.products;
CREATE TRIGGER trg_sync_hardware_accessory_raw_materials
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_hardware_accessory_to_raw_materials();

-- 3. Two-way sync: When an admin updates raw_materials unit_price or description, sync back to products.base_price
CREATE OR REPLACE FUNCTION public.sync_raw_material_to_hardware_accessory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND (OLD.unit_price IS DISTINCT FROM NEW.unit_price OR OLD.description IS DISTINCT FROM NEW.description) THEN
    UPDATE public.products
    SET
      base_price = NEW.unit_price,
      product_name = NEW.description,
      updated_at = now()
    WHERE product_id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_raw_material_to_hardware_accessory ON public.raw_materials;
CREATE TRIGGER trg_sync_raw_material_to_hardware_accessory
  AFTER UPDATE ON public.raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_raw_material_to_hardware_accessory();

-- 4. Backfill any existing hardware accessories into raw_materials
INSERT INTO public.raw_materials (
  id,
  product_id,
  material_code,
  description,
  category,
  finish_type,
  billing_unit,
  unit_price,
  waste_allowance,
  is_active
)
SELECT
  p.product_id,
  p.product_id,
  'HW-' || upper(substring(regexp_replace(coalesce(p.product_name, 'ACC'), '[^a-zA-Z0-9]', '', 'g') from 1 for 16)) || '-' || upper(substring(replace(p.product_id::text, '-', '') from 1 for 6)),
  p.product_name,
  'Hardware',
  'Standard',
  'pc',
  coalesce(p.base_price, 0),
  0.000,
  TRUE
FROM public.products p
WHERE p.is_accessory IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.raw_materials rm WHERE rm.product_id = p.product_id OR rm.id = p.product_id
  );

