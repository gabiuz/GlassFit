"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import { getProductDraft } from "./productMutations";
import { validateAccessoryApprovalIds } from "./accessoryActions";
import { syncHardwareAccessoryToRawMaterial } from "@/lib/admin/materials/hardwareSync";
import type { AccessoryCategory } from "./types";
import { getProductComponentIssue, isQualifyingModelAsset, requiresComponentMaterial } from "./componentEligibility";

export async function activateProduct(productId: string) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // 1. Fetch draft to ensure it exists and has required parts
    const draft = await getProductDraft(productId);
    if (!draft) throw new Error("Product not found.");

    const template = Array.isArray(draft.product_templates) ? draft.product_templates[0] : draft.product_templates;
    if (!template) throw new Error("Product template not found.");

    // IMP-MS77 / QAD-TC92.5-.8: publication always rechecks current approval state.
    const { data: slots, error: slotsError } = await supabase
        .from("product_components")
        .select("component_name, component_key, accessory_category, allowed_accessory_ids")
        .eq("template_id", template.template_id)
        .eq("is_accessory_slot", true);
    if (slotsError) throw new Error(`Accessory slots could not be checked: ${slotsError.message}`);
    for (const slot of slots || []) {
        await validateAccessoryApprovalIds(
            slot.accessory_category as AccessoryCategory | null,
            slot.allowed_accessory_ids as string[] | null,
            slot.component_name || slot.component_key,
            true,
        );
    }

    const eligibilityContext = {
        modelStrategy: template.model_strategy,
        isAccessory: draft.is_accessory,
        isAddon: draft.is_addon,
    };
    const productIssue = getProductComponentIssue({
        ...eligibilityContext,
        componentsCount: template.product_components?.length ?? 0,
        hasQualifyingModelAsset: draft.product_assets?.some(isQualifyingModelAsset) ?? false,
    });
    if (productIssue) throw new Error(productIssue);
    const unassignedComponent = template.product_components?.find((comp) =>
        requiresComponentMaterial({
            pricingMethod: comp.pricing_method,
            unitPrice: comp.unit_price,
            dimensionBinding: comp.dimension_binding,
        }, eligibilityContext) && !comp.raw_material_id
    );
    if (unassignedComponent) {
        throw new Error(`Activation Blocked: Component "${unassignedComponent.component_name || unassignedComponent.component_key}" has no default material assigned.`);
    }

    if (draft.is_accessory) {
        // Modular hardware accessories (IMP-MS74, IMP-MS78):
        // Bypasses 2D/3D assets and scalar parametric dimension rules.
        // Fixed hardware accessories do not require catalog raw material mappings.
    } else if (draft.is_addon) {
        // Procedural add-on accessories (IMP-MS70):
        // Bypasses 2D/3D assets and 3D component model requirements.
    } else if (template.model_strategy === "Parametric") {
        if (!template.product_parameters || template.product_parameters.length === 0) {
            throw new Error("Parametric products require at least one parameter.");
        }
    } else if (template.model_strategy === "Fixed") {
    }


    // 2. Publish the template first so the customer-side loader can find it
    // as soon as the product becomes visible in the catalog.
    const { error: templateError } = await supabase
        .from("product_templates")
        .update({
            status: "Active",
            updated_by: adminCtx.profileId,
            updated_at: new Date().toISOString()
        })
        .eq("template_id", template.template_id);

    if (templateError) {
        console.error("Failed to activate product template:", templateError);
        throw new Error(templateError.message);
    }

    // 3. Update product status to Active
    const { error } = await supabase
        .from("products")
        .update({
            status: "Active",
            updated_by: adminCtx.profileId,
            updated_at: new Date().toISOString()
        })
        .eq("product_id", productId);

    if (error) {
        console.error("Failed to activate product:", error);
        throw new Error(error.message);
    }

    if (draft.is_accessory) {
        await syncHardwareAccessoryToRawMaterial(supabase, {
            productId: draft.product_id,
            productName: draft.product_name,
            basePrice: draft.base_price,
            status: "Active",
        });
    }

    // 4. Revalidate frontend paths
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/admin/products/${productId}/setup`);
    revalidatePath(`/admin/products`);
    revalidatePath(`/product`);
    revalidatePath(`/product-details/${productId}`);
    revalidatePath(`/visualize/${productId}/upload`);
    revalidatePath(`/visualize/${productId}/workspace`);

    return true;
}
