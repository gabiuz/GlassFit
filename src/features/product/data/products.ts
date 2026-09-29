/**
 * Local renderer registry.
 *
 * This file previously served as the product catalog.
 * It now only maps supported renderer keys to their current local asset paths.
 *
 * The product catalog is now driven by public.products in Supabase.
 * See: src/lib/products/getActiveProducts.ts
 *
 * This registry will be replaced by product_templates + product_assets
 * in a future implementation step.
 */

export type RendererKey = "window" | "cabinet";

export interface RendererRegistryEntry {
  rendererKey: RendererKey;
  fallbackModelPath: string;
}

export const rendererRegistry: Record<RendererKey, RendererRegistryEntry> = {
  window: {
    rendererKey: "window",
    fallbackModelPath: "/models/glass_window.glb",
  },
  cabinet: {
    rendererKey: "cabinet",
    fallbackModelPath: "/models/ikea-3-drawer.glb",
  },
};
