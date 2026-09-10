"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import type { DimensionBinding, PresentationCategory } from "@/lib/pricing/types";

export type ComponentType = "Procedural" | "Model" | "Glass" | "Frame" | "Panel" | "Hardware" | "Other";

export type UpsertComponentInput = {
    templateId: string;
    componentKey: string;
    componentName: string;
    componentType: ComponentType;
    baseQuantity: number;
    rawMaterialId?: string | null;
    dimensionBinding?: DimensionBinding;
    spanRatio?: number;
    isRemovable?: boolean;
    togglePropertyKey?: string | null;
    presentationCategory?: PresentationCategory;
    glbFileUrl?: string | null;
    assemblyGroup?: string;
    componentData?: Record<string, unknown>; // To store source_dimensions_mm, etc.
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

    const payload = {
        component_name: input.componentName,
        component_type: input.componentType,
        base_quantity: input.baseQuantity,
        raw_material_id: input.rawMaterialId || null,
        dimension_binding: input.dimensionBinding || "FIXED",
        span_ratio: typeof input.spanRatio === "number" ? input.spanRatio : 1.0,
        is_removable: Boolean(input.isRemovable),
        toggle_property_key: input.togglePropertyKey || null,
        presentation_category: input.presentationCategory || "Framing",
        glb_file_url: input.glbFileUrl || null,
        component_data: mergedComponentData,
        updated_by: adminCtx.profileId,
    };

    if (existing) {
        const { data, error } = await supabase
            .from("product_components")
            .update(payload)
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
                component_key: input.componentKey,
                status: "Active",
                ...payload,
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

    if (!finalData) {
        throw new Error("Product component could not be saved.");
    }

    return finalData.component_id;
}

