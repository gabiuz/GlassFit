/**
 * Smart Dynamic Modular Bay Replication & Directional Expansion Engine (IMP-MS82)
 *
 * Upstream Specifications: docs/implementation/ms82.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F10, PRD-F14, PRD-F19, SDD-C4, SDD-C5, SDD-C7, SDD-C9,
 * DSD-UI4, DSD-UI7, DSD-UI10, ERD-E3, ERD-E4, ERD-E6, ERD-E7, ERD-E14, ERD-E17, IMP-MS82, QAD-TC97
 */

import type {
  DynamicBayConfig,
  DynamicBayRole,
  ExpansionAnchorMode,
  DimensionBinding,
  JalousieConfig,
} from "@/lib/pricing/types";
import {
  computeLouverBladeCount,
  computeLouverOperatorCount,
} from "./jalousieGeometryAnalyzer";

export interface BayReplicationParameters {
  targetWidthMm: number;
  nominalBayPitchMm?: number;
  minBayWidthMm?: number;
  maxBayWidthMm?: number;
  minBays?: number;
}

export interface ClearBayWidthParameters {
  targetWidthMm: number;
  bayCount?: number;
  leftJambWidthMm?: number;
  rightJambWidthMm?: number;
  mullionWidthMm?: number;
}

export interface SpatialDistributionParameters extends ClearBayWidthParameters {
  anchorMode?: ExpansionAnchorMode;
  defaultWidthMm?: number;
}

export interface DynamicBayQuantitiesInput {
  targetWidthMm: number;
  targetHeightMm?: number;
  bayConfig?: DynamicBayConfig | null;
  jalousieConfig?: JalousieConfig | null;
  components?: Array<{
    componentKey: string;
    bayRole?: DynamicBayRole | null;
    dimensionBinding?: DimensionBinding;
    baseQuantity: number;
  }>;
}

export interface DynamicBayQuantitiesResult {
  bayCount: number;
  mullionCount: number;
  clearBayWidthMm: number;
  componentQuantities: Record<string, number>;
}

/**
 * Computes the dynamic count of modular bays (panels/lights) based on target aperture width.
 * Formula (IMP-MS82 Section 3.1):
 * N_bays = max(1, round(W_target / W_bay_pitch))
 */
export function computeDynamicBayCount(
  targetWidthMm: number,
  nominalBayPitchMm: number = 600,
  minBays: number = 1,
): number {
  if (!Number.isFinite(targetWidthMm) || targetWidthMm <= 0) {
    return Math.max(1, minBays);
  }
  const safePitch = Math.max(1, nominalBayPitchMm);
  return Math.max(minBays, Math.round(targetWidthMm / safePitch));
}

/**
 * Computes intermediate divider mullion count (N_mullions = N_bays - 1).
 */
export function computeMullionCount(bayCount: number): number {
  return Math.max(0, Math.floor(bayCount) - 1);
}

/**
 * Computes clear aperture width per bay after subtracting jambs and intermediate mullions.
 * Formula (IMP-MS82 Section 3.1):
 * W_bay_clear = (W_target - (W_left + W_right) - (N_bays - 1) * W_mullion) / N_bays
 */
export function computeClearBayWidth(
  targetWidthMm: number,
  bayCount: number,
  leftJambWidthMm: number = 60,
  rightJambWidthMm: number = 60,
  mullionWidthMm: number = 80,
): number {
  const safeBays = Math.max(1, Math.floor(bayCount ?? 1));
  const totalFramingW = (leftJambWidthMm + rightJambWidthMm) + (safeBays - 1) * mullionWidthMm;
  const netClearMm = Math.max(0, targetWidthMm - totalFramingW);
  return Number((netClearMm / safeBays).toFixed(2));
}

/**
 * Computes the left boundary coordinate (X in meters) based on the expansion anchor mode.
 */
function resolveLeftEdgeMeters(
  targetWidthMm: number,
  defaultWidthMm: number,
  anchorMode: ExpansionAnchorMode = "symmetric",
): number {
  const targetWidthM = targetWidthMm / 1000;
  const defaultWidthM = defaultWidthMm / 1000;

  switch (anchorMode) {
    case "rightward":
      // Left jamb remains anchored at standard baseline coordinate
      return -defaultWidthM / 2;
    case "leftward":
      // Right jamb remains anchored at standard baseline coordinate
      return (defaultWidthM / 2) - targetWidthM;
    case "symmetric":
    default:
      // Centered at world origin
      return -targetWidthM / 2;
  }
}

/**
 * Evaluates center coordinates (X in meters) for modular bay infill assemblies (IMP-MS82 Section 3.2).
 */
export function computeBayCenters(params: SpatialDistributionParameters): number[] {
  const {
    targetWidthMm,
    bayCount,
    leftJambWidthMm = 60,
    rightJambWidthMm = 60,
    mullionWidthMm = 80,
    anchorMode = "symmetric",
    defaultWidthMm = 1200,
  } = params;

  const safeBays = Math.max(1, Math.floor(bayCount ?? 1));
  const clearBayWidthMm = computeClearBayWidth(
    targetWidthMm,
    safeBays,
    leftJambWidthMm,
    rightJambWidthMm,
    mullionWidthMm,
  );

  const leftEdgeM = resolveLeftEdgeMeters(targetWidthMm, defaultWidthMm, anchorMode);
  const leftJambM = leftJambWidthMm / 1000;
  const clearBayM = clearBayWidthMm / 1000;
  const mullionM = mullionWidthMm / 1000;

  const centers: number[] = [];
  for (let b = 0; b < safeBays; b++) {
    const xBay = leftEdgeM + leftJambM + (b + 0.5) * clearBayM + b * mullionM;
    centers.push(Number(xBay.toFixed(4)));
  }
  return centers;
}

/**
 * Evaluates center coordinates (X in meters) for intermediate divider mullions (IMP-MS82 Section 3.2).
 */
export function computeMullionCenters(params: SpatialDistributionParameters): number[] {
  const {
    targetWidthMm,
    bayCount,
    leftJambWidthMm = 60,
    rightJambWidthMm = 60,
    mullionWidthMm = 80,
    anchorMode = "symmetric",
    defaultWidthMm = 1200,
  } = params;

  const safeBays = Math.max(1, Math.floor(bayCount ?? 1));
  const mullionCount = computeMullionCount(safeBays);
  if (mullionCount === 0) {
    return [];
  }

  const clearBayWidthMm = computeClearBayWidth(
    targetWidthMm,
    safeBays,
    leftJambWidthMm,
    rightJambWidthMm,
    mullionWidthMm,
  );

  const leftEdgeM = resolveLeftEdgeMeters(targetWidthMm, defaultWidthMm, anchorMode);
  const leftJambM = leftJambWidthMm / 1000;
  const clearBayM = clearBayWidthMm / 1000;
  const mullionM = mullionWidthMm / 1000;

  const centers: number[] = [];
  for (let m = 0; m < mullionCount; m++) {
    const xMullion = leftEdgeM + leftJambM + (m + 1) * clearBayM + (m + 0.5) * mullionM;
    centers.push(Number(xMullion.toFixed(4)));
  }
  return centers;
}

/**
 * Computes bounding flank coordinates (X in meters) for the left and right outer perimeter jambs.
 */
export function computeOuterJambPositions(params: SpatialDistributionParameters): { leftJambX: number; rightJambX: number } {
  const {
    targetWidthMm,
    leftJambWidthMm = 60,
    rightJambWidthMm = 60,
    anchorMode = "symmetric",
    defaultWidthMm = 1200,
  } = params;

  const leftEdgeM = resolveLeftEdgeMeters(targetWidthMm, defaultWidthMm, anchorMode);
  const targetWidthM = targetWidthMm / 1000;
  const leftJambM = leftJambWidthMm / 1000;
  const rightJambM = rightJambWidthMm / 1000;

  const leftJambX = leftEdgeM + leftJambM / 2;
  const rightJambX = leftEdgeM + targetWidthM - rightJambM / 2;

  return {
    leftJambX: Number(leftJambX.toFixed(4)),
    rightJambX: Number(rightJambX.toFixed(4)),
  };
}

/**
 * Resolves component quantities for modular bay fenestration systems (IMP-MS82, QAD-TC97.7, QAD-TC97.8, QAD-TC97.9).
 */
export function resolveDynamicBayQuantities(
  input: DynamicBayQuantitiesInput,
): DynamicBayQuantitiesResult {
  const { targetWidthMm, bayConfig, jalousieConfig } = input;
  const targetHeightMm = input.targetHeightMm ?? 1200;
  const components = input.components ?? [];

  const enabled = Boolean(bayConfig?.enabled);
  const nominalPitch = bayConfig?.nominal_bay_pitch_mm ?? bayConfig?.nominalBayPitchMm ?? 600;
  const bayCount = enabled ? computeDynamicBayCount(targetWidthMm, nominalPitch) : 1;
  const mullionCount = enabled ? computeMullionCount(bayCount) : 0;
  const clearBayWidthMm = computeClearBayWidth(targetWidthMm, bayCount);

  const pitchMm = jalousieConfig?.pitch_mm ?? jalousieConfig?.pitchMm ?? 175;
  const bladesPerOp = jalousieConfig?.blades_per_operator ?? jalousieConfig?.bladesPerOperator ?? 4;
  const louverCountPerBay = computeLouverBladeCount(targetHeightMm, pitchMm);
  const operatorCountPerBay = computeLouverOperatorCount(louverCountPerBay, bladesPerOp);

  const componentQuantities: Record<string, number> = {};

  for (const comp of components) {
    const role = comp.bayRole;
    const isMullionRole = role === "BAY_DIVIDER" || comp.componentKey.toLowerCase().includes("center") || comp.componentKey.toLowerCase().includes("mullion");
    const isLouverBlade = comp.dimensionBinding === "LOUVER_BLADE" || role === "BAY_INFILL";
    const isLouverOperator = comp.dimensionBinding === "LOUVER_OPERATOR" || role === "BAY_HARDWARE";

    if (enabled && isMullionRole) {
      componentQuantities[comp.componentKey] = mullionCount;
    } else if (enabled && isLouverBlade && comp.dimensionBinding === "LOUVER_BLADE") {
      componentQuantities[comp.componentKey] = bayCount * louverCountPerBay;
    } else if (enabled && isLouverOperator && comp.dimensionBinding === "LOUVER_OPERATOR") {
      componentQuantities[comp.componentKey] = bayCount * operatorCountPerBay;
    } else if (enabled && (role === "BAY_INFILL" || role === "BAY_HARDWARE")) {
      componentQuantities[comp.componentKey] = bayCount * (comp.baseQuantity || 1);
    } else {
      componentQuantities[comp.componentKey] = comp.baseQuantity;
    }
  }

  return {
    bayCount,
    mullionCount,
    clearBayWidthMm,
    componentQuantities,
  };
}
