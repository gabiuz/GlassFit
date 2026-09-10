# Entity Relationship Document (ERD)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Date:** September 9, 2026  
**Version:** 1.0 (Capstone Production Release)  
**Owner:** Gabriel Nicolai D. Pelagio (Database & Infrastructure Lead) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Locked  
**Last reconciled:** September 9, 2026 (Reconciled with 16-table Supabase schema in supabase/migrations/001_backend_core.sql)  
**SDD:** docs/sdd-glassfit.md

---

## 1. Storage Architecture & Partitioning

**Primary persistence engine:**
PostgreSQL 16 managed on Supabase with JSONB procedural storage, stored generated columns, strict domain constraints, custom validation triggers, and native Row-Level Security (RLS).

**Secondary or cache layer:**
Next.js Data Cache and Incremental Static Regeneration (ISR) caching active product catalog definitions and 3D preview metadata. Client-side memory caching for parsed GLTF/GLB models and transparent layer canvas renders.

**Tenant isolation strategy:**
Row-Level Security (RLS) applied across all 16 database tables:
- Public/Anonymous: Read-only access restricted strictly to catalog products and assets where `status = 'Active'`.
- Customer Layer: Strict record isolation using `profile_id = auth.uid()` on `visualization_snapshots`, `product_configurations`, `quotation_estimates`, `signed_booking_links`, and `booking_requests`.
- Administrative Layer: Back-office staff operations guarded by security definer function `public.is_admin(auth.uid())` verifying active assignment in `admin_roles`.

---

## 2. Entity Definitions & Schema Catalog

### 2.1 Administrative & User Identity

#### Entity: AdminRoles (`ERD-E1`)
- Table Name: `public.admin_roles`
- Purpose: Stores role hierarchies (Owner, Manager, Staff) and granular permission JSON definitions.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `role_id` | UUID | No | Primary Key | `gen_random_uuid()` | Immutable unique role identifier |
| `role_name` | VARCHAR(50) | No | Unique | None | Unique name (Owner, Manager, Staff) |
| `description` | TEXT | Yes | None | None | Descriptive role summary |
| `permissions` | JSONB | No | None | `'{}'::jsonb` | Must conform to valid JSON object |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: Profiles (`ERD-E2`)
- Table Name: `public.profiles`
- Purpose: Extends `auth.users` with customer and administrative staff metadata.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `profile_id` | UUID | No | Primary Key | None | References `auth.users(id)` ON DELETE CASCADE |
| `admin_role_id` | UUID | Yes | Foreign Key | None | References `admin_roles(role_id)` ON DELETE SET NULL |
| `first_name` | VARCHAR(50) | No | None | None | Non-blank trimmed string |
| `last_name` | VARCHAR(50) | No | None | None | Non-blank trimmed string |
| `full_name` | VARCHAR(101)| No | Generated | `trim(first_name || ' ' || last_name)` | Stored generated column |
| `email` | VARCHAR(254)| No | Unique | None | Valid unique email address |
| `contact_number` | VARCHAR(20) | Yes | None | None | Philippine contact format (+63) |
| `auth_provider` | VARCHAR(30) | No | None | None | In set: `'Email'`, `'Google'`, `'Other'` |
| `account_type` | VARCHAR(20) | No | None | `'Customer'` | In set: `'Customer'`, `'Admin'` |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'`, `'Suspended'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

---

### 2.2 Product Catalog & Parametric Rule Entities

#### Entity: Products (`ERD-E3`)
- Table Name: `public.products`
- Purpose: High-level catalog product entity defining classification and base pricing.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `product_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique product identifier |
| `created_by` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `product_name` | VARCHAR(100)| No | Unique | None | Unique descriptive product name |
| `product_type` | VARCHAR(50) | No | None | None | In: `'Window'`, `'Door'`, `'Partition'`, `'Cabinet'`, `'Enclosure'`, `'Railing'`, `'Other'` |
| `description` | TEXT | Yes | None | None | Detailed specifications |
| `base_price` | NUMERIC(12,2)| No | None | `0.00` | Non-negative numeric value |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: ProductTemplates (`ERD-E4`)
- Table Name: `public.product_templates`
- Purpose: Dictates whether a product is a static model or dynamically assembled via parametric rules.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `template_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique template identifier |
| `product_id` | UUID | No | Foreign Key, Unique | None | References `products(product_id)` ON DELETE CASCADE |
| `created_by` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `template_name`| VARCHAR(100)| No | None | None | Descriptive template identifier |
| `model_strategy`| VARCHAR(20) | No | None | None | In set: `'Fixed'`, `'Parametric'` |
| `measurement_unit`| VARCHAR(10)| No | None | `'mm'` | In set: `'mm'`, `'cm'`, `'m'` |
| `base_configuration`| JSONB | Yes | None | None | Valid JSON object with default attributes |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: ProductParameters (`ERD-E5`)
- Table Name: `public.product_parameters`
- Purpose: Configurable dimensions and options controlling parametric geometry.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `parameter_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique parameter identifier |
| `template_id` | UUID | No | Foreign Key | None | References `product_templates(template_id)` ON DELETE CASCADE |
| `created_by` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `parameter_key`| VARCHAR(50) | No | None | None | Unique per template (`template_id`, `parameter_key`) |
| `parameter_name`| VARCHAR(100)| No | None | None | Human-readable label (e.g., Overall Width) |
| `parameter_type`| VARCHAR(20) | No | None | None | In set: `'Number'`, `'Integer'`, `'Boolean'`, `'Select'` |
| `minimum_value`| NUMERIC(12,4)| Yes | None | None | Minimum range constraint |
| `maximum_value`| NUMERIC(12,4)| Yes | None | None | Maximum range constraint |
| `default_value`| JSONB | No | None | None | Initial state value |
| `step_value` | NUMERIC(12,4)| Yes | None | None | Increment step; positive value |
| `unit` | VARCHAR(20) | Yes | None | None | Unit string (e.g., mm, count) |
| `affects_structure`| BOOLEAN | No | None | `true` | Indicates structural rebuild trigger |
| `display_order`| INTEGER | No | None | `1` | Ordering index >= 1 |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: ProductComponents (`ERD-E6`)
- Table Name: `public.product_components`
- Purpose: Modular geometric parts (outer frame, mullion, glass pane) assembled in parametric products and bound to physical raw materials.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `component_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique component identifier |
| `template_id` | UUID | No | Foreign Key | None | References `product_templates(template_id)` ON DELETE CASCADE |
| `raw_material_id` | UUID | Yes | Foreign Key | None | References `raw_materials(id)` ON DELETE SET NULL |
| `created_by` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `component_key`| VARCHAR(50) | No | None | None | Unique per template (`template_id`, `component_key`) |
| `component_name`| VARCHAR(100)| No | None | None | Human-readable part name |
| `component_type`| VARCHAR(30) | No | None | None | In: `'Procedural'`, `'Model'`, `'Glass'`, `'Frame'`, `'Panel'`, `'Hardware'`, `'Other'` |
| `dimension_binding`| VARCHAR(20)| No | None | `'FIXED'` | In set: `'WIDTH'`, `'HEIGHT'`, `'AREA'`, `'FIXED'` |
| `span_ratio` | NUMERIC(5,4)| No | None | `1.0000` | Range: `0.0000` to `10.0000` |
| `base_quantity`| NUMERIC(12,4)| No | None | `1.0000` | Non-negative quantity |
| `pricing_method`| VARCHAR(30)| No | None | `'Included'` | In: `'Included'`, `'Per Piece'`, `'Per Length'`, `'Per Area'`, `'Fixed'`, `'Other'` |
| `unit_price` | NUMERIC(12,4)| No | None | `0.0000` | Non-negative unit cost |
| `pricing_unit` | VARCHAR(20) | Yes | None | None | e.g., mm, sq.m, piece |
| `is_removable` | BOOLEAN | No | None | `false` | Indicates whether part can be omitted by user |
| `toggle_property_key`| VARCHAR(50)| Yes | None | None | Property toggle name (e.g., `has_sill`) |
| `presentation_category`| VARCHAR(50)| No | None | `'Framing'` | In set: `'Framing'`, `'Glazing'`, `'Hardware'`, `'Consumable'`, `'Other'` |
| `glb_file_url` | TEXT | Yes | None | None | Object storage URL for individual 3D part mesh |
| `component_data`| JSONB | Yes | None | None | Procedural dimensions or GLB transforms |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: StructuralRules (`ERD-E7`)
- Table Name: `public.structural_rules`
- Purpose: Conditional logic for structural regeneration and Hybrid Guardrails (e.g., width >= 2400mm enforces 3-panel split or waiver prompt).

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `rule_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique rule identifier |
| `template_id` | UUID | No | Foreign Key | None | References `product_templates(template_id)` ON DELETE CASCADE |
| `created_by` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `rule_name` | VARCHAR(120)| No | None | None | Unique per template priority (`template_id`, `priority`, `rule_name`) |
| `priority` | INTEGER | No | None | `1` | Evaluation precedence >= 1 |
| `condition_data`| JSONB | No | None | None | JSON logic expression object (`parameter`, `operator`, `value_mm`) |
| `action_data` | JSONB | No | None | None | Mutation action payload (`enforce_panel_count`, `ui_prompt`, `mutations`) |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: ProductAssets (`ERD-E8`)
- Table Name: `public.product_assets`
- Purpose: Stores object storage keys for 3D models (GLB), textures, and 2D catalog renders.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `asset_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique asset identifier |
| `product_id` | UUID | No | Foreign Key | None | References `products(product_id)` ON DELETE CASCADE |
| `template_id` | UUID | Yes | Foreign Key | None | References `product_templates(template_id)` ON DELETE CASCADE |
| `component_id` | UUID | Yes | Foreign Key | None | References `product_components(component_id)` ON DELETE CASCADE |
| `created_by` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `asset_type` | VARCHAR(40) | No | None | None | In: `'Thumbnail'`, `'Catalog Image'`, `'Catalog 3D Preview'`, `'Whole Model'`, `'Component Model'`, `'Texture'`, `'Material Map'`, `'Variation Preview'`, `'Other'` |
| `r2_object_key`| TEXT | No | Unique | None | S3/R2 storage key |
| `file_name` | VARCHAR(180)| No | None | None | Original uploaded file name |
| `mime_type` | VARCHAR(100)| No | None | None | e.g., model/gltf-binary, image/webp |
| `byte_size` | BIGINT | Yes | None | None | Non-negative byte size |
| `display_order`| INTEGER | No | None | `1` | Ordering index >= 1 |
| `is_primary` | BOOLEAN | No | None | `false` | Unique per product and asset type when true |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: ProductVariations (`ERD-E9`)
- Table Name: `public.product_variations`
- Purpose: Aesthetic options (Frame Color: Anodized Black, Powder White; Glass Tint: Clear, Frosted, Dark Bronze).

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `variation_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique variation identifier |
| `product_id` | UUID | No | Foreign Key | None | References `products(product_id)` ON DELETE CASCADE |
| `preview_asset_id`| UUID | Yes | Foreign Key | None | References `product_assets(asset_id)` ON DELETE SET NULL |
| `created_by` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `variation_type`| VARCHAR(50) | No | None | None | In: `'Color'`, `'Material'`, `'Finish'`, `'Glass Type'`, `'Frame Type'`, `'Design'`, `'Other'` |
| `variation_name`| VARCHAR(100)| No | None | None | Unique per product type (`product_id`, `variation_type`, `variation_name`) |
| `additional_price`| NUMERIC(12,2)| No | None | `0.00` | Non-negative price delta |
| `render_data` | JSONB | Yes | None | None | Material properties (roughness, metalness, hex) |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Inactive'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

---

### 2.3 Visualization, Quotation & Booking Entities

#### Entity: VisualizationSnapshots (`ERD-E10`)
- Table Name: `public.visualization_snapshots`
- Purpose: Permanent composed consultation simulation image saved to Cloudflare R2.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `snapshot_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique snapshot identifier |
| `profile_id` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `final_image_r2_key`| TEXT | No | Unique | None | Unique R2 storage object key |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |

#### Entity: ProductConfigurations (`ERD-E11`)
- Table Name: `public.product_configurations`
- Purpose: Individual product instance placed within a snapshot with verified quotation dimensions.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `configuration_id`| UUID | No | Primary Key | `gen_random_uuid()` | Unique configuration identifier |
| `snapshot_id` | UUID | No | Foreign Key | None | References `visualization_snapshots(snapshot_id)` ON DELETE CASCADE |
| `product_id` | UUID | No | Foreign Key | None | References `products(product_id)` ON DELETE RESTRICT |
| `template_id` | UUID | No | Foreign Key | None | References `product_templates(template_id)` ON DELETE RESTRICT |
| `visual_parameter_values`| JSONB | No | None | `'{}'::jsonb` | Canvas transform and visual scale state |
| `quotation_width`| NUMERIC(12,4)| Yes | None | None | Verified real-world width >= 0 |
| `quotation_height`| NUMERIC(12,4)| Yes | None | None | Verified real-world height >= 0 |
| `quotation_depth`| NUMERIC(12,4)| Yes | None | None | Verified real-world depth >= 0 |
| `quotation_measurement_unit`| VARCHAR(10)| Yes | None | None | In set: `'mm'`, `'cm'`, `'m'` |
| `measurement_source`| VARCHAR(20)| No | None | `'Estimated'` | In set: `'Estimated'`, `'Manual'` |
| `measurement_confirmed`| BOOLEAN | No | None | `false` | Confirmation flag from client modal |
| `quantity` | INTEGER | No | None | `1` | Integer quantity >= 1 |
| `estimated_configuration_price`| NUMERIC(12,2)| No | None | `0.00` | Subtotal price >= 0 |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: ConfigurationVariations (`ERD-E12`)
- Table Name: `public.configuration_variations`
- Purpose: Join table associating chosen material and color variations to a specific placed product.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `configuration_id`| UUID | No | Primary Key, FK | None | References `product_configurations(configuration_id)` ON DELETE CASCADE |
| `variation_id` | UUID | No | Primary Key, FK | None | References `product_variations(variation_id)` ON DELETE RESTRICT |
| `additional_price_snapshot`| NUMERIC(12,2)| No | None | `0.00` | Price delta at time of configuration |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |

#### Entity: QuotationEstimates (`ERD-E13`)
- Table Name: `public.quotation_estimates`
- Purpose: Aggregate budgetary quotation record associated with a visual snapshot.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `quotation_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique quotation identifier |
| `snapshot_id` | UUID | No | Foreign Key, Unique | None | References `visualization_snapshots(snapshot_id)` ON DELETE RESTRICT |
| `profile_id` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `quotation_number`| VARCHAR(50)| No | Unique | None | Human-readable identifier (e.g., Q-20260909-001) |
| `total_estimated_amount`| NUMERIC(12,2)| No | None | None | Total price >= 0 |
| `currency` | CHAR(3) | No | None | `'PHP'` | Valid 3-letter currency code |
| `quotation_note`| TEXT | Yes | None | None | Special notes or fabricator disclaimers |
| `pdf_r2_object_key`| TEXT | Yes | Unique | None | Storage key for generated PDF document |
| `status` | VARCHAR(20) | No | None | `'Draft'` | In set: `'Draft'`, `'Generated'`, `'Expired'`, `'Cancelled'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: QuotationItems (`ERD-E14`)
- Table Name: `public.quotation_items`
- Purpose: Grouped summary line items within a quotation estimate (Aluminum Framing, Glass Infill, Hardware & Accessories, Labor & Installation).

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `quotation_item_id`| UUID | No | Primary Key | `gen_random_uuid()` | Unique item identifier |
| `quotation_id` | UUID | No | Foreign Key | None | References `quotation_estimates(quotation_id)` ON DELETE CASCADE |
| `configuration_id`| UUID | Yes | Foreign Key | None | References `product_configurations(configuration_id)` ON DELETE SET NULL |
| `item_name` | VARCHAR(150)| No | None | None | Line item title |
| `item_group_name`| VARCHAR(100)| No | None | `'Aluminum Framing'` | In set: `'Aluminum Framing'`, `'Glass Infill'`, `'Hardware & Accessories'`, `'Labor & Installation'`, `'Miscellaneous'` |
| `quantity` | NUMERIC(12,4)| No | None | `1.0000` | Non-negative quantity |
| `unit` | VARCHAR(20) | No | None | `'piece'` | Unit descriptor |
| `unit_price` | NUMERIC(12,4)| No | None | None | Non-negative unit rate |
| `estimated_subtotal`| NUMERIC(12,2)| No | None | None | Non-negative subtotal |
| `pricing_details`| JSONB | No | None | `'{}'::jsonb` | Frozen formula calculation metadata preserving historical prices |
| `structural_waiver`| BOOLEAN | No | None | `false` | Acknowledged structural span waiver flag |
| `item_note` | TEXT | Yes | None | None | Additional notes |
| `display_order`| INTEGER | No | None | `1` | Ordering index >= 1 |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |

#### Entity: SignedBookingLinks (`ERD-E15`)
- Table Name: `public.signed_booking_links`
- Purpose: Secure tokenized URL reference allowing frictionless consultation sharing.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `link_id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique link identifier |
| `profile_id` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `quotation_id` | UUID | No | Foreign Key, Unique | None | References `quotation_estimates(quotation_id)` ON DELETE RESTRICT |
| `snapshot_id` | UUID | No | Foreign Key | None | References `visualization_snapshots(snapshot_id)` ON DELETE RESTRICT |
| `token_hash` | CHAR(64) | No | Unique | None | 64-character hexadecimal SHA-256 string |
| `expires_at` | TIMESTAMPTZ | No | None | None | Must be greater than creation timestamp |
| `status` | VARCHAR(20) | No | None | `'Active'` | In set: `'Active'`, `'Expired'`, `'Revoked'`, `'Used'` |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |

#### Entity: BookingRequests (`ERD-E16`)
- Table Name: `public.booking_requests`
- Purpose: Logs customer handoff to Facebook Messenger or Viber.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `booking_request_id`| UUID | No | Primary Key | `gen_random_uuid()` | Unique booking identifier |
| `profile_id` | UUID | No | Foreign Key | None | References `profiles(profile_id)` ON DELETE RESTRICT |
| `link_id` | UUID | No | Foreign Key, Unique | None | References `signed_booking_links(link_id)` ON DELETE RESTRICT |
| `selected_platform`| VARCHAR(20)| No | None | None | In set: `'Messenger'`, `'Viber'` |
| `status` | VARCHAR(20) | No | None | `'Pending'` | In set: `'Pending'`, `'Ongoing'`, `'Done'`, `'Cancelled'` |
| `updated_by` | UUID | Yes | Foreign Key | None | References `profiles(profile_id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

#### Entity: RawMaterials (`ERD-E17`)
- Table Name: `public.raw_materials`
- Purpose: Central catalog managing physical inventory unit rates, finish variations, and waste scrap allowances.

| Attribute Name | Data Type | Nullable? | Key Type | Default Value | Validation Constraints |
|---|---|---|---|---|---|
| `id` | UUID | No | Primary Key | `gen_random_uuid()` | Unique raw material identifier |
| `material_code` | VARCHAR(50) | No | Unique | None | Unique material code (e.g. `mat_al_798_head_anlk`) |
| `description` | VARCHAR(255)| No | None | None | Descriptive profile or item name |
| `category` | VARCHAR(50) | No | None | None | In set: `'Aluminum'`, `'Glass'`, `'Hardware'`, `'Consumable'` |
| `finish_type` | VARCHAR(50) | No | None | None | In set: `'Mill'`, `'Anodized'`, `'Analok'`, `'PowderCoatedWhite'`, `'PowderCoatedBlack'`, `'Bronze'`, `'Clear'`, `'None'` |
| `billing_unit` | VARCHAR(20) | No | None | None | In set: `'m'`, `'sqm'`, `'pc'`, `'set'`, `'tube'`, `'lot'` |
| `unit_price` | NUMERIC(10,2)| No | None | None | Unit price >= 0 |
| `waste_allowance`| NUMERIC(4,3)| No | None | `0.000` | Allowance ratio between 0.000 and 1.000 (e.g. 0.120 for 12%) |
| `is_active` | BOOLEAN | No | None | `true` | Active catalog status flag |
| `created_at` | TIMESTAMPTZ | No | None | `now()` | System creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | None | `now()` | Maintained via database trigger |

---

## 3. Relationship Matrix & Referential Cardinality

| Rel ID | Source Entity | Cardinality | Target Entity | Foreign Key Column | On Delete Action | Enforced By |
|---|---|---|---|---|---|---|
| ERD-REL1 | `ERD-E1` (AdminRoles) | 1 to Many | `ERD-E2` (Profiles) | `profiles.admin_role_id` | SET NULL | DB Foreign Key |
| ERD-REL2 | `ERD-E2` (Profiles) | 1 to Many | `ERD-E3` (Products) | `products.created_by` | RESTRICT | DB Foreign Key |
| ERD-REL3 | `ERD-E3` (Products) | 1 to 1 | `ERD-E4` (ProductTemplates) | `product_templates.product_id` | CASCADE | DB Unique FK |
| ERD-REL4 | `ERD-E4` (ProductTemplates)| 1 to Many | `ERD-E5` (ProductParameters)| `product_parameters.template_id`| CASCADE | DB Foreign Key |
| ERD-REL5 | `ERD-E4` (ProductTemplates)| 1 to Many | `ERD-E6` (ProductComponents)| `product_components.template_id`| CASCADE | DB Foreign Key |
| ERD-REL6 | `ERD-E4` (ProductTemplates)| 1 to Many | `ERD-E7` (StructuralRules) | `structural_rules.template_id` | CASCADE | DB Foreign Key |
| ERD-REL7 | `ERD-E3` (Products) | 1 to Many | `ERD-E8` (ProductAssets) | `product_assets.product_id` | CASCADE | DB Foreign Key |
| ERD-REL8 | `ERD-E3` (Products) | 1 to Many | `ERD-E9` (ProductVariations)| `product_variations.product_id` | CASCADE | DB Foreign Key |
| ERD-REL9 | `ERD-E2` (Profiles) | 1 to Many | `ERD-E10` (Snapshots) | `visualization_snapshots.profile_id`| SET NULL | DB Foreign Key |
| ERD-REL10| `ERD-E10` (Snapshots) | 1 to Many | `ERD-E11` (Configurations)| `product_configurations.snapshot_id`| CASCADE | DB Foreign Key |
| ERD-REL11| `ERD-E11` (Configurations)| Many to Many| `ERD-E9` (Variations) | `configuration_variations.variation_id`| RESTRICT | Join Table FK |
| ERD-REL12| `ERD-E10` (Snapshots) | 1 to 1 | `ERD-E13` (Quotations) | `quotation_estimates.snapshot_id`| RESTRICT | DB Unique FK |
| ERD-REL13| `ERD-E13` (Quotations) | 1 to Many | `ERD-E14` (QuotationItems)| `quotation_items.quotation_id` | CASCADE | DB Foreign Key |
| ERD-REL14| `ERD-E13` (Quotations) | 1 to 1 | `ERD-E15` (BookingLinks) | `signed_booking_links.quotation_id`| RESTRICT | DB Unique FK |
| ERD-REL15| `ERD-E15` (BookingLinks) | 1 to 1 | `ERD-E16` (BookingRequests)| `booking_requests.link_id` | RESTRICT | DB Unique FK |
| ERD-REL16| `ERD-E17` (RawMaterials) | 1 to Many | `ERD-E6` (ProductComponents)| `product_components.raw_material_id`| SET NULL | DB Foreign Key |

---

## 4. Indexing Strategy & Query Optimization

| Index Identifier | Target Table | Target Columns | Index Type | Optimization Rationale |
|---|---|---|---|---|
| `idx_products_status_type` | `products` | `status`, `product_type` | B-Tree | Accelerates public catalog filtering by product category |
| `idx_product_parameters_template_order` | `product_parameters` | `template_id`, `display_order` | B-Tree | Optimizes real-time retrieval of parametric UI controls |
| `idx_structural_rules_template_priority` | `structural_rules` | `template_id`, `priority` | B-Tree | Ensures high-speed sequential rule evaluation in Three.js |
| `idx_product_assets_product_type` | `product_assets` | `product_id`, `asset_type` | B-Tree | Fast lookup of primary GLB models and catalog thumbnails |
| `idx_product_assets_one_primary_per_type`| `product_assets` | `product_id`, `asset_type` (partial) | Unique B-Tree | Enforces single primary active asset constraint per type |
| `idx_visualization_snapshots_profile` | `visualization_snapshots` | `profile_id`, `created_at DESC` | B-Tree | Accelerates customer consultation history queries |
| `idx_product_configurations_snapshot` | `product_configurations` | `snapshot_id` | B-Tree | Rapid retrieval of overlay metadata for compositing |
| `idx_quotation_estimates_profile_status`| `quotation_estimates` | `profile_id`, `status` | B-Tree | Speeds up user dashboard quote queries |
| `idx_signed_booking_links_token` | `signed_booking_links` | `token_hash` | Hash / Unique | Instant resolution of external Messenger / Viber incoming links |
| `idx_booking_requests_status_platform` | `booking_requests` | `status`, `selected_platform` | B-Tree | Powers administrative consultation triage queue |
| `raw_materials_category_idx` | `raw_materials` | `category` | B-Tree | Fast filtering of raw materials by category |
| `raw_materials_finish_type_idx` | `raw_materials` | `finish_type` | B-Tree | Fast lookup of raw materials by profile finish |
| `raw_materials_active_idx` | `raw_materials` | `is_active` | B-Tree | Accelerates active raw material selection for catalog |
| `product_components_raw_material_idx` | `product_components` | `raw_material_id` | B-Tree | Accelerates relational joins between components and raw materials |
| `quotation_items_group_idx` | `quotation_items` | `quotation_id`, `item_group_name` | B-Tree | Speeds up grouped 4-item BOM queries |

---

## 5. Lifecycle Management, Retention & Data Privacy

- Transient Space Session Disposal: Temporary uploaded images, binary YOLOv8 segmentation masks, and Depth Anything tensors stored in the FastAPI server filesystem are automatically purged after 120 minutes via `cleanup_expired_sessions()`.
- Customer Snapshot Persistence: Permanent storage in Cloudflare R2 and `visualization_snapshots` occurs exclusively when the user actively finalizes their simulation.
- Administrative Soft Deletion: Products, templates, parameters, and variations utilize logical soft deletion via `status = 'Inactive'`, preserving referential integrity for historical quotations and past job orders.
- Signed Link Expiration: Signed booking references are initialized with an immutable 7-day expiration timestamp (`expires_at`). Links accessed post-expiration return an expired consultation notice requiring reactivation.
- Data Privacy Protection: In strict compliance with the Philippine Data Privacy Act of 2012 (RA 10173), customer phone numbers and names are never shared with third parties or exposed through unauthenticated endpoints.

---

## Self-Check

- [x] Storage engines and tenancy partitioning strategy are clearly defined
- [x] Every entity has an assigned ERD-E# identifier with column types and nullability constraints
- [x] Primary keys, foreign keys, and default values are explicitly specified
- [x] Cardinality matrix documents relationships and referential deletion actions
- [x] Performance indexes are mapped to query optimization needs
- [x] Soft deletion, lifecycle retention, and PII protection controls are established
- [x] No ASCII entity relationship diagrams inside code blocks; normalized tables used
- [x] AGENTS hard bans applied; VOICE polish pass completed without em-dashes
