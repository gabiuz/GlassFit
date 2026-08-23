"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";

export type ComponentType = "Procedural" | "Model" | "Glass" | "Frame" | "Panel" | "Hardware" | "Other";

export type UpsertComponentInput = {
    templateId: string;
    componentKey: string;
    componentName: string;
    componentType: ComponentType;
    baseQuantity: number;
    assemblyGroup?: string;
    componentData?: any; // To store source_dimensions_mm, etc.
};

export async function upsertProductComponent(input: UpsertComponentInput) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // Check if component already exists for this template/key
    const { data: existing } = await supabase
        .from("product_components")
        .select("component_id")
        .eq("template_id", input.templateId)
        .eq("component_key", input.componentKey)
        .single();

    let finalData;
    let finalError;

    // We inject assembly_group into component_data if provided
    const mergedComponentData = {
        ...(input.componentData || {}),
        assembly_group: input.assemblyGroup || undefined,
    };

    if (existing) {
        const { data, error } = await supabase
            .from("product_components")
            .update({
                component_name: input.componentName,
                component_type: input.componentType,
                base_quantity: input.baseQuantity,
                component_data: mergedComponentData,
                updated_by: adminCtx.profileId,
            })
            .eq("component_id", existing.component_id)
            .select("component_id")
            .single();

        finalData = data;
        finalError = error;
    } else {
        const { data, error } = await supabase
            .from("product_components")
            .insert({
                template_id: input.templateId,
                created_by: adminCtx.profileId,
                updated_by: adminCtx.profileId,
                component_key: input.componentKey,
                component_name: input.componentName,
                component_type: input.componentType,
                base_quantity: input.baseQuantity,
                component_data: mergedComponentData,
                status: "Active",
            })
            .select("component_id")
            .single();
            
        finalData = data;
        finalError = error;
    }

    if (finalError) {
        console.error("Failed to upsert product component:", finalError);
        throw new Error(finalError.message);
    }

    return finalData.component_id;
}
