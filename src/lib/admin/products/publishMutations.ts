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
        if (!draft.product_assets || draft.product_assets.length === 0) {
             throw new Error("Fixed products require a 3D model asset.");
        }
    }

    // 2. Update status to Active
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

    // 3. Revalidate frontend paths
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/admin/products`);
    revalidatePath(`/products`);
    revalidatePath(`/products/${productId}`);

    return true;
}
