"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import { deleteProductAssets } from "./assetUpload";

export type CreateProductInput = {
    product_name: string;
    product_type: string;
    description: string;
    base_price: number;
};

export async function createProductDraft(input: CreateProductInput) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("products")
        .insert({
            product_name: input.product_name,
            product_type: input.product_type,
            description: input.description,
            base_price: input.base_price,
            status: "Inactive", // Draft state
            created_by: adminCtx.profileId,
            updated_by: adminCtx.profileId,
        })
        .select("product_id")
        .single();

    if (error) {
        console.error("Failed to create product:", error);
        throw new Error(error.message);
    }

    revalidatePath("/admin/products");
    return data.product_id;
}

export type UpsertTemplateInput = {
    model_strategy: "Fixed" | "Parametric";
    builder_key?: string;
};

export async function upsertProductTemplate(productId: string, input: UpsertTemplateInput) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // Check if template exists
    const { data: existing } = await supabase
        .from("product_templates")
        .select("template_id")
        .eq("product_id", productId)
        .single();

    let error;

    if (existing) {
        // Update
        const { error: updateError } = await supabase
            .from("product_templates")
            .update({
                model_strategy: input.model_strategy,
                base_configuration: input.model_strategy === "Parametric" ? { builder_key: input.builder_key } : null,
                updated_by: adminCtx.profileId,
            })
            .eq("template_id", existing.template_id);
        error = updateError;
    } else {
        // Insert
        // Need to get the product to use its name for template_name, or just default it
        const { data: product } = await supabase
            .from("products")
            .select("product_name")
            .eq("product_id", productId)
            .single();

        const { error: insertError } = await supabase
            .from("product_templates")
            .insert({
                product_id: productId,
                template_name: product ? `${product.product_name} Template` : "Default Template",
                model_strategy: input.model_strategy,
                measurement_unit: "mm",
                base_configuration: input.model_strategy === "Parametric" ? { builder_key: input.builder_key } : null,
                status: "Inactive", // Keep inactive during draft
                created_by: adminCtx.profileId,
                updated_by: adminCtx.profileId,
            });
        error = insertError;
    }

    if (error) {
        console.error("Failed to upsert product template:", error);
        throw new Error(error.message);
    }

    revalidatePath(`/admin/products/${productId}/setup`);
    
    // We need to return the template_id so the UI state has it for the next steps
    const { data: finalTemplate } = await supabase
        .from("product_templates")
        .select("template_id")
        .eq("product_id", productId)
        .single();
        
    return finalTemplate?.template_id;
}

export async function getProductDraft(productId: string) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    const { data: product, error } = await supabase
        .from("products")
        .select(`
            product_id,
            product_name,
            product_type,
            description,
            base_price,
            status,
            product_templates (
                template_id,
                model_strategy,
                base_configuration,
                product_components (
                    component_id,
                    component_key,
                    component_name,
                    component_type,
                    base_quantity,
                    component_data
                ),
                product_parameters (
                    parameter_id,
                    parameter_key,
                    parameter_name,
                    parameter_type,
                    minimum_value,
                    maximum_value,
                    default_value,
                    step_value,
                    unit,
                    affects_structure,
                    display_order
                ),
                structural_rules (
                    rule_id,
                    rule_name,
                    priority,
                    condition_data,
                    action_data
                )
            ),
            product_assets (
                asset_id,
                asset_type,
                file_name,
                mime_type,
                byte_size,
                r2_object_key,
                component_id
            )
        `)
        .eq("product_id", productId)
        .single();

    if (error) {
        if (error.code !== "PGRST116") {
            console.error("Failed to get product draft:", error);
        }
        return null;
    }

    return product;
}

export async function deleteProduct(productId: string) {
    await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // 1. Fetch all assets associated with this product to delete them from R2
    const { data: assets, error: assetError } = await supabase
        .from("product_assets")
        .select("r2_object_key")
        .eq("product_id", productId);
        
    if (assetError) {
        console.error("Failed to fetch assets for deletion:", assetError);
        throw new Error(assetError.message);
    }

    const objectKeys = assets?.map(a => a.r2_object_key).filter(Boolean) as string[];
    
    // 2. Delete from R2
    if (objectKeys.length > 0) {
        await deleteProductAssets(objectKeys);
    }

    // 3. Delete from Supabase (cascades to templates, components, rules, and assets in the DB)
    const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("product_id", productId);

    if (deleteError) {
        console.error("Failed to delete product:", deleteError);
        throw new Error(deleteError.message);
    }

    revalidatePath("/admin/products");
    return true;
}
