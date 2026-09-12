"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";

export interface DuplicatePresetResult {
  newProductId: string;
  newProductName: string;
  templateId: string;
}

/**
 * Clones an existing product template, its parameters, component bindings (including raw material references),
 * structural rules, and asset links into a new Inactive draft product in under 2 seconds.
 */
export async function duplicateProductPreset(
  sourceProductId: string,
  newProductName?: string
): Promise<DuplicatePresetResult> {
  const adminCtx = await requirePermission("manage_products");
  const supabase = await createSupabaseServerClient();

  // 1. Fetch source product and its full relational graph
  const { data: source, error: sourceError } = await supabase
    .from("products")
    .select(`
      product_id,
      product_name,
      product_type,
      description,
      base_price,
      product_templates (
        template_id,
        template_name,
        model_strategy,
        measurement_unit,
        base_configuration,
        product_parameters (
          parameter_key,
          parameter_name,
          parameter_type,
          minimum_value,
          maximum_value,
          default_value,
          step_value,
          unit,
          affects_structure,
          display_order,
          status
        ),
        product_components (
          component_id,
          component_key,
          component_name,
          component_type,
          base_quantity,
          raw_material_id,
          dimension_binding,
          span_ratio,
          is_removable,
          toggle_property_key,
          presentation_category,
          glb_file_url,
          component_data,
          status
        ),
        structural_rules (
          rule_name,
          priority,
          condition_data,
          action_data,
          status
        )
      ),
      product_assets (
        asset_type,
        file_name,
        mime_type,
        byte_size,
        r2_object_key,
        component_id,
        is_primary,
        display_order,
        status
      )
    `)
    .eq("product_id", sourceProductId)
    .single();

  if (sourceError || !source) {
    console.error("Failed to load source product for duplication:", sourceError);
    throw new Error(`Source product not found: ${sourceError?.message || "Not found"}`);
  }

  const generatedName = newProductName?.trim() || `${source.product_name} (Copy)`;

  // 2. Insert new draft product
  const { data: newProduct, error: insertProductError } = await supabase
    .from("products")
    .insert({
      product_name: generatedName,
      product_type: source.product_type,
      description: source.description,
      base_price: source.base_price,
      status: "Inactive", // Always draft
      created_by: adminCtx.profileId,
      updated_by: adminCtx.profileId,
    })
    .select("product_id")
    .single();

  if (insertProductError || !newProduct) {
    console.error("Failed to create duplicated product:", insertProductError);
    throw new Error(`Failed to create duplicate: ${insertProductError?.message}`);
  }

  const newProductId = newProduct.product_id;
  const sourceTemplates = Array.isArray(source.product_templates)
    ? source.product_templates
    : source.product_templates
    ? [source.product_templates]
    : [];

  let newTemplateId = "";

  // 3. Clone template and nested entities
  for (const srcTemplate of sourceTemplates) {
    const { data: createdTemplate, error: templateInsertError } = await supabase
      .from("product_templates")
      .insert({
        product_id: newProductId,
        template_name: `${generatedName} Template`,
        model_strategy: srcTemplate.model_strategy,
        measurement_unit: srcTemplate.measurement_unit,
        base_configuration: srcTemplate.base_configuration,
        status: "Inactive",
        created_by: adminCtx.profileId,
        updated_by: adminCtx.profileId,
      })
      .select("template_id")
      .single();

    if (templateInsertError || !createdTemplate) {
      console.error("Failed to create duplicated template:", templateInsertError);
      throw new Error(`Failed to clone template: ${templateInsertError?.message}`);
    }

    newTemplateId = createdTemplate.template_id;

    // A. Clone Parameters
    const srcParams = srcTemplate.product_parameters || [];
    if (srcParams.length > 0) {
      const paramsToInsert = srcParams.map((p) => ({
        template_id: newTemplateId,
        parameter_key: p.parameter_key,
        parameter_name: p.parameter_name,
        parameter_type: p.parameter_type,
        minimum_value: p.minimum_value,
        maximum_value: p.maximum_value,
        default_value: p.default_value,
        step_value: p.step_value,
        unit: p.unit,
        affects_structure: p.affects_structure,
        display_order: p.display_order,
        status: "Active",
        created_by: adminCtx.profileId,
        updated_by: adminCtx.profileId,
      }));

      const { error: paramsError } = await supabase
        .from("product_parameters")
        .insert(paramsToInsert);

      if (paramsError) {
        console.error("Failed to clone parameters:", paramsError);
      }
    }

    // B. Clone Components (Keep track of old component_id -> new component_id for asset mapping)
    const srcComponents = srcTemplate.product_components || [];
    const componentIdMap = new Map<string, string>();

    for (const comp of srcComponents) {
      const { data: newComp, error: compError } = await supabase
        .from("product_components")
        .insert({
          template_id: newTemplateId,
          component_key: comp.component_key,
          component_name: comp.component_name,
          component_type: comp.component_type,
          base_quantity: comp.base_quantity,
          raw_material_id: comp.raw_material_id,
          dimension_binding: comp.dimension_binding || "FIXED",
          span_ratio: comp.span_ratio ?? 1.0,
          is_removable: comp.is_removable ?? false,
          toggle_property_key: comp.toggle_property_key,
          presentation_category: comp.presentation_category || "Framing",
          glb_file_url: comp.glb_file_url,
          component_data: comp.component_data,
          status: "Active",
          created_by: adminCtx.profileId,
          updated_by: adminCtx.profileId,
        })
        .select("component_id")
        .single();

      if (!compError && newComp) {
        componentIdMap.set(comp.component_id, newComp.component_id);
      }
    }

    // C. Clone Structural Rules
    const srcRules = srcTemplate.structural_rules || [];
    if (srcRules.length > 0) {
      const rulesToInsert = srcRules.map((r) => ({
        template_id: newTemplateId,
        rule_name: r.rule_name,
        priority: r.priority,
        condition_data: r.condition_data,
        action_data: r.action_data,
        status: "Active",
        created_by: adminCtx.profileId,
        updated_by: adminCtx.profileId,
      }));

      const { error: rulesError } = await supabase
        .from("structural_rules")
        .insert(rulesToInsert);

      if (rulesError) {
        console.error("Failed to clone structural rules:", rulesError);
      }
    }
  }

  // 4. Clone Asset references (Sharing R2 object keys without re-uploading)
  const srcAssets = source.product_assets || [];
  if (srcAssets.length > 0) {
    const assetsToInsert = srcAssets.map((asset) => {
      const mappedComponentId = asset.component_id
        ? (sourceTemplates[0]?.product_components?.find(
            (c) => c.component_id === asset.component_id
          )?.component_id
            ? asset.component_id
            : null)
        : null;

      return {
        product_id: newProductId,
        template_id: newTemplateId || null,
        component_id: mappedComponentId,
        asset_type: asset.asset_type,
        file_name: asset.file_name,
        mime_type: asset.mime_type,
        byte_size: asset.byte_size,
        r2_object_key: asset.r2_object_key,
        is_primary: asset.is_primary,
        display_order: asset.display_order ?? 0,
        status: "Active",
        created_by: adminCtx.profileId,
        updated_by: adminCtx.profileId,
      };
    });

    const { error: assetsError } = await supabase
      .from("product_assets")
      .insert(assetsToInsert);

    if (assetsError) {
      console.error("Failed to clone asset references:", assetsError);
    }
  }

  revalidatePath("/admin/products");
  return {
    newProductId,
    newProductName: generatedName,
    templateId: newTemplateId,
  };
}
