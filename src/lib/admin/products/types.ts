import type { DimensionBinding, PresentationCategory, JalousieConfig, DynamicBayRole, ExpansionAnchorMode, DynamicBayConfig } from "@/lib/pricing/types";
export type { JalousieConfig, DynamicBayRole, ExpansionAnchorMode, DynamicBayConfig };
import type { ComponentMaterialBindingInput } from "@/lib/pricing/materialBindingUtils";

export type AddonType = "screen" | "grill";
export type AddonMountingSide = "front" | "back";
export type AddonAllowedSides = "front" | "back" | "both";

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

export type HorizontalPosition = "left" | "right";
export type VerticalPosition = "bottom" | "up";

export interface AccessoryPositionOptions {
  allowHorizontalToggle: boolean;
  defaultHorizontal: HorizontalPosition;
  horizontalOffsetMm: number; // Lateral offset from edge
  allowVerticalToggle: boolean;
  defaultVertical: VerticalPosition;
  verticalOffsetMm: number; // Offset from bottom or top rail
}

export interface AccessorySlotConfig {
  isAccessorySlot: boolean;
  accessoryCategory: AccessoryCategory | null;
  allowedAccessoryIds: string[] | null; // Legacy null is treated as an empty approval list
  positionOptions: AccessoryPositionOptions;
}

export interface ComponentHandingMetadata {
  sourceHanding: "left" | "right";
  uploadedGlbUrl: string;
  leftGlbUrl: string;
  rightGlbUrl: string;
  mirroredAt: string;
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
  isAccessorySlot?: boolean;
  accessoryCategory?: AccessoryCategory | null;
  allowedAccessoryIds?: string[] | null;
  positionOptions?: AccessoryPositionOptions;
  unitPrice?: number;
  pricingMethod?: "Fixed" | "Included" | "Per Piece" | "Per Length" | "Per Area" | "Other" | string;
  handingMetadata?: ComponentHandingMetadata | null;
  jalousieConfig?: JalousieConfig | null;
  jalousie_config?: JalousieConfig | null;
  bayRole?: DynamicBayRole | null;
  bay_role?: DynamicBayRole | null;
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
  isAccessorySlot?: boolean;
  accessoryCategory?: AccessoryCategory | null;
  allowedAccessoryIds?: string[] | null;
  positionOptions?: AccessoryPositionOptions;
  unitPrice?: number;
  pricingMethod?: "Fixed" | "Included" | "Per Piece" | "Per Length" | "Per Area" | "Other" | string;
  handingMetadata?: ComponentHandingMetadata | null;
  jalousieConfig?: JalousieConfig | null;
  jalousie_config?: JalousieConfig | null;
  bayRole?: DynamicBayRole | null;
  bay_role?: DynamicBayRole | null;
}

export type ProductRole = "standard" | "addon" | "accessory";
export type AccessoryCategory = "handle" | "lock" | "hinge" | "roller" | "other";
export type AccessoryMountingType = "surface_mount" | "mortise" | "recessed" | "clamp";

export interface CreateAccessoryProductInput {
  product_name: string;
  description?: string | null;
  base_price: number;
  is_accessory: true;
  is_addon: false;
  accessory_category: AccessoryCategory;
  accessory_mounting_type: AccessoryMountingType;
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
  is_accessory: boolean;
  accessory_category: AccessoryCategory | null;
  accessory_mounting_type: AccessoryMountingType | null;
  dynamic_bay_config?: DynamicBayConfig | null;
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
  allowedSides?: AddonAllowedSides;
  defaultSide?: AddonMountingSide;
  hatchTargetComponentKeys?: string[] | null;
  hatchAlignmentConfig?: Record<string, unknown> | null;
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
  screenAllowedSides?: AddonAllowedSides;
  screenDefaultSide?: AddonMountingSide;
  screenHatchTargetComponentKeys?: string[];
  screenHatchAlignmentConfig?: Record<string, unknown> | null;
  hasGrill: boolean;
  grillAddonProductId?: string | null;
  grillAddonProductIds?: string[];
  grillAllowedSides?: AddonAllowedSides;
  grillDefaultSide?: AddonMountingSide;
  grillHatchTargetComponentKeys?: string[];
  grillHatchAlignmentConfig?: Record<string, unknown> | null;
}
