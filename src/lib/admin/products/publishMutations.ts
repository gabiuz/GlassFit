"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import { getProductDraft } from "./productMutations";

export async function activateProduct(productId: string) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // 1. Fetch draft to ensure it exists and has required parts
    const draft = await getProductDraft(productId);
    if (!draft) throw new Error("Product not found.");

    const template = Array.isArray(draft.product_templates) ? draft.product_templates[0] : draft.product_templates;
    if (!template) throw new Error("Product template not found.");

    if (template.model_strategy === "Parametric") {
        if (!template.product_parameters || template.product_parameters.length === 0) {
            throw new Error("Parametric products require at least one parameter.");
        }
        if (!template.product_components || template.product_components.length === 0) {
            throw new Error("Parametric products require at least one component.");
        }
    }

    if (template.model_strategy === "Fixed") {
        const hasFixedModelAsset = draft.product_assets?.some((asset) =>
            (asset.asset_type === "Whole Model" || asset.asset_type === "Catalog 3D Preview") &&
            asset.status === "Active"
        );

        if (!hasFixedModelAsset) {
             throw new Error("Fixed products require a 3D model asset.");
        }
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
