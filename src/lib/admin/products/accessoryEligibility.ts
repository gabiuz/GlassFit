import "server-only";

import { getR2AssetUrl } from "@/lib/r2";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccessoryCategory, ComponentHandingMetadata } from "./types";

export interface EligibleAccessory {
  id: string;
  name: string;
  category: AccessoryCategory;
  price: number;
  description: string;
  glbUrl: string;
  handingMetadata?: ComponentHandingMetadata | null;
}

/** IMP-MS77, IMP-MS78, QAD-TC92.2, QAD-TC93.5: resolve currently published, renderable catalog records. */
export async function getEligibleAccessories(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  category?: AccessoryCategory,
  ids?: string[],
): Promise<EligibleAccessory[]> {
  if (ids && ids.length === 0) return [];
  let query = supabase
    .from("products")
    .select(`product_id, product_name, description, base_price, accessory_category,
      product_assets (asset_type, r2_object_key, status, is_primary, display_order),
      product_templates (product_components (component_data))`)
    .eq("is_accessory", true)
    .eq("status", "Active");
  if (category) query = query.eq("accessory_category", category);
  if (ids) query = query.in("product_id", ids);
  const { data, error } = await query;
  if (error) throw new Error(`Registered accessories could not be loaded: ${error.message}`);
  return (data || []).flatMap((item) => {
    const asset = (item.product_assets || [])
      .filter((candidate) => candidate.status === "Active" &&
        (candidate.asset_type === "Catalog 3D Preview" || candidate.asset_type === "Whole Model" || candidate.asset_type === "Component Model") &&
        Boolean(candidate.r2_object_key))
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) ||
        (a.display_order ?? 0) - (b.display_order ?? 0))[0];
    const glbUrl = getR2AssetUrl(asset?.r2_object_key);
    if (!glbUrl || !item.accessory_category) return [];

    const templates = item.product_templates || [];
    const firstTemplate = Array.isArray(templates) ? templates[0] : templates;
    const comps = firstTemplate?.product_components || [];
    const firstComp = Array.isArray(comps) ? comps[0] : comps;
    const handingMeta = (firstComp?.component_data as Record<string, unknown> | undefined)?.handing_metadata as ComponentHandingMetadata | undefined;

    return [{
      id: item.product_id,
      name: item.product_name,
      category: item.accessory_category as AccessoryCategory,
      price: Number(item.base_price) || 0,
      description: item.description || "",
      glbUrl,
      handingMetadata: handingMeta || null,
    }];
  });
}
