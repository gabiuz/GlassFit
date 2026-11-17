import type { ProductStructuralDefinition } from "./types";

/**
 * Shared Fit capability and bounded Cabinet correction (PRD-F6, SDD-C5, IMP-MS89 Section 4.1).
 *
 * Canonical `Cabinet` products use free placement even when their name or component keys
 * contain `door` or `window-sill`. All non-cabinet categories preserve the existing
 * window/sill and door/name/component predicates exactly.
 */

export const CABINET_FREE_PLACEMENT_NOTICE =
  "This cabinet uses free placement. Your existing placement is kept.";

export type FitCapabilityReason =
  | "eligible"
  | "cabinet_free_placement"
  | "category_not_fit_eligible"
  | "definition_unavailable";

export type WorkspacePlacementMode = "fit" | "free_place" | "unavailable";

export interface WorkspaceProductCapabilities {
  isDefinitionReady: boolean;
  isCanonicalCabinet: boolean;
  supportsPerspectivePlane: boolean;
  canFitOpening: boolean;
  canEditCorners: boolean;
  placementMode: WorkspacePlacementMode;
  reason: FitCapabilityReason;
  isWindowPredicate: boolean;
  isDoorPredicate: boolean;
}

export interface ResolveWorkspaceProductCapabilitiesInput {
  structuralDefinition: ProductStructuralDefinition | null | undefined;
  selectedProductName?: string | null;
  isDefinitionLoading?: boolean;
  hasDefinitionError?: boolean;
}

/**
 * Preserved legacy window predicate for sill UI, default sizing, and non-cabinet Fit checks.
 */
export function isLegacyWindowProduct(
  structuralDefinition: ProductStructuralDefinition | null | undefined,
): boolean {
  if (!structuralDefinition) return false;
  return (
    structuralDefinition.product.productType === "Window" ||
    Boolean(
      structuralDefinition.components.some(
        (component) => component.componentKey.replace(/_/g, "-") === "window-sill",
      ),
    )
  );
}

/**
 * Preserved legacy door predicate for default dimensions, openingType, and non-cabinet Fit checks.
 */
export function isLegacyDoorProduct(
  structuralDefinition: ProductStructuralDefinition | null | undefined,
  selectedProductName?: string | null,
): boolean {
  if (!structuralDefinition) return false;
  return (
    structuralDefinition.product.productType === "Door" ||
    (structuralDefinition.product.productType || "").toLowerCase().includes("door") ||
    (structuralDefinition.product.productName || "").toLowerCase().includes("door") ||
    (selectedProductName || "").toLowerCase().includes("door") ||
    Boolean(
      structuralDefinition.components.some((component) =>
        component.componentKey.replace(/_/g, "-").includes("door"),
      ),
    )
  );
}

/**
 * Explicit canonical Cabinet check against the product definition's canonical productType.
 */
export function isCanonicalCabinetDefinition(
  structuralDefinition: ProductStructuralDefinition | null | undefined,
): boolean {
  if (!structuralDefinition) return false;
  return (structuralDefinition.product.productType || "").trim().toLowerCase() === "cabinet";
}

/**
 * Resolves workspace Fit / Edit Corners eligibility after the product definition is ready.
 */
export function resolveWorkspaceProductCapabilities(
  input: ResolveWorkspaceProductCapabilitiesInput,
): WorkspaceProductCapabilities {
  const {
    structuralDefinition,
    selectedProductName,
    isDefinitionLoading = false,
    hasDefinitionError = false,
  } = input;

  if (!structuralDefinition || isDefinitionLoading || hasDefinitionError) {
    return {
      isDefinitionReady: false,
      isCanonicalCabinet: false,
      supportsPerspectivePlane: false,
      canFitOpening: false,
      canEditCorners: false,
      placementMode: "unavailable",
      reason: "definition_unavailable",
      isWindowPredicate: false,
      isDoorPredicate: false,
    };
  }

  const isWindowPredicate = isLegacyWindowProduct(structuralDefinition);
  const isDoorPredicate = isLegacyDoorProduct(structuralDefinition, selectedProductName);
  const isCanonicalCabinet = isCanonicalCabinetDefinition(structuralDefinition);

  if (isCanonicalCabinet) {
    return {
      isDefinitionReady: true,
      isCanonicalCabinet: true,
      supportsPerspectivePlane: false,
      canFitOpening: false,
      canEditCorners: false,
      placementMode: "free_place",
      reason: "cabinet_free_placement",
      isWindowPredicate,
      isDoorPredicate,
    };
  }

  const eligible = isWindowPredicate || isDoorPredicate;
  return {
    isDefinitionReady: true,
    isCanonicalCabinet: false,
    supportsPerspectivePlane: eligible,
    canFitOpening: eligible,
    canEditCorners: eligible,
    placementMode: eligible ? "fit" : "free_place",
    reason: eligible ? "eligible" : "category_not_fit_eligible",
    isWindowPredicate,
    isDoorPredicate,
  };
}
