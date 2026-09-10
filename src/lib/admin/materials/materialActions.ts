"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import {
  UpsertRawMaterialInputSchema,
  BatchUpdateMaterialPricesInputSchema,
  RawMaterialsFilterSchema,
  type UpsertRawMaterialInput,
  type BatchUpdateMaterialPricesInput,
  type RawMaterialsFilter,
  type RawMaterial,
} from "./types";

/**
 * Fetch all raw materials with optional category, finish, active status, and search filters.
 */
export async function getRawMaterials(filter?: RawMaterialsFilter): Promise<RawMaterial[]> {
  const supabase = await createSupabaseServerClient();
  const validatedFilter = filter ? RawMaterialsFilterSchema.parse(filter) : undefined;

  let query = supabase
    .from("raw_materials")
    .select("*")
    .order("category", { ascending: true })
    .order("material_code", { ascending: true });

  if (validatedFilter?.category) {
    query = query.eq("category", validatedFilter.category);
  }

  if (validatedFilter?.finish_type) {
    query = query.eq("finish_type", validatedFilter.finish_type);
  }

  if (typeof validatedFilter?.is_active === "boolean") {
    query = query.eq("is_active", validatedFilter.is_active);
  }

  if (validatedFilter?.search && validatedFilter.search.trim().length > 0) {
    const s = validatedFilter.search.trim();
    query = query.or(`material_code.ilike.%${s}%,description.ilike.%${s}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch raw materials:", error);
    throw new Error(`Failed to fetch raw materials: ${error.message}`);
  }

  return (data ?? []) as RawMaterial[];
}

/**
 * Upsert (create or update) a raw material record.
 */
export async function upsertRawMaterial(input: UpsertRawMaterialInput): Promise<RawMaterial> {
  await requirePermission("manage_products");
  const validated = UpsertRawMaterialInputSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const payload = {
    material_code: validated.material_code,
    description: validated.description,
    category: validated.category,
    finish_type: validated.finish_type,
    billing_unit: validated.billing_unit,
    unit_price: validated.unit_price,
    waste_allowance: validated.waste_allowance,
    is_active: validated.is_active,
  };

  let resultData: RawMaterial | null = null;

  if (validated.id) {
    const { data, error } = await supabase
      .from("raw_materials")
      .update(payload)
      .eq("id", validated.id)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update raw material:", error);
      throw new Error(`Failed to update raw material: ${error.message}`);
    }
    resultData = data as RawMaterial;
  } else {
    const { data, error } = await supabase
      .from("raw_materials")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert raw material:", error);
      throw new Error(`Failed to insert raw material: ${error.message}`);
    }
    resultData = data as RawMaterial;
  }

  revalidatePath("/admin/materials");
  return resultData;
}

/**
 * Delete a raw material record, or flag inactive if bound to product components.
 */
export async function deleteRawMaterial(id: string): Promise<{ success: boolean; deactivated?: boolean }> {
  await requirePermission("manage_products");
  const supabase = await createSupabaseServerClient();

  // Check if material is actively referenced by any product components
  const { data: referencingComponents, error: refError } = await supabase
    .from("product_components")
    .select("component_id")
    .eq("raw_material_id", id)
    .limit(1);

  if (refError && refError.code !== "PGRST116") {
    console.error("Failed to check component references:", refError);
  }

  if (referencingComponents && referencingComponents.length > 0) {
    // Cannot hard-delete due to foreign key integrity; soft-deactivate instead
    const { error: updateError } = await supabase
      .from("raw_materials")
      .update({ is_active: false })
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to deactivate material: ${updateError.message}`);
    }

    revalidatePath("/admin/materials");
    return { success: true, deactivated: true };
  }

  const { error: deleteError } = await supabase
    .from("raw_materials")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Failed to delete raw material:", deleteError);
    throw new Error(`Failed to delete raw material: ${deleteError.message}`);
  }

  revalidatePath("/admin/materials");
  return { success: true, deactivated: false };
}

/**
 * Batch update unit prices for multiple raw materials.
 */
export async function batchUpdateMaterialPrices(input: BatchUpdateMaterialPricesInput): Promise<{ count: number }> {
  await requirePermission("manage_products");
  const validated = BatchUpdateMaterialPricesInputSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  let updatedCount = 0;
  for (const item of validated.updates) {
    const { error } = await supabase
      .from("raw_materials")
      .update({ unit_price: item.unit_price })
      .eq("id", item.id);

    if (error) {
      console.error(`Failed to update price for material ${item.id}:`, error);
      throw new Error(`Failed to update price for item ${item.id}: ${error.message}`);
    }
    updatedCount++;
  }

  revalidatePath("/admin/materials");
  return { count: updatedCount };
}

/**
 * Quick toggle of active status for a raw material.
 */
export async function toggleRawMaterialStatus(id: string, is_active: boolean): Promise<RawMaterial> {
  await requirePermission("manage_products");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("raw_materials")
    .update({ is_active })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to toggle raw material status:", error);
    throw new Error(`Failed to toggle raw material status: ${error.message}`);
  }

  revalidatePath("/admin/materials");
  return data as RawMaterial;
}
