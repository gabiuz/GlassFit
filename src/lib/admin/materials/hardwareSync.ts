import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawMaterial } from "@/lib/pricing/types";

/**
 * Deterministically constructs a standard Hardware raw material code from a product name and ID.
 * Example: "Screen Door Latch" + "448a4c53-..." -> "HW-SCREENDOORLAT-448A4C"
 */
export function generateHardwareMaterialCode(productName: string, productId: string): string {
  const cleanName = (productName || "ACC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
  const shortId = productId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `HW-${cleanName || "ACC"}-${shortId}`;
}

export type HardwareAccessorySyncInput = {
  productId: string;
  productName: string;
  basePrice?: number | null;
  status?: string | null;
};

/**
 * Synchronizes a single hardware accessory product into the raw_materials catalog under category 'Hardware'.
 * Traceability: PRD-F14, SDD-C9, ERD-E17, IMP-MS78, QAD-TC93.14
 */
export async function syncHardwareAccessoryToRawMaterial(
  supabase: SupabaseClient,
  input: HardwareAccessorySyncInput
): Promise<RawMaterial | null> {
  if (!input.productId) return null;

  const code = generateHardwareMaterialCode(input.productName, input.productId);
  const unitPrice = typeof input.basePrice === "number" && !isNaN(input.basePrice)
    ? Math.max(0, input.basePrice)
    : 0;

  // Check if existing raw material is mapped to this accessory product
  const { data: existing } = await supabase
    .from("raw_materials")
    .select("*")
    .or(`id.eq.${input.productId},material_code.eq.${code}`)
    .maybeSingle();

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("raw_materials")
      .update({
        description: input.productName,
        category: "Hardware",
        finish_type: "Standard",
        billing_unit: "pc",
        unit_price: unitPrice,
        waste_allowance: 0.000,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Failed to update hardware accessory in raw_materials:", updateError);
      return null;
    }
    return updated as RawMaterial;
  }

  // Insert new hardware raw material record using productId as primary key
  const { data: inserted, error: insertError } = await supabase
    .from("raw_materials")
    .insert({
      id: input.productId,
      material_code: code,
      description: input.productName,
      category: "Hardware",
      finish_type: "Standard",
      billing_unit: "pc",
      unit_price: unitPrice,
      waste_allowance: 0.000,
      is_active: true,
    })
    .select("*")
    .single();

  if (insertError) {
    // If conflict on code or id, perform fallback update
    const { data: fallback } = await supabase
      .from("raw_materials")
      .update({
        description: input.productName,
        unit_price: unitPrice,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${input.productId},material_code.eq.${code}`)
      .select("*")
      .maybeSingle();

    return (fallback as RawMaterial) || null;
  }

  return inserted as RawMaterial;
}

/**
 * Removes the corresponding raw_materials record when a hardware accessory is deleted or role changed.
 */
export async function deleteHardwareAccessoryFromRawMaterials(
  supabase: SupabaseClient,
  productId: string
): Promise<void> {
  if (!productId) return;
  await supabase
    .from("raw_materials")
    .delete()
    .eq("id", productId);
}

/**
 * Ensures all hardware accessory products in the database are mirrored into raw_materials.
 * Called before fetching raw materials to ensure 100% catalog parity.
 */
export async function syncAllHardwareAccessoriesToRawMaterials(
  supabase: SupabaseClient
): Promise<void> {
  const { data: accessories, error } = await supabase
    .from("products")
    .select("product_id, product_name, base_price, status")
    .eq("is_accessory", true);

  if (error || !accessories || accessories.length === 0) {
    return;
  }

  await Promise.all(
    accessories.map((acc) =>
      syncHardwareAccessoryToRawMaterial(supabase, {
        productId: acc.product_id,
        productName: acc.product_name,
        basePrice: acc.base_price,
        status: acc.status,
      })
    )
  );
}

