import type { DimensionBinding, PresentationCategory } from "@/lib/pricing/types";
import type { ComponentMaterialBindingInput } from "@/lib/pricing/materialBindingUtils";

export type AddonType = "screen" | "grill";

export type ComponentType = "Procedural" | "Model" | "Glass" | "Frame" | "Panel" | "Hardware" | "Other";

export interface AvailableAddonProduct {
  productId: string;
  productName: string;
  productType: string;
  addonType: AddonType | null;
  basePrice: number;
  status: string;
  description: string | null;
}

export type UpsertComponentInput = {
  templateId: string;
  componentKey: string;
  componentName: string;
  componentType: ComponentType;
  baseQuantity: number;
  rawMaterialId?: string | null;
  dimensionBinding?: DimensionBinding;
  spanRatio?: number;
  isRemovable?: boolean;
  togglePropertyKey?: string | null;
  presentationCategory?: PresentationCategory;
  glbFileUrl?: string | null;
  assemblyGroup?: string;
  componentData?: Record<string, unknown>;
  materialBindings?: ComponentMaterialBindingInput[];
};

export interface UpsertComponentPayload {
  id?: string;
  productId?: string;
  templateId?: string;
  componentKey: string;
  componentName: string;
  componentType: ComponentType;
  assemblyGroup?: string;
  baseQuantity: number;
  rawMaterialId?: string | null;
  dimensionBinding?: DimensionBinding;
  spanRatio?: number;
  isRemovable?: boolean;
  togglePropertyKey?: string | null;
  presentationCategory?: PresentationCategory;
  glbFileUrl?: string | null;
  componentData?: Record<string, unknown>;
  materialBindings?: ComponentMaterialBindingInput[];
}

export interface DatabaseProductExtended {
  product_id: string;
  product_name: string;
  product_type: string;
  description: string | null;
  base_price: number;
  status: "Active" | "Inactive";
  is_addon: boolean;
  addon_type: AddonType | null;
  created_at: string;
  updated_at: string;
}

export interface CompatibleAddonBinding {
  id?: string;
  parentProductId: string;
  addonProductId: string;
  addonType: AddonType;
  isDefaultEnabled: boolean;
  displayOrder: number;
  addonProduct?: {
    productId: string;
    productName: string;
    basePrice: number;
    status: string;
  };
}

export interface HostProductAddonConfig {
  hasScreen: boolean;
  screenAddonProductId?: string | null;
  screenAddonProductIds?: string[];
  hasGrill: boolean;
  grillAddonProductId?: string | null;
  grillAddonProductIds?: string[];
}
