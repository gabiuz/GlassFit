"use server";

import { requirePermission } from "@/lib/auth/admin";
import { getDraftStructuralDefinition } from "@/lib/visualization/structuralData";
import { ProductStructuralDefinition } from "@/lib/visualization/types";

export async function fetchDraftStructuralDefinition(productId: string): Promise<ProductStructuralDefinition> {
    await requirePermission("manage_products");
    return await getDraftStructuralDefinition(productId);
}
