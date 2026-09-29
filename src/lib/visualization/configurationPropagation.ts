/**
 * Product configuration transport and hydration helpers for IMP-MS12.
 * Traceability: PRD-F1, PRD-F2, PRD-F6, PRD-F7, SDD-C1, SDD-C5, QAD-TC6, QAD-TC7.
 */
import { normalizeProductQuantity } from "@/lib/products/productPreviewConfiguration";
import { isRrdAluminumFinish } from "./colorVariations";
import type {
  GlassAppearanceMode,
  GlassColorKey,
  GlassThicknessMm,
  GlassTypeKey,
  PendingProductConfiguration,
  ProductConfigurationSeed,
  ProductConfigurationSnapshot,
} from "./types";
import { normalizeAluminumFinish } from "./colorVariations";

const GLASS_TYPES = new Set<GlassTypeKey>(["regular", "frosted", "mirror", "tempered", "reflective"]);
const GLASS_COLORS = new Set<GlassColorKey>(["clear", "bronze", "silver", "blue"]);
const GLASS_THICKNESSES = new Set<GlassThicknessMm>([6, 8, 12]);
const GLASS_APPEARANCES = new Set<GlassAppearanceMode>(["clear", "frosted", "opaque", "reflective", "outdoor"]);

export function normalizeGlassType(value: unknown): GlassTypeKey | undefined {
  return typeof value === "string" && GLASS_TYPES.has(value as GlassTypeKey)
    ? value as GlassTypeKey
    : undefined;
}

export function normalizeGlassColor(value: unknown): GlassColorKey {
  return typeof value === "string" && GLASS_COLORS.has(value as GlassColorKey)
    ? value as GlassColorKey
    : "clear";
}

export function normalizeGlassThickness(value: unknown): GlassThicknessMm {
  return typeof value === "number" && GLASS_THICKNESSES.has(value as GlassThicknessMm)
    ? value as GlassThicknessMm
    : 6;
}

export function deriveGlassTypeFromAppearance(value: GlassAppearanceMode): GlassTypeKey | undefined {
  if (value === "clear") return "regular";
  if (value === "frosted") return "frosted";
  if (value === "reflective") return "reflective";
  return undefined;
}

export function normalizeProductConfigurationSeed(value: unknown): ProductConfigurationSeed | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const glassType = normalizeGlassType(candidate.glassType);
  if (
    !isRrdAluminumFinish(candidate.aluminumFinish)
    || !glassType
    || typeof candidate.glassAppearance !== "string"
    || !GLASS_APPEARANCES.has(candidate.glassAppearance as GlassAppearanceMode)
    || !GLASS_COLORS.has(candidate.glassColor as GlassColorKey)
    || !GLASS_THICKNESSES.has(candidate.glassThicknessMm as GlassThicknessMm)
  ) return null;

  const hasWidth = candidate.widthCm !== undefined;
  const hasHeight = candidate.heightCm !== undefined;
  if (hasWidth !== hasHeight) return null;
  if (hasWidth && (!isPositiveFinite(candidate.widthCm) || !isPositiveFinite(candidate.heightCm))) return null;

  return {
    aluminumFinish: candidate.aluminumFinish,
    glassType,
    glassAppearance: candidate.glassAppearance as GlassAppearanceMode,
    glassColor: candidate.glassColor as GlassColorKey,
    glassThicknessMm: candidate.glassThicknessMm as GlassThicknessMm,
    ...(hasWidth ? { widthCm: candidate.widthCm as number, heightCm: candidate.heightCm as number } : {}),
    quantity: normalizeProductQuantity(candidate.quantity as string | number),
  };
}

export function normalizePendingProductConfiguration(value: unknown): PendingProductConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.productId !== "string" || candidate.productId.length === 0) return null;
  const configuration = normalizeProductConfigurationSeed(candidate.configuration);
  return configuration ? { productId: candidate.productId, configuration } : null;
}

export function getMatchingProductConfigurationSeed(
  pending: PendingProductConfiguration | null,
  productId: string,
): ProductConfigurationSeed | null {
  return pending?.productId === productId ? pending.configuration : null;
}

export function hydrateProductVariationConfiguration(
  initial: ProductConfigurationSnapshot | null | undefined,
  seed: ProductConfigurationSeed | null | undefined,
) {
  const source = initial ?? seed;
  const appearance = source?.glassAppearance ?? "clear";
  const explicitType = normalizeGlassType(source && "glassType" in source ? source.glassType : undefined);
  return {
    aluminumFinish: normalizeAluminumFinish(source?.aluminumFinish),
    glassAppearance: appearance,
    glassType: explicitType ?? deriveGlassTypeFromAppearance(appearance),
    glassColor: normalizeGlassColor(source && "glassColor" in source ? source.glassColor : undefined),
    glassThicknessMm: normalizeGlassThickness(
      source && "glassThicknessMm" in source ? source.glassThicknessMm : undefined,
    ),
    widthCm: source?.widthCm,
    heightCm: source?.heightCm,
    quantity: normalizeProductQuantity(source?.quantity ?? 1),
  };
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
