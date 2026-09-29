


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."assert_active_admin"("profile" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if profile is null or not public.is_admin(profile) then
    raise exception 'Profile % must be an active administrator', profile
      using errcode = '23514';
  end if;
end;
$$;


ALTER FUNCTION "public"."assert_active_admin"("profile" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_admin_audit_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_admin_audit_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_admin_permission"("permission_key" "text", "user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."has_admin_permission"("permission_key" "text", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_json_object"("value" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select value is not null and jsonb_typeof(value) = 'object';
$$;


ALTER FUNCTION "public"."is_json_object"("value" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_booking_link"("target_link" "uuid", "user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.signed_booking_links l
    where l.link_id = target_link
      and l.profile_id = user_id
  );
$$;


ALTER FUNCTION "public"."owns_booking_link"("target_link" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_configuration"("target_configuration" "uuid", "user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.product_configurations c
    join public.visualization_snapshots s on s.snapshot_id = c.snapshot_id
    where c.configuration_id = target_configuration
      and s.profile_id = user_id
  );
$$;


ALTER FUNCTION "public"."owns_configuration"("target_configuration" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_quotation"("target_quotation" "uuid", "user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.quotation_estimates q
    where q.quotation_id = target_quotation
      and q.profile_id = user_id
  );
$$;


ALTER FUNCTION "public"."owns_quotation"("target_quotation" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_snapshot"("target_snapshot" "uuid", "user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.visualization_snapshots s
    where s.snapshot_id = target_snapshot
      and s.profile_id = user_id
  );
$$;


ALTER FUNCTION "public"."owns_snapshot"("target_snapshot" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_raw_materials_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_raw_materials_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_link_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_booking_link_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_request_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_booking_request_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_configuration_template"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_configuration_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_configuration_variation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_configuration_variation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_product_asset_links"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_product_asset_links"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_quotation_item_configuration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_quotation_item_configuration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_quotation_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_quotation_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_structural_rule_payload"("p_action" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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


ALTER FUNCTION "public"."validate_structural_rule_payload"("p_action" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_variation_preview_asset"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_variation_preview_asset"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_roles" (
    "role_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_name" character varying(50) NOT NULL,
    "description" "text",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_roles_permissions_object" CHECK ("public"."is_json_object"("permissions")),
    CONSTRAINT "admin_roles_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[])))
);


ALTER TABLE "public"."admin_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_requests" (
    "booking_request_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "link_id" "uuid" NOT NULL,
    "selected_platform" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_requests_platform_check" CHECK ((("selected_platform")::"text" = ANY ((ARRAY['Messenger'::character varying, 'Viber'::character varying])::"text"[]))),
    CONSTRAINT "booking_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Ongoing'::character varying, 'Done'::character varying, 'Cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."booking_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuration_variations" (
    "configuration_id" "uuid" NOT NULL,
    "variation_id" "uuid" NOT NULL,
    "additional_price_snapshot" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "configuration_variations_price_nonnegative" CHECK (("additional_price_snapshot" >= (0)::numeric))
);


ALTER TABLE "public"."configuration_variations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_assets" (
    "asset_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "component_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "asset_type" character varying(40) NOT NULL,
    "r2_object_key" "text" NOT NULL,
    "file_name" character varying(180) NOT NULL,
    "mime_type" character varying(100) NOT NULL,
    "byte_size" bigint,
    "display_order" integer DEFAULT 1 NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_assets_byte_size_nonnegative" CHECK ((("byte_size" IS NULL) OR ("byte_size" >= 0))),
    CONSTRAINT "product_assets_component_requires_template" CHECK ((("component_id" IS NULL) OR ("template_id" IS NOT NULL))),
    CONSTRAINT "product_assets_display_order_positive" CHECK (("display_order" >= 1)),
    CONSTRAINT "product_assets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[]))),
    CONSTRAINT "product_assets_type_check" CHECK ((("asset_type")::"text" = ANY ((ARRAY['Thumbnail'::character varying, 'Catalog Image'::character varying, 'Catalog 3D Preview'::character varying, 'Whole Model'::character varying, 'Component Model'::character varying, 'Texture'::character varying, 'Material Map'::character varying, 'Variation Preview'::character varying, 'Other'::character varying])::"text"[])))
);


ALTER TABLE "public"."product_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_components" (
    "component_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "component_key" character varying(50) NOT NULL,
    "component_name" character varying(100) NOT NULL,
    "component_type" character varying(30) NOT NULL,
    "base_quantity" numeric(12,4) DEFAULT 1.0000 NOT NULL,
    "pricing_method" character varying(30) DEFAULT 'Included'::character varying NOT NULL,
    "unit_price" numeric(12,4) DEFAULT 0.0000 NOT NULL,
    "pricing_unit" character varying(20),
    "component_data" "jsonb",
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_material_id" "uuid",
    "dimension_binding" character varying(20) DEFAULT 'FIXED'::character varying NOT NULL,
    "span_ratio" numeric(5,4) DEFAULT 1.0000 NOT NULL,
    "is_removable" boolean DEFAULT false NOT NULL,
    "toggle_property_key" character varying(50),
    "presentation_category" character varying(50) DEFAULT 'Framing'::character varying NOT NULL,
    "glb_file_url" "text",
    CONSTRAINT "product_components_data_object" CHECK ((("component_data" IS NULL) OR "public"."is_json_object"("component_data"))),
    CONSTRAINT "product_components_dimension_binding_check" CHECK ((("dimension_binding")::"text" = ANY ((ARRAY['WIDTH'::character varying, 'HEIGHT'::character varying, 'AREA'::character varying, 'FIXED'::character varying])::"text"[]))),
    CONSTRAINT "product_components_presentation_category_check" CHECK ((("presentation_category")::"text" = ANY ((ARRAY['Framing'::character varying, 'Glazing'::character varying, 'Hardware'::character varying, 'Consumable'::character varying, 'Other'::character varying])::"text"[]))),
    CONSTRAINT "product_components_pricing_method_check" CHECK ((("pricing_method")::"text" = ANY ((ARRAY['Included'::character varying, 'Per Piece'::character varying, 'Per Length'::character varying, 'Per Area'::character varying, 'Fixed'::character varying, 'Other'::character varying])::"text"[]))),
    CONSTRAINT "product_components_quantity_nonnegative" CHECK (("base_quantity" >= (0)::numeric)),
    CONSTRAINT "product_components_span_ratio_check" CHECK ((("span_ratio" >= 0.0000) AND ("span_ratio" <= 10.0000))),
    CONSTRAINT "product_components_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[]))),
    CONSTRAINT "product_components_type_check" CHECK ((("component_type")::"text" = ANY ((ARRAY['Procedural'::character varying, 'Model'::character varying, 'Glass'::character varying, 'Frame'::character varying, 'Panel'::character varying, 'Hardware'::character varying, 'Other'::character varying])::"text"[]))),
    CONSTRAINT "product_components_unit_price_nonnegative" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."product_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_configurations" (
    "configuration_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "visual_parameter_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "quotation_width" numeric(12,4),
    "quotation_height" numeric(12,4),
    "quotation_depth" numeric(12,4),
    "quotation_measurement_unit" character varying(10),
    "measurement_source" character varying(20) DEFAULT 'Estimated'::character varying NOT NULL,
    "measurement_confirmed" boolean DEFAULT false NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "estimated_configuration_price" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_configurations_depth_nonnegative" CHECK ((("quotation_depth" IS NULL) OR ("quotation_depth" >= (0)::numeric))),
    CONSTRAINT "product_configurations_height_nonnegative" CHECK ((("quotation_height" IS NULL) OR ("quotation_height" >= (0)::numeric))),
    CONSTRAINT "product_configurations_measurement_source_check" CHECK ((("measurement_source")::"text" = ANY ((ARRAY['Estimated'::character varying, 'Manual'::character varying])::"text"[]))),
    CONSTRAINT "product_configurations_measurement_unit_check" CHECK ((("quotation_measurement_unit" IS NULL) OR (("quotation_measurement_unit")::"text" = ANY ((ARRAY['mm'::character varying, 'cm'::character varying, 'm'::character varying])::"text"[])))),
    CONSTRAINT "product_configurations_measurement_unit_required" CHECK (((("quotation_width" IS NULL) AND ("quotation_height" IS NULL) AND ("quotation_depth" IS NULL)) OR ("quotation_measurement_unit" IS NOT NULL))),
    CONSTRAINT "product_configurations_price_nonnegative" CHECK (("estimated_configuration_price" >= (0)::numeric)),
    CONSTRAINT "product_configurations_quantity_positive" CHECK (("quantity" >= 1)),
    CONSTRAINT "product_configurations_visual_values_object" CHECK ("public"."is_json_object"("visual_parameter_values")),
    CONSTRAINT "product_configurations_width_nonnegative" CHECK ((("quotation_width" IS NULL) OR ("quotation_width" >= (0)::numeric)))
);


ALTER TABLE "public"."product_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_parameters" (
    "parameter_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "parameter_key" character varying(50) NOT NULL,
    "parameter_name" character varying(100) NOT NULL,
    "parameter_type" character varying(20) NOT NULL,
    "minimum_value" numeric(12,4),
    "maximum_value" numeric(12,4),
    "default_value" "jsonb" NOT NULL,
    "step_value" numeric(12,4),
    "unit" character varying(20),
    "affects_structure" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 1 NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_parameters_display_order_positive" CHECK (("display_order" >= 1)),
    CONSTRAINT "product_parameters_range_check" CHECK ((("minimum_value" IS NULL) OR ("maximum_value" IS NULL) OR ("minimum_value" <= "maximum_value"))),
    CONSTRAINT "product_parameters_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[]))),
    CONSTRAINT "product_parameters_step_positive" CHECK ((("step_value" IS NULL) OR ("step_value" > (0)::numeric))),
    CONSTRAINT "product_parameters_type_check" CHECK ((("parameter_type")::"text" = ANY ((ARRAY['Number'::character varying, 'Integer'::character varying, 'Boolean'::character varying, 'Select'::character varying])::"text"[])))
);


ALTER TABLE "public"."product_parameters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_templates" (
    "template_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "template_name" character varying(100) NOT NULL,
    "model_strategy" character varying(20) NOT NULL,
    "measurement_unit" character varying(10) DEFAULT 'mm'::character varying NOT NULL,
    "base_configuration" "jsonb",
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_templates_base_configuration_object" CHECK ((("base_configuration" IS NULL) OR "public"."is_json_object"("base_configuration"))),
    CONSTRAINT "product_templates_measurement_unit_check" CHECK ((("measurement_unit")::"text" = ANY ((ARRAY['mm'::character varying, 'cm'::character varying, 'm'::character varying])::"text"[]))),
    CONSTRAINT "product_templates_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[]))),
    CONSTRAINT "product_templates_strategy_check" CHECK ((("model_strategy")::"text" = ANY ((ARRAY['Fixed'::character varying, 'Parametric'::character varying])::"text"[])))
);


ALTER TABLE "public"."product_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_variations" (
    "variation_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "preview_asset_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "variation_type" character varying(50) NOT NULL,
    "variation_name" character varying(100) NOT NULL,
    "additional_price" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "render_data" "jsonb",
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_variations_price_nonnegative" CHECK (("additional_price" >= (0)::numeric)),
    CONSTRAINT "product_variations_render_data_object" CHECK ((("render_data" IS NULL) OR "public"."is_json_object"("render_data"))),
    CONSTRAINT "product_variations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[]))),
    CONSTRAINT "product_variations_type_check" CHECK ((("variation_type")::"text" = ANY ((ARRAY['Color'::character varying, 'Material'::character varying, 'Finish'::character varying, 'Glass Type'::character varying, 'Frame Type'::character varying, 'Design'::character varying, 'Other'::character varying])::"text"[])))
);


ALTER TABLE "public"."product_variations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "product_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "product_name" character varying(100) NOT NULL,
    "product_type" character varying(50) NOT NULL,
    "description" "text",
    "base_price" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_base_price_nonnegative" CHECK (("base_price" >= (0)::numeric)),
    CONSTRAINT "products_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[]))),
    CONSTRAINT "products_type_check" CHECK ((("product_type")::"text" = ANY ((ARRAY['Window'::character varying, 'Door'::character varying, 'Partition'::character varying, 'Cabinet'::character varying, 'Enclosure'::character varying, 'Railing'::character varying, 'Other'::character varying])::"text"[])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "profile_id" "uuid" NOT NULL,
    "admin_role_id" "uuid",
    "first_name" character varying(50) NOT NULL,
    "last_name" character varying(50) NOT NULL,
    "full_name" character varying(101) GENERATED ALWAYS AS (TRIM(BOTH FROM ((("first_name")::"text" || ' '::"text") || ("last_name")::"text"))) STORED,
    "email" character varying(254) NOT NULL,
    "contact_number" character varying(20),
    "auth_provider" character varying(30) NOT NULL,
    "account_type" character varying(20) DEFAULT 'Customer'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_account_type_check" CHECK ((("account_type")::"text" = ANY ((ARRAY['Customer'::character varying, 'Admin'::character varying])::"text"[]))),
    CONSTRAINT "profiles_admin_role_consistency_check" CHECK ((((("account_type")::"text" = 'Admin'::"text") AND ("admin_role_id" IS NOT NULL)) OR ((("account_type")::"text" = 'Customer'::"text") AND ("admin_role_id" IS NULL)))),
    CONSTRAINT "profiles_auth_provider_check" CHECK ((("auth_provider")::"text" = ANY ((ARRAY['Email'::character varying, 'Google'::character varying, 'Other'::character varying])::"text"[]))),
    CONSTRAINT "profiles_first_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "first_name")) > 0)),
    CONSTRAINT "profiles_last_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "last_name")) > 0)),
    CONSTRAINT "profiles_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying, 'Suspended'::character varying])::"text"[])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_estimates" (
    "quotation_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "quotation_number" character varying(50) NOT NULL,
    "total_estimated_amount" numeric(12,2) NOT NULL,
    "quotation_document_snapshot" jsonb,
    "negotiated_amount" numeric(12,2),
    "negotiated_by" uuid,
    "negotiated_at" timestamp with time zone,
    "item_price_overrides" jsonb,
    "currency" character(3) DEFAULT 'PHP'::"bpchar" NOT NULL,
    "quotation_note" "text",
    "pdf_r2_object_key" "text",
    "status" character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quotation_estimates_currency_format" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "quotation_estimates_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Draft'::character varying, 'Generated'::character varying, 'Expired'::character varying, 'Cancelled'::character varying])::"text"[]))),
    CONSTRAINT "quotation_estimates_total_nonnegative" CHECK (("total_estimated_amount" >= (0)::numeric)),
    CONSTRAINT "quotation_document_snapshot_object_check" CHECK (("quotation_document_snapshot" IS NULL) OR (jsonb_typeof("quotation_document_snapshot") = 'object'::text)),
    CONSTRAINT "quotation_negotiated_amount_range_check" CHECK (("negotiated_amount" IS NULL) OR (("negotiated_amount" >= 0) AND ("negotiated_amount" <= 9999999999.99))),
    CONSTRAINT "quotation_negotiation_audit_check" CHECK ((("negotiated_amount" IS NULL) AND ("negotiated_by" IS NULL) AND ("negotiated_at" IS NULL)) OR (("negotiated_amount" IS NOT NULL) AND ("negotiated_by" IS NOT NULL) AND ("negotiated_at" IS NOT NULL))),
    CONSTRAINT "quotation_item_price_overrides_object_check" CHECK (("item_price_overrides" IS NULL) OR (jsonb_typeof("item_price_overrides") = 'object'::text))
);


ALTER TABLE "public"."quotation_estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_items" (
    "quotation_item_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "configuration_id" "uuid",
    "item_name" character varying(150) NOT NULL,
    "quantity" numeric(12,4) DEFAULT 1.0000 NOT NULL,
    "unit" character varying(20) DEFAULT 'piece'::character varying NOT NULL,
    "unit_price" numeric(12,4) NOT NULL,
    "estimated_subtotal" numeric(12,2) NOT NULL,
    "pricing_details" "jsonb",
    "item_note" "text",
    "display_order" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "item_group_name" character varying(100) DEFAULT 'Aluminum Framing'::character varying NOT NULL,
    "structural_waiver" boolean DEFAULT false NOT NULL,
    CONSTRAINT "quotation_items_display_order_positive" CHECK (("display_order" >= 1)),
    CONSTRAINT "quotation_items_group_name_check" CHECK ((("item_group_name")::"text" = ANY ((ARRAY['Aluminum Framing'::character varying, 'Glass Infill'::character varying, 'Hardware & Accessories'::character varying, 'Labor & Installation'::character varying, 'Miscellaneous'::character varying])::"text"[]))),
    CONSTRAINT "quotation_items_pricing_details_object" CHECK ((("pricing_details" IS NULL) OR "public"."is_json_object"("pricing_details"))),
    CONSTRAINT "quotation_items_quantity_nonnegative" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "quotation_items_subtotal_nonnegative" CHECK (("estimated_subtotal" >= (0)::numeric)),
    CONSTRAINT "quotation_items_unit_price_nonnegative" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."quotation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raw_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_code" character varying(50) NOT NULL,
    "description" character varying(255) NOT NULL,
    "category" character varying(50) NOT NULL,
    "finish_type" character varying(50) NOT NULL,
    "billing_unit" character varying(20) NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "waste_allowance" numeric(4,3) DEFAULT 0.000 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "raw_materials_billing_unit_check" CHECK ((("billing_unit")::"text" = ANY ((ARRAY['m'::character varying, 'sqm'::character varying, 'pc'::character varying, 'set'::character varying, 'tube'::character varying, 'lot'::character varying])::"text"[]))),
    CONSTRAINT "raw_materials_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['Aluminum'::character varying, 'Glass'::character varying, 'Hardware'::character varying, 'Consumable'::character varying])::"text"[]))),
    CONSTRAINT "raw_materials_unit_price_nonnegative" CHECK (("unit_price" >= (0)::numeric)),
    CONSTRAINT "raw_materials_waste_allowance_range" CHECK ((("waste_allowance" >= 0.000) AND ("waste_allowance" <= 1.000)))
);


ALTER TABLE "public"."raw_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signed_booking_links" (
    "link_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "token_hash" character(64) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signed_booking_links_expiration_after_creation" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "signed_booking_links_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Expired'::character varying, 'Revoked'::character varying, 'Used'::character varying])::"text"[]))),
    CONSTRAINT "signed_booking_links_token_hash_format" CHECK (("token_hash" ~ '^[0-9a-fA-F]{64}$'::"text"))
);


ALTER TABLE "public"."signed_booking_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."structural_rules" (
    "rule_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "rule_name" character varying(120) NOT NULL,
    "priority" integer DEFAULT 1 NOT NULL,
    "condition_data" "jsonb" NOT NULL,
    "action_data" "jsonb" NOT NULL,
    "status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "structural_rules_action_object" CHECK ("public"."is_json_object"("action_data")),
    CONSTRAINT "structural_rules_condition_object" CHECK ("public"."is_json_object"("condition_data")),
    CONSTRAINT "structural_rules_priority_positive" CHECK (("priority" >= 1)),
    CONSTRAINT "structural_rules_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::"text"[])))
);


ALTER TABLE "public"."structural_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visualization_snapshots" (
    "snapshot_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "final_image_r2_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."visualization_snapshots" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("role_id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_role_name_unique" UNIQUE ("role_name");



ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_one_per_link" UNIQUE ("link_id");



ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("booking_request_id");



ALTER TABLE ONLY "public"."configuration_variations"
    ADD CONSTRAINT "configuration_variations_pk" PRIMARY KEY ("configuration_id", "variation_id");



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_pkey" PRIMARY KEY ("asset_id");



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_r2_key_unique" UNIQUE ("r2_object_key");



ALTER TABLE ONLY "public"."product_components"
    ADD CONSTRAINT "product_components_pkey" PRIMARY KEY ("component_id");



ALTER TABLE ONLY "public"."product_components"
    ADD CONSTRAINT "product_components_template_key_unique" UNIQUE ("template_id", "component_key");



ALTER TABLE ONLY "public"."product_configurations"
    ADD CONSTRAINT "product_configurations_pkey" PRIMARY KEY ("configuration_id");



ALTER TABLE ONLY "public"."product_parameters"
    ADD CONSTRAINT "product_parameters_pkey" PRIMARY KEY ("parameter_id");



ALTER TABLE ONLY "public"."product_parameters"
    ADD CONSTRAINT "product_parameters_template_key_unique" UNIQUE ("template_id", "parameter_key");



ALTER TABLE ONLY "public"."product_templates"
    ADD CONSTRAINT "product_templates_one_per_product" UNIQUE ("product_id");



ALTER TABLE ONLY "public"."product_templates"
    ADD CONSTRAINT "product_templates_pkey" PRIMARY KEY ("template_id");



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_pkey" PRIMARY KEY ("variation_id");



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_product_type_name_unique" UNIQUE ("product_id", "variation_type", "variation_name");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_name_unique" UNIQUE ("product_name");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."quotation_estimates"
    ADD CONSTRAINT "quotation_estimates_number_unique" UNIQUE ("quotation_number");



ALTER TABLE ONLY "public"."quotation_estimates"
    ADD CONSTRAINT "quotation_estimates_pdf_key_unique" UNIQUE ("pdf_r2_object_key");



ALTER TABLE ONLY "public"."quotation_estimates"
    ADD CONSTRAINT "quotation_estimates_pkey" PRIMARY KEY ("quotation_id");



ALTER TABLE ONLY "public"."quotation_estimates"
    ADD CONSTRAINT "quotation_estimates_snapshot_unique" UNIQUE ("snapshot_id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("quotation_item_id");



ALTER TABLE ONLY "public"."raw_materials"
    ADD CONSTRAINT "raw_materials_material_code_key" UNIQUE ("material_code");



ALTER TABLE ONLY "public"."raw_materials"
    ADD CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signed_booking_links"
    ADD CONSTRAINT "signed_booking_links_pkey" PRIMARY KEY ("link_id");



ALTER TABLE ONLY "public"."signed_booking_links"
    ADD CONSTRAINT "signed_booking_links_quotation_unique" UNIQUE ("quotation_id");



ALTER TABLE ONLY "public"."signed_booking_links"
    ADD CONSTRAINT "signed_booking_links_token_hash_unique" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."structural_rules"
    ADD CONSTRAINT "structural_rules_pkey" PRIMARY KEY ("rule_id");



ALTER TABLE ONLY "public"."structural_rules"
    ADD CONSTRAINT "structural_rules_template_priority_name_unique" UNIQUE ("template_id", "priority", "rule_name");



ALTER TABLE ONLY "public"."visualization_snapshots"
    ADD CONSTRAINT "visualization_snapshots_final_image_unique" UNIQUE ("final_image_r2_key");



ALTER TABLE ONLY "public"."visualization_snapshots"
    ADD CONSTRAINT "visualization_snapshots_pkey" PRIMARY KEY ("snapshot_id");



CREATE INDEX "booking_requests_profile_created_idx" ON "public"."booking_requests" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "booking_requests_status_updated_idx" ON "public"."booking_requests" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "booking_requests_updated_by_idx" ON "public"."booking_requests" USING "btree" ("updated_by");



CREATE INDEX "configuration_variations_variation_idx" ON "public"."configuration_variations" USING "btree" ("variation_id");



CREATE INDEX "product_assets_component_idx" ON "public"."product_assets" USING "btree" ("component_id");



CREATE INDEX "product_assets_created_by_idx" ON "public"."product_assets" USING "btree" ("created_by");



CREATE UNIQUE INDEX "product_assets_one_primary_per_type_idx" ON "public"."product_assets" USING "btree" ("product_id", "asset_type") WHERE (("is_primary" = true) AND (("status")::"text" = 'Active'::"text"));



CREATE INDEX "product_assets_product_order_idx" ON "public"."product_assets" USING "btree" ("product_id", "display_order") WHERE (("status")::"text" = 'Active'::"text");



CREATE INDEX "product_assets_template_idx" ON "public"."product_assets" USING "btree" ("template_id");



CREATE INDEX "product_assets_type_status_idx" ON "public"."product_assets" USING "btree" ("asset_type", "status");



CREATE INDEX "product_components_created_by_idx" ON "public"."product_components" USING "btree" ("created_by");



CREATE INDEX "product_components_raw_material_idx" ON "public"."product_components" USING "btree" ("raw_material_id");



CREATE INDEX "product_components_template_idx" ON "public"."product_components" USING "btree" ("template_id");



CREATE INDEX "product_components_template_status_idx" ON "public"."product_components" USING "btree" ("template_id", "status");



CREATE INDEX "product_configurations_product_idx" ON "public"."product_configurations" USING "btree" ("product_id");



CREATE INDEX "product_configurations_snapshot_idx" ON "public"."product_configurations" USING "btree" ("snapshot_id");



CREATE INDEX "product_configurations_template_idx" ON "public"."product_configurations" USING "btree" ("template_id");



CREATE INDEX "product_parameters_created_by_idx" ON "public"."product_parameters" USING "btree" ("created_by");



CREATE INDEX "product_parameters_template_order_idx" ON "public"."product_parameters" USING "btree" ("template_id", "display_order") WHERE (("status")::"text" = 'Active'::"text");



CREATE INDEX "product_templates_created_by_idx" ON "public"."product_templates" USING "btree" ("created_by");



CREATE INDEX "product_templates_status_idx" ON "public"."product_templates" USING "btree" ("status");



CREATE INDEX "product_variations_created_by_idx" ON "public"."product_variations" USING "btree" ("created_by");



CREATE INDEX "product_variations_preview_asset_idx" ON "public"."product_variations" USING "btree" ("preview_asset_id");



CREATE INDEX "product_variations_product_type_idx" ON "public"."product_variations" USING "btree" ("product_id", "variation_type") WHERE (("status")::"text" = 'Active'::"text");



CREATE INDEX "products_created_by_idx" ON "public"."products" USING "btree" ("created_by");



CREATE INDEX "products_name_lower_idx" ON "public"."products" USING "btree" ("lower"(("product_name")::"text"));



CREATE INDEX "products_type_status_idx" ON "public"."products" USING "btree" ("product_type", "status");



CREATE INDEX "products_updated_by_idx" ON "public"."products" USING "btree" ("updated_by");



CREATE INDEX "profiles_account_type_status_idx" ON "public"."profiles" USING "btree" ("account_type", "status");



CREATE INDEX "profiles_admin_role_idx" ON "public"."profiles" USING "btree" ("admin_role_id");



CREATE INDEX "profiles_email_lower_idx" ON "public"."profiles" USING "btree" ("lower"(("email")::"text"));



CREATE INDEX "profiles_full_name_lower_idx" ON "public"."profiles" USING "btree" ("lower"(("full_name")::"text"));



CREATE INDEX "profiles_last_name_lower_idx" ON "public"."profiles" USING "btree" ("lower"(("last_name")::"text"));



CREATE INDEX "quotation_estimates_profile_created_idx" ON "public"."quotation_estimates" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "quotation_estimates_status_idx" ON "public"."quotation_estimates" USING "btree" ("status");



CREATE INDEX "quotation_items_configuration_idx" ON "public"."quotation_items" USING "btree" ("configuration_id");



CREATE INDEX "quotation_items_group_idx" ON "public"."quotation_items" USING "btree" ("quotation_id", "item_group_name");



CREATE INDEX "quotation_items_quotation_order_idx" ON "public"."quotation_items" USING "btree" ("quotation_id", "display_order");



CREATE INDEX "raw_materials_active_idx" ON "public"."raw_materials" USING "btree" ("is_active");



CREATE INDEX "raw_materials_category_idx" ON "public"."raw_materials" USING "btree" ("category");



CREATE INDEX "raw_materials_finish_type_idx" ON "public"."raw_materials" USING "btree" ("finish_type");



CREATE INDEX "signed_booking_links_expiry_idx" ON "public"."signed_booking_links" USING "btree" ("expires_at") WHERE (("status")::"text" = 'Active'::"text");



CREATE INDEX "signed_booking_links_profile_created_idx" ON "public"."signed_booking_links" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "signed_booking_links_snapshot_idx" ON "public"."signed_booking_links" USING "btree" ("snapshot_id");



CREATE INDEX "structural_rules_created_by_idx" ON "public"."structural_rules" USING "btree" ("created_by");



CREATE INDEX "structural_rules_template_priority_idx" ON "public"."structural_rules" USING "btree" ("template_id", "priority") WHERE (("status")::"text" = 'Active'::"text");



CREATE INDEX "visualization_snapshots_profile_created_idx" ON "public"."visualization_snapshots" USING "btree" ("profile_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "admin_roles_set_updated_at" BEFORE UPDATE ON "public"."admin_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "booking_requests_consistency_check" BEFORE INSERT OR UPDATE OF "profile_id", "link_id", "updated_by" ON "public"."booking_requests" FOR EACH ROW EXECUTE FUNCTION "public"."validate_booking_request_consistency"();



CREATE OR REPLACE TRIGGER "booking_requests_set_updated_at" BEFORE UPDATE ON "public"."booking_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "configuration_variations_product_check" BEFORE INSERT OR UPDATE OF "configuration_id", "variation_id" ON "public"."configuration_variations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_configuration_variation"();



CREATE OR REPLACE TRIGGER "product_assets_admin_audit_check" BEFORE INSERT OR UPDATE ON "public"."product_assets" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_audit_fields"();



CREATE OR REPLACE TRIGGER "product_assets_link_check" BEFORE INSERT OR UPDATE OF "product_id", "template_id", "component_id" ON "public"."product_assets" FOR EACH ROW EXECUTE FUNCTION "public"."validate_product_asset_links"();



CREATE OR REPLACE TRIGGER "product_assets_set_updated_at" BEFORE UPDATE ON "public"."product_assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "product_components_admin_audit_check" BEFORE INSERT OR UPDATE ON "public"."product_components" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_audit_fields"();



CREATE OR REPLACE TRIGGER "product_components_set_updated_at" BEFORE UPDATE ON "public"."product_components" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "product_configurations_set_updated_at" BEFORE UPDATE ON "public"."product_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "product_configurations_template_check" BEFORE INSERT OR UPDATE OF "product_id", "template_id" ON "public"."product_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_configuration_template"();



CREATE OR REPLACE TRIGGER "product_parameters_admin_audit_check" BEFORE INSERT OR UPDATE ON "public"."product_parameters" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_audit_fields"();



CREATE OR REPLACE TRIGGER "product_parameters_set_updated_at" BEFORE UPDATE ON "public"."product_parameters" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "product_templates_admin_audit_check" BEFORE INSERT OR UPDATE ON "public"."product_templates" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_audit_fields"();



CREATE OR REPLACE TRIGGER "product_templates_set_updated_at" BEFORE UPDATE ON "public"."product_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "product_variations_admin_audit_check" BEFORE INSERT OR UPDATE ON "public"."product_variations" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_audit_fields"();



CREATE OR REPLACE TRIGGER "product_variations_preview_check" BEFORE INSERT OR UPDATE OF "product_id", "preview_asset_id" ON "public"."product_variations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_variation_preview_asset"();



CREATE OR REPLACE TRIGGER "product_variations_set_updated_at" BEFORE UPDATE ON "public"."product_variations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "products_admin_audit_check" BEFORE INSERT OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_audit_fields"();



CREATE OR REPLACE TRIGGER "products_set_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "quotation_estimates_owner_check" BEFORE INSERT OR UPDATE OF "snapshot_id", "profile_id" ON "public"."quotation_estimates" FOR EACH ROW EXECUTE FUNCTION "public"."validate_quotation_owner"();



CREATE OR REPLACE TRIGGER "quotation_estimates_set_updated_at" BEFORE UPDATE ON "public"."quotation_estimates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "quotation_items_configuration_check" BEFORE INSERT OR UPDATE OF "quotation_id", "configuration_id" ON "public"."quotation_items" FOR EACH ROW EXECUTE FUNCTION "public"."validate_quotation_item_configuration"();



CREATE OR REPLACE TRIGGER "raw_materials_set_updated_at" BEFORE UPDATE ON "public"."raw_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_raw_materials_updated_at"();



CREATE OR REPLACE TRIGGER "signed_booking_links_consistency_check" BEFORE INSERT OR UPDATE OF "profile_id", "quotation_id", "snapshot_id" ON "public"."signed_booking_links" FOR EACH ROW EXECUTE FUNCTION "public"."validate_booking_link_consistency"();



CREATE OR REPLACE TRIGGER "structural_rules_admin_audit_check" BEFORE INSERT OR UPDATE ON "public"."structural_rules" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_audit_fields"();



CREATE OR REPLACE TRIGGER "structural_rules_set_updated_at" BEFORE UPDATE ON "public"."structural_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_link_fk" FOREIGN KEY ("link_id") REFERENCES "public"."signed_booking_links"("link_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_profile_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."configuration_variations"
    ADD CONSTRAINT "configuration_variations_configuration_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."product_configurations"("configuration_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuration_variations"
    ADD CONSTRAINT "configuration_variations_variation_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."product_variations"("variation_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_component_fk" FOREIGN KEY ("component_id") REFERENCES "public"."product_components"("component_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_product_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."product_templates"("template_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_assets"
    ADD CONSTRAINT "product_assets_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_components"
    ADD CONSTRAINT "product_components_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_components"
    ADD CONSTRAINT "product_components_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_components"
    ADD CONSTRAINT "product_components_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."product_templates"("template_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_components"
    ADD CONSTRAINT "product_components_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_configurations"
    ADD CONSTRAINT "product_configurations_product_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_configurations"
    ADD CONSTRAINT "product_configurations_snapshot_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."visualization_snapshots"("snapshot_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_configurations"
    ADD CONSTRAINT "product_configurations_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."product_templates"("template_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_parameters"
    ADD CONSTRAINT "product_parameters_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_parameters"
    ADD CONSTRAINT "product_parameters_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."product_templates"("template_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_parameters"
    ADD CONSTRAINT "product_parameters_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_templates"
    ADD CONSTRAINT "product_templates_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_templates"
    ADD CONSTRAINT "product_templates_product_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_templates"
    ADD CONSTRAINT "product_templates_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_preview_asset_fk" FOREIGN KEY ("preview_asset_id") REFERENCES "public"."product_assets"("asset_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_product_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_admin_role_fk" FOREIGN KEY ("admin_role_id") REFERENCES "public"."admin_roles"("role_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_fk" FOREIGN KEY ("profile_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_estimates"
    ADD CONSTRAINT "quotation_estimates_profile_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."quotation_estimates"
    ADD CONSTRAINT "quotation_estimates_negotiated_by_fk" FOREIGN KEY ("negotiated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_estimates"
    ADD CONSTRAINT "quotation_estimates_snapshot_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."visualization_snapshots"("snapshot_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_configuration_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."product_configurations"("configuration_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_quotation_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotation_estimates"("quotation_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signed_booking_links"
    ADD CONSTRAINT "signed_booking_links_profile_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."signed_booking_links"
    ADD CONSTRAINT "signed_booking_links_quotation_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotation_estimates"("quotation_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."signed_booking_links"
    ADD CONSTRAINT "signed_booking_links_snapshot_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."visualization_snapshots"("snapshot_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."structural_rules"
    ADD CONSTRAINT "structural_rules_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("profile_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."structural_rules"
    ADD CONSTRAINT "structural_rules_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."product_templates"("template_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."structural_rules"
    ADD CONSTRAINT "structural_rules_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visualization_snapshots"
    ADD CONSTRAINT "visualization_snapshots_profile_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("profile_id") ON DELETE SET NULL;



ALTER TABLE "public"."admin_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_roles_admin_all" ON "public"."admin_roles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "booking_links_admin_write" ON "public"."signed_booking_links" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "booking_links_select_own_or_admin" ON "public"."signed_booking_links" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."booking_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_requests_admin_update" ON "public"."booking_requests" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_bookings'::"text")) WITH CHECK ("public"."has_admin_permission"('manage_bookings'::"text"));



CREATE POLICY "booking_requests_insert_own" ON "public"."booking_requests" FOR INSERT TO "authenticated" WITH CHECK ((("profile_id" = "auth"."uid"()) AND "public"."owns_booking_link"("link_id") AND ("updated_by" IS NULL) AND (("status")::"text" = 'Pending'::"text")));



CREATE POLICY "booking_requests_select_own_or_admin" ON "public"."booking_requests" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."configuration_variations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuration_variations_delete_own_or_admin" ON "public"."configuration_variations" FOR DELETE TO "authenticated" USING (("public"."owns_configuration"("configuration_id") OR "public"."is_admin"()));



CREATE POLICY "configuration_variations_insert_own" ON "public"."configuration_variations" FOR INSERT TO "authenticated" WITH CHECK ("public"."owns_configuration"("configuration_id"));



CREATE POLICY "configuration_variations_select_own_or_admin" ON "public"."configuration_variations" FOR SELECT TO "authenticated" USING (("public"."owns_configuration"("configuration_id") OR "public"."is_admin"()));



CREATE POLICY "configurations_delete_own_or_admin" ON "public"."product_configurations" FOR DELETE TO "authenticated" USING (("public"."owns_snapshot"("snapshot_id") OR "public"."is_admin"()));



CREATE POLICY "configurations_insert_own" ON "public"."product_configurations" FOR INSERT TO "authenticated" WITH CHECK ("public"."owns_snapshot"("snapshot_id"));



CREATE POLICY "configurations_select_own_or_admin" ON "public"."product_configurations" FOR SELECT TO "authenticated" USING (("public"."owns_snapshot"("snapshot_id") OR "public"."is_admin"()));



CREATE POLICY "configurations_update_own_or_admin" ON "public"."product_configurations" FOR UPDATE TO "authenticated" USING (("public"."owns_snapshot"("snapshot_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_snapshot"("snapshot_id") OR "public"."is_admin"()));



ALTER TABLE "public"."product_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_assets_admin_write" ON "public"."product_assets" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "product_assets_public_read_active" ON "public"."product_assets" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'Active'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."product_components" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_components_admin_delete" ON "public"."product_components" FOR DELETE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_components_admin_insert" ON "public"."product_components" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_components_admin_update" ON "public"."product_components" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text")) WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_components_admin_write" ON "public"."product_components" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "product_components_public_read_active" ON "public"."product_components" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'Active'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."product_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_parameters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_parameters_admin_delete" ON "public"."product_parameters" FOR DELETE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_parameters_admin_insert" ON "public"."product_parameters" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_parameters_admin_update" ON "public"."product_parameters" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text")) WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_parameters_admin_write" ON "public"."product_parameters" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "product_parameters_public_read_active" ON "public"."product_parameters" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'Active'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."product_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_templates_admin_delete" ON "public"."product_templates" FOR DELETE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_templates_admin_insert" ON "public"."product_templates" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_templates_admin_update" ON "public"."product_templates" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text")) WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "product_templates_admin_write" ON "public"."product_templates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "product_templates_public_read_active" ON "public"."product_templates" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'Active'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."product_variations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_variations_admin_write" ON "public"."product_variations" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "product_variations_public_read_active" ON "public"."product_variations" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'Active'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_admin_delete" ON "public"."products" FOR DELETE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "products_admin_insert" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "products_admin_update" ON "public"."products" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text")) WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "products_admin_write" ON "public"."products" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "products_public_read_active" ON "public"."products" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'Active'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_manage" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_roles'::"text")) WITH CHECK ("public"."has_admin_permission"('manage_roles'::"text"));



CREATE POLICY "profiles_insert_own_customer" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((("profile_id" = "auth"."uid"()) AND (("account_type")::"text" = 'Customer'::"text") AND ("admin_role_id" IS NULL)));



CREATE POLICY "profiles_select_own_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "profiles_update_own_or_admin" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK (("public"."is_admin"() OR (("profile_id" = "auth"."uid"()) AND (("account_type")::"text" = 'Customer'::"text") AND ("admin_role_id" IS NULL))));



ALTER TABLE "public"."quotation_estimates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_items_admin_write" ON "public"."quotation_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "quotation_items_select_own_or_admin" ON "public"."quotation_items" FOR SELECT TO "authenticated" USING (("public"."owns_quotation"("quotation_id") OR "public"."is_admin"()));



CREATE POLICY "quotations_admin_insert" ON "public"."quotation_estimates" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());
CREATE POLICY "quotations_admin_delete" ON "public"."quotation_estimates" FOR DELETE TO "authenticated" USING ("public"."is_admin"());
CREATE POLICY "quotations_manage_bookings_update" ON "public"."quotation_estimates" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_bookings')) WITH CHECK ("public"."has_admin_permission"('manage_bookings'));



CREATE POLICY "quotations_select_own_or_admin" ON "public"."quotation_estimates" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."raw_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "raw_materials_admin_delete" ON "public"."raw_materials" FOR DELETE TO "authenticated" USING (("public"."has_admin_permission"('manage_products'::"text") OR "public"."is_admin"()));



CREATE POLICY "raw_materials_admin_insert" ON "public"."raw_materials" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_admin_permission"('manage_products'::"text") OR "public"."is_admin"()));



CREATE POLICY "raw_materials_admin_update" ON "public"."raw_materials" FOR UPDATE TO "authenticated" USING (("public"."has_admin_permission"('manage_products'::"text") OR "public"."is_admin"())) WITH CHECK (("public"."has_admin_permission"('manage_products'::"text") OR "public"."is_admin"()));



CREATE POLICY "raw_materials_public_read_active" ON "public"."raw_materials" FOR SELECT USING ((("is_active" = true) OR "public"."is_admin"()));



ALTER TABLE "public"."signed_booking_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "snapshots_delete_own_or_admin" ON "public"."visualization_snapshots" FOR DELETE TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "snapshots_insert_own" ON "public"."visualization_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "snapshots_select_own_or_admin" ON "public"."visualization_snapshots" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "snapshots_update_own_or_admin" ON "public"."visualization_snapshots" FOR UPDATE TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."structural_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "structural_rules_admin_delete" ON "public"."structural_rules" FOR DELETE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "structural_rules_admin_insert" ON "public"."structural_rules" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "structural_rules_admin_update" ON "public"."structural_rules" FOR UPDATE TO "authenticated" USING ("public"."has_admin_permission"('manage_products'::"text")) WITH CHECK ("public"."has_admin_permission"('manage_products'::"text"));



CREATE POLICY "structural_rules_admin_write" ON "public"."structural_rules" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "structural_rules_public_read_active" ON "public"."structural_rules" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'Active'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."visualization_snapshots" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_active_admin"("profile" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_active_admin"("profile" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assert_active_admin"("profile" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_active_admin"("profile" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_admin_audit_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_admin_audit_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_admin_audit_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_admin_permission"("permission_key" "text", "user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_admin_permission"("permission_key" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_admin_permission"("permission_key" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_admin_permission"("permission_key" "text", "user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_json_object"("value" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."is_json_object"("value" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_json_object"("value" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."owns_booking_link"("target_link" "uuid", "user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."owns_booking_link"("target_link" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_booking_link"("target_link" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_booking_link"("target_link" "uuid", "user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."owns_configuration"("target_configuration" "uuid", "user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."owns_configuration"("target_configuration" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_configuration"("target_configuration" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_configuration"("target_configuration" "uuid", "user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."owns_quotation"("target_quotation" "uuid", "user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."owns_quotation"("target_quotation" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_quotation"("target_quotation" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_quotation"("target_quotation" "uuid", "user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."owns_snapshot"("target_snapshot" "uuid", "user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."owns_snapshot"("target_snapshot" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_snapshot"("target_snapshot" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_snapshot"("target_snapshot" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_raw_materials_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_raw_materials_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_raw_materials_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_link_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_link_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_link_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_request_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_request_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_request_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_configuration_template"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_configuration_template"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_configuration_template"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_configuration_variation"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_configuration_variation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_configuration_variation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_product_asset_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_product_asset_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_product_asset_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_quotation_item_configuration"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_quotation_item_configuration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_quotation_item_configuration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_quotation_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_quotation_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_quotation_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_structural_rule_payload"("p_action" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_structural_rule_payload"("p_action" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_structural_rule_payload"("p_action" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_variation_preview_asset"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_variation_preview_asset"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_variation_preview_asset"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_roles" TO "anon";
GRANT ALL ON TABLE "public"."admin_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_roles" TO "service_role";



GRANT ALL ON TABLE "public"."booking_requests" TO "anon";
GRANT ALL ON TABLE "public"."booking_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_requests" TO "service_role";



GRANT ALL ON TABLE "public"."configuration_variations" TO "anon";
GRANT ALL ON TABLE "public"."configuration_variations" TO "authenticated";
GRANT ALL ON TABLE "public"."configuration_variations" TO "service_role";



GRANT ALL ON TABLE "public"."product_assets" TO "anon";
GRANT ALL ON TABLE "public"."product_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."product_assets" TO "service_role";



GRANT ALL ON TABLE "public"."product_components" TO "anon";
GRANT ALL ON TABLE "public"."product_components" TO "authenticated";
GRANT ALL ON TABLE "public"."product_components" TO "service_role";



GRANT ALL ON TABLE "public"."product_configurations" TO "anon";
GRANT ALL ON TABLE "public"."product_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."product_parameters" TO "anon";
GRANT ALL ON TABLE "public"."product_parameters" TO "authenticated";
GRANT ALL ON TABLE "public"."product_parameters" TO "service_role";



GRANT ALL ON TABLE "public"."product_templates" TO "anon";
GRANT ALL ON TABLE "public"."product_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."product_templates" TO "service_role";



GRANT ALL ON TABLE "public"."product_variations" TO "anon";
GRANT ALL ON TABLE "public"."product_variations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variations" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_estimates" TO "anon";
GRANT ALL ON TABLE "public"."quotation_estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_estimates" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_items" TO "anon";
GRANT ALL ON TABLE "public"."quotation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_items" TO "service_role";



GRANT ALL ON TABLE "public"."raw_materials" TO "anon";
GRANT ALL ON TABLE "public"."raw_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_materials" TO "service_role";



GRANT ALL ON TABLE "public"."signed_booking_links" TO "anon";
GRANT ALL ON TABLE "public"."signed_booking_links" TO "authenticated";
GRANT ALL ON TABLE "public"."signed_booking_links" TO "service_role";



GRANT ALL ON TABLE "public"."structural_rules" TO "anon";
GRANT ALL ON TABLE "public"."structural_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."structural_rules" TO "service_role";



GRANT ALL ON TABLE "public"."visualization_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."visualization_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."visualization_snapshots" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";





