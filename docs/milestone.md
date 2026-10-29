# GlassFit Implementation Milestones: Parametric Pricing Engine, Structural Guardrails, and Part Inspector

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Master Implementation Roadmap and Milestone Verification Specification  
**Version:** 1.0.0 (Capstone Production Roadmap)  
**Date:** October 1, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Active  
**Upstream Specifications:** `docs/pricing.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/erd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`, `docs/index.md`  

---

## 1. Executive Summary & Problem Context

In the current GlassFit administrative setup (`/admin/products/[id]/setup`), uploading a product captures only a static `base_price` (NUMERIC) and basic dimensional parameters. When configuring customized products in the visualization canvas or measurement modal, the system lacks:
1. **Mathematical Bill-of-Materials (BOM) Formula:** No calculation logic exists for scaling dimensional horizontal/vertical framing members (1D), surface glass infill (2D), static hardware (O(1)), cut-off scrap allowances (12% aluminum, 10% glass), fabrication labor floor (`max(PHP 750.00, 0.25 * Materials)`), and contractor gross margin (25%).
2. **Physical & Structural Guardrails:** No automated verification of glass dead load (Universal 2.5 rule), roller weight capacities (Series 798 40kg sash limit), interlocker wind deflection (NSCP 2015 Section 207), or aspect ratio crabbing/racking limits. When a customer expands aperture width past 2400mm, the system does not enforce multi-panel transitions or record structural waivers.
3. **Admin Part Inspector & Real-Time Feedback:** Uploaded `.glb` meshes in Step 4 are not bound to physical raw materials, dimension drivers (`Width`, `Height`, `Area`, `Fixed`), span ratios (`1.0x`, `0.5x`, `0.33x`), or removable flags (`is_removable`, `toggle_property_key: has_sill`). Administrators lack a live calculation sandbox to test price responses before publishing products to the catalog.

This milestone document provides the sequential engineering blueprint to implement the entire specification defined in `docs/pricing.md`, reconcile all master documentation in `docs/`, and deliver production-grade parametric estimation for Philippine SME fabricators.

### Mandatory UI Component Reuse & Styling Consistency Directives
When implementing or modifying any user interface within these milestones (such as admin panels, drawers, modals, tables, sliders, cards, or buttons):
1. **Strict Component Reuse:** Always reuse existing presentation components located in `src/components/` and existing feature components in `src/features/`.
2. **Design Token Parity:** Strictly adhere to the existing design system styles and Tailwind CSS tokens defined in `src/app/globals.css` and `docs/dsd-glassfit.md` (e.g., slate surfaces, sky blue and teal accents, rounded corner radii `rounded-[16px]`, `rounded-[20px]`, `rounded-[25px]`, drop shadows, and typography scales).
3. **Zero Alien UI Libraries or Ad-Hoc Styling:** Do not introduce foreign component libraries, conflicting color palettes, or isolated ad-hoc styling hacks. All UI changes must visually and structurally feel native to the existing GlassFit repository (per `BAN-UI-09`).

---

## 2. Milestone Overview & Sequencing Matrix

| Milestone ID | Milestone Title | Primary Layer | Core Deliverables | Target Timeline | Traceability Codes |
|---|---|---|---|---|---|
| MS-1 | Database Schema & Seed Migration | PostgreSQL / Supabase | `raw_materials` table, enhanced `product_components`, structural rule mutations, `quotation_items` grouped line items | Sprint 1 (Days 1-2) | `ERD-E6`, `ERD-E7`, `ERD-E14`, `ERD-E17`, `BAN-MIGR-06` |
| MS-2 | Central Raw Materials Master Catalog | Admin Backend & UI | Materials management interface (`/admin/materials`), CRUD actions, finish variations, unit rates, waste allowances | Sprint 1 (Days 3-4) | `PRD-F14`, `PRD-F19`, `SDD-C9`, `ERD-E17` |
| MS-3 | Admin Part Inspector & Component Mapping | Admin Step 4 UI | Split-screen Three.js viewport, Part Inspector Drawer, dimension drivers, span ratios, removable sill toggle, filename auto-detection | Sprint 2 (Days 5-7) | `PRD-F14`, `SDD-C9`, `DSD-UI10`, `ERD-E6` |
| MS-4 | Interactive Test-Drive Simulator & Preset Duplication | Admin Step 6 & Catalog | Live calculation sandbox, dimensional sliders, sill switch, real-time BOM preview, one-click preset duplication | Sprint 2 (Days 8-9) | `PRD-F14`, `PRD-F19`, `SDD-C9`, `DSD-UI10` |
| MS-5 | Parametric BOM Pricing Engine Core | Domain Logic / Shared | Decoupled 1D/2D/O(1) calculation library, scrap factors, Option A labor floor, 25% margin, frozen quotation snapshot generator | Sprint 3 (Days 10-11) | `PRD-F10`, `SDD-C7`, `ERD-E14`, `BRD-M5` |
| MS-6 | Engineering Guardrails & Hybrid Confirmation Modal | Visualization Client | Dead-load monitor, roller capacity validator, aspect ratio checks, 2400mm width trigger, Behavior B prompt modal (3-panel switch vs waiver) | Sprint 3 (Days 12-13) | `PRD-F5`, `PRD-F10`, `SDD-C4`, `SDD-C5`, `DSD-UI7` |
| MS-7 | Quotation Summary & Consultation PDF Handoff | Customer UI & PDF Engine | Interactive estimate breakdown, sill removal deduction, and simplified PDF consultation document with one final price per product item and structural waiver disclaimers. IMP-MS17 supersedes customer-facing component-cost disclosure. | Sprint 4 (Days 14-15) | `PRD-F10`, `PRD-F11`, `PRD-F13`, `SDD-C7`, `SDD-C8` |
| MS-8 | Automated Test Suites & Numerical Validation | QA / Testing | Vitest unit tests verifying scenarios 1 through 4 against benchmark data, Playwright E2E tests for guardrail modal and admin wizard | Sprint 4 (Days 16-17) | `QAD-TC5`, `QAD-TC10`, `QAD-TC15` to `QAD-TC18` |
| MS-9 | Master Documentation & Governance Reconciliation | Specifications / Docs Hub | Reconcile all 8 existing documentation files in `docs/` with `pricing.md` and `milestone.md` without em-dashes | Sprint 4 (Day 18) | `INDEX`, `BRD`, `PRD`, `SDD`, `DSD`, `ERD`, `QAD`, `BUILD` |
| MS-10 | Admin Product Setup Wizard State & Component Persistence | Admin UI & State Layer | Bidirectional state synchronization, tab transition auto-refresh from DB, zero component loss between steps, seamless UX | Sprint 5 (Days 19-20) | `PRD-F14`, `SDD-C9`, `DSD-UI10`, `ERD-E4`, `ERD-E6`, `QAD-TC19` |
| MS-35 | Multi-Format Space Image Ingestion | Visualization Client / FastAPI CV | Static WebP and HEIC/HEIF upload acceptance, browser-safe preview fallback, deterministic format resolution, server-side HEIF decoding, OpenCV normalization, and automated regression coverage | Maintenance Release | `PRD-F3`, `PRD-F4`, `PRD-F7`, `SDD-C2`, `SDD-C3`, `DSD-UI3`, `QAD-TC3`, `QAD-TC4`, `QAD-TC50` |
| MS-36 | Admin Product Type and Status Filters | Admin Products UI | Interactive product type and lifecycle status filters composed with existing search, synchronized result count, no-match reset, and keyboard-operable controls | Maintenance Release | `PRD-F14`, `SDD-C9`, `DSD-UI14`, `ERD-E3`, `QAD-TC51` |
| MS-37 | Mobile Visualization Workspace Optimization | Visualization Client | Compact full-viewport editor, nested-safe scroll isolation, portrait guidance, responsive HUD, and thumb-safe four-point controls | Maintenance Release | `BRD-M4`, `PRD-F6`, `SDD-C5`, `DSD-UI4`, `DSD-UI15`, `QAD-TC52` |
| MS-38 | Quotation Preview and Browser-Saved PDF Reliability | Quotation Domain / Print Presentation | Evidence-gated Page 1 repair, canonical specification isolation, bounded print fragmentation, numeric wrapping protection, and cross-browser PDF verification | Maintenance Release | `BRD-M3`, `BRD-M5`, `PRD-F10`, `PRD-F11`, `SDD-C7`, `DSD-UI16`, `ERD-E13`, `ERD-E14`, `QAD-TC53` |
| MS-39 | Discrete Yaw and Pitch Degree Stepper Controls | Visualization Client | Accessible single-degree yaw and pitch controls with boundary clamping and slider synchronization | Maintenance Release | `BRD-M4`, `PRD-F6`, `SDD-C5`, `DSD-UI4`, `DSD-UI15`, `QAD-TC54` |
| MS-40 | Neutral Orientation After Perspective Fit | Visualization Client | Reset yaw and pitch to zero on fit confirmation while preserving corner-based dimension estimation and later manual adjustments | Maintenance Release, after MS-39 | `BRD-M4`, `PRD-F6`, `SDD-C5`, `DSD-UI4`, `QAD-TC55` |
| MS-44 | Seamless Cross-Product Workspace Switching | Visualization Client | Stage target definitions and models before committing an in-place product switch | Maintenance Release | `BRD-M2`, `BRD-M4`, `PRD-F6`, `SDD-C5`, `DSD-UI4`, `QAD-TC59` |
| MS-47 | Interactive Fiducial Pin Fallback and Precision Dimension Grounding | Visualization Client | 4-point paper fiducial pin fallback modal, direct coplanar dimension grounding, and calibrated HUD badge | Maintenance Release | `BRD-M1`, `BRD-M5`, `PRD-F6`, `PRD-F10`, `SDD-C5`, `SDD-C7`, `QAD-TC62` |
| MS-48 | Autonomous Multi-Standard Paper Fiducial Detection and Resilient Scale Engine | Computer Vision Service | Multi-standard paper aspect ratio matching, orientation normalization, and adaptive edge closing | Maintenance Release | `BRD-M1`, `BRD-M6`, `PRD-F4`, `SDD-C3`, `QAD-TC63` |
| MS-49 | Session-Permanent Calibration State and Fallback Pinning Lifecycle | Visualization Client / Session Layer | Session-permanent calibration state persistence across product additions, product switching, and quotation round-trips | Maintenance Release | `BRD-M1`, `BRD-M4`, `PRD-F6`, `PRD-F10`, `SDD-C5`, `SDD-C7`, `QAD-TC64` |
| MS-50 | Grounded Real-World 3D Model Sizing and Quotation Parity | Visualization Client / Sizing Engine | Direct coplanar scale grounding, 100% mathematical weight bypassing height heuristics, and quotation line item parity | Maintenance Release | `BRD-M1`, `BRD-M5`, `PRD-F6`, `PRD-F10`, `SDD-C5`, `SDD-C7`, `QAD-TC65` |
| MS-51 | Pre-Workspace Fiducial Paper Detection Confirmation Gateway | Visualization Client / Upload Gateway | Pre-workspace confirmation modal, visual boundary verification, interactive 2.5x loupe adjustment, and paper standard override | Maintenance Release | `BRD-M1`, `BRD-M2`, `PRD-F3`, `PRD-F4`, `PRD-F6`, `SDD-C2`, `SDD-C5`, `QAD-TC66` |
| MS-63 | Resilient HEIC Space Image Ingestion and Low-Latency Pipeline | Visualization Client / FastAPI CV | Network-tolerant exponential backoff, resolution-constrained paper detection, session-bound snap endpoint, and local blob buffering | Maintenance Release | `BRD-M1`, `BRD-M3`, `BRD-M4`, `BRD-M5`, `PRD-F3`, `PRD-F4`, `PRD-F10`, `SDD-C2`, `SDD-C3`, `SDD-C4`, `DSD-UI3`, `DSD-UI4`, `QAD-TC78` |

---

## 3. Detailed Milestone Specifications

### Milestone 1: Database Schema & Seed Migration (Persistence Layer)

**Objective:**  
Establish the relational tables, foreign key constraints, indexes, and initial benchmark seed data required for raw material cataloging, dimensional component binding, structural rule mutations, and itemized quotation snapshots.

**Technical Tasks:**
1. Create migration file `supabase/migrations/005_parametric_pricing_engine.sql`:
   - Create table `public.raw_materials` with columns: `id (UUID PK)`, `material_code (VARCHAR UNIQUE)`, `description (VARCHAR)`, `category (VARCHAR)`, `finish_type (VARCHAR)`, `billing_unit (VARCHAR)`, `unit_price (NUMERIC(10,2))`, `waste_allowance (NUMERIC(4,3))`, `is_active (BOOLEAN)`, `created_at`, `updated_at`.
   - Add RLS policies for `public.raw_materials`: public read for active rows, admin-only write via `public.is_admin(auth.uid())`.
   - Populate benchmark seed data from Section 3.1 of `docs/pricing.md` (Series 798 Head/Sill/Jamb/Rail/Stile in Analok and Powder Coated White; 6mm clear, tinted bronze, and tempered glass; POM rollers, flush latches, fasteners, and silicone sealants).
   - Alter `public.product_components`:
     - Add `raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE RESTRICT`.
     - Add `dimension_binding VARCHAR(20) NOT NULL DEFAULT 'FIXED'` (Domain: `'WIDTH'`, `'HEIGHT'`, `'AREA'`, `'FIXED'`).
     - Add `span_ratio NUMERIC(5,4) NOT NULL DEFAULT 1.0000`.
     - Add `is_removable BOOLEAN NOT NULL DEFAULT false`.
     - Add `toggle_property_key VARCHAR(50)`.
     - Add `presentation_category VARCHAR(50) NOT NULL DEFAULT 'Framing'` (Domain: `'Framing'`, `'Glazing'`, `'Hardware'`).
     - Add `glb_file_url TEXT`.
   - Update `public.structural_rules` schema to formally validate action payloads containing `enforce_panel_count`, `ui_prompt`, and `mutations` arrays.
   - Update `public.quotation_items` table:
     - Add `item_group_name VARCHAR(100) NOT NULL` (Domain: `'Aluminum Framing'`, `'Glass Infill'`, `'Hardware & Accessories'`, `'Labor & Installation'`).
     - Add `pricing_details JSONB NOT NULL DEFAULT '{}'::jsonb`.
     - Add `structural_waiver BOOLEAN NOT NULL DEFAULT false`.
2. Generate TypeScript types and Zod schemas in `src/lib/pricing/types.ts` and `src/lib/admin/materials/types.ts`:
   - Define strict TypeScript interfaces (zero `any` per BAN-TYPE-05).
   - Export database DTOs for `RawMaterial`, `ProductComponentBinding`, `StructuralRulePayload`, `QuotationBOMSummary`.

**Definition of Done (Exit Criteria):**
- Migration executes cleanly forward and rollback tested in local Supabase environment.
- RLS policies prevent unauthenticated mutations while allowing public catalog reads.
- Benchmark seed data for Series 798 extrusions, glass, and hardware are fully queryable.

---

### Milestone 2: Central Raw Materials Master Catalog (Admin UI & API Layer)

**Objective:**  
Empower administrators to manage regional aluminum profiles, glass stock sheets, hardware accessories, and consumable rates without modifying frontend application code.

**Technical Tasks:**
1. Backend Service & Server Actions:
   - Create `src/lib/admin/materials/materialActions.ts` with `getRawMaterials()`, `upsertRawMaterial()`, `deleteRawMaterial()`, and `batchUpdateMaterialPrices()`.
   - Implement Zod schema validation for pricing rates, billing units (`m`, `sqm`, `pc`), and waste allowances (`0.000` to `0.500`).
2. Administrative Interface:
   - Create admin route `/admin/materials` (accessible to Owner and Manager roles).
   - Build a searchable, filterable data table displaying:
     - Material Code and Description.
     - Category pill (Aluminum, Glass, Hardware, Consumable).
     - Finish Type pill (Analok, Powder Coated White, Anodized, Clear, Bronze).
     - Billing Unit and Current Unit Price (PHP).
     - Waste Allowance percentage (e.g., 12.0% for aluminum offcuts, 10.0% for glass).
     - Active/Inactive toggle.
   - Modal dialog for adding or editing raw material records with instant preview of effective cost after waste factor.
   - Batch price update action allowing fabricators to adjust wholesale profile rates during supplier price updates.

**Definition of Done (Exit Criteria):**
- Admin can create, edit, deactivate, and search raw materials in under 2 seconds.
- Changes in raw material unit prices reflect immediately in dependent quotation calculations.

---

### Milestone 3: Admin Part Inspector & Component Mapping (Admin Step 4)

**Objective:**  
Replace the rudimentary component upload in Step 4 of the product wizard with the interactive split-screen Part Inspector, binding 3D `.glb` meshes to physical materials, dimension drivers, span ratios, and toggle keys.

**Technical Tasks:**
1. Split-Screen Layout (`src/features/admin/products/setup/StructuralComponentsSection.tsx`):
   - Left side (60% width): Interactive Three.js 3D viewport rendering uploaded `.glb` meshes with orbit, pan, and part selection highlight.
   - Right side (40% width): Part Inspector Drawer displaying the configuration fields of the selected part.
2. Part Inspector Configuration Controls:
   - **Material Link:** Dropdown populated from `public.raw_materials`, filtered by profile finish.
   - **Dimension Driver:** Radio or dropdown with options `[ Width ]`, `[ Height ]`, `[ Area ]`, and `[ Static / Fixed ]`.
   - **Span Multiplier:** Quick selectors for `Full Span (1.0x)` (Head, Sill, Jambs), `Half Span (0.5x)` (2-panel sash rails), `Third Span (0.33x)` (3-panel sash rails), or custom numeric ratio.
   - **Removable Toggle:** Switch labeled *"Allow Client to Toggle / Remove this Part"* with dependent `Toggle Key` text field (e.g., `has_sill`).
   - **Base Quantity:** Integer input for count per assembly.
3. Smart Auto-Detection & Batch Operations:
   - Automated filename parser assigning default bindings upon file drop:
     - Filename matching `*sill*` -> Driver: `Width`, Span: `1.0x`, Removable: `true`, Toggle Key: `has_sill`, Category: `Framing`.
     - Filename matching `*jamb*` or `*stile*` -> Driver: `Height`, Span: `1.0x`, Category: `Framing`.
     - Filename matching `*rail*` -> Driver: `Width`, Span: `0.5x` (or `0.33x`), Category: `Framing`.
     - Filename matching `*glass*` or `*pane*` -> Driver: `Area`, Category: `Glazing`.
     - Filename matching `*roller*` or `*lock*` -> Driver: `Static`, Category: `Hardware`.
   - Multi-select capability (`Shift + Click` or checkbox list) allowing simultaneous configuration of symmetrical members (e.g., all 4 sash rails).
4. Mutation & Asset Persistence:
   - Update `upsertProductComponent()` in `src/lib/admin/products/componentMutations.ts` to write all relational columns to `product_components`.

**Definition of Done (Exit Criteria):**
- Dropping Series 798 `.glb` files automatically tags appropriate drivers, span ratios, and removable sill keys.
- Selecting any part in the 3D viewport highlights the mesh and displays its properties in the inspector drawer.
- Component records in `public.product_components` successfully reference `raw_materials(id)` foreign keys.

---

### Milestone 4: Interactive Test-Drive Simulator & Preset Duplication (Admin Step 6 & Catalog)

**Objective:**  
Provide administrative staff with a live calculation sandbox to test parametric size responses and verify quotations against shop floor reality before publishing.

**Technical Tasks:**
1. Live Calculation Sandbox (`src/features/admin/products/setup/ValidationWorkspaceSection.tsx`):
   - Embed real-time interactive parameter controls:
     - Width Slider: 600mm to 3600mm (10mm increments).
     - Height Slider: 600mm to 2400mm (10mm increments).
     - Feature Switch: `[x] Remove Bottom Sill` (bound to `has_sill`).
   - Live Bill-of-Materials Output Card:
     - Total linear extrusion meters and itemized cut lengths (Head, Sill, Jambs, Rails, Stiles).
     - Glazing surface area in square meters.
     - Direct material cost breakdown with 12% aluminum offcut allowance and 10% glass handling scrap.
     - Fixed hardware and weatherseal consumables subtotal.
     - Direct workshop fabrication labor (computed via `max(PHP 750.00, 0.25 * Materials Subtotal)`).
     - Contractor gross margin (25%).
     - Final estimated customer quotation in Philippine Pesos (PHP).
2. Configuration Error Guardrails:
   - Visual alert badges when calculations detect anomalous unit costs (e.g., unit price entered as PHP 1,100/m instead of PHP 110/m).
   - Live aspect ratio readout warning admins if test dimensions induce sash crabbing (aspect ratio > 1.2:1).
3. Preset Duplication Workflow (`src/features/admin/products/ProductsContent.tsx`):
   - Add "[Duplicate from Preset]" action button on product catalog items.
   - Clones product template, parameters, component bindings, raw material links, and structural rules into a new draft product record in under 2 minutes.

**Definition of Done (Exit Criteria):**
- Adjusting width/height sliders recalculates the full BOM and total quotation in under 50ms.
- Toggling "Remove Bottom Sill" immediately zeroes out sill extrusion length, removes its scrap factor, and recalculates labor and margin.
- Duplicating a 2-panel window creates an independent draft ready for 3-panel adjustments without re-uploading shared meshes.

---

### Milestone 5: Parametric Bill-of-Materials (BOM) Pricing Engine Core (Domain Service)

**Objective:**  
Implement the deterministic mathematical pricing engine in a clean, reusable service shared between the admin simulator, customer quotation modal, and server actions.

**Technical Tasks:**
1. Core Pricing Calculation Library (`src/lib/pricing/pricingEngine.ts`):
   - Implement the master equation:
     `Q = (1 + mu) * [ (1 + omega_ext) * C_ext + (1 + omega_gl) * C_gl + C_hw + C_cons + C_lab ]`
   - Decouple dimensional scaling:
     - 1D Linear Extrusions: `C_outer = (W * R_head) + (delta_sill * W * R_sill) + (2 * H * R_jamb)`
     - Moving Sash Frames: `C_sash = (2 * W * R_rail) + (2 * H * R_lockstile) + (2 * (N - 1) * H * R_interlocker)`
     - 2D Glazing Infill: `A_glass = W * H`, `C_gl = A_glass * R_glass`
     - Fixed Hardware: `C_hw = (2 * N * P_roller) + P_flush_lock + (4 * P_guide_caps) + P_fasteners`
     - Weatherseal Consumables: `C_cons = ((2 * W + 2 * H) / 5.0) * P_silicone + (2 * W + 2 * N * H) * P_gasket`
     - Workshop Labor: `C_lab = max(750.00, 0.25 * Materials Subtotal)`
     - Contractor Gross Margin: `mu = 0.25`
   - Support arbitrary panel counts (N=2, N=3) and profile finishes (Analok, Powder Coated White).
2. Frozen Quotation Snapshot Generator:
   - Function `generateQuotationSnapshot()` creating 4 grouped summary line items for `public.quotation_items`:
     1. Aluminum Framing (includes total linear cuts, scrap factor, subtotal).
     2. Glass Infill (includes daylight area, glass type, scrap factor, subtotal).
     3. Hardware & Accessories (includes rollers, latches, guides, sealants, subtotal).
     4. Workshop Labor & Installation (includes labor floor or percentage, subtotal).
   - Serializes complete calculation inputs, material rates, and dimensions into `pricing_details JSONB` to safeguard past quotations against future catalog price edits.

**Definition of Done (Exit Criteria):**
- Pricing library passes pure unit tests matching the 4 benchmark validation scenarios from `docs/pricing.md` down to the exact centavo.
- Frozen quotation snapshots preserve calculation parameters immutably in PostgreSQL JSONB.

---

### Milestone 6: Engineering Guardrails & Hybrid Confirmation Modal (Visualization Layer)

**Objective:**  
Incorporate physical engineering constraints (NSCP 2015 wind deflection, roller load capacities, glass dead load, aspect ratio) into the customer workspace and enforce the Hybrid Guardrail (Behavior B prompt modal).

**Technical Tasks:**
1. Real-Time Engineering Validation Engine (`src/lib/visualization/guardrailEngine.ts`):
   - **Glass Dead Load Calculation:** Calculate panel weight using the Universal 2.5 rule:
     `Dead Load (kg) = Area (m2) * Thickness (mm) * 2.5 kg/m2 + Sash Frame (6.0kg)`
   - **Roller Capacity Check:** Flag warning if leaf dead load exceeds 30.0kg; block or prompt if dead load exceeds 40.0kg (exceeds Series 798 POM roller limits).
   - **Aspect Ratio Monitor:** Compute `Ratio = Height / Width`. Flag cautionary warning if ratio > 1.2:1 (sash crabbing and binding risk).
   - **Span Limit Threshold:** Trigger guardrail when total opening width `W >= 2400mm` under a 2-panel configuration.
2. Hybrid Guardrail Prompt Modal (Behavior B):
   - Build accessible modal dialog in `src/features/visualization/components/StructuralGuardrailModal.tsx`:
     - Modal Header: *"Structural Span Limit Exceeded"*
     - Modal Body: Explains Series 798 1200mm leaf limit, roller micro-pitting, sash crabbing, and wind-driven water infiltration.
     - Primary Action (Recommended): *"Switch to 3 Panels (Recommended)"*
       - Automatically increments panels to 3.
       - Adjusts sash rail span ratio to `0.3333`.
       - Increments sash stiles by +2 and rollers by +2.
       - Triggers Three.js structural rebuild in canvas.
     - Secondary Action: *"Acknowledge & Proceed as 2-Panel"*
       - Retains 2 leaves.
       - Sets `structural_waiver = true` on the session configuration.
       - Attaches formal waiver disclaimer to resulting quotation and PDF.

**Definition of Done (Exit Criteria):**
- Setting width >= 2400mm on a 2-panel window opens the guardrail modal immediately.
- Choosing "Switch to 3 Panels" seamlessly updates the 3D model, rail cut ratios, and hardware counts.
- Choosing "Acknowledge & Proceed" persists an immutable waiver flag into the quotation record.

---

### Milestone 7: Quotation Summary & Consultation PDF Handoff (Quotation Layer)

**Objective:**  
Refactor the customer quotation review page and server-side PDF generator to display the itemized BOM breakdown, sill removal price reductions, and structural waiver disclaimers.

**Technical Tasks:**
1. Customer Quotation Review Page (`src/features/quotation/components/ProductSummary.tsx`):
   - Replace flat base price display with the 4 grouped BOM line items:
     - Aluminum Framing (with linear meters and finish label).
     - Glass Infill (with surface area and glass specification).
     - Hardware & Consumables (with roller and lockset counts).
     - Direct Labor & Fabrication.
   - Display net price adjustment callout when bottom sill is omitted (`has_sill = false`).
   - Prominently render cautionary engineering banner if `structural_waiver == true`:
     *"Notice: This configuration exceeds standard Series 798 2-panel structural width recommendations (W >= 2400mm). The customer has acknowledged potential operational stiffness and wind-load deflection risks."*
2. Server-Side Consultation PDF Generator (`src/lib/pdf/quotationPdfGenerator.ts`):
   - Render high-resolution visual snapshot, customer details, and itemized 4-part cost summary.
   - Embed statutory legal disclaimer (Consumer Act of the Philippines RA 7394) stating that estimate is subject to on-site ocular verification.
   - Embed explicit NSCP 2015 Structural Waiver clause when `structural_waiver == true`.
   - Store generated PDF in Cloudflare R2 and update `quotation_estimates.pdf_r2_object_key`.
3. Signed Booking Handoff Integration (`src/features/booking/components/BookingFlow.tsx`):
   - Maintain SHA-256 tokenized reference link generation (`signed_booking_links`).
   - Format Messenger and Viber deep links containing quotation reference and structural waiver status flag.

**Definition of Done (Exit Criteria):**
- Customer sees transparent, grouped BOM pricing matching the mathematical formulation.
- PDF generation embeds the composite image, full price breakdown, and waiver disclaimer if active.
- Booking deep links successfully pass quotation reference code to Messenger and Viber.

---

### Milestone 8: Automated Test Suites & Numerical Validation (QA Layer)

**Objective:**  
Validate all mathematical algorithms, database constraints, administrative workflows, and customer guardrail paths using automated unit and end-to-end tests.

**Technical Tasks:**
1. Vitest Unit Test Suite (`tests/unit/pricingEngine.test.ts`):
   - **Scenario 1 (Baseline 2-Panel, 1.20m x 1.20m, with Sill):** Verify net manufacturing cost is PHP 3,490.34 and final quotation is PHP 4,362.93.
   - **Scenario 2 (Extended Width, 1.80m x 1.20m, with Sill):** Verify net manufacturing cost is PHP 4,536.59 and final quotation is PHP 5,670.74.
   - **Scenario 3 (Extended Width, 1.80m x 1.20m, Sill Removed):** Verify net manufacturing cost is PHP 4,228.14, final quotation is PHP 5,285.18, and net sill deduction is PHP 385.56.
   - **Scenario 4 (Wide Span Threshold, 2.60m x 1.20m, 3-Panel Transition):** Verify 6 sash rails, 6 stiles, 6 rollers, net manufacturing cost PHP 6,482.30, and final quotation PHP 8,102.88.
   - **Dead-Load Unit Tests:** Verify 6mm glass calculates 15.0 kg/m2 and 12mm glass calculates 30.0 kg/m2 per the 2.5 rule.
2. Playwright End-to-End Test Suite (`tests/e2e/guardrailWorkflow.spec.ts`):
   - Test admin Part Inspector workflow: uploading files, verifying auto-detection badges, saving bindings.
   - Test customer guardrail workflow: widening window to 2500mm, confirming modal display, selecting "Switch to 3 Panels", verifying 3-pane assembly in canvas and quote.
   - Test customer waiver workflow: widening window to 2500mm, selecting "Acknowledge & Proceed", verifying waiver notice on quote and in PDF.

**Definition of Done (Exit Criteria):**
- All 4 numerical validation test cases pass with 100% precision against Section 5 of `docs/pricing.md`.
- Playwright E2E tests pass headlessly in CI pipeline with zero timeouts or flakiness.

---

### Milestone 9: Master Documentation & Governance Reconciliation (Governance Layer)

**Objective:**  
Reconcile all 8 existing documentation files in `docs/` with `pricing.md` and `milestone.md`, eliminating documentation drift and enforcing AGENTS.md hard bans.

**Technical Tasks:**
1. Reconcile `docs/index.md`:
   - Add `docs/pricing.md` and `docs/milestone.md` to Master Document Registry.
   - Update End-to-End Traceability Matrix with new pricing features, entities, and test cases.
2. Reconcile `docs/erd-glassfit.md`:
   - Add `raw_materials` entity (`ERD-E17`).
   - Update `product_components` (`ERD-E6`), `structural_rules` (`ERD-E7`), and `quotation_items` (`ERD-E14`).
   - Document new foreign keys, cardinality relationships, and indexes.
3. Reconcile `docs/prd-glassfit.md`:
   - Update `PRD-F5`, `PRD-F10`, `PRD-F14`, and `PRD-F19` with BOM decoupling, guardrail prompt modals, and Part Inspector specifications.
4. Reconcile `docs/sdd-glassfit.md`:
   - Update `SDD-C4`, `SDD-C7`, and `SDD-C9` component descriptions, data transfer contracts, and endpoint matrices.
5. Reconcile `docs/dsd-glassfit.md`:
   - Detail `DSD-UI7` Structural Guardrail Prompt Modal and `DSD-UI10` Split-Screen Part Inspector.
6. Reconcile `docs/qad-glassfit.md`:
   - Add `QAD-TC15` (Raw Materials Catalog CRUD), `QAD-TC16` (Part Inspector Auto-Binding), `QAD-TC17` (Hybrid Guardrail Modal & Waiver), and `QAD-TC18` (BOM Mathematical Accuracy).
7. Reconcile `docs/build-glassfit.md`:
   - Document migration `005_parametric_pricing_engine.sql` and benchmark seed data deployment.
8. Enforce Hard Bans Across Documentation:
   - Strict audit for zero em-dashes across all files (BAN-PUNCT-01).
   - Ensure all features map directly to upstream IDs (BAN-SPEC-02).
   - Ensure zero ASCII box diagrams or trees inside code blocks (BAN-DIAG-03).

**Definition of Done (Exit Criteria):**
- All 9 markdown specifications in `docs/` are completely harmonized with active codebase contracts.
- Automated lint and grep checks confirm zero em-dashes and 100% spec link traceability.

---

### Milestone 10: Admin Product Setup Wizard State & Component Persistence (Admin UI & State Layer)

**Objective:**  
Eliminate state desynchronization, parameter loss, and rule-blocking traps in the multi-step administrative product setup wizard (`/admin/products/[productId]/setup`), ensuring that default parameters auto-save on initial generation, modified parameters synchronize reactively with debouncing, and navigating back and forth between wizard steps (such as configuring parameters in Step 5 and returning to components in Step 4) retains all structural components, models, and parameters without requiring a browser reload.

**Technical Tasks:**
1. Parameter Auto-Save & Debounced Synchronization:
   - In `src/features/admin/products/setup/ParametersAndRulesSection.tsx`, implement automatic debounced persistence for parameters and rules with real-time UI status badges (`Saving...`, `Saved`, `Error`).
   - Automatically persist initial default parameters (`width`, `height`) on step mount when creating new parametric products so that dependent structural rules always have persisted parameter references.
   - Refactor rule generation to intelligently seed only rules referencing available components, ensuring missing component keys never block parameter saves.
2. Dynamic Step State Revalidation & Server Sync:
   - In `src/features/admin/products/setup/ProductSetupWizard.tsx`, implement automated draft state refresh (`getProductDraft(productId)`) upon step transition or tab click so that the wizard parent state stays strictly synchronized with the latest Supabase database records.
   - Preserve local edits and in-flight changes across tab transitions without unmounting or discarding uploaded component files and 3D preview meshes.
3. Bidirectional Component State Propagation:
   - Update `src/features/admin/products/setup/StructuralComponentsSection.tsx` to accept reactive `initialData` changes and synchronize internal `mappedFiles` when re-entering the tab.
   - Provide an `onComponentsUpdate` or integrated state notification callback to notify the parent wizard and adjacent sections (such as Step 5 Parameters & Rules and Step 6 Validation Workspace) of newly saved components and template IDs immediately.
4. Smooth User Experience & Optimistic Feedback:
   - Implement seamless tab transitions with loading state indicators during background syncs.
   - Maintain active selection states, part drawer bindings, and Three.js canvas viewport controls when returning to Step 4.
   - Provide toast notifications or status indicators when step data is saved and persisted to the relational persistence layer.

**Definition of Done (Exit Criteria):**
- Parameters in Step 5 automatically persist to Supabase upon creation or edit with clear visual feedback.
- Administrator can upload components in Step 4, proceed to Step 5 (Parameters & Rules), navigate back to Step 4 (Components), and see all uploaded parts, raw material links, and 3D preview meshes fully intact without browser reloads.
- Step 5 component reference dropdowns dynamically display newly added components from Step 4 without requiring manual page refresh.
- Validation workspace in Step 6 immediately reflects structural components and parameters configured in preceding steps.

---

## 4. End-to-End Traceability Reference Matrix

| Milestone ID | Upstream PRD | Upstream SDD | Data Entities (ERD) | UI Components (DSD) | QA Test Cases |
|---|---|---|---|---|---|
| MS-1 | `PRD-F10`, `PRD-F14` | `SDD-C7`, `SDD-C9` | `ERD-E6`, `ERD-E7`, `ERD-E14`, `ERD-E17` | N/A (Schema) | `QAD-TC15` |
| MS-2 | `PRD-F14`, `PRD-F19` | `SDD-C9` | `ERD-E17` | `DSD-UI10` | `QAD-TC15` |
| MS-3 | `PRD-F5`, `PRD-F14` | `SDD-C4`, `SDD-C9` | `ERD-E6`, `ERD-E8` | `DSD-UI10` | `QAD-TC16` |
| MS-4 | `PRD-F14`, `PRD-F19` | `SDD-C9` | `ERD-E4`, `ERD-E6`, `ERD-E17` | `DSD-UI10` | `QAD-TC16` |
| MS-5 | `PRD-F10` | `SDD-C7` | `ERD-E13`, `ERD-E14`, `ERD-E17` | `DSD-UI7` | `QAD-TC18` |
| MS-6 | `PRD-F5`, `PRD-F10` | `SDD-C4`, `SDD-C5` | `ERD-E5`, `ERD-E7`, `ERD-E11` | `DSD-UI7` | `QAD-TC5`, `QAD-TC17` |
| MS-7 | `PRD-F10`, `PRD-F11` | `SDD-C7`, `SDD-C8` | `ERD-E13`, `ERD-E14`, `ERD-E15` | `DSD-UI7`, `DSD-UI8` | `QAD-TC10`, `QAD-TC11` |
| MS-8 | All Features | All Components | All Entities | All UI Components | `QAD-TC1` to `QAD-TC18` |
| MS-9 | Governance | Governance | Governance | Governance | Governance |
| MS-10 | `PRD-F14` | `SDD-C9` | `ERD-E4`, `ERD-E6` | `DSD-UI10` | `QAD-TC19` |
| MS-30 | `PRD-F12`, `PRD-F14` | `SDD-C8`, `SDD-C9` | `ERD-E2`, `ERD-E20` | `DSD-UI10` | `QAD-TC12`, `QAD-TC14`, `QAD-TC45` |
| MS-31 | `PRD-F10`, `PRD-F12`, `PRD-F13`, `PRD-F14` | `SDD-C8`, `SDD-C9` | `ERD-E13`, `ERD-E14`, `ERD-E15`, `ERD-E16` | `DSD-UI11` | `QAD-TC46` |
| MS-32 | `PRD-F14`, `PRD-F10`, `PRD-F12`, `PRD-F13` | `SDD-C9`, `SDD-C10` | `ERD-E3`, `ERD-E13`, `ERD-E16`, `ERD-E18` | `DSD-UI11`, `DSD-UI12` | `QAD-TC47` |
| MS-33 | `PRD-F1`, `PRD-F6`, `PRD-F14` | `SDD-C1`, `SDD-C5`, `SDD-C9` | N/A (Presentation) | `DSD-UI13` | `QAD-TC48` |
| MS-35 | `PRD-F3`, `PRD-F4`, `PRD-F7` | `SDD-C2`, `SDD-C3` | N/A (Temporary Files) | `DSD-UI3` | `QAD-TC3`, `QAD-TC4`, `QAD-TC50` |
| MS-36 | `PRD-F14` | `SDD-C9` | `ERD-E3` | `DSD-UI14` | `QAD-TC51` |
| MS-37 | `PRD-F6` | `SDD-C5` | N/A (Transient Presentation State) | `DSD-UI4`, `DSD-UI15` | `QAD-TC52` |
| MS-38 | `PRD-F10`, `PRD-F11` | `SDD-C7` | `ERD-E13`, `ERD-E14` | `DSD-UI16` | `QAD-TC53` |
| MS-39 | `PRD-F6` | `SDD-C5` | N/A (Transient Presentation State) | `DSD-UI4`, `DSD-UI15` | `QAD-TC54` |
| MS-40 | `PRD-F6` | `SDD-C5` | N/A (Transient Presentation State) | `DSD-UI4` | `QAD-TC55` |
| MS-43 | `PRD-F5`, `PRD-F14` | `SDD-C4`, `SDD-C9` | `ERD-E4`, `ERD-E5`, `ERD-E6`, `ERD-E7` | `DSD-UI10` | `QAD-TC58` |
| MS-44 | `PRD-F6` | `SDD-C4`, `SDD-C5`, `SDD-C6` | `ERD-E4`, `ERD-E5`, `ERD-E6`, `ERD-E7` | `DSD-UI4` | `QAD-TC59` |

### MS-30: Inclusive Identity and Administrator Email Change

MS-30 centralizes Unicode person-name validation, permits mononyms, secures administrator self-profile mutation, and adds role-aware administrator email changes. Staff changes require an active Owner or Manager decision through a protected review page. Owner and Manager self-changes complete immediately. Migration 012 retains an immutable workflow audit and synchronizes completed Auth email changes to profiles.

### MS-31: Admin Booking Discard-to-Hard-Delete Workflow and Bidirectional Quotation Purge

MS-31 introduces the hard-delete workflow for discarded bookings, executing atomic multi-table purge via `public.hard_delete_booking_quotation`, client-side selection advance, Next.js cache revalidation, and Cloudflare R2 binary asset cleanup.

### MS-32: Admin Data Management, GlassFit Business Intelligence Exports, Native Visual Analytics, and System Backup Engine

MS-32 converts placeholder Data Management controls into authenticated Next.js streaming export routes (`/api/admin/export/bookings`, `/api/admin/export/products`, `/api/admin/export/backup`), GlassFit-connected CSVs with executive KPI summaries and UTF-8 BOM, an interactive Business Intelligence Modal with pure SVG charts (`StatusDonutChart`, `TrendAreaChart`, `ChannelBarChart`, `ProductDistributionChart`), and a secure JSON system backup engine that updates `public.system_preferences` with live backup audit tracking via `public.record_system_backup`.

### MS-33: Unified Cross-Browser GlassFit Brand Theme Scrollbar System

MS-33 implements a unified, brand-consistent scrollbar system in `src/app/globals.css` covering root viewports and nested containers across Chromium, Blink, Gecko, and WebKit rendering engines. The design applies dual-standard W3C properties (`scrollbar-width`, `scrollbar-color`) and WebKit pseudo-elements (`::-webkit-scrollbar`), featuring an 8px slim floating cyan pill with rounded ends (`border-radius: 9999px`), 2px transparent inset margins, dynamic light/dark mode color transitions, transparent corner intersections, and dedicated `.scrollbar-none` and `.no-scrollbar` utilities.

### MS-35: Multi-Format Space Image Ingestion

MS-35 extends the existing client-space upload workflow to accept static WebP and HEIC/HEIF files in addition to JPG and PNG. The browser validates and previews formats it can decode, presents an accessible metadata card for HEIC/HEIF files it cannot render, and sends the original bytes to FastAPI. The server verifies the declared and decoded formats, enforces byte, pixel, and single-frame limits, decodes HEIC/HEIF with the pinned decoder, normalizes it for OpenCV, and preserves the existing `workspace.webp` output contract.

### MS-36: Admin Product Type and Status Filters

MS-36 turns the two placeholder controls on `/admin/products` into accessible single-selection filters. The first control derives its options from loaded `products.product_type` values. The second filters the normalized Published or Draft client status originating from database values Active and Inactive. Both predicates compose with the existing search, update the visible result count, distinguish an empty catalog from a no-match result, and preserve all row actions.

### MS-37: Mobile Visualization Workspace Optimization

MS-37 gives compact touch viewports a `100dvh` photo-based workspace editor with a flexible canvas stage, compact HUD, safe-area support, advisory landscape guidance, nested-safe document scroll isolation, exact exit restoration, and 44px four-point controls with elevated touch proxies. `Done` exits only the compact shell and retains the existing in-memory configuration. Product application, snapshot persistence, pricing, CV, and desktop behavior remain unchanged.

### MS-38: Quotation Preview and Browser-Saved PDF Reliability

MS-38 repairs the shared quotation document without changing pricing or persistence. It first isolates the Page 1 failure against the current pattern-based logo, then applies a dedicated print-safe asset only when supported by reproduction evidence. Canonical rendering derives multi-fixture behavior directly from the quotation view model, compact fixture cards keep their identity and final price together, numeric values do not split, and customer, administrator, and download-route surfaces retain equivalent content. Automated HTML tests are supplemented by mandatory native Save as PDF verification because browser PDF output cannot be proven by source assertions alone.

### MS-39: Discrete Yaw and Pitch Degree Stepper Controls

MS-39 adds keyboard-operable single-degree stepper controls for yaw and pitch, bounded by their existing angle domains. The controls stay synchronized with the sliders and numerical readouts and are covered by QAD-TC54.

### MS-40: Neutral Orientation After Perspective Fit

MS-40 follows MS-39. Confirming a perspective fit sets yaw and pitch to zero while preserving corner geometry used for dimension estimation. The overlay warp, renderer pipeline, and later manual orientation adjustments remain available. Automated and manual verification is specified by QAD-TC55.

### MS-43: Unconstrained Dimension Parameters and Incremental Step-Loop Structural Rules

MS-43 removes artificial upper limits on width and height parameters in the admin product setup wizard (`maximum_value = null`) while preserving minimum and default dimension constraints. It introduces first-class incremental step-loop structural rules ("FOR EVERY [step] mm ADD [quantity] parts") in both the admin rule authoring interface and the Three.js parametric structural resolver (`structuralResolver.ts`), preventing repetitive conditional threshold creation. Testing sandbox supports dimensions up to 10,000mm and is covered by QAD-TC58.

### MS-47: Interactive Fiducial Pin Fallback and Precision Dimension Grounding

MS-47 delivers a 4-point interactive fiducial pin picker modal (`FiducialPaperPickerModal`), coplanar scale factor derivation (cm per px) across Philippine paper standards (Short, A4, Long), direct coplanar dimension grounding in `computeEstimatedDimensions()` and `getScaleAwareInitialDimensions()`, and calibrated trust badges in the workspace HUD and quotation measurement modal. Covered by QAD-TC62.

### MS-48: Autonomous Multi-Standard Paper Fiducial Detection and Resilient Scale Engine

MS-48 enhances the FastAPI computer vision microservice (`paper_calibration.py`, `main.py`) to automatically detect standard Philippine paper dimensions (Short Bond, A4, Long Bond) under diverse room lighting and orientations without requiring manual client standard selection. Covered by QAD-TC63.

### MS-49: Session-Permanent Calibration State and Fallback Pinning Lifecycle

MS-49 establishes immutable, session-permanent calibration persistence across the visualization workspace. Calibrated status, metric scale, homography matrices, and detected corners persist in `VisualizationSessionContext` and `sessionStorage`, surviving multi-product additions (`mode: "add"`), product switches (`mode: "change"`), and quotation review round-trips without re-triggering the manual pin modal. Covered by QAD-TC64.

### MS-50: Grounded Real-World 3D Model Sizing and Quotation Parity

MS-50 mathematically grounds parametric 3D model dimensions, perspective quadrilateral fits, and quotation line items directly in verified coplanar scale factors. In `computeEstimatedDimensions()` and `getScaleAwareInitialDimensions()`, heuristic default height blending and depth corrections are bypassed when paper calibration is active, assigning 100% mathematical weight to the verified scale factor. Newly placed fixtures in multi-product workspaces calculate starting dimensions directly from physical scale, perspective quad fits synchronize dynamically with Three.js parametric meshes, and `MeasurementConfirmationModal` renders high-precision emerald trust choice cards while persisting `pricing_details.dimension_source = "calibrated_visual"` to downstream quotation items. Covered by QAD-TC65.

### MS-51: Pre-Workspace Fiducial Paper Detection Confirmation and Interactive Refinement Gateway

MS-51 intercepts the room space image upload pipeline prior to 3D workspace entry, replacing generic success prompts with `PaperDetectionConfirmationModal` whenever paper fiducial mode is selected or paper boundaries are detected. The modal highlights detected paper quadrilaterals with glowing emerald perimeter overlays and numbered corner pins, provides a single-tap approval path (`Looks Right / Confirm & Enter Workspace`), enables interactive corner refinement via a 2.5x circular loupe with adaptive boundary clamping, allows dynamic switching between Philippine paper standards (Short Bond, A4, Long Bond), enforces strict convexity guardrails against self-intersecting polygons, provides non-blocking heuristic fallbacks (`status: "heuristic_fallback"`), and suppresses redundant pinning prompts upon workspace hydration. Covered by QAD-TC66.

### MS-52: Grounded Model Dimensioning Accuracy, Aperture Fitting, and Workspace Dynamic Synchronization

MS-52 establishes end-to-end mathematical grounding and real-time visual dimensioning within the 3D visualization workspace based on verified fiducial scale factors. In `ProductModelWorkspace.tsx` and `scaleEstimation.ts`, 3D models initialize physical width and height directly from verified coplanar scale factors via `getVerifiedScaleInitialDimensions()`, completely bypassing heuristic height blending and depth distortions. The active model bounding box renders live floating physical dimension callout badges (in millimeters and centimeters) with emerald lock icons and verified trust badges. During quadrilateral aperture alignment in `PerspectivePlanePicker.tsx`, real-time millimeter edge dimension tags dynamically reflect opening geometry as corners are dragged. When the user initiates marker re-adjustments via the top-left HUD calibration pill, `PaperDetectionConfirmationModal` opens and confirms new corner pin bounds, hot-rescaling the active fixture and all placed scene fixtures in real time while triggering Three.js parametric mesh re-extrusion without resetting finishes, glass selections, or quotation state. Multi-product additions (`mode: "add"`) automatically inherit the active verified scale factor. Quotation item payloads in `MeasurementConfirmationModal.tsx` and `bookingActions.ts` permanently record `pricing_details.dimension_source = "verified_calibrated_visual"` alongside `paper_standard`, `calibration_scale_cm_per_px`, and `user_verified`, providing an immutable audit trail for fabricators. Covered by QAD-TC67.

---

## 5. Capstone Oral Defense Alignment & Theoretical Justifications

Completing these milestones arms the capstone team with robust academic and empirical answers during the CCIS panel defense:

1. **Defense of BOM Pricing vs Per-Square-Meter Rules of Thumb:**  
   Per-square-meter heuristic multipliers fail because perimeter framing scales linearly in 1D, glazing scales quadratically in 2D, and hardware is static O(1). The BOM model protects SME fabricators from quoting unprofitable high-aspect-ratio openings while keeping wide openings competitive.
2. **Defense of Dynamic Material Decoupling:**  
   Wholesale aluminum and glass price volatility in the Philippines is managed centrally via `public.raw_materials`. Adjusting a wholesale profile price once updates all dependent products and variations dynamically without modifying application code.
3. **Defense of Structural Guardrails (NSCP 2015 & Hardware Safety):**  
   Series 798 residential single-bearing rollers fail above 40kg total leaf weight, and stiles deflect beyond the L/175 serviceability limit under Philippine typhoon wind loads when leaf width exceeds 1200mm. The hybrid prompt modal preserves customer design autonomy while protecting the fabricator from legal liability via signed structural waivers.

---

## Self-Check & Governance Audit

- [x] Active milestone specifications include traceable foundation, maintenance, and governance work
- [x] Zero em-dashes used anywhere in document; standard hyphens, colons, and parentheses used exclusively (BAN-PUNCT-01)
- [x] Every milestone explicitly maps to PRD-F#, SDD-C#, ERD-E#, and QAD-TC# identifiers (BAN-SPEC-02)
- [x] No box diagrams or tree diagrams inside code blocks; normalized Markdown tables and prose used (BAN-DIAG-03)
- [x] All 4 numerical validation scenarios from docs/pricing.md integrated into verification requirements
- [x] Structural guardrails (dead-load 2.5 rule, Series 798 limits, Behavior B prompt modal) fully addressed
- [x] Admin wizard state persistence between component and parameter tabs explicitly specified in MS-10


## MS-53: Reliable Automatic Paper Detection and Reference Selection

**Status:** Implemented, pending MS57 real-photo validation. **Specification:** [IMP-MS53](implementation/ms53.md). **Traceability:** PRD-F3, PRD-F4, SDD-C2, SDD-C3, DSD-UI3, QAD-TC68.

Automatic intake now returns ranked boundary evidence and abstains when weak or ambiguous. Customers review or choose an outline, explicitly declare the physical format and same-plane placement, and retain manual corners and approximate preview as recovery paths. Detection never infers Short/A4/Long from projected image shape or silently establishes metric calibration. MS54-MS57 complete the subsequent geometry, eligibility, propagation, and quantitative release gates.


## Milestone 54: Perspective-Correct Metric Measurement and Coordinate Integrity

Implemented IMP-MS54 / QAD-TC69 on October 19, 2026. Reviewed paper corners establish a versioned workspace-pixel-to-millimeter plane transform with explicit side correspondence. Opening fits, picker callouts, and marker-triggered session recalculation share geometry validation and sensitivity diagnostics. Default preview dimensions remain approximate; invalid results do not produce clamped metric readings. Quality thresholds and real-photo accuracy remain pending MS57 validation. MS55 eligibility and MS56 full model/quotation synchronization remain subsequent milestones.


Implemented IMP-MS55 / QAD-TC70 on October 19, 2026. Versioned placement declarations and per-opening plane assignments gate paper-derived measurements independently of outline approval. Handheld, displaced, uncertain, warped, and obscured references retain retake, both manual tape dimensions, and approximate-preview recovery. Legacy hydration and quotation review cannot inherit calibrated status from badges. MS57 physical-photo release validation remains pending.

## MS56: Consistent Model Dimensions and Quotation Provenance

Implemented IMP-MS56 / QAD-TC71 on October 19, 2026. Versioned, plane-bound opening measurements synchronize unrounded model and quotation dimensions, preserve manual tape precedence, revalidate hydrated drafts, and persist auditable provenance in existing JSONB. New photo writes use `planar_paper_estimate`; historical quotation snapshots remain immutable. Physical benchmark and browser acceptance remain pending MS57. See [implementation specification](implementation/ms56.md).

## MS57: Real-World Measurement Benchmark and Release Gates

Benchmark tooling implemented October 19, 2026 (IMP-MS57 / QAD-TC72). The private manifest runner records detector evidence and production geometry/plane decisions, separates automatic and corrected measurements, computes per-axis errors and coverage, and enforces a development/source freeze before held-out evaluation. Missing photos or tape evidence cannot become passing scores. Physical collection, threshold calibration, original baseline, supplied-sample browser checks and release acceptance remain pending. See [specification](implementation/ms57.md) and [operator instructions](../scripts/ms57/README.md).

## MS58: Click-Guided Interactive Paper Localization and Seed-Constrained Candidate Selection

Implemented IMP-MS58 / QAD-TC73 on October 19, 2026. Single-click paper seed localization provides an interactive tap-to-snap workflow. The normalized click coordinate constrains candidate selection (Tier 1 fast spatial query with 1.5% diagonal proximity tolerance) or triggers localized CLAHE adaptive segmentation (Tier 2 local ROI extraction). Mapped corners populate PaperDetectionConfirmationModal and FiducialPaperPickerModal with animated ripples and instant feedback while retaining manual pin editing and approximate fallbacks. See [implementation specification](implementation/ms58.md).

## MS59: Sub-Pixel Edge Snapping, Magnetic Loupe Alignment, and Corner Refinement

Implemented IMP-MS59 / QAD-TC74 on October 19, 2026. Sub-pixel edge snapping and magnetic alignment with straight edge line intersection locate true paper corners with under 1.0px error, bypassing corner fillet curvature, tape occlusion, and shadow gradients. The interactive 2.5x mobile loupe crosshair magnetically snaps to edge gradient peaks within 6px and smoothly releases when dragged away. See [implementation specification](implementation/ms59.md).

## MS60: Perspective Unwarping Aspect Ratio Matcher, Standard Auto-Suggestion, and Model Sizing Parity

Implemented IMP-MS60 / QAD-TC75 on October 19, 2026. Computes frontal-rectified unwarped aspect ratios to auto-suggest canonical Philippine paper standards (Short, A4, Long) within +-3.5% tolerance with matching confidence scores. Provides explicit side correspondence, an interactive orientation toggle (Swap Width / Height), and end-to-end unrounded millimeter synchronization across 3D model meshes, guardrails, and quotation line items. See [implementation specification](implementation/ms60.md).

## MS61: Empirical Real-World Accuracy Benchmark and Comparative Release Protocol

Implemented IMP-MS61 / QAD-TC76 on October 19, 2026. Establishes the comparative fiducial accuracy benchmark suite contrasting Full-Automatic (MOD-AUTO), Click-Guided Snap (MOD-CLICK), and Manual Pinning (MOD-MANUAL). Implements centroid seed generation, 25%/50%/75% perturbation robustness simulations, corner RMSE calculation with cyclic and winding invariance, per-axis error tracking against physical tape ground truth, and statistical release gate evaluation in both TypeScript (`scripts/ms57/comparator.ts`) and Python (`scripts/ms57/comparator.py`, `scripts/ms57/run_benchmark.py`). Validated via `tests/unit/clickGuidedBenchmark.test.ts`. See [implementation specification](implementation/ms61.md).

## MS62: Separate Automatic Detection from Paper Reference Calibration

**Status:** Implemented (October 21, 2026); browser acceptance pending. **Specification:** [IMP-MS62](implementation/ms62.md). **Traceability:** BRD-M1, BRD-M5; PRD-F3, PRD-F4, PRD-F5, PRD-F6, PRD-F10; SDD-C2, SDD-C3, SDD-C4, SDD-C5; DSD-UI3, DSD-UI4, DSD-UI7; QAD-TC77.1 through QAD-TC77.12. No database schema change.

Restore paper-free Automatic Detection on both upload paths: existing image analysis, success modal, and approximate workspace preview. Reserve detection, confirmation, pinning, and marker adjustment for Paper Reference Calibration. Specify request-authoritative session normalization, paper-free workspace guards, and legacy restoration that retains previously reviewed paper work under paper mode. Preserve heuristic signals, manual measurements, paper geometry/eligibility, and historical quotations.

This target supersedes the default paper-localization intake behavior described in MS48/MS51/MS53; their paper functionality remains available in paper mode. MS61 MOD-AUTO remains a paper benchmark method. This entry records specification readiness only and does not certify implementation or test completion.

## MS-63: Resilient HEIC Space Image Ingestion, Network-Tolerant Conversion, and Low-Latency Paper Detection Pipeline

**Status:** Implemented (October 21, 2026); automated test suites passing. **Specification:** [IMP-MS63](implementation/ms63.md). **Traceability:** BRD-M1, BRD-M3, BRD-M4, BRD-M5; PRD-F3, PRD-F4, PRD-F10; SDD-C2, SDD-C3, SDD-C4; DSD-UI3, DSD-UI4; QAD-TC78.1 through QAD-TC78.8.

Resolve network-induced HEIC photo upload failures under unstable cellular internet conditions. Eliminate full-resolution computer vision processing bottleneck by constraining OpenCV fiducial search and bilateral filtering to workspace-normalized resolutions (max 1920px), reducing CV execution latency from over 15 seconds to under 150 milliseconds. Introduce resilient client-side transport with exponential backoff retry and request timeouts. Decouple click-guided paper snapping by providing dedicated session-bound snapping (`/snap-paper`), eliminating redundant multi-megabyte image downloads and re-uploads over unstable connections. Preserve local file references and buffer converted workspace blobs on the client to ensure instant, network-resilient modal rendering.

## MS71: Parametric Grille Linear-Meter Pricing Engine, Automated 3D Sub-Bar Geometry Analyzer, and Pattern Repetition Metric Engine

**Status:** Implemented (October 26, 2026); automated unit test suite passing (`npm run test:ms71`). **Specification:** [IMP-MS71](implementation/ms71.md). **Traceability:** BRD-M2, BRD-M3, BRD-M5; PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F11, PRD-F14; SDD-C4, SDD-C7, SDD-C9; DSD-UI4, DSD-UI7, DSD-UI10; ERD-E6, ERD-E13, ERD-E14, ERD-E17; QAD-TC86.1 through QAD-TC86.10.

Replaces area-based approximations with precise per-piece and per-meter measurement of individual horizontal and vertical bars under dynamic pattern repetition for window security grilles. Provides `grilleGeometryAnalyzer.ts` for automated 3D sub-bar geometry inspection of uploaded GLB files or procedural patterns without manual per-bar selection. Implements `grillePricingEngine.ts` calculating exact linear meters and piece counts for perimeter rails, vertical pickets, and horizontal divider/tie bars across Grid, Louver, and Staggered Brick topologies with 12% aluminum scrap allowance, PHP 650.00 fabrication labor floor, and 25% contractor margin. All 10 acceptance scenarios in QAD-TC86 verified.

## MS72: Admin Product Setup Wizard Center-Grille Part Inspector, Single-Click Material Binding, and Linear Calculation Preview

**Status:** Implemented (October 26, 2026); automated unit test suite passing (`npm run test:ms72`). **Specification:** [IMP-MS72](implementation/ms72.md). **Traceability:** BRD-M2, BRD-M4, BRD-M5; PRD-F14, PRD-F19; SDD-C4, SDD-C9; DSD-UI10; ERD-E6, ERD-E17; QAD-TC87.1 through QAD-TC87.10.

Streamlines administrative grille authoring in the Product Setup Wizard by introducing the `GRILLE_LINEAR` dimension binding across database check constraints, TypeScript schemas, and automated filename classification (`window_center_grille`, `grill_bars`, `grille_infill`, `middle_bars`, `picket_lattice`). Enables single-click material assignment per linear meter for the entire center grille assembly without manual one-by-one bar selection. Filters candidate materials to linear extrusion profiles (`/m`) and validates against non-linear material assignment. Renders live 3D bar breakdown summary card in Part Inspector with discrete vertical/horizontal piece counts and cut lengths. Embeds real-time Grille Linear Extrusion Cut List table in Validation Workspace Section updating in under 16ms during width and height slider manipulation. All 10 acceptance scenarios in QAD-TC87 verified.

## MS73: Customer Visualization Workspace Dynamic Grille Sizing, Real-Time Linear BOM Recalculation, and Itemized Quotation/PDF Handoff

**Status:** Implemented (October 26, 2026); automated unit test suite passing (`npm run test:ms73`). **Specification:** [IMP-MS73](implementation/ms73.md). **Traceability:** BRD-M2, BRD-M3, BRD-M4, BRD-M5; PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F11; SDD-C4, SDD-C5, SDD-C7, SDD-C8; DSD-UI4, DSD-UI7, DSD-UI16; ERD-E13, ERD-E14; QAD-TC88.1 through QAD-TC88.10.

Integrates dynamic procedural security grille attachments into customer 3D visualization, interactive dimensional resizing, sub-50ms linear extrusion BOM recalculation, and Philippine fabricator consultation PDF exports. Dynamically generates parametric 3D grille assemblies with adaptive pattern repetition and independent frame finish swatches in under 16ms. Updates real-time pricing factoring linear meters, pickets, divider rails, scrap allowance, and contractor margins. Itemizes grille extrusion specifications in customer quotation modals and consultation PDFs.

## MS74: Admin Accessory Product Role and 5-Step Authoring Workflow

**Status:** Implemented (October 26, 2026); automated unit test suite passing (`npm run test:ms74`). **Specification:** [IMP-MS74](implementation/ms74.md). **Traceability:** BRD-M2, BRD-M4, BRD-M5; PRD-F14, PRD-F19; SDD-C4, SDD-C9; DSD-UI10; ERD-E3, ERD-E6; QAD-TC89.1 through QAD-TC89.10.

Introduces the dedicated Accessory Product Role in admin product authoring, separating standalone modular hardware (handles, locks, doorknobs, rollers, and hinges) from primary architectural fixtures and add-on attachments. Condenses the 7-step wizard into a focused 5-step workflow (Basic Info, Visualization Strategy, Structural Components, Validation Workspace, Review & Publish) omitting irrelevant dimensional parameters and asset uploads. Enforces mutual role exclusivity, provides category-scoped administrative catalog filtering, and enables direct publishing for modular accessories.

## MS75: Admin Part Inspector Swappable Accessory Binding and Position Configuration

**Status:** Implemented (October 26, 2026); automated unit test suite passing (`npm run test:ms75`). **Specification:** [IMP-MS75](implementation/ms75.md). **Traceability:** BRD-M2, BRD-M4, BRD-M5; PRD-F14, PRD-F19; SDD-C4, SDD-C9; DSD-UI10; ERD-E6; QAD-TC90.1 through QAD-TC90.10.

Extends the admin Part Inspector drawer to designate decomposed 3D sub-components as swappable accessory slots. Enables administrators to select accessory categories (handle, lock, roller, hinge), whitelist compatible accessory products, and configure spatial position constraints including horizontal Left/Right and vertical Bottom/Up elevation toggles with millimeter offsets. Automatically maps component classifications to accessory slots and validates configuration before publishing.

## MS76: Customer Visualization Workspace Dynamic Accessory Swapping, Positional Matrix Alignment, and Real-Time Quotation/PDF BOM Handoff

**Status:** Implemented (October 26, 2026); automated unit test suite passing (`npm run test:ms76`). **Specification:** [IMP-MS76](implementation/ms76.md). **Traceability:** BRD-M2, BRD-M3, BRD-M4, BRD-M5; PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F11; SDD-C4, SDD-C5, SDD-C7, SDD-C8; DSD-UI4, DSD-UI7, DSD-UI16; ERD-E3, ERD-E6, ERD-E13, ERD-E14; QAD-TC91.1 through QAD-TC91.10.

Enables customer dynamic hardware accessory swapping inside the 3D visualization workspace (`ProductModelWorkspace.tsx`). Features an interactive Hardware & Accessories dock displaying compatible handles, knobs, and smart digital locks with price deltas and PBR finish swatches (Matte Black, Brushed Chrome, Satin Brass, Stainless Steel). Executes sub-16ms runtime 3D mesh replacement with strict lateral X-axis translation for Left vs Right handings and strict vertical Y-axis translation for Bottom vs Up elevations. Recalculates hardware BOM pricing in under 50ms, itemizes hardware selections in quotation confirmation modals, and prints exact accessory model, finish, and handing in consultation PDF exports for Philippine fabricators. All 10 acceptance scenarios in QAD-TC91 verified.

## MS77: Admin Part Replacement Binding to Registered Accessories

**Status:** Implemented (October 27, 2026); browser acceptance pending. **Specification:** [IMP-MS77](implementation/ms77.md). **Traceability:** BRD-M2, BRD-M4, BRD-M5; PRD-F5, PRD-F14; SDD-C4, SDD-C9; DSD-UI10; ERD-E3, ERD-E6; QAD-TC92.1 through QAD-TC92.10.

Administrators explicitly approve published, renderable Accessories products for each replaceable part. Empty allowlists keep the original part only. Save, publication, customer preview, and new quotation submission enforce current catalog eligibility and the approved part binding. Migration 021 normalizes legacy null allowlists for review.

## MS79: Admin Components Workspace Usability, Material Assignment, Selection Clarity, and Save Integrity

**Status:** Ready for Implementation (plan only, October 28, 2026). **Specification:** [IMP-MS79](implementation/ms79.md). **Traceability:** BRD-M2, BRD-M4, BRD-M5; PRD-F5, PRD-F10, PRD-F14, PRD-F19; SDD-C4, SDD-C7, SDD-C9; DSD-UI10; ERD-E6, ERD-E17; planned QAD-TC94.1 through QAD-TC94.18.

Plans a bounded 60/40 admin Components workbench that keeps the model visible while browsing many materials, a focused allowed/default material chooser, exact part navigation, glass-safe selection outline, and responsive review layout. Also plans explicit save and removal persistence, truthful readiness and upload feedback, accessible controls, and browser acceptance using the existing 18-part Jalousie product. No application code is implemented by this milestone document.

## MS80: Directional Add-on Placement Side Compatibility and Operator-Targeted Multi-Hatch Alignment

**Status:** Implemented (October 29, 2026); automated unit test suite passing (`npm run test:ms80`). **Specification:** [IMP-MS80](implementation/ms80.md). **Traceability:** BRD-M2, BRD-M4, BRD-M5; PRD-F5, PRD-F10, PRD-F14, PRD-F19; SDD-C4, SDD-C5, SDD-C7, SDD-C9; DSD-UI4, DSD-UI7, DSD-UI10; ERD-E3, ERD-E6, ERD-E14; QAD-TC95.1 through QAD-TC95.12.

Enforces directional mounting side compatibility (Front exterior, Back interior, or Both customer selectable) for add-on attachments (insect screens and security grilles) to prevent physical projection collisions on outward-projecting fixtures (awning and casement windows). Dynamically binds screen access hatches directly to host product operating mechanisms (jalousie window operators), automatically cloning and positioning N distinct hatches centered at target operator centroids in 3D space, mirroring handing laterally for left-side operators, and scaling parametric BOM hardware quantities by N. All 12 acceptance scenarios in QAD-TC95 verified.

## MS81: Parametric Jalousie Dynamic Louver and Operator Generation, Automated Pitch Counting, and Per-Piece BOM Pricing Engine

**Status:** Implemented (October 29, 2026); automated unit test suite passing (`npm run test:ms81`). **Specification:** [IMP-MS81](implementation/ms81.md). **Traceability:** BRD-M2, BRD-M4, BRD-M5; PRD-F5, PRD-F10, PRD-F14, PRD-F19; SDD-C4, SDD-C5, SDD-C7, SDD-C9; DSD-UI4, DSD-UI7, DSD-UI10; ERD-E3, ERD-E6, ERD-E14, ERD-E17; QAD-TC96.1 through QAD-TC96.12.

Introduces automated 3D geometry analysis for uploaded jalousie louver and operator meshes (`JW_Louver_Clips_And_Glass.glb` detecting 7 blades at 175mm pitch; `JW_Operators.glb` detecting 2 operators). Dynamically adds or deletes discrete louver glass blades at 175mm pitch intervals during height adjustment without vertical mesh stretching ($scaleY = 1.0$). Automatically scales operator hardware count proportionally ($N_{operators} = \lceil N_{louvers} / 4 \rceil$) and distributes operators along window jamb centroids. Evaluates parametric bill-of-materials costs on a discrete per-piece (`pc`) billing basis for both glass blades and operating mechanisms, feeding into real-time quotation snapshots and consultation PDF handoffs.






