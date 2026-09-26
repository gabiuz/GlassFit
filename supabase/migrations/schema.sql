-- ============================================================================
-- GlassFit Database Schema (DrawSQL / PostgreSQL DDL Export)
-- Project: GlassFit (Web-Based Client-Space Visualization System)
-- Reconciled for DrawSQL Import & Visual ERD Rendering
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. admin_roles (ERD-E1)
-- --------------------------------------------------------------------------
CREATE TABLE admin_roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
);

-- --------------------------------------------------------------------------
-- 2. profiles (ERD-E2)
-- --------------------------------------------------------------------------
CREATE TABLE profiles (
    profile_id UUID PRIMARY KEY,
    admin_role_id UUID REFERENCES admin_roles(role_id) ON DELETE SET NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    full_name VARCHAR(101) GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,
    email VARCHAR(254) NOT NULL UNIQUE,
    contact_number VARCHAR(20),
    auth_provider VARCHAR(30) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'Customer',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 3. products (ERD-E3)
-- --------------------------------------------------------------------------
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    product_name VARCHAR(100) NOT NULL UNIQUE,
    product_type VARCHAR(50) NOT NULL,
    description TEXT,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 4. product_templates (ERD-E4)
-- --------------------------------------------------------------------------
CREATE TABLE product_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE REFERENCES products(product_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    template_name VARCHAR(100) NOT NULL,
    model_strategy VARCHAR(20) NOT NULL,
    measurement_unit VARCHAR(10) NOT NULL DEFAULT 'mm',
    base_configuration JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 5. raw_materials (ERD-E17)
-- --------------------------------------------------------------------------
CREATE TABLE raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    finish_type VARCHAR(50) NOT NULL,
    billing_unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    waste_allowance NUMERIC(4,3) NOT NULL DEFAULT 0.000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 6. product_components (ERD-E6)
-- --------------------------------------------------------------------------
CREATE TABLE product_components (
    component_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES product_templates(template_id) ON DELETE CASCADE,
    raw_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    component_key VARCHAR(50) NOT NULL,
    component_name VARCHAR(100) NOT NULL,
    component_type VARCHAR(30) NOT NULL,
    dimension_binding VARCHAR(20) NOT NULL DEFAULT 'FIXED',
    span_ratio NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
    base_quantity NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
    pricing_method VARCHAR(30) NOT NULL DEFAULT 'Included',
    unit_price NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
    pricing_unit VARCHAR(20),
    is_removable BOOLEAN NOT NULL DEFAULT false,
    toggle_property_key VARCHAR(50),
    presentation_category VARCHAR(50) NOT NULL DEFAULT 'Framing',
    glb_file_url TEXT,
    component_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_components_template_key_unique UNIQUE (template_id, component_key)
);

-- --------------------------------------------------------------------------
-- 7. product_parameters (ERD-E5)
-- --------------------------------------------------------------------------
CREATE TABLE product_parameters (
    parameter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES product_templates(template_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    parameter_key VARCHAR(50) NOT NULL,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_type VARCHAR(20) NOT NULL,
    minimum_value NUMERIC(12,4),
    maximum_value NUMERIC(12,4),
    default_value JSONB NOT NULL,
    step_value NUMERIC(12,4),
    unit VARCHAR(20),
    affects_structure BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_parameters_template_key_unique UNIQUE (template_id, parameter_key)
);

-- --------------------------------------------------------------------------
-- 8. structural_rules (ERD-E7)
-- --------------------------------------------------------------------------
CREATE TABLE structural_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES product_templates(template_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    rule_name VARCHAR(120) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    condition_data JSONB NOT NULL,
    action_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT structural_rules_template_priority_name_unique UNIQUE (template_id, priority, rule_name)
);

-- --------------------------------------------------------------------------
-- 9. product_assets (ERD-E8)
-- --------------------------------------------------------------------------
CREATE TABLE product_assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    template_id UUID REFERENCES product_templates(template_id) ON DELETE CASCADE,
    component_id UUID REFERENCES product_components(component_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    asset_type VARCHAR(40) NOT NULL,
    r2_object_key TEXT NOT NULL UNIQUE,
    file_name VARCHAR(180) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    byte_size BIGINT,
    display_order INTEGER NOT NULL DEFAULT 1,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 10. product_variations (ERD-E9)
-- --------------------------------------------------------------------------
CREATE TABLE product_variations (
    variation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    preview_asset_id UUID REFERENCES product_assets(asset_id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    variation_type VARCHAR(50) NOT NULL,
    variation_name VARCHAR(100) NOT NULL,
    additional_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    render_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_variations_product_type_name_unique UNIQUE (product_id, variation_type, variation_name)
);

-- --------------------------------------------------------------------------
-- 11. visualization_snapshots (ERD-E10)
-- --------------------------------------------------------------------------
CREATE TABLE visualization_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    final_image_r2_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 12. product_configurations (ERD-E11)
-- --------------------------------------------------------------------------
CREATE TABLE product_configurations (
    configuration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES visualization_snapshots(snapshot_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    template_id UUID NOT NULL REFERENCES product_templates(template_id) ON DELETE RESTRICT,
    visual_parameter_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    quotation_width NUMERIC(12,4),
    quotation_height NUMERIC(12,4),
    quotation_depth NUMERIC(12,4),
    quotation_measurement_unit VARCHAR(10),
    measurement_source VARCHAR(20) NOT NULL DEFAULT 'Estimated',
    measurement_confirmed BOOLEAN NOT NULL DEFAULT false,
    quantity INTEGER NOT NULL DEFAULT 1,
    estimated_configuration_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 13. configuration_variations (ERD-E12)
-- --------------------------------------------------------------------------
CREATE TABLE configuration_variations (
    configuration_id UUID NOT NULL REFERENCES product_configurations(configuration_id) ON DELETE CASCADE,
    variation_id UUID NOT NULL REFERENCES product_variations(variation_id) ON DELETE RESTRICT,
    additional_price_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (configuration_id, variation_id)
);

-- --------------------------------------------------------------------------
-- 14. quotation_estimates (ERD-E13)
-- --------------------------------------------------------------------------
CREATE TABLE quotation_estimates (
    quotation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL UNIQUE REFERENCES visualization_snapshots(snapshot_id) ON DELETE RESTRICT,
    profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    quotation_number VARCHAR(50) NOT NULL UNIQUE,
    total_estimated_amount NUMERIC(12,2) NOT NULL,
    quotation_document_snapshot JSONB,
    negotiated_amount NUMERIC(12,2),
    negotiated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    negotiated_at TIMESTAMPTZ,
    item_price_overrides JSONB,
    currency CHAR(3) NOT NULL DEFAULT 'PHP',
    quotation_note TEXT,
    pdf_r2_object_key TEXT UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    CONSTRAINT quotation_document_snapshot_object_check CHECK (quotation_document_snapshot IS NULL OR jsonb_typeof(quotation_document_snapshot) = 'object'),
    CONSTRAINT quotation_negotiated_amount_range_check CHECK (negotiated_amount IS NULL OR negotiated_amount BETWEEN 0 AND 9999999999.99),
    CONSTRAINT quotation_negotiation_audit_check CHECK ((negotiated_amount IS NULL AND negotiated_by IS NULL AND negotiated_at IS NULL) OR (negotiated_amount IS NOT NULL AND negotiated_by IS NOT NULL AND negotiated_at IS NOT NULL)),
    CONSTRAINT quotation_item_price_overrides_object_check CHECK (item_price_overrides IS NULL OR jsonb_typeof(item_price_overrides) = 'object')
);

-- --------------------------------------------------------------------------
-- 15. quotation_items (ERD-E14)
-- --------------------------------------------------------------------------
CREATE TABLE quotation_items (
    quotation_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotation_estimates(quotation_id) ON DELETE CASCADE,
    configuration_id UUID REFERENCES product_configurations(configuration_id) ON DELETE SET NULL,
    item_name VARCHAR(150) NOT NULL,
    item_group_name VARCHAR(100) NOT NULL DEFAULT 'Aluminum Framing',
    quantity NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
    unit VARCHAR(20) NOT NULL DEFAULT 'piece',
    unit_price NUMERIC(12,4) NOT NULL,
    estimated_subtotal NUMERIC(12,2) NOT NULL,
    pricing_details JSONB,
    structural_waiver BOOLEAN NOT NULL DEFAULT false,
    item_note TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 16. signed_booking_links (ERD-E15)
-- --------------------------------------------------------------------------
CREATE TABLE signed_booking_links (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    quotation_id UUID NOT NULL UNIQUE REFERENCES quotation_estimates(quotation_id) ON DELETE RESTRICT,
    snapshot_id UUID NOT NULL REFERENCES visualization_snapshots(snapshot_id) ON DELETE RESTRICT,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 17. booking_requests (ERD-E16)
-- --------------------------------------------------------------------------
CREATE TABLE booking_requests (
    booking_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    link_id UUID NOT NULL UNIQUE REFERENCES signed_booking_links(link_id) ON DELETE RESTRICT,
    selected_platform VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
