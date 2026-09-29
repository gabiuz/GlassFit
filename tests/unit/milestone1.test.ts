import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  RawMaterialSchema,
  ProductComponentBindingSchema,
  StructuralRulePayloadSchema,
  QuotationBOMSummarySchema,
} from "../../src/lib/pricing/types.js";
import { UpsertRawMaterialInputSchema } from "../../src/lib/admin/materials/types.js";

describe("Milestone 1: Database Schema & Seed Migration Validation", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/005_parametric_pricing_engine.sql"
  );

  it("should have migration 005_parametric_pricing_engine.sql file present", () => {
    assert.strictEqual(fs.existsSync(migrationPath), true);
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert.strictEqual(sqlContent.length > 500, true);
  });

  it("should contain DDL for public.raw_materials table with appropriate columns and constraints", () => {
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert.strictEqual(sqlContent.includes("create table if not exists public.raw_materials"), true);
    assert.strictEqual(sqlContent.includes("material_code varchar(50) unique not null"), true);
    assert.strictEqual(sqlContent.includes("category varchar(50) not null"), true);
    assert.strictEqual(sqlContent.includes("finish_type varchar(50) not null"), true);
    assert.strictEqual(sqlContent.includes("billing_unit varchar(20) not null"), true);
    assert.strictEqual(sqlContent.includes("unit_price numeric(10, 2) not null"), true);
    assert.strictEqual(sqlContent.includes("waste_allowance numeric(4, 3) not null default 0.000"), true);
    assert.strictEqual(sqlContent.includes("is_active boolean not null default true"), true);
  });

  it("should contain alter table statements for product_components binding columns", () => {
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert.strictEqual(sqlContent.includes("alter table public.product_components"), true);
    assert.strictEqual(sqlContent.includes("raw_material_id uuid references public.raw_materials(id)"), true);
    assert.strictEqual(sqlContent.includes("dimension_binding varchar(20) not null default 'FIXED'"), true);
    assert.strictEqual(sqlContent.includes("span_ratio numeric(5, 4) not null default 1.0000"), true);
    assert.strictEqual(sqlContent.includes("is_removable boolean not null default false"), true);
    assert.strictEqual(sqlContent.includes("toggle_property_key varchar(50)"), true);
    assert.strictEqual(sqlContent.includes("presentation_category varchar(50) not null default 'Framing'"), true);
    assert.strictEqual(sqlContent.includes("glb_file_url text"), true);
  });

  it("should contain alter table statements for quotation_items grouping & waiver flags", () => {
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert.strictEqual(sqlContent.includes("alter table public.quotation_items"), true);
    assert.strictEqual(sqlContent.includes("item_group_name varchar(100) not null default 'Aluminum Framing'"), true);
    assert.strictEqual(sqlContent.includes("structural_waiver boolean not null default false"), true);
  });

  it("should contain benchmark seed data matching docs/pricing.md Section 3.1", () => {
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    const requiredBenchmarkCodes = [
      "mat_al_798_head_anlk",
      "mat_al_798_sill_anlk",
      "mat_al_798_jamb_anlk",
      "mat_al_798_rail_anlk",
      "mat_al_798_stle_anlk",
      "mat_al_798_head_pcw",
      "mat_al_798_sill_pcw",
      "mat_al_798_jamb_pcw",
      "mat_al_798_rail_pcw",
      "mat_al_798_stle_pcw",
      "mat_gl_6mm_float_brz",
      "mat_gl_6mm_float_clr",
      "mat_gl_6mm_tempered",
      "mat_hw_798_roller",
      "mat_hw_flush_lock",
      "mat_hw_guide_caps",
      "mat_cons_sealant",
      "mat_cons_epdm_gasket",
    ];

    for (const code of requiredBenchmarkCodes) {
      assert.strictEqual(sqlContent.includes(code), true, `Missing benchmark code: ${code}`);
    }
  });

  it("should validate RawMaterial Zod schema against sample benchmark objects", () => {
    const sampleAnalokHead = {
      id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
      material_code: "mat_al_798_head_anlk",
      description: "Series 798 Double Head",
      category: "Aluminum",
      finish_type: "Analok",
      billing_unit: "m",
      unit_price: 90.0,
      waste_allowance: 0.12,
      is_active: true,
    };

    const parsed = RawMaterialSchema.safeParse(sampleAnalokHead);
    assert.strictEqual(parsed.success, true);
  });

  it("should validate ProductComponentBinding Zod schema for removable sill & sash rails", () => {
    const sampleSill = {
      template_id: "b2c3d4e5-f6a7-4b2c-9d3e-4f5a6b7c8d9e",
      component_key: "series_798_sill",
      component_name: "Series 798 Double Sill Track",
      raw_material_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
      dimension_binding: "WIDTH",
      span_ratio: 1.0,
      base_quantity: 1,
      is_removable: true,
      toggle_property_key: "has_sill",
      presentation_category: "Framing",
      glb_file_url: "https://pub-r2.storage.com/models/798_double_sill.glb",
    };

    const parsedSill = ProductComponentBindingSchema.safeParse(sampleSill);
    assert.strictEqual(parsedSill.success, true);

    const sampleRail = {
      template_id: "b2c3d4e5-f6a7-4b2c-9d3e-4f5a6b7c8d9e",
      component_key: "series_798_sash_rails",
      component_name: "Series 798 Sash Horizontal Rails",
      dimension_binding: "WIDTH",
      span_ratio: 0.5,
      base_quantity: 4,
      is_removable: false,
      toggle_property_key: null,
      presentation_category: "Framing",
    };

    const parsedRail = ProductComponentBindingSchema.safeParse(sampleRail);
    assert.strictEqual(parsedRail.success, true);
  });

  it("should validate StructuralRulePayload Zod schema for 2400mm width guardrail", () => {
    const sampleRulePayload = {
      rule_name: "Width Guardrail Threshold (3-Panel Split)",
      trigger_condition: {
        parameter: "quotation_width",
        operator: ">=",
        value_mm: 2400,
      },
      action_payload: {
        enforce_panel_count: 3,
        ui_prompt: "PROMPT_MODAL_BEHAVIOR_B",
        mutations: [
          {
            target_category: "Sash Rails",
            update_span_ratio: 0.3333,
            update_base_quantity: 6,
          },
          {
            target_category: "Sash Stiles",
            update_base_quantity: 6,
          },
          {
            target_component: "mat_hw_798_roller",
            update_base_quantity: 6,
          },
        ],
      },
    };

    const parsed = StructuralRulePayloadSchema.safeParse(sampleRulePayload);
    assert.strictEqual(parsed.success, true);
  });

  it("should validate FrozenPricingDetails and QuotationBOMSummary schemas", () => {
    const sampleBOMSummary = {
      total_estimated_amount: 4362.93,
      currency: "PHP",
      has_sill: true,
      structural_waiver: false,
      groups: [
        {
          item_group_name: "Aluminum Framing",
          quantity: 1,
          unit_label: "lot",
          unit_price: 1069.82,
          estimated_subtotal: 1069.82,
          structural_waiver: false,
          pricing_details: {
            width_m: 1.2,
            height_m: 1.2,
            panel_count: 2,
            has_sill: true,
            finish_type: "Analok",
            glass_type: "mat_gl_6mm_float_brz",
            items_breakdown: [
              {
                code: "mat_al_798_head_anlk",
                description: "Series 798 Double Head",
                quantity: 1.2,
                unit: "m",
                unit_price: 90.0,
                waste_factor: 0.12,
                subtotal: 108.0,
              },
            ],
            raw_material_subtotal: 955.2,
            waste_allowance_subtotal: 114.62,
            direct_material_subtotal: 1069.82,
            labor_cost: 750.0,
            contractor_margin: 872.59,
            margin_rate: 0.25,
            total_estimate: 4362.93,
          },
        },
      ],
    };

    const parsed = QuotationBOMSummarySchema.safeParse(sampleBOMSummary);
    assert.strictEqual(parsed.success, true);
  });

  it("should validate admin UpsertRawMaterialInputSchema validation rules", () => {
    const valid = {
      material_code: "mat_test_profile_01",
      description: "Test Custom Extrusion",
      category: "Aluminum",
      finish_type: "PowderCoatedWhite",
      billing_unit: "m",
      unit_price: 150.5,
      waste_allowance: 0.15,
      is_active: true,
    };
    assert.strictEqual(UpsertRawMaterialInputSchema.safeParse(valid).success, true);

    const invalidPrice = { ...valid, unit_price: -10 };
    assert.strictEqual(UpsertRawMaterialInputSchema.safeParse(invalidPrice).success, false);

    const invalidWaste = { ...valid, waste_allowance: 1.5 };
    assert.strictEqual(UpsertRawMaterialInputSchema.safeParse(invalidWaste).success, false);
  });
});
