-- ============================================================================
-- GlassFit Database Schema (DrawSQL / PostgreSQL DDL Export)
-- Project: GlassFit (Web-Based Client-Space Visualization System)
-- Reconciled for DrawSQL Import & Visual ERD Rendering
-- Traceability: ERD-E1 through ERD-E20
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 2. profiles (ERD-E2)
-- --------------------------------------------------------------------------
CREATE TABLE profiles (
    profile_id UUID PRIMARY KEY,
    admin_role_id UUID REFERENCES admin_roles(role_id) ON DELETE SET NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL DEFAULT '',
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stock_length_meters NUMERIC(6,3) DEFAULT 6.000,
    stock_price_rrd NUMERIC(10,2),
    sheet_width_ft NUMERIC(5,2) DEFAULT 4.00,
    sheet_height_ft NUMERIC(5,2) DEFAULT 6.00,
    is_premium_trigger BOOLEAN NOT NULL DEFAULT false,
    pricing_tier VARCHAR(20) NOT NULL DEFAULT 'Standard',
    supported_thicknesses INTEGER[] DEFAULT ARRAY[6, 8, 12]
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
    admin_labor_charge NUMERIC(12,2) DEFAULT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'PHP',
    quotation_note TEXT,
    pdf_r2_object_key TEXT UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quotation_document_snapshot_object_check CHECK (quotation_document_snapshot IS NULL OR jsonb_typeof(quotation_document_snapshot) = 'object'),
    CONSTRAINT quotation_negotiated_amount_range_check CHECK (negotiated_amount IS NULL OR negotiated_amount BETWEEN 0 AND 9999999999.99),
    CONSTRAINT quotation_negotiation_audit_check CHECK ((negotiated_amount IS NULL AND negotiated_by IS NULL AND negotiated_at IS NULL) OR (negotiated_amount IS NOT NULL AND negotiated_by IS NOT NULL AND negotiated_at IS NOT NULL)),
    CONSTRAINT quotation_item_price_overrides_object_check CHECK (item_price_overrides IS NULL OR jsonb_typeof(item_price_overrides) = 'object'),
    CONSTRAINT quotation_admin_labor_charge_range_check CHECK (admin_labor_charge IS NULL OR admin_labor_charge BETWEEN 0.00 AND 9999999999.99)
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
    quotation_id UUID NOT NULL UNIQUE REFERENCES quotation_estimates(quotation_id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES visualization_snapshots(snapshot_id) ON DELETE SET NULL,
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
    link_id UUID NOT NULL UNIQUE REFERENCES signed_booking_links(link_id) ON DELETE CASCADE,
    selected_platform VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 18. staff_invitations (ERD-E19)
-- --------------------------------------------------------------------------
CREATE TABLE staff_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    verification_code VARCHAR(6) NOT NULL,
    role_id UUID NOT NULL REFERENCES admin_roles(role_id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_invitations_status_check CHECK (status IN ('Pending', 'Accepted', 'Expired', 'Revoked')),
    CONSTRAINT staff_invitations_code_check CHECK (verification_code ~ '^[0-9]{6}$')
);

-- --------------------------------------------------------------------------
-- 19. system_preferences (ERD-E18)
-- --------------------------------------------------------------------------
CREATE TABLE system_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key VARCHAR(50) NOT NULL DEFAULT 'GLOBAL_PREFERENCES' UNIQUE,
    business_name VARCHAR(255) NOT NULL DEFAULT 'GlassFit',
    contact_email VARCHAR(255) NOT NULL DEFAULT 'glassfit@gmail.com',
    contact_phone VARCHAR(50) NOT NULL DEFAULT '+63 917 123 4567',
    operating_days_range VARCHAR(100) NOT NULL DEFAULT 'Monday - Saturday',
    operating_hours_range VARCHAR(100) NOT NULL DEFAULT '8:00 AM - 5:00 PM',
    operating_schedules JSONB NOT NULL DEFAULT '[{"id": "default-schedule-1", "start_day": "Monday", "end_day": "Saturday", "start_time": "08:00", "end_time": "17:00"}]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    last_backup_at TIMESTAMPTZ,
    last_backup_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    CONSTRAINT system_preferences_singleton_check CHECK (singleton_key = 'GLOBAL_PREFERENCES')
);

-- --------------------------------------------------------------------------
-- 20. admin_email_change_events (ERD-E20)
-- --------------------------------------------------------------------------
CREATE TABLE admin_email_change_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    target_user_id UUID NOT NULL,
    actor_full_name TEXT NOT NULL,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('Owner', 'Manager', 'Staff')),
    previous_email VARCHAR(254) NOT NULL,
    proposed_email VARCHAR(254) NOT NULL,
    change_mode TEXT NOT NULL CHECK (change_mode IN ('StaffApproval', 'PrivilegedImmediate')),
    status TEXT NOT NULL CHECK (status IN ('Initiated', 'PendingApproval', 'Processing', 'Rejected', 'Cancelled', 'Expired', 'Completed', 'Failed')),
    approval_token_hash CHAR(64) UNIQUE CHECK (approval_token_hash IS NULL OR approval_token_hash ~ '^[0-9a-f]{64}$'),
    approval_expires_at TIMESTAMPTZ,
    delivery_status TEXT NOT NULL DEFAULT 'Pending' CHECK (delivery_status IN ('Pending', 'NotRequired', 'Delivered', 'Partial', 'Failed')),
    approval_deliveries JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(approval_deliveries) = 'array'),
    delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
    processing_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    processing_started_at TIMESTAMPTZ,
    decided_by UUID REFERENCES profiles(profile_id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    last_error TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT admin_email_change_staff_approval_fields CHECK (
        (change_mode = 'StaffApproval' AND approval_token_hash IS NOT NULL AND approval_expires_at IS NOT NULL)
        OR (change_mode = 'PrivilegedImmediate' AND approval_token_hash IS NULL AND approval_expires_at IS NULL)
    )
);
