"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import {
    normalizeMaterialBindings,
    type ComponentMaterialBindingInput,
} from "@/lib/pricing/materialBindingUtils";
import type {
    UpsertComponentInput,
    UpsertComponentPayload,
} from "./types";
import { validateAccessoryApprovalIds } from "./accessoryActions";

export async function upsertProductComponent(input: UpsertComponentInput): Promise<string> {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    let requireAccessoryOptions = false;
    if (input.isAccessorySlot) {
        const { data: template, error: templateError } = await supabase
            .from("product_templates")
            .select("product_id")
            .eq("template_id", input.templateId)
            .single();
        if (templateError || !template) throw new Error("Product template could not be checked before saving its accessory slot.");
        const { data: product, error: productError } = await supabase
            .from("products")
            .select("status")
            .eq("product_id", template.product_id)
            .single();
        if (productError || !product) throw new Error("Product status could not be checked before saving its accessory slot.");
        requireAccessoryOptions = product.status === "Active";
    }
    const approvedAccessoryIds = input.isAccessorySlot
        ? await validateAccessoryApprovalIds(input.accessoryCategory, input.allowedAccessoryIds, input.componentName, requireAccessoryOptions)
        : [];

    // Check if component already exists for this template/key
    const { data: existing } = await supabase
        .from("product_components")
        .select("component_id")
        .eq("template_id", input.templateId)
        .eq("component_key", input.componentKey)
        .single();

    let finalData: { component_id: string } | null = null;
    let finalError: Error | { message: string } | null = null;

    // Normalize material bindings if provided
    let normalizedBindings: ComponentMaterialBindingInput[] | undefined = undefined;
    let resolvedRawMaterialId: string | null = input.rawMaterialId || null;

    if (input.materialBindings !== undefined) {
        normalizedBindings = normalizeMaterialBindings(input.materialBindings);
        const defaultBinding = normalizedBindings.find((b) => b.isDefault);
        resolvedRawMaterialId = defaultBinding ? defaultBinding.rawMaterialId : null;
    }

    // We inject assembly_group and handing_metadata into component_data if provided
    const mergedComponentData = {
        ...(input.componentData || {}),
        assembly_group: input.assemblyGroup || undefined,
        ...(input.handingMetadata ? { handing_metadata: input.handingMetadata } : {}),
    };

    const payload = {
        component_name: input.componentName,
        component_type: input.componentType,
        base_quantity: input.baseQuantity,
        raw_material_id: resolvedRawMaterialId,
        unit_price: Math.max(0, Number(input.unitPrice ?? 0)),
        pricing_method: input.pricingMethod || (input.unitPrice !== undefined && input.unitPrice > 0 ? "Fixed" : "Included"),
        dimension_binding: input.dimensionBinding || "FIXED",
        span_ratio: typeof input.spanRatio === "number" ? input.spanRatio : 1.0,
        is_removable: Boolean(input.isRemovable),
        toggle_property_key: input.togglePropertyKey || null,
        presentation_category: input.presentationCategory || "Framing",
        glb_file_url: input.glbFileUrl || null,
        component_data: mergedComponentData,
        is_accessory_slot: Boolean(input.isAccessorySlot),
        accessory_category: input.isAccessorySlot ? (input.accessoryCategory || null) : null,
        allowed_accessory_ids: approvedAccessoryIds,
        position_options: input.positionOptions || {
            allowHorizontalToggle: true,
            defaultHorizontal: "right",
            horizontalOffsetMm: 45,
            allowVerticalToggle: false,
            defaultVertical: "up",
            verticalOffsetMm: 1000,
        },
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

    const componentId = finalData.component_id;

    // Synchronize product_component_materials junction rows
    if (normalizedBindings !== undefined) {
        if (normalizedBindings.length === 0) {
            // Delete all existing bindings
            const { error: delError } = await supabase
                .from("product_component_materials")
                .delete()
                .eq("product_component_id", componentId);

            if (delError) {
                console.error("Failed to clear product component materials:", delError);
            }
        } else {
            const rawMaterialIds = normalizedBindings.map((b) => b.rawMaterialId);

            // 1. Delete rows not in candidate list
            await supabase
                .from("product_component_materials")
                .delete()
                .eq("product_component_id", componentId)
                .not("raw_material_id", "in", `(${rawMaterialIds.join(",")})`);

            // 2. Clear default flag to avoid unique constraint collision
            await supabase
                .from("product_component_materials")
                .update({ is_default: false })
                .eq("product_component_id", componentId);

            // 3. Upsert candidate bindings with target is_default
            for (const binding of normalizedBindings) {
                const { error: upsertMatError } = await supabase
                    .from("product_component_materials")
                    .upsert(
                        {
                            product_component_id: componentId,
                            raw_material_id: binding.rawMaterialId,
                            is_default: binding.isDefault,
                            display_order: binding.displayOrder ?? 0,
                            updated_at: new Date().toISOString(),
                        },
                        {
                            onConflict: "product_component_id,raw_material_id",
                        }
                    );

                if (upsertMatError) {
                    console.error("Failed to upsert product component material row:", upsertMatError);
                }
            }
        }
    } else if (resolvedRawMaterialId) {
        // Fallback for legacy calls: ensure single default entry exists
        await supabase
            .from("product_component_materials")
            .upsert(
                {
                    product_component_id: componentId,
                    raw_material_id: resolvedRawMaterialId,
                    is_default: true,
                    display_order: 0,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "product_component_id,raw_material_id",
                }
            );
    }

    return componentId;
}

export async function upsertProductComponentWithMaterials(
    payload: UpsertComponentPayload
): Promise<{ success: boolean; componentId: string; error?: string }> {
    try {
        let templateId = payload.templateId;

        if (!templateId && payload.productId) {
            const supabase = await createSupabaseServerClient();
            const { data: template } = await supabase
                .from("product_templates")
                .select("template_id")
                .eq("product_id", payload.productId)
                .single();

            if (template) {
                templateId = template.template_id;
            }
        }

        if (!templateId) {
            return {
                success: false,
                componentId: "",
                error: "Missing required templateId or productId to resolve product template.",
            };
        }

        const componentId = await upsertProductComponent({
            templateId,
            componentKey: payload.componentKey,
            componentName: payload.componentName,
            componentType: payload.componentType,
            baseQuantity: payload.baseQuantity,
            rawMaterialId: payload.rawMaterialId,
            dimensionBinding: payload.dimensionBinding,
            spanRatio: payload.spanRatio,
            isRemovable: payload.isRemovable,
            togglePropertyKey: payload.togglePropertyKey,
            presentationCategory: payload.presentationCategory,
            glbFileUrl: payload.glbFileUrl,
            assemblyGroup: payload.assemblyGroup,
            componentData: payload.componentData,
            materialBindings: payload.materialBindings,
            isAccessorySlot: payload.isAccessorySlot,
            accessoryCategory: payload.accessoryCategory,
            allowedAccessoryIds: payload.allowedAccessoryIds,
            positionOptions: payload.positionOptions,
            unitPrice: payload.unitPrice,
            pricingMethod: payload.pricingMethod,
            handingMetadata: payload.handingMetadata,
        });

        return {
            success: true,
            componentId,
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error upserting component with materials";
        console.error("upsertProductComponentWithMaterials error:", err);
        return {
            success: false,
            componentId: "",
            error: message,
        };
    }
}
