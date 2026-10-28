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

    // Normalize material bindings if provided
    let normalizedBindings: ComponentMaterialBindingInput[] | undefined = undefined;
    let resolvedRawMaterialId: string | null = input.rawMaterialId || null;

    if (input.materialBindings !== undefined) {
        normalizedBindings = normalizeMaterialBindings(input.materialBindings);
        if (new Set(normalizedBindings.map((binding) => binding.rawMaterialId)).size !== normalizedBindings.length ||
            normalizedBindings.some((binding) => !binding.rawMaterialId || !Number.isInteger(binding.displayOrder) || (binding.displayOrder ?? 0) < 0)) {
            throw new Error("Component material bindings must have unique materials and valid display orders.");
        }
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

    const bindings = normalizedBindings ?? (resolvedRawMaterialId
        ? [{ rawMaterialId: resolvedRawMaterialId, isDefault: true, displayOrder: 0 }]
        : []);
    const { data: componentId, error } = await supabase.rpc("save_product_component_with_materials", {
        p_template_id: input.templateId,
        p_component_key: input.componentKey,
        p_component: payload,
        p_bindings: bindings.map((binding) => ({
            raw_material_id: binding.rawMaterialId,
            is_default: binding.isDefault,
            display_order: binding.displayOrder ?? 0,
        })),
    });
    if (error) throw new Error(`Product component could not be saved: ${error.message}`);
    if (typeof componentId !== "string") throw new Error("Product component save was not confirmed.");
    return componentId;
}

/** Remove one persisted component in the authorized admin context (IMP-MS79, ERD-E6). */
export async function deleteProductComponent(templateId: string, componentKey: string): Promise<void> {
    await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: lookupError } = await supabase
        .from("product_components")
        .select("component_id")
        .eq("template_id", templateId)
        .eq("component_key", componentKey)
        .maybeSingle();
    if (lookupError) throw new Error(`Could not check component before removal: ${lookupError.message}`);
    if (!existing) return;

    // Check dependent records before the database cascade. R2 objects are not purged here:
    // the same object key can be referenced by another component or product asset.
    const [{ error: bindingsError }, { error: assetsError }] = await Promise.all([
        supabase.from("product_component_materials").select("id", { count: "exact", head: true }).eq("product_component_id", existing.component_id),
        supabase.from("product_assets").select("asset_id", { count: "exact", head: true }).eq("component_id", existing.component_id),
    ]);
    if (bindingsError) throw new Error(`Could not check component material bindings: ${bindingsError.message}`);
    if (assetsError) throw new Error(`Could not check component asset references: ${assetsError.message}`);

    const { data: deleted, error: deleteError } = await supabase
        .from("product_components")
        .delete()
        .eq("component_id", existing.component_id)
        .eq("template_id", templateId)
        .select("component_id");
    if (deleteError) throw new Error(`Could not remove component: ${deleteError.message}`);
    if (!deleted?.length) throw new Error("Component removal was not confirmed. Please retry.");
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
