-- Migration: 016_product_addon_catalog_and_inheritance.sql
-- Function: Support modular add-on products (screens and grills) and host product inheritance bindings
-- Upstream Traceability: ERD-E3 (products), PRD-F1, PRD-F14, SDD-C1, SDD-C9

-- 1. Extend public.products with add-on classification columns
alter table public.products
  add column if not exists is_addon boolean not null default false,
  add column if not exists addon_type varchar(20);

-- Add check constraint for addon_type
alter table public.products
  drop constraint if exists products_addon_type_check;

alter table public.products
  add constraint products_addon_type_check
  check (
    (is_addon = false and addon_type is null) or
    (is_addon = true and addon_type in ('screen', 'grill'))
  );

-- Indexes for catalog query performance
create index if not exists idx_products_is_addon on public.products(is_addon);
create index if not exists idx_products_addon_type on public.products(addon_type) where is_addon = true;

-- 2. Create junction table public.product_compatible_addons
create table if not exists public.product_compatible_addons (
  id uuid primary key default gen_random_uuid(),
  parent_product_id uuid not null references public.products(product_id) on delete cascade,
  addon_product_id uuid not null references public.products(product_id) on delete restrict,
  addon_type varchar(20) not null check (addon_type in ('screen', 'grill')),
  is_default_enabled boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_parent_addon_type unique (parent_product_id, addon_type),
  constraint uq_parent_addon_product unique (parent_product_id, addon_product_id)
);

-- Indexes for fast lookup
create index if not exists idx_pca_parent_product on public.product_compatible_addons(parent_product_id);
create index if not exists idx_pca_addon_product on public.product_compatible_addons(addon_product_id);

-- 3. Row-Level Security (RLS) Policies
alter table public.product_compatible_addons enable row level security;

-- Public read for active products
drop policy if exists pca_public_read on public.product_compatible_addons;
create policy pca_public_read
  on public.product_compatible_addons for select
  using (
    exists (
      select 1 from public.products p
      where p.product_id = product_compatible_addons.parent_product_id
        and (p.status = 'Active' or public.is_admin())
    )
  );

-- Admin mutation policies
drop policy if exists pca_admin_insert on public.product_compatible_addons;
create policy pca_admin_insert
  on public.product_compatible_addons for insert to authenticated
  with check (public.has_admin_permission('manage_products') or public.is_admin());

drop policy if exists pca_admin_update on public.product_compatible_addons;
create policy pca_admin_update
  on public.product_compatible_addons for update to authenticated
  using (public.has_admin_permission('manage_products') or public.is_admin())
  with check (public.has_admin_permission('manage_products') or public.is_admin());

drop policy if exists pca_admin_delete on public.product_compatible_addons;
create policy pca_admin_delete
  on public.product_compatible_addons for delete to authenticated
  using (public.has_admin_permission('manage_products') or public.is_admin());

-- 4. Permissions
grant select on table public.product_compatible_addons to authenticated, anon;
grant all on table public.product_compatible_addons to authenticated, service_role;
