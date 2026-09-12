-- ============================================================================
-- 005_parametric_pricing_engine.sql
-- GlassFit Parametric Pricing Engine, Structural Guardrails & Raw Materials
--
-- Milestone 1: Database Schema & Seed Migration (Persistence Layer)
-- Upstream Specifications: docs/pricing.md, docs/milestone.md (MS-1)
-- Traceability Codes: ERD-E6, ERD-E7, ERD-E14, ERD-E17, BAN-MIGR-06
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Table: public.raw_materials (ERD-E17)
-- Central catalog managing physical inventory unit rates, finish types, and waste factors.
-- --------------------------------------------------------------------------

create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  material_code varchar(50) unique not null,
  description varchar(255) not null,
  category varchar(50) not null,
  finish_type varchar(50) not null,
  billing_unit varchar(20) not null,
  unit_price numeric(10, 2) not null,
  waste_allowance numeric(4, 3) not null default 0.000,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint raw_materials_category_check
    check (category in ('Aluminum', 'Glass', 'Hardware', 'Consumable')),
  constraint raw_materials_billing_unit_check
    check (billing_unit in ('m', 'sqm', 'pc', 'set', 'tube', 'lot')),
  constraint raw_materials_unit_price_nonnegative
    check (unit_price >= 0),
  constraint raw_materials_waste_allowance_range
    check (waste_allowance >= 0.000 and waste_allowance <= 1.000)
);

-- Indexes for performance
create index if not exists raw_materials_category_idx
  on public.raw_materials(category);
create index if not exists raw_materials_finish_type_idx
  on public.raw_materials(finish_type);
create index if not exists raw_materials_active_idx
  on public.raw_materials(is_active);

-- Automatic updated_at trigger
create or replace function public.set_raw_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists raw_materials_set_updated_at on public.raw_materials;
create trigger raw_materials_set_updated_at
  before update on public.raw_materials
  for each row execute function public.set_raw_materials_updated_at();

-- RLS Policies for raw_materials
alter table public.raw_materials enable row level security;

drop policy if exists raw_materials_public_read_active on public.raw_materials;
create policy raw_materials_public_read_active
  on public.raw_materials for select
  using (is_active = true or public.is_admin());

drop policy if exists raw_materials_admin_insert on public.raw_materials;
create policy raw_materials_admin_insert
  on public.raw_materials for insert to authenticated
  with check (public.has_admin_permission('manage_products') or public.is_admin());

drop policy if exists raw_materials_admin_update on public.raw_materials;
create policy raw_materials_admin_update
  on public.raw_materials for update to authenticated
  using (public.has_admin_permission('manage_products') or public.is_admin())
  with check (public.has_admin_permission('manage_products') or public.is_admin());

drop policy if exists raw_materials_admin_delete on public.raw_materials;
create policy raw_materials_admin_delete
  on public.raw_materials for delete to authenticated
  using (public.has_admin_permission('manage_products') or public.is_admin());

-- --------------------------------------------------------------------------
-- 2. Populate Benchmark Seed Data for raw_materials (docs/pricing.md Section 3.1)
-- --------------------------------------------------------------------------

insert into public.raw_materials (material_code, description, category, finish_type, billing_unit, unit_price, waste_allowance, is_active)
values
  ('mat_al_798_head_anlk', 'Series 798 Double Head', 'Aluminum', 'Analok', 'm', 90.00, 0.120, true),
  ('mat_al_798_sill_anlk', 'Series 798 Double Sill', 'Aluminum', 'Analok', 'm', 110.00, 0.120, true),
  ('mat_al_798_jamb_anlk', 'Series 798 Double Jamb', 'Aluminum', 'Analok', 'm', 70.00, 0.120, true),
  ('mat_al_798_rail_anlk', 'Series 798 Sash Rail', 'Aluminum', 'Analok', 'm', 72.00, 0.120, true),
  ('mat_al_798_stle_anlk', 'Series 798 Interlock/Lockstile', 'Aluminum', 'Analok', 'm', 78.00, 0.120, true),
  ('mat_al_798_head_pcw', 'Series 798 Double Head', 'Aluminum', 'PowderCoatedWhite', 'm', 105.00, 0.120, true),
  ('mat_al_798_sill_pcw', 'Series 798 Double Sill', 'Aluminum', 'PowderCoatedWhite', 'm', 125.00, 0.120, true),
  ('mat_al_798_jamb_pcw', 'Series 798 Double Jamb', 'Aluminum', 'PowderCoatedWhite', 'm', 82.00, 0.120, true),
  ('mat_al_798_rail_pcw', 'Series 798 Sash Rail', 'Aluminum', 'PowderCoatedWhite', 'm', 84.00, 0.120, true),
  ('mat_al_798_stle_pcw', 'Series 798 Interlock/Lockstile', 'Aluminum', 'PowderCoatedWhite', 'm', 90.00, 0.120, true),
  ('mat_gl_6mm_float_brz', '6mm Annealed Float Tinted', 'Glass', 'Bronze', 'sqm', 780.00, 0.100, true),
  ('mat_gl_6mm_float_clr', '6mm Annealed Float Clear', 'Glass', 'Clear', 'sqm', 650.00, 0.100, true),
  ('mat_gl_6mm_tempered', '6mm Safety Tempered Clear', 'Glass', 'Clear', 'sqm', 1650.00, 0.050, true),
  ('mat_hw_798_roller', 'Series 798 Single POM Roller', 'Hardware', 'Mill', 'pc', 25.00, 0.000, true),
  ('mat_hw_flush_lock', 'Mortise Flush Latch Lock', 'Hardware', 'Mill', 'pc', 65.00, 0.000, true),
  ('mat_hw_guide_caps', 'Sash Guide & Anti-Lift Caps Set', 'Hardware', 'Mill', 'set', 50.00, 0.000, true),
  ('mat_cons_sealant', 'Neutral-Cure Silicone Sealant (Perimeter)', 'Consumable', 'None', 'tube', 220.00, 0.000, true),
  ('mat_cons_epdm_gasket', 'EPDM Sash Glazing Gasket', 'Consumable', 'None', 'm', 15.00, 0.000, true)
on conflict (material_code) do update set
  description = excluded.description,
  category = excluded.category,
  finish_type = excluded.finish_type,
  billing_unit = excluded.billing_unit,
  unit_price = excluded.unit_price,
  waste_allowance = excluded.waste_allowance,
  is_active = excluded.is_active,
  updated_at = now();

-- --------------------------------------------------------------------------
-- 3. Alter public.product_components (ERD-E6)
-- Add physical raw material binding, 1D/2D dimension drivers, span ratios, removable flags, and GLB asset URLs.
-- --------------------------------------------------------------------------

alter table public.product_components
  add column if not exists raw_material_id uuid references public.raw_materials(id) on delete set null,
  add column if not exists dimension_binding varchar(20) not null default 'FIXED',
  add column if not exists span_ratio numeric(5, 4) not null default 1.0000,
  add column if not exists is_removable boolean not null default false,
  add column if not exists toggle_property_key varchar(50),
  add column if not exists presentation_category varchar(50) not null default 'Framing',
  add column if not exists glb_file_url text;

-- Add constraint checks
alter table public.product_components
  drop constraint if exists product_components_dimension_binding_check,
  add constraint product_components_dimension_binding_check
    check (dimension_binding in ('WIDTH', 'HEIGHT', 'AREA', 'FIXED'));

alter table public.product_components
  drop constraint if exists product_components_presentation_category_check,
  add constraint product_components_presentation_category_check
    check (presentation_category in ('Framing', 'Glazing', 'Hardware', 'Consumable', 'Other'));

alter table public.product_components
  drop constraint if exists product_components_span_ratio_check,
  add constraint product_components_span_ratio_check
    check (span_ratio >= 0.0000 and span_ratio <= 10.0000);

create index if not exists product_components_raw_material_idx
  on public.product_components(raw_material_id);

-- --------------------------------------------------------------------------
-- 4. Alter public.quotation_items (ERD-E14)
-- Group line items by major BOM categories and store immutable frozen calculation details & waiver acknowledgements.
-- --------------------------------------------------------------------------

alter table public.quotation_items
  add column if not exists item_group_name varchar(100) not null default 'Aluminum Framing',
  add column if not exists structural_waiver boolean not null default false;

alter table public.quotation_items
  drop constraint if exists quotation_items_group_name_check,
  add constraint quotation_items_group_name_check
    check (item_group_name in ('Aluminum Framing', 'Glass Infill', 'Hardware & Accessories', 'Labor & Installation', 'Miscellaneous'));

create index if not exists quotation_items_group_idx
  on public.quotation_items(quotation_id, item_group_name);

-- --------------------------------------------------------------------------
-- 5. Helper Function: Validate Structural Rule Action Payload
-- Ensures action payloads conform to the Hybrid Guardrail mutation contract.
-- --------------------------------------------------------------------------

create or replace function public.validate_structural_rule_payload(p_action jsonb)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' then
    return false;
  end if;

  -- Optional schema properties verification if present
  if p_action ? 'enforce_panel_count' and jsonb_typeof(p_action->'enforce_panel_count') <> 'number' then
    return false;
  end if;

  if p_action ? 'mutations' and jsonb_typeof(p_action->'mutations') <> 'array' then
    return false;
  end if;

  return true;
end;
$$;

commit;
