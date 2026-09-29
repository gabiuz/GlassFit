-- ============================================================================
-- 003_admin_auth.sql
-- Adds permission-level authorization for Admin roles.
--
-- Changes:
-- 1. has_admin_permission() — fine-grained permission helper used by RLS and
--    server-side authorization helpers. Owner bypasses all permission checks.
-- 2. Updated RLS write policies for product-related and booking-related tables
--    to enforce per-permission authorization instead of bare is_admin().
-- 3. Seeds admin_roles with Owner, Manager, Staff if not already present.
--
-- Run in Supabase SQL Editor after 001_backend_core.sql and 002_auth_user_trigger.sql.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. has_admin_permission()
-- Returns true when the given user is an active Admin whose role either:
--   a) is named 'Owner' (superuser — all permissions implicitly granted), OR
--   b) has the given permission key set to true in admin_roles.permissions.
-- --------------------------------------------------------------------------

create or replace function public.has_admin_permission(
  permission_key text,
  user_id        uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.admin_roles r on r.role_id = p.admin_role_id
    where p.profile_id = user_id
      and p.account_type = 'Admin'
      and p.status = 'Active'
      and r.status = 'Active'
      and (
        lower(r.role_name) = 'owner'
        or coalesce((r.permissions ->> permission_key)::boolean, false)
      )
  );
$$;

revoke all  on function public.has_admin_permission(text, uuid) from public;
grant execute on function public.has_admin_permission(text, uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 2. Seed admin_roles (Owner, Manager, Staff) if not present.
-- The manager role is seeded but not exposed in the v1 UI.
-- --------------------------------------------------------------------------

insert into public.admin_roles (role_name, description, permissions, status)
values
  (
    'Owner',
    'Full access to all Admin features.',
    '{
      "manage_products": true,
      "manage_pricing": true,
      "manage_roles": true,
      "manage_bookings": true
    }'::jsonb,
    'Active'
  ),
  (
    'Manager',
    'Product and booking management, but no role management.',
    '{
      "manage_products": true,
      "manage_pricing": true,
      "manage_roles": false,
      "manage_bookings": true
    }'::jsonb,
    'Active'
  ),
  (
    'Staff',
    'Operational booking management only.',
    '{
      "manage_products": false,
      "manage_pricing": false,
      "manage_roles": false,
      "manage_bookings": true
    }'::jsonb,
    'Active'
  )
on conflict (role_name) do nothing;

-- --------------------------------------------------------------------------
-- 3. Update RLS write policies to enforce per-permission checks.
--
-- NOTE: The exact policy names match what 001_backend_core.sql created.
-- We drop and recreate write policies to swap is_admin() for
-- has_admin_permission(). Read policies remain unchanged.
-- --------------------------------------------------------------------------

-- products — write requires manage_products
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;

create policy products_admin_insert on public.products
  for insert to authenticated
  with check (public.has_admin_permission('manage_products'));

create policy products_admin_update on public.products
  for update to authenticated
  using  (public.has_admin_permission('manage_products'))
  with check (public.has_admin_permission('manage_products'));

create policy products_admin_delete on public.products
  for delete to authenticated
  using (public.has_admin_permission('manage_products'));

-- product_templates — write requires manage_products
drop policy if exists product_templates_admin_insert on public.product_templates;
drop policy if exists product_templates_admin_update on public.product_templates;
drop policy if exists product_templates_admin_delete on public.product_templates;

create policy product_templates_admin_insert on public.product_templates
  for insert to authenticated
  with check (public.has_admin_permission('manage_products'));

create policy product_templates_admin_update on public.product_templates
  for update to authenticated
  using  (public.has_admin_permission('manage_products'))
  with check (public.has_admin_permission('manage_products'));

create policy product_templates_admin_delete on public.product_templates
  for delete to authenticated
  using (public.has_admin_permission('manage_products'));

-- product_parameters — write requires manage_products
drop policy if exists product_parameters_admin_insert on public.product_parameters;
drop policy if exists product_parameters_admin_update on public.product_parameters;
drop policy if exists product_parameters_admin_delete on public.product_parameters;

create policy product_parameters_admin_insert on public.product_parameters
  for insert to authenticated
  with check (public.has_admin_permission('manage_products'));

create policy product_parameters_admin_update on public.product_parameters
  for update to authenticated
  using  (public.has_admin_permission('manage_products'))
  with check (public.has_admin_permission('manage_products'));

create policy product_parameters_admin_delete on public.product_parameters
  for delete to authenticated
  using (public.has_admin_permission('manage_products'));

-- product_components — write requires manage_products
drop policy if exists product_components_admin_insert on public.product_components;
drop policy if exists product_components_admin_update on public.product_components;
drop policy if exists product_components_admin_delete on public.product_components;

create policy product_components_admin_insert on public.product_components
  for insert to authenticated
  with check (public.has_admin_permission('manage_products'));

create policy product_components_admin_update on public.product_components
  for update to authenticated
  using  (public.has_admin_permission('manage_products'))
  with check (public.has_admin_permission('manage_products'));

create policy product_components_admin_delete on public.product_components
  for delete to authenticated
  using (public.has_admin_permission('manage_products'));

-- structural_rules — write requires manage_products
drop policy if exists structural_rules_admin_insert on public.structural_rules;
drop policy if exists structural_rules_admin_update on public.structural_rules;
drop policy if exists structural_rules_admin_delete on public.structural_rules;

create policy structural_rules_admin_insert on public.structural_rules
  for insert to authenticated
  with check (public.has_admin_permission('manage_products'));

create policy structural_rules_admin_update on public.structural_rules
  for update to authenticated
  using  (public.has_admin_permission('manage_products'))
  with check (public.has_admin_permission('manage_products'));

create policy structural_rules_admin_delete on public.structural_rules
  for delete to authenticated
  using (public.has_admin_permission('manage_products'));

-- --------------------------------------------------------------------------
-- Booking request write policy — manage_bookings
-- (booking_requests table must exist from 001_backend_core.sql)
-- --------------------------------------------------------------------------

drop policy if exists booking_requests_admin_update on public.booking_requests;

create policy booking_requests_admin_update on public.booking_requests
  for update to authenticated
  using  (public.has_admin_permission('manage_bookings'))
  with check (public.has_admin_permission('manage_bookings'));

-- --------------------------------------------------------------------------
-- profiles — Owner can manage other Admin profiles (suspend/reactivate).
-- Admins can read all profiles for the Staff list UI.
-- --------------------------------------------------------------------------

drop policy if exists profiles_admin_manage on public.profiles;

create policy profiles_admin_manage on public.profiles
  for update to authenticated
  using  (public.has_admin_permission('manage_roles'))
  with check (public.has_admin_permission('manage_roles'));

commit;
