-- ============================================================================
-- GlassFit database schema
-- Target: Supabase PostgreSQL
-- Scope: 16-table lean schema for fixed and structural products, final-image
--        snapshots, estimated quotations, PDF references, and booking handoff.
--
-- Notes:
-- 1. Cloudflare R2 files are not created by this script. The database stores
--    only R2 object keys.
-- 2. Temporary customer uploads, masks, occlusion data, overlay transforms,
--    and realism settings are intentionally not persisted.
-- 3. This migration assumes Supabase Auth already provides auth.users.
-- 4. profiles stores first_name and last_name separately; full_name is generated automatically.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- Utility functions
-- --------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_json_object(value jsonb)
returns boolean
language sql
immutable
as $$
  select value is not null and jsonb_typeof(value) = 'object';
$$;

-- --------------------------------------------------------------------------
-- 1. admin_roles
-- --------------------------------------------------------------------------

create table public.admin_roles (
  role_id uuid primary key default gen_random_uuid(),
  role_name varchar(50) not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admin_roles_role_name_unique unique (role_name),
  constraint admin_roles_permissions_object check (public.is_json_object(permissions)),
  constraint admin_roles_status_check check (status in ('Active', 'Inactive'))
);

-- --------------------------------------------------------------------------
-- 2. profiles
-- --------------------------------------------------------------------------

create table public.profiles (
  profile_id uuid primary key,
  admin_role_id uuid,
  first_name varchar(50) not null,
  last_name varchar(50) not null,
  full_name varchar(101)
    generated always as (
      trim(first_name || ' ' || last_name)
    ) stored,
  email varchar(254) not null,
  contact_number varchar(20),
  auth_provider varchar(30) not null,
  account_type varchar(20) not null default 'Customer',
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_auth_user_fk
    foreign key (profile_id) references auth.users(id) on delete cascade,
  constraint profiles_admin_role_fk
    foreign key (admin_role_id) references public.admin_roles(role_id) on delete set null,
  constraint profiles_email_unique unique (email),
  constraint profiles_first_name_not_blank
    check (length(trim(first_name)) > 0),
  constraint profiles_last_name_not_blank
    check (length(trim(last_name)) > 0),
  constraint profiles_auth_provider_check
    check (auth_provider in ('Email', 'Google', 'Other')),
  constraint profiles_account_type_check
    check (account_type in ('Customer', 'Admin')),
  constraint profiles_status_check
    check (status in ('Active', 'Inactive', 'Suspended')),
  constraint profiles_admin_role_consistency_check
    check (
      (account_type = 'Admin' and admin_role_id is not null)
      or
      (account_type = 'Customer' and admin_role_id is null)
    )
);

-- Helper used by RLS policies. SECURITY DEFINER avoids recursive profile RLS.
create or replace function public.is_admin(user_id uuid default auth.uid())
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
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Auto-create profile on new auth.users row
-- Fires for both email/password sign-ups and OAuth (Google) sign-ins.
-- Uses SECURITY DEFINER so it can bypass RLS when writing the first row.
-- --------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name  varchar(50);
  v_last_name   varchar(50);
  v_phone       varchar(20);
  v_provider    varchar(30);
  v_full_name   text;
  v_name_parts  text[];
begin
  -- Determine auth provider
  -- new.raw_app_meta_data->>'provider' contains 'email' or 'google' etc.
  v_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');

  if v_provider = 'google' then
    -- Google OAuth: names come from raw_user_meta_data
    v_full_name  := coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    );
    v_name_parts := string_to_array(trim(v_full_name), ' ');

    -- First name = first token; last name = everything else (or repeat first if only one token)
    v_first_name := coalesce(nullif(trim(v_name_parts[1]), ''), 'User');
    v_last_name  := coalesce(
      nullif(trim(array_to_string(v_name_parts[2:array_length(v_name_parts,1)], ' ')), ''),
      v_first_name
    );
    v_phone      := null;
    v_provider   := 'Google';
  else
    -- Email/password: names come from options.data passed in signUp()
    v_first_name := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), 'User');
    v_last_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), v_first_name);
    v_phone      := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
    v_provider   := 'Email';
  end if;

  -- Enforce varchar(50) limits
  v_first_name := left(v_first_name, 50);
  v_last_name  := left(v_last_name, 50);

  insert into public.profiles (
    profile_id,
    first_name,
    last_name,
    email,
    contact_number,
    auth_provider,
    account_type,
    status
  ) values (
    new.id,
    v_first_name,
    v_last_name,
    coalesce(new.email, new.raw_user_meta_data->>'email', ''),
    v_phone,
    v_provider,
    'Customer',
    'Active'
  )
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

-- Trigger fires after a new row is committed to auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- 3. products
-- --------------------------------------------------------------------------

create table public.products (
  product_id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  updated_by uuid,
  product_name varchar(100) not null,
  product_type varchar(50) not null,
  description text,
  base_price numeric(12,2) not null default 0.00,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_created_by_fk
    foreign key (created_by) references public.profiles(profile_id) on delete restrict,
  constraint products_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint products_name_unique unique (product_name),
  constraint products_type_check
    check (product_type in ('Window', 'Door', 'Partition', 'Cabinet', 'Enclosure', 'Railing', 'Other')),
  constraint products_base_price_nonnegative check (base_price >= 0),
  constraint products_status_check check (status in ('Active', 'Inactive'))
);

-- --------------------------------------------------------------------------
-- 4. product_templates
-- One product has exactly zero or one template while being drafted, and one
-- template when it is configurable. Fixed products use model_strategy=Fixed.
-- --------------------------------------------------------------------------

create table public.product_templates (
  template_id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  created_by uuid not null,
  updated_by uuid,
  template_name varchar(100) not null,
  model_strategy varchar(20) not null,
  measurement_unit varchar(10) not null default 'mm',
  base_configuration jsonb,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_templates_product_fk
    foreign key (product_id) references public.products(product_id) on delete cascade,
  constraint product_templates_created_by_fk
    foreign key (created_by) references public.profiles(profile_id) on delete restrict,
  constraint product_templates_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint product_templates_one_per_product unique (product_id),
  constraint product_templates_strategy_check check (model_strategy in ('Fixed', 'Parametric')),
  constraint product_templates_measurement_unit_check check (measurement_unit in ('mm', 'cm', 'm')),
  constraint product_templates_base_configuration_object
    check (base_configuration is null or public.is_json_object(base_configuration)),
  constraint product_templates_status_check check (status in ('Active', 'Inactive'))
);

-- --------------------------------------------------------------------------
-- 5. product_parameters
-- --------------------------------------------------------------------------

create table public.product_parameters (
  parameter_id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  created_by uuid not null,
  updated_by uuid,
  parameter_key varchar(50) not null,
  parameter_name varchar(100) not null,
  parameter_type varchar(20) not null,
  minimum_value numeric(12,4),
  maximum_value numeric(12,4),
  default_value jsonb not null,
  step_value numeric(12,4),
  unit varchar(20),
  affects_structure boolean not null default true,
  display_order integer not null default 1,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_parameters_template_fk
    foreign key (template_id) references public.product_templates(template_id) on delete cascade,
  constraint product_parameters_created_by_fk
    foreign key (created_by) references public.profiles(profile_id) on delete restrict,
  constraint product_parameters_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint product_parameters_template_key_unique unique (template_id, parameter_key),
  constraint product_parameters_type_check
    check (parameter_type in ('Number', 'Integer', 'Boolean', 'Select')),
  constraint product_parameters_range_check
    check (minimum_value is null or maximum_value is null or minimum_value <= maximum_value),
  constraint product_parameters_step_positive check (step_value is null or step_value > 0),
  constraint product_parameters_display_order_positive check (display_order >= 1),
  constraint product_parameters_status_check check (status in ('Active', 'Inactive'))
);

-- --------------------------------------------------------------------------
-- 6. product_components
-- --------------------------------------------------------------------------

create table public.product_components (
  component_id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  created_by uuid not null,
  updated_by uuid,
  component_key varchar(50) not null,
  component_name varchar(100) not null,
  component_type varchar(30) not null,
  base_quantity numeric(12,4) not null default 1.0000,
  pricing_method varchar(30) not null default 'Included',
  unit_price numeric(12,4) not null default 0.0000,
  pricing_unit varchar(20),
  component_data jsonb,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_components_template_fk
    foreign key (template_id) references public.product_templates(template_id) on delete cascade,
  constraint product_components_created_by_fk
    foreign key (created_by) references public.profiles(profile_id) on delete restrict,
  constraint product_components_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint product_components_template_key_unique unique (template_id, component_key),
  constraint product_components_type_check
    check (component_type in ('Procedural', 'Model', 'Glass', 'Frame', 'Panel', 'Hardware', 'Other')),
  constraint product_components_quantity_nonnegative check (base_quantity >= 0),
  constraint product_components_pricing_method_check
    check (pricing_method in ('Included', 'Per Piece', 'Per Length', 'Per Area', 'Fixed', 'Other')),
  constraint product_components_unit_price_nonnegative check (unit_price >= 0),
  constraint product_components_data_object
    check (component_data is null or public.is_json_object(component_data)),
  constraint product_components_status_check check (status in ('Active', 'Inactive'))
);

-- --------------------------------------------------------------------------
-- 7. structural_rules
-- --------------------------------------------------------------------------

create table public.structural_rules (
  rule_id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  created_by uuid not null,
  updated_by uuid,
  rule_name varchar(120) not null,
  priority integer not null default 1,
  condition_data jsonb not null,
  action_data jsonb not null,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint structural_rules_template_fk
    foreign key (template_id) references public.product_templates(template_id) on delete cascade,
  constraint structural_rules_created_by_fk
    foreign key (created_by) references public.profiles(profile_id) on delete restrict,
  constraint structural_rules_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint structural_rules_priority_positive check (priority >= 1),
  constraint structural_rules_condition_object check (public.is_json_object(condition_data)),
  constraint structural_rules_action_object check (public.is_json_object(action_data)),
  constraint structural_rules_status_check check (status in ('Active', 'Inactive')),
  constraint structural_rules_template_priority_name_unique unique (template_id, priority, rule_name)
);

-- --------------------------------------------------------------------------
-- 8. product_assets
-- --------------------------------------------------------------------------

create table public.product_assets (
  asset_id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  template_id uuid,
  component_id uuid,
  created_by uuid not null,
  updated_by uuid,
  asset_type varchar(40) not null,
  r2_object_key text not null,
  file_name varchar(180) not null,
  mime_type varchar(100) not null,
  byte_size bigint,
  display_order integer not null default 1,
  is_primary boolean not null default false,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_assets_product_fk
    foreign key (product_id) references public.products(product_id) on delete cascade,
  constraint product_assets_template_fk
    foreign key (template_id) references public.product_templates(template_id) on delete cascade,
  constraint product_assets_component_fk
    foreign key (component_id) references public.product_components(component_id) on delete cascade,
  constraint product_assets_created_by_fk
    foreign key (created_by) references public.profiles(profile_id) on delete restrict,
  constraint product_assets_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint product_assets_r2_key_unique unique (r2_object_key),
  constraint product_assets_type_check check (
    asset_type in (
      'Thumbnail', 'Catalog Image', 'Catalog 3D Preview', 'Whole Model',
      'Component Model', 'Texture', 'Material Map', 'Variation Preview', 'Other'
    )
  ),
  constraint product_assets_byte_size_nonnegative check (byte_size is null or byte_size >= 0),
  constraint product_assets_display_order_positive check (display_order >= 1),
  constraint product_assets_status_check check (status in ('Active', 'Inactive')),
  constraint product_assets_component_requires_template check (component_id is null or template_id is not null)
);

-- Only one primary asset of a given type per product.
create unique index product_assets_one_primary_per_type_idx
  on public.product_assets(product_id, asset_type)
  where is_primary = true and status = 'Active';

-- --------------------------------------------------------------------------
-- 9. product_variations
-- --------------------------------------------------------------------------

create table public.product_variations (
  variation_id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  preview_asset_id uuid,
  created_by uuid not null,
  updated_by uuid,
  variation_type varchar(50) not null,
  variation_name varchar(100) not null,
  additional_price numeric(12,2) not null default 0.00,
  render_data jsonb,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_variations_product_fk
    foreign key (product_id) references public.products(product_id) on delete cascade,
  constraint product_variations_preview_asset_fk
    foreign key (preview_asset_id) references public.product_assets(asset_id) on delete set null,
  constraint product_variations_created_by_fk
    foreign key (created_by) references public.profiles(profile_id) on delete restrict,
  constraint product_variations_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint product_variations_product_type_name_unique
    unique (product_id, variation_type, variation_name),
  constraint product_variations_type_check
    check (variation_type in ('Color', 'Material', 'Finish', 'Glass Type', 'Frame Type', 'Design', 'Other')),
  constraint product_variations_price_nonnegative check (additional_price >= 0),
  constraint product_variations_render_data_object
    check (render_data is null or public.is_json_object(render_data)),
  constraint product_variations_status_check check (status in ('Active', 'Inactive'))
);

-- --------------------------------------------------------------------------
-- 10. visualization_snapshots
-- Stores only the permanent final composed image.
-- --------------------------------------------------------------------------

create table public.visualization_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  final_image_r2_key text not null,
  created_at timestamptz not null default now(),

  constraint visualization_snapshots_profile_fk
    foreign key (profile_id) references public.profiles(profile_id) on delete set null,
  constraint visualization_snapshots_final_image_unique unique (final_image_r2_key)
);

-- --------------------------------------------------------------------------
-- 11. product_configurations
-- One row represents one placed product instance in the final image.
-- --------------------------------------------------------------------------

create table public.product_configurations (
  configuration_id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  product_id uuid not null,
  template_id uuid not null,
  visual_parameter_values jsonb not null default '{}'::jsonb,
  quotation_width numeric(12,4),
  quotation_height numeric(12,4),
  quotation_depth numeric(12,4),
  quotation_measurement_unit varchar(10),
  measurement_source varchar(20) not null default 'Estimated',
  measurement_confirmed boolean not null default false,
  quantity integer not null default 1,
  estimated_configuration_price numeric(12,2) not null default 0.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_configurations_snapshot_fk
    foreign key (snapshot_id) references public.visualization_snapshots(snapshot_id) on delete cascade,
  constraint product_configurations_product_fk
    foreign key (product_id) references public.products(product_id) on delete restrict,
  constraint product_configurations_template_fk
    foreign key (template_id) references public.product_templates(template_id) on delete restrict,
  constraint product_configurations_visual_values_object
    check (public.is_json_object(visual_parameter_values)),
  constraint product_configurations_width_nonnegative check (quotation_width is null or quotation_width >= 0),
  constraint product_configurations_height_nonnegative check (quotation_height is null or quotation_height >= 0),
  constraint product_configurations_depth_nonnegative check (quotation_depth is null or quotation_depth >= 0),
  constraint product_configurations_measurement_unit_check
    check (quotation_measurement_unit is null or quotation_measurement_unit in ('mm', 'cm', 'm')),
  constraint product_configurations_measurement_source_check
    check (measurement_source in ('Estimated', 'Manual')),
  constraint product_configurations_quantity_positive check (quantity >= 1),
  constraint product_configurations_price_nonnegative check (estimated_configuration_price >= 0),
  constraint product_configurations_measurement_unit_required check (
    (quotation_width is null and quotation_height is null and quotation_depth is null)
    or quotation_measurement_unit is not null
  )
);

-- --------------------------------------------------------------------------
-- 12. configuration_variations
-- --------------------------------------------------------------------------

create table public.configuration_variations (
  configuration_id uuid not null,
  variation_id uuid not null,
  additional_price_snapshot numeric(12,2) not null default 0.00,
  created_at timestamptz not null default now(),

  constraint configuration_variations_pk primary key (configuration_id, variation_id),
  constraint configuration_variations_configuration_fk
    foreign key (configuration_id) references public.product_configurations(configuration_id) on delete cascade,
  constraint configuration_variations_variation_fk
    foreign key (variation_id) references public.product_variations(variation_id) on delete restrict,
  constraint configuration_variations_price_nonnegative check (additional_price_snapshot >= 0)
);

-- --------------------------------------------------------------------------
-- 13. quotation_estimates
-- --------------------------------------------------------------------------

create table public.quotation_estimates (
  quotation_id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  profile_id uuid not null,
  quotation_number varchar(50) not null,
  total_estimated_amount numeric(12,2) not null,
  currency char(3) not null default 'PHP',
  quotation_note text,
  pdf_r2_object_key text,
  status varchar(20) not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint quotation_estimates_snapshot_fk
    foreign key (snapshot_id) references public.visualization_snapshots(snapshot_id) on delete restrict,
  constraint quotation_estimates_profile_fk
    foreign key (profile_id) references public.profiles(profile_id) on delete restrict,
  constraint quotation_estimates_snapshot_unique unique (snapshot_id),
  constraint quotation_estimates_number_unique unique (quotation_number),
  constraint quotation_estimates_pdf_key_unique unique (pdf_r2_object_key),
  constraint quotation_estimates_total_nonnegative check (total_estimated_amount >= 0),
  constraint quotation_estimates_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint quotation_estimates_status_check
    check (status in ('Draft', 'Generated', 'Expired', 'Cancelled'))
);

-- --------------------------------------------------------------------------
-- 14. quotation_items
-- --------------------------------------------------------------------------

create table public.quotation_items (
  quotation_item_id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null,
  configuration_id uuid,
  item_name varchar(150) not null,
  quantity numeric(12,4) not null default 1.0000,
  unit varchar(20) not null default 'piece',
  unit_price numeric(12,4) not null,
  estimated_subtotal numeric(12,2) not null,
  pricing_details jsonb,
  item_note text,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),

  constraint quotation_items_quotation_fk
    foreign key (quotation_id) references public.quotation_estimates(quotation_id) on delete cascade,
  constraint quotation_items_configuration_fk
    foreign key (configuration_id) references public.product_configurations(configuration_id) on delete set null,
  constraint quotation_items_quantity_nonnegative check (quantity >= 0),
  constraint quotation_items_unit_price_nonnegative check (unit_price >= 0),
  constraint quotation_items_subtotal_nonnegative check (estimated_subtotal >= 0),
  constraint quotation_items_pricing_details_object
    check (pricing_details is null or public.is_json_object(pricing_details)),
  constraint quotation_items_display_order_positive check (display_order >= 1)
);

-- --------------------------------------------------------------------------
-- 15. signed_booking_links
-- --------------------------------------------------------------------------

create table public.signed_booking_links (
  link_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  quotation_id uuid not null,
  snapshot_id uuid not null,
  token_hash char(64) not null,
  expires_at timestamptz not null,
  status varchar(20) not null default 'Active',
  created_at timestamptz not null default now(),

  constraint signed_booking_links_profile_fk
    foreign key (profile_id) references public.profiles(profile_id) on delete restrict,
  constraint signed_booking_links_quotation_fk
    foreign key (quotation_id) references public.quotation_estimates(quotation_id) on delete restrict,
  constraint signed_booking_links_snapshot_fk
    foreign key (snapshot_id) references public.visualization_snapshots(snapshot_id) on delete restrict,
  constraint signed_booking_links_quotation_unique unique (quotation_id),
  constraint signed_booking_links_token_hash_unique unique (token_hash),
  constraint signed_booking_links_token_hash_format check (token_hash ~ '^[0-9a-fA-F]{64}$'),
  constraint signed_booking_links_status_check
    check (status in ('Active', 'Expired', 'Revoked', 'Used')),
  constraint signed_booking_links_expiration_after_creation check (expires_at > created_at)
);

-- --------------------------------------------------------------------------
-- 16. booking_requests
-- --------------------------------------------------------------------------

create table public.booking_requests (
  booking_request_id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  link_id uuid not null,
  selected_platform varchar(20) not null,
  status varchar(20) not null default 'Pending',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint booking_requests_profile_fk
    foreign key (profile_id) references public.profiles(profile_id) on delete restrict,
  constraint booking_requests_link_fk
    foreign key (link_id) references public.signed_booking_links(link_id) on delete restrict,
  constraint booking_requests_updated_by_fk
    foreign key (updated_by) references public.profiles(profile_id) on delete set null,
  constraint booking_requests_one_per_link unique (link_id),
  constraint booking_requests_platform_check check (selected_platform in ('Messenger', 'Viber')),
  constraint booking_requests_status_check check (status in ('Pending', 'Ongoing', 'Done', 'Cancelled'))
);

-- --------------------------------------------------------------------------
-- Cross-table integrity triggers
-- These checks enforce relationships that ordinary foreign keys cannot express.
-- --------------------------------------------------------------------------

create or replace function public.assert_active_admin(profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if profile is null or not public.is_admin(profile) then
    raise exception 'Profile % must be an active administrator', profile
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.assert_active_admin(uuid) from public;

create or replace function public.enforce_admin_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_active_admin(new.created_by);
  end if;

  if new.updated_by is not null then
    perform public.assert_active_admin(new.updated_by);
  end if;

  return new;
end;
$$;

create trigger products_admin_audit_check
before insert or update on public.products
for each row execute function public.enforce_admin_audit_fields();

create trigger product_templates_admin_audit_check
before insert or update on public.product_templates
for each row execute function public.enforce_admin_audit_fields();

create trigger product_parameters_admin_audit_check
before insert or update on public.product_parameters
for each row execute function public.enforce_admin_audit_fields();

create trigger product_components_admin_audit_check
before insert or update on public.product_components
for each row execute function public.enforce_admin_audit_fields();

create trigger structural_rules_admin_audit_check
before insert or update on public.structural_rules
for each row execute function public.enforce_admin_audit_fields();

create trigger product_assets_admin_audit_check
before insert or update on public.product_assets
for each row execute function public.enforce_admin_audit_fields();

create trigger product_variations_admin_audit_check
before insert or update on public.product_variations
for each row execute function public.enforce_admin_audit_fields();

create or replace function public.validate_product_asset_links()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_product uuid;
  linked_template uuid;
begin
  if new.template_id is not null then
    select product_id into linked_product
    from public.product_templates
    where template_id = new.template_id;

    if linked_product is distinct from new.product_id then
      raise exception 'Asset template does not belong to asset product'
        using errcode = '23514';
    end if;
  end if;

  if new.component_id is not null then
    select template_id into linked_template
    from public.product_components
    where component_id = new.component_id;

    if linked_template is distinct from new.template_id then
      raise exception 'Asset component does not belong to asset template'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger product_assets_link_check
before insert or update of product_id, template_id, component_id
on public.product_assets
for each row execute function public.validate_product_asset_links();

create or replace function public.validate_variation_preview_asset()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  asset_product uuid;
begin
  if new.preview_asset_id is not null then
    select product_id into asset_product
    from public.product_assets
    where asset_id = new.preview_asset_id;

    if asset_product is distinct from new.product_id then
      raise exception 'Variation preview asset does not belong to the same product'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger product_variations_preview_check
before insert or update of product_id, preview_asset_id
on public.product_variations
for each row execute function public.validate_variation_preview_asset();

create or replace function public.validate_configuration_template()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  template_product uuid;
begin
  select product_id into template_product
  from public.product_templates
  where template_id = new.template_id;

  if template_product is distinct from new.product_id then
    raise exception 'Configuration template does not belong to selected product'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger product_configurations_template_check
before insert or update of product_id, template_id
on public.product_configurations
for each row execute function public.validate_configuration_template();

create or replace function public.validate_configuration_variation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  configuration_product uuid;
  variation_product uuid;
begin
  select product_id into configuration_product
  from public.product_configurations
  where configuration_id = new.configuration_id;

  select product_id into variation_product
  from public.product_variations
  where variation_id = new.variation_id;

  if configuration_product is distinct from variation_product then
    raise exception 'Selected variation does not belong to configured product'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger configuration_variations_product_check
before insert or update of configuration_id, variation_id
on public.configuration_variations
for each row execute function public.validate_configuration_variation();

create or replace function public.validate_quotation_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  snapshot_owner uuid;
begin
  select profile_id into snapshot_owner
  from public.visualization_snapshots
  where snapshot_id = new.snapshot_id;

  if snapshot_owner is null then
    raise exception 'Quotation snapshot must belong to an authenticated customer'
      using errcode = '23514';
  end if;

  if snapshot_owner is distinct from new.profile_id then
    raise exception 'Quotation customer must own the selected snapshot'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger quotation_estimates_owner_check
before insert or update of snapshot_id, profile_id
on public.quotation_estimates
for each row execute function public.validate_quotation_owner();

create or replace function public.validate_quotation_item_configuration()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  quotation_snapshot uuid;
  configuration_snapshot uuid;
begin
  if new.configuration_id is null then
    return new;
  end if;

  select snapshot_id into quotation_snapshot
  from public.quotation_estimates
  where quotation_id = new.quotation_id;

  select snapshot_id into configuration_snapshot
  from public.product_configurations
  where configuration_id = new.configuration_id;

  if quotation_snapshot is distinct from configuration_snapshot then
    raise exception 'Quotation item configuration must belong to the quotation snapshot'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger quotation_items_configuration_check
before insert or update of quotation_id, configuration_id
on public.quotation_items
for each row execute function public.validate_quotation_item_configuration();

create or replace function public.validate_booking_link_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  quotation_profile uuid;
  quotation_snapshot uuid;
begin
  select profile_id, snapshot_id
  into quotation_profile, quotation_snapshot
  from public.quotation_estimates
  where quotation_id = new.quotation_id;

  if quotation_profile is distinct from new.profile_id then
    raise exception 'Booking link customer must match quotation customer'
      using errcode = '23514';
  end if;

  if quotation_snapshot is distinct from new.snapshot_id then
    raise exception 'Booking link snapshot must match quotation snapshot'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger signed_booking_links_consistency_check
before insert or update of profile_id, quotation_id, snapshot_id
on public.signed_booking_links
for each row execute function public.validate_booking_link_consistency();

create or replace function public.validate_booking_request_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  link_profile uuid;
begin
  select profile_id into link_profile
  from public.signed_booking_links
  where link_id = new.link_id;

  if link_profile is distinct from new.profile_id then
    raise exception 'Booking request customer must match booking link customer'
      using errcode = '23514';
  end if;

  if new.updated_by is not null then
    perform public.assert_active_admin(new.updated_by);
  end if;

  return new;
end;
$$;

create trigger booking_requests_consistency_check
before insert or update of profile_id, link_id, updated_by
on public.booking_requests
for each row execute function public.validate_booking_request_consistency();

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------

create trigger admin_roles_set_updated_at
before update on public.admin_roles
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger product_templates_set_updated_at
before update on public.product_templates
for each row execute function public.set_updated_at();

create trigger product_parameters_set_updated_at
before update on public.product_parameters
for each row execute function public.set_updated_at();

create trigger product_components_set_updated_at
before update on public.product_components
for each row execute function public.set_updated_at();

create trigger structural_rules_set_updated_at
before update on public.structural_rules
for each row execute function public.set_updated_at();

create trigger product_assets_set_updated_at
before update on public.product_assets
for each row execute function public.set_updated_at();

create trigger product_variations_set_updated_at
before update on public.product_variations
for each row execute function public.set_updated_at();

create trigger product_configurations_set_updated_at
before update on public.product_configurations
for each row execute function public.set_updated_at();

create trigger quotation_estimates_set_updated_at
before update on public.quotation_estimates
for each row execute function public.set_updated_at();

create trigger booking_requests_set_updated_at
before update on public.booking_requests
for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- Indexes
-- Foreign-key columns are indexed explicitly because PostgreSQL does not
-- automatically create indexes for referencing columns.
-- --------------------------------------------------------------------------

create index profiles_admin_role_idx on public.profiles(admin_role_id);
create index profiles_account_type_status_idx on public.profiles(account_type, status);
create index profiles_email_lower_idx on public.profiles(lower(email));
create index profiles_last_name_lower_idx on public.profiles(lower(last_name));
create index profiles_full_name_lower_idx on public.profiles(lower(full_name));

create index products_created_by_idx on public.products(created_by);
create index products_updated_by_idx on public.products(updated_by);
create index products_type_status_idx on public.products(product_type, status);
create index products_name_lower_idx on public.products(lower(product_name));

create index product_templates_created_by_idx on public.product_templates(created_by);
create index product_templates_status_idx on public.product_templates(status);

create index product_parameters_template_order_idx
  on public.product_parameters(template_id, display_order)
  where status = 'Active';
create index product_parameters_created_by_idx on public.product_parameters(created_by);

create index product_components_template_idx on public.product_components(template_id);
create index product_components_template_status_idx
  on public.product_components(template_id, status);
create index product_components_created_by_idx on public.product_components(created_by);

create index structural_rules_template_priority_idx
  on public.structural_rules(template_id, priority)
  where status = 'Active';
create index structural_rules_created_by_idx on public.structural_rules(created_by);

create index product_assets_product_order_idx
  on public.product_assets(product_id, display_order)
  where status = 'Active';
create index product_assets_template_idx on public.product_assets(template_id);
create index product_assets_component_idx on public.product_assets(component_id);
create index product_assets_created_by_idx on public.product_assets(created_by);
create index product_assets_type_status_idx on public.product_assets(asset_type, status);

create index product_variations_product_type_idx
  on public.product_variations(product_id, variation_type)
  where status = 'Active';
create index product_variations_preview_asset_idx on public.product_variations(preview_asset_id);
create index product_variations_created_by_idx on public.product_variations(created_by);

create index visualization_snapshots_profile_created_idx
  on public.visualization_snapshots(profile_id, created_at desc);

create index product_configurations_snapshot_idx on public.product_configurations(snapshot_id);
create index product_configurations_product_idx on public.product_configurations(product_id);
create index product_configurations_template_idx on public.product_configurations(template_id);

create index configuration_variations_variation_idx
  on public.configuration_variations(variation_id);

create index quotation_estimates_profile_created_idx
  on public.quotation_estimates(profile_id, created_at desc);
create index quotation_estimates_status_idx on public.quotation_estimates(status);

create index quotation_items_quotation_order_idx
  on public.quotation_items(quotation_id, display_order);
create index quotation_items_configuration_idx on public.quotation_items(configuration_id);

create index signed_booking_links_profile_created_idx
  on public.signed_booking_links(profile_id, created_at desc);
create index signed_booking_links_snapshot_idx on public.signed_booking_links(snapshot_id);
create index signed_booking_links_expiry_idx
  on public.signed_booking_links(expires_at)
  where status = 'Active';

create index booking_requests_profile_created_idx
  on public.booking_requests(profile_id, created_at desc);
create index booking_requests_status_updated_idx
  on public.booking_requests(status, updated_at desc);
create index booking_requests_updated_by_idx on public.booking_requests(updated_by);

-- --------------------------------------------------------------------------
-- Row Level Security helpers
-- --------------------------------------------------------------------------

create or replace function public.owns_snapshot(target_snapshot uuid, user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.visualization_snapshots s
    where s.snapshot_id = target_snapshot
      and s.profile_id = user_id
  );
$$;

create or replace function public.owns_configuration(target_configuration uuid, user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.product_configurations c
    join public.visualization_snapshots s on s.snapshot_id = c.snapshot_id
    where c.configuration_id = target_configuration
      and s.profile_id = user_id
  );
$$;

create or replace function public.owns_quotation(target_quotation uuid, user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quotation_estimates q
    where q.quotation_id = target_quotation
      and q.profile_id = user_id
  );
$$;

create or replace function public.owns_booking_link(target_link uuid, user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.signed_booking_links l
    where l.link_id = target_link
      and l.profile_id = user_id
  );
$$;

revoke all on function public.owns_snapshot(uuid, uuid) from public;
revoke all on function public.owns_configuration(uuid, uuid) from public;
revoke all on function public.owns_quotation(uuid, uuid) from public;
revoke all on function public.owns_booking_link(uuid, uuid) from public;

grant execute on function public.owns_snapshot(uuid, uuid) to authenticated;
grant execute on function public.owns_configuration(uuid, uuid) to authenticated;
grant execute on function public.owns_quotation(uuid, uuid) to authenticated;
grant execute on function public.owns_booking_link(uuid, uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Row Level Security
-- --------------------------------------------------------------------------

alter table public.admin_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_templates enable row level security;
alter table public.product_parameters enable row level security;
alter table public.product_components enable row level security;
alter table public.structural_rules enable row level security;
alter table public.product_assets enable row level security;
alter table public.product_variations enable row level security;
alter table public.visualization_snapshots enable row level security;
alter table public.product_configurations enable row level security;
alter table public.configuration_variations enable row level security;
alter table public.quotation_estimates enable row level security;
alter table public.quotation_items enable row level security;
alter table public.signed_booking_links enable row level security;
alter table public.booking_requests enable row level security;

-- Public catalog reads. Inactive records remain admin-only.
create policy admin_roles_admin_all
on public.admin_roles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy products_public_read_active
on public.products for select
to anon, authenticated
using (status = 'Active' or public.is_admin());

create policy products_admin_write
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy product_templates_public_read_active
on public.product_templates for select
to anon, authenticated
using (status = 'Active' or public.is_admin());

create policy product_templates_admin_write
on public.product_templates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy product_parameters_public_read_active
on public.product_parameters for select
to anon, authenticated
using (status = 'Active' or public.is_admin());

create policy product_parameters_admin_write
on public.product_parameters for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy product_components_public_read_active
on public.product_components for select
to anon, authenticated
using (status = 'Active' or public.is_admin());

create policy product_components_admin_write
on public.product_components for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy structural_rules_public_read_active
on public.structural_rules for select
to anon, authenticated
using (status = 'Active' or public.is_admin());

create policy structural_rules_admin_write
on public.structural_rules for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy product_assets_public_read_active
on public.product_assets for select
to anon, authenticated
using (status = 'Active' or public.is_admin());

create policy product_assets_admin_write
on public.product_assets for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy product_variations_public_read_active
on public.product_variations for select
to anon, authenticated
using (status = 'Active' or public.is_admin());

create policy product_variations_admin_write
on public.product_variations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Profiles: users read/update their own record; admins can read/manage all.
create policy profiles_select_own_or_admin
on public.profiles for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy profiles_insert_own_customer
on public.profiles for insert
to authenticated
with check (
  profile_id = auth.uid()
  and account_type = 'Customer'
  and admin_role_id is null
);

create policy profiles_update_own_or_admin
on public.profiles for update
to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    profile_id = auth.uid()
    and account_type = 'Customer'
    and admin_role_id is null
  )
);

-- Final snapshots: customer owns the record; admin can inspect all.
create policy snapshots_select_own_or_admin
on public.visualization_snapshots for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy snapshots_insert_own
on public.visualization_snapshots for insert
to authenticated
with check (profile_id = auth.uid());

create policy snapshots_update_own_or_admin
on public.visualization_snapshots for update
to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());

create policy snapshots_delete_own_or_admin
on public.visualization_snapshots for delete
to authenticated
using (profile_id = auth.uid() or public.is_admin());

-- Configurations and selected variations inherit ownership from snapshot.
create policy configurations_select_own_or_admin
on public.product_configurations for select
to authenticated
using (public.owns_snapshot(snapshot_id) or public.is_admin());

create policy configurations_insert_own
on public.product_configurations for insert
to authenticated
with check (public.owns_snapshot(snapshot_id));

create policy configurations_update_own_or_admin
on public.product_configurations for update
to authenticated
using (public.owns_snapshot(snapshot_id) or public.is_admin())
with check (public.owns_snapshot(snapshot_id) or public.is_admin());

create policy configurations_delete_own_or_admin
on public.product_configurations for delete
to authenticated
using (public.owns_snapshot(snapshot_id) or public.is_admin());

create policy configuration_variations_select_own_or_admin
on public.configuration_variations for select
to authenticated
using (public.owns_configuration(configuration_id) or public.is_admin());

create policy configuration_variations_insert_own
on public.configuration_variations for insert
to authenticated
with check (public.owns_configuration(configuration_id));

create policy configuration_variations_delete_own_or_admin
on public.configuration_variations for delete
to authenticated
using (public.owns_configuration(configuration_id) or public.is_admin());

-- Quotations are normally generated by a trusted backend/service-role process.
-- Customers may read their quotation; admins may manage all quotations.
create policy quotations_select_own_or_admin
on public.quotation_estimates for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy quotations_admin_write
on public.quotation_estimates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy quotation_items_select_own_or_admin
on public.quotation_items for select
to authenticated
using (public.owns_quotation(quotation_id) or public.is_admin());

create policy quotation_items_admin_write
on public.quotation_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Booking links are generated by trusted backend/admin code. Customers can
-- read only their own record. Public token lookup should happen server-side.
create policy booking_links_select_own_or_admin
on public.signed_booking_links for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy booking_links_admin_write
on public.signed_booking_links for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Customers create/read their request; admins update status.
create policy booking_requests_select_own_or_admin
on public.booking_requests for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy booking_requests_insert_own
on public.booking_requests for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.owns_booking_link(link_id)
  and updated_by is null
  and status = 'Pending'
);

create policy booking_requests_admin_update
on public.booking_requests for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Table grants
-- RLS still determines which rows are accessible.
-- --------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on
  public.products,
  public.product_templates,
  public.product_parameters,
  public.product_components,
  public.structural_rules,
  public.product_assets,
  public.product_variations
  to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.visualization_snapshots to authenticated;
grant select, insert, update, delete on public.product_configurations to authenticated;
grant select, insert, delete on public.configuration_variations to authenticated;
grant select on public.quotation_estimates, public.quotation_items to authenticated;
grant select on public.signed_booking_links to authenticated;
grant select, insert, update on public.booking_requests to authenticated;

-- Admin table privileges; RLS verifies active-admin status.
grant select, insert, update, delete on
  public.admin_roles,
  public.products,
  public.product_templates,
  public.product_parameters,
  public.product_components,
  public.structural_rules,
  public.product_assets,
  public.product_variations,
  public.quotation_estimates,
  public.quotation_items,
  public.signed_booking_links
  to authenticated;

-- --------------------------------------------------------------------------
-- Optional seed roles
-- Safe to rerun because role_name is unique.
-- --------------------------------------------------------------------------

insert into public.admin_roles (role_name, description, permissions)
values
  (
    'Owner',
    'Full administrative control of GlassFit.',
    '{"manage_products":true,"manage_pricing":true,"manage_roles":true,"manage_bookings":true}'::jsonb
  ),
  (
    'Manager',
    'Manages products, pricing, quotations, and booking requests.',
    '{"manage_products":true,"manage_pricing":true,"manage_roles":false,"manage_bookings":true}'::jsonb
  ),
  (
    'Staff',
    'Views and updates assigned operational records.',
    '{"manage_products":false,"manage_pricing":false,"manage_roles":false,"manage_bookings":true}'::jsonb
  )
on conflict (role_name) do nothing;

commit;

-- ============================================================================
-- Application responsibilities not enforced solely by SQL
-- ============================================================================
-- 1. Generate secure random booking tokens in trusted server code, store only
--    SHA-256 token_hash, and never expose the service-role key to the client.
-- 2. Recalculate quotation totals in trusted server code before inserting a
--    Generated quotation. Do not trust client-submitted totals.
-- 3. Validate visual_parameter_values, condition_data, action_data,
--    component_data, render_data, and pricing_details against application-side
--    JSON schemas because PostgreSQL CHECK constraints only verify basic shape.
-- 4. Upload permanent product assets, final images, and PDFs to R2 before or in
--    coordination with database inserts. Clean up orphaned R2 objects if a
--    transaction fails.
-- 5. Apply an R2 lifecycle rule to temporary session paths so abandoned space
--    images and processing artifacts expire automatically.
-- 6. Use service-role/backend code for quotation generation, PDF generation,
--    signed booking-link creation, and public token resolution.