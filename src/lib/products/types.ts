/**
 * Raw record shape returned from public.products in Supabase.
 * Only fields needed for the catalog are included (created_by / updated_by are omitted).
 */
export type DatabaseProduct = {
  product_id: string;
  product_name: string;
  product_type:
    | "Window"
    | "Door"
    | "Partition"
    | "Cabinet"
    | "Enclosure"
    | "Railing"
    | "Other";
  description: string | null;
  base_price: number;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
};

/**
 * Temporary renderer keys mapping to currently supported visualization implementations.
 * This will be replaced by product_templates.model_strategy in a future step.
 */
export type SupportedRendererKey = "window" | "cabinet";

/**
 * UI-facing product shape used by catalog components.
 * Carries the database UUID so later persistence can reference the exact selected product.
 */
export type CatalogProduct = {
  /** Stable database UUID — use this as the product identity, not the name. */
  id: string;
  name: string;
  type: DatabaseProduct["product_type"];
  description: string | null;
  basePrice: number;
  /**
   * Temporary adapter key for the current renderer registry.
   * null means the product has no supported visualization yet.
   */
  rendererKey: SupportedRendererKey | null;
};
