/**
 * GlassFit Real-Time Engineering Validation & Guardrail Engine (MS-6)
 *
 * Implements structural guardrails, roller weight limits, dead load assessment
 * using the Universal 2.5 rule, and aspect ratio monitoring per NSCP 2015.
 *
 * Upstream Specifications: docs/pricing.md, docs/milestone.md (MS-6)
 * Traceability Codes: PRD-F5, PRD-F10, SDD-C4, SDD-C5, DSD-UI7, QAD-TC5, QAD-TC17, BAN-TYPE-05
 */

export interface EngineeringValidationInput {
  widthMm: number;
  heightMm: number;
  panelCount?: number;
  glassThicknessMm?: number;
  sashFrameWeightKg?: number; // default 6.0kg per leaf
}

export interface EngineeringValidationResult {
  widthMm: number;
  heightMm: number;
  panelCount: number;
  leafWidthMm: number;
  leafHeightMm: number;
  leafAreaSqm: number;
  totalAreaSqm: number;

  // Dead Load metrics (Universal 2.5 rule)
  glassThicknessMm: number;
  glassWeightPerSqmKg: number; // thickness * 2.5 kg/m2
  leafGlassDeadLoadKg: number;
  leafSashFrameWeightKg: number;
  totalLeafDeadLoadKg: number;

  // Roller capacity verification (Series 798 POM rollers, max 40kg/leaf)
  rollerWarningLimitKg: number; // 30.0kg
  rollerMaxCapacityKg: number; // 40.0kg
  isRollerOverloaded: boolean; // totalLeafDeadLoadKg > 40kg
  isRollerNearCapacity: boolean; // totalLeafDeadLoadKg > 30kg

  // Aspect ratio & sash crabbing (NSCP 2015 / Architectural limits)
  aspectRatio: number; // Height / Leaf Width
  isCrabbingRisk: boolean; // ratio > 1.2:1

  // Span limit threshold (W >= 2400mm on 2-panel)
  isSpanLimitExceeded: boolean;

  // Overall guardrail trigger flag
  requiresPromptModal: boolean;
  warnings: string[];
}

export const UNIVERSAL_GLASS_DENSITY_FACTOR = 2.5; // kg/m2 per mm thickness
export const DEFAULT_SASH_FRAME_WEIGHT_KG = 6.0;
export const SERIES_798_ROLLER_MAX_CAPACITY_KG = 40.0;
export const SERIES_798_ROLLER_WARNING_LIMIT_KG = 30.0;
export const SPAN_LIMIT_THRESHOLD_MM = 2400;
export const ASPECT_RATIO_CRABBING_LIMIT = 1.2;

/**
 * Validates structural physical constraints for a glass and aluminum window/door assembly.
 */
export function validateEngineeringGuardrails(
  input: EngineeringValidationInput
): EngineeringValidationResult {
  const widthMm = Math.max(100, input.widthMm);
  const heightMm = Math.max(100, input.heightMm);
  const panelCount = Math.max(1, input.panelCount ?? (widthMm >= SPAN_LIMIT_THRESHOLD_MM ? 3 : 2));
  const glassThicknessMm = Math.max(1, input.glassThicknessMm ?? 6.0);
  const leafSashFrameWeightKg = Math.max(0, input.sashFrameWeightKg ?? DEFAULT_SASH_FRAME_WEIGHT_KG);

  const leafWidthMm = widthMm / panelCount;
  const leafHeightMm = heightMm;
  const leafWidthM = leafWidthMm / 1000;
  const leafHeightM = leafHeightMm / 1000;

  const leafAreaSqm = round4(leafWidthM * leafHeightM);
  const totalAreaSqm = round4((widthMm / 1000) * (heightMm / 1000));

  // Universal 2.5 rule: Weight (kg/m2) = Thickness (mm) * 2.5
  const glassWeightPerSqmKg = round2(glassThicknessMm * UNIVERSAL_GLASS_DENSITY_FACTOR);
  const leafGlassDeadLoadKg = round2(leafAreaSqm * glassWeightPerSqmKg);
  const totalLeafDeadLoadKg = round2(leafGlassDeadLoadKg + leafSashFrameWeightKg);

  // Roller capacity checks
  const isRollerOverloaded = totalLeafDeadLoadKg > SERIES_798_ROLLER_MAX_CAPACITY_KG;
  const isRollerNearCapacity = totalLeafDeadLoadKg > SERIES_798_ROLLER_WARNING_LIMIT_KG;

  // Aspect ratio (Height / Leaf Width)
  const aspectRatio = leafWidthM > 0 ? round2(leafHeightM / leafWidthM) : 1.0;
  const isCrabbingRisk = aspectRatio > ASPECT_RATIO_CRABBING_LIMIT;

  // Span limit guardrail (2-panel >= 2400mm)
  const isSpanLimitExceeded = panelCount === 2 && widthMm >= SPAN_LIMIT_THRESHOLD_MM;

  const warnings: string[] = [];

  if (isSpanLimitExceeded) {
    warnings.push(
      "Aperture width reaches or exceeds 2400mm. A 2-panel configuration risks sash deflection, water infiltration, and roller micro-pitting under Philippine wind loads (NSCP 2015)."
    );
  }

  if (isRollerOverloaded) {
    warnings.push(
      `Leaf dead load (${totalLeafDeadLoadKg.toFixed(2)}kg) exceeds the certified Series 798 POM roller limit of 40.0kg per leaf.`
    );
  } else if (isRollerNearCapacity) {
    warnings.push(
      `Leaf dead load (${totalLeafDeadLoadKg.toFixed(2)}kg) exceeds 30.0kg. Heavy-duty tandem rollers or reduced panel dimensions are recommended.`
    );
  }

  if (isCrabbingRisk) {
    warnings.push(
      `Aspect ratio (${aspectRatio.toFixed(2)}:1) exceeds 1.2:1. Tall, narrow sliding panels risk racking and crabbing during manual operation.`
    );
  }

  const requiresPromptModal = isSpanLimitExceeded || isRollerOverloaded;

  return {
    widthMm,
    heightMm,
    panelCount,
    leafWidthMm: round2(leafWidthMm),
    leafHeightMm: round2(leafHeightMm),
    leafAreaSqm,
    totalAreaSqm,
    glassThicknessMm,
    glassWeightPerSqmKg,
    leafGlassDeadLoadKg,
    leafSashFrameWeightKg,
    totalLeafDeadLoadKg,
    rollerWarningLimitKg: SERIES_798_ROLLER_WARNING_LIMIT_KG,
    rollerMaxCapacityKg: SERIES_798_ROLLER_MAX_CAPACITY_KG,
    isRollerOverloaded,
    isRollerNearCapacity,
    aspectRatio,
    isCrabbingRisk,
    isSpanLimitExceeded,
    requiresPromptModal,
    warnings,
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
