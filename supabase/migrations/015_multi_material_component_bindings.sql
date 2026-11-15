-- Migration: 015_multi_material_component_bindings.sql
-- Function: Support multi-material candidate bindings per product component with explicit default selection
-- Upstream Traceability: ERD-E6 (product_components), ERD-E17 (raw_materials), PRD-F14, SDD-C9, IMP-MS64

-- 1. Create junction table public.product_component_materials
create table if not exists public.product_component_materials (
  id uuid primary key default gen_random_uuid(),
  product_component_id uuid not null references public.product_components(component_id) on delete cascade,
  raw_material_id uuid not null references public.raw_materials(id) on delete restrict,
  is_default boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_component_material unique (product_component_id, raw_material_id)
);

-- Indexes for performance
create index if not exists idx_pcm_component_id on public.product_component_materials(product_component_id);
create index if not exists idx_pcm_material_id on public.product_component_materials(raw_material_id);
create index if not exists idx_pcm_default on public.product_component_materials(product_component_id) where is_default = true;

-- 2. Ensure at most one default per component when bindings exist
create unique index if not exists uq_component_single_default 
  on public.product_component_materials(product_component_id) 
  where is_default = true;

-- 3. Row-Level Security (RLS) Policies
alter table public.product_component_materials enable row level security;

drop policy if exists pcm_public_read on public.product_component_materials;
create policy pcm_public_read
  on public.product_component_materials for select
  using (
    exists (
      select 1 from public.product_components pc
      where pc.component_id = product_component_materials.product_component_id
        and (pc.status = 'Active' or public.is_admin())
    )
  );

drop policy if exists pcm_admin_insert on public.product_component_materials;
create policy pcm_admin_insert
  on public.product_component_materials for insert to authenticated
  with check (public.has_admin_permission('manage_products') or public.is_admin());

drop policy if exists pcm_admin_update on public.product_component_materials;
create policy pcm_admin_update
  on public.product_component_materials for update to authenticated
  using (public.has_admin_permission('manage_products') or public.is_admin())
  with check (public.has_admin_permission('manage_products') or public.is_admin());

drop policy if exists pcm_admin_delete on public.product_component_materials;
create policy pcm_admin_delete
  on public.product_component_materials for delete to authenticated
  using (public.has_admin_permission('manage_products') or public.is_admin());

-- 4. Trigger Function: Sync product_components.raw_material_id with default material
create or replace function public.sync_component_default_material()
returns trigger
language plpgsql
as $$
declare
  target_component_id uuid;
  default_mat_id uuid;
begin
  if (tg_op = 'DELETE') then
    target_component_id := old.product_component_id;
  else
    target_component_id := new.product_component_id;
  end if;

  select raw_material_id into default_mat_id
  from public.product_component_materials
  where product_component_id = target_component_id
    and is_default = true
  limit 1;

  update public.product_components
  set raw_material_id = default_mat_id,
      updated_at = now()
  where component_id = target_component_id;

  return null;
end;
$$;

drop trigger if exists trg_sync_component_default_material on public.product_component_materials;
create trigger trg_sync_component_default_material
  after insert or update of is_default, raw_material_id or delete on public.product_component_materials
  for each row execute function public.sync_component_default_material();

-- 5. Seed backfill: Populate product_component_materials from existing product_components.raw_material_id
insert into public.product_component_materials (product_component_id, raw_material_id, is_default, display_order)
select component_id, raw_material_id, true, 0
from public.product_components
where raw_material_id is not null
on conflict (product_component_id, raw_material_id) do update set
  is_default = true;

-- 6. Permissions
grant select on table public.product_component_materials to authenticated, anon;
grant all on table public.product_component_materials to authenticated, service_role;
