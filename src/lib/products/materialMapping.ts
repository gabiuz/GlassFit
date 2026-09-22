/**
 * R.R.D. product configuration catalog for IMP-MS09.
 * Traceability: PRD-F1, PRD-F2, PRD-F7, SDD-C1, DSD-UI2.
 */
import type { RrdAluminumFinishKey } from "@/lib/visualization/colorVariations";
import type {
  GlassAppearanceMode,
  GlassColorKey,
  GlassThicknessMm,
  GlassTypeKey,
} from "@/lib/visualization/types";

export type { GlassTypeKey } from "@/lib/visualization/types";

export type RrdSupportedProductType = "Window" | "Door" | "Cabinet";
export type PricingClass = "Standard" | "Special" | "Premium";

export interface FinishOption {
  id: RrdAluminumFinishKey;
  label: string;
  rrdCode: string;
  pricingClass: "Standard" | "Special";
  previewHex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

export interface GlassTypeOption {
  id: GlassTypeKey;
  label: string;
  pricingClass: "Standard" | "Premium";
  appearance: GlassAppearanceMode;
}

export interface GlassColorOption {
  id: GlassColorKey;
  label: string;
  pricingClass: "Standard" | "Premium";
  previewHex: string;
}

export interface GlassThicknessOption {
  value: GlassThicknessMm;
  label: string;
  attenuationDistance: number;
}

const METALLIC = { metalness: 0.8, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 } as const;
const ANODIZED = { metalness: 0.55, roughness: 0.26, clearcoat: 0.45, clearcoatRoughness: 0.2 } as const;
const POWDER = { metalness: 0.2, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2 } as const;

export const ALUMINUM_FINISH_OPTIONS = [
  { id: "white", label: "White", rrdCode: "Standard", pricingClass: "Standard", previewHex: "#ECEAE4", ...POWDER },
  { id: "analok", label: "Analok", rrdCode: "Standard", pricingClass: "Standard", previewHex: "#6B594A", ...ANODIZED },
  { id: "al_1001", label: "Metallic Silver", rrdCode: "AL 1001", pricingClass: "Special", previewHex: "#A8ACB1", ...METALLIC },
  { id: "al_1002", label: "Bright Silver", rrdCode: "AL 1002", pricingClass: "Special", previewHex: "#D8DDE2", ...METALLIC },
  { id: "al_1003", label: "Champagne Silver", rrdCode: "AL 1003", pricingClass: "Special", previewHex: "#C7BFA9", ...METALLIC },
  { id: "al_1004", label: "Champagne Gold", rrdCode: "AL 1004", pricingClass: "Special", previewHex: "#C7A75B", ...METALLIC },
  { id: "al_1005", label: "Bright Gold", rrdCode: "AL 1005", pricingClass: "Special", previewHex: "#D4AF37", ...METALLIC },
  { id: "al_1006", label: "Jade Silver", rrdCode: "AL 1006", pricingClass: "Special", previewHex: "#9FAFA5", ...METALLIC },
  { id: "al_1007", label: "Blue Silver", rrdCode: "AL 1007", pricingClass: "Special", previewHex: "#98A9B7", ...METALLIC },
  { id: "al_1008", label: "Copper", rrdCode: "AL 1008", pricingClass: "Special", previewHex: "#B66A3C", ...ANODIZED },
  { id: "al_1009", label: "Black", rrdCode: "AL 1009", pricingClass: "Special", previewHex: "#232527", ...POWDER },
  { id: "al_1010", label: "Sparkling Black", rrdCode: "AL 1010", pricingClass: "Special", previewHex: "#17191C", ...POWDER },
  { id: "al_1011", label: "Pure White", rrdCode: "AL 1011", pricingClass: "Special", previewHex: "#F5F5F0", ...POWDER },
  { id: "al_1012", label: "Ivory White", rrdCode: "AL 1012", pricingClass: "Special", previewHex: "#E8DFC8", ...POWDER },
  { id: "al_1013", label: "Finland Green", rrdCode: "AL 1013", pricingClass: "Special", previewHex: "#3F6651", ...POWDER },
  { id: "al_1014", label: "Leaf Green", rrdCode: "AL 1014", pricingClass: "Special", previewHex: "#4E7A35", ...POWDER },
  { id: "al_1015", label: "Forest Green", rrdCode: "AL 1015", pricingClass: "Special", previewHex: "#244A36", ...POWDER },
  { id: "al_1016", label: "Light Blue", rrdCode: "AL 1016", pricingClass: "Special", previewHex: "#7AAED1", ...POWDER },
  { id: "al_1017", label: "Postal Blue", rrdCode: "AL 1017", pricingClass: "Special", previewHex: "#245B86", ...POWDER },
  { id: "al_1018", label: "Glossy Blue", rrdCode: "AL 1018", pricingClass: "Special", previewHex: "#124C8C", ...POWDER },
  { id: "al_1019", label: "Dark Blue", rrdCode: "AL 1019", pricingClass: "Special", previewHex: "#18324A", ...POWDER },
  { id: "al_1020", label: "Coffee", rrdCode: "AL 1020", pricingClass: "Special", previewHex: "#5A3D2B", ...ANODIZED },
  { id: "champagne", label: "Champagne", rrdCode: "Not assigned", pricingClass: "Special", previewHex: "#C8AD7F", ...ANODIZED },
  { id: "peacock_blue", label: "Peacock Blue", rrdCode: "Not assigned", pricingClass: "Special", previewHex: "#006D77", ...POWDER },
] as const satisfies readonly FinishOption[];

export const GLASS_TYPE_OPTIONS = [
  { id: "regular", label: "Regular", pricingClass: "Standard", appearance: "clear" },
  { id: "frosted", label: "Frosted", pricingClass: "Standard", appearance: "frosted" },
  { id: "mirror", label: "Mirror", pricingClass: "Standard", appearance: "reflective" },
  { id: "tempered", label: "Tempered", pricingClass: "Premium", appearance: "clear" },
  { id: "reflective", label: "Reflective", pricingClass: "Premium", appearance: "reflective" },
] as const satisfies readonly GlassTypeOption[];

export const GLASS_COLOR_OPTIONS = [
  { id: "clear", label: "Clear", pricingClass: "Standard", previewHex: "#F0F5F7" },
  { id: "bronze", label: "Bronze", pricingClass: "Standard", previewHex: "#8B6F47" },
  { id: "silver", label: "Silver", pricingClass: "Premium", previewHex: "#AEBCC5" },
  { id: "blue", label: "Blue", pricingClass: "Premium", previewHex: "#7FA9C4" },
] as const satisfies readonly GlassColorOption[];

export const GLASS_THICKNESS_OPTIONS = [
  { value: 6, label: "6 mm", attenuationDistance: 2.4 },
  { value: 8, label: "8 mm", attenuationDistance: 1.8 },
  { value: 12, label: "12 mm", attenuationDistance: 1.2 },
] as const satisfies readonly GlassThicknessOption[];

export const DEFAULT_PRODUCT_PREVIEW_CONFIGURATION = {
  aluminumFinish: "white",
  glassType: "regular",
  glassColor: "clear",
  glassThicknessMm: 6,
  quantity: 1,
} as const;

export function isRrdSupportedProductType(productType: string): productType is RrdSupportedProductType {
  return productType === "Window" || productType === "Door" || productType === "Cabinet";
}

export function getAvailableFinishOptions(productType: RrdSupportedProductType): readonly FinishOption[] {
  void productType;
  return ALUMINUM_FINISH_OPTIONS;
}

export function getAvailableGlassTypeOptions(productType: RrdSupportedProductType): readonly GlassTypeOption[] {
  void productType;
  return GLASS_TYPE_OPTIONS;
}

export function mapGlassTypeToAppearanceMode(glassType: GlassTypeKey): GlassAppearanceMode {
  switch (glassType) {
    case "regular": return "clear";
    case "frosted": return "frosted";
    case "mirror": return "reflective";
    case "tempered": return "clear";
    case "reflective": return "reflective";
  }
}

export function findFinishOption(value: string): FinishOption | null {
  return ALUMINUM_FINISH_OPTIONS.find((option) => option.id === value) ?? null;
}

export function findGlassTypeOption(value: string): GlassTypeOption | null {
  return GLASS_TYPE_OPTIONS.find((option) => option.id === value) ?? null;
}

export function findGlassColorOption(value: string): GlassColorOption | null {
  return GLASS_COLOR_OPTIONS.find((option) => option.id === value) ?? null;
}

export function findGlassThicknessOption(value: number): GlassThicknessOption | null {
  return GLASS_THICKNESS_OPTIONS.find((option) => option.value === value) ?? null;
}
