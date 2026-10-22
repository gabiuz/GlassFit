export const WIZARD_STEPS = [
  "basic",
  "strategy",
  "assets",
  "components",
  "parameters",
  "validation",
  "review",
] as const;

export type StepKey = (typeof WIZARD_STEPS)[number];

export interface WizardStepDefinition {
  key: StepKey;
  label: string;
  number: number;
}

export const STANDARD_PRODUCT_STEPS: WizardStepDefinition[] = [
  { key: "basic", label: "Basic Info", number: 1 },
  { key: "strategy", label: "Visualization", number: 2 },
  { key: "assets", label: "Assets", number: 3 },
  { key: "components", label: "Components", number: 4 },
  { key: "parameters", label: "Parameters", number: 5 },
  { key: "validation", label: "Validation", number: 6 },
  { key: "review", label: "Review", number: 7 },
];

/**
 * Streamlined 5-step authoring workflow for Add-on products (IMP-MS70).
 * Preserves structural components for uploading and configuring 3D model parts.
 * Restores 3D validation preview before final review and confirmation.
 * Visualization strategy is defaulted to Parametric Frame + Panels and omitted from tabs.
 * 2D/3D Assets tab is omitted.
 */
export const ADDON_PRODUCT_STEPS: WizardStepDefinition[] = [
  { key: "basic", label: "Basic Info", number: 1 },
  { key: "components", label: "Components", number: 2 },
  { key: "parameters", label: "Parameters & Pricing", number: 3 },
  { key: "validation", label: "Validation", number: 4 },
  { key: "review", label: "Review & Publish", number: 5 },
];

export function getStepsForProduct(isAddon?: boolean): WizardStepDefinition[] {
  return isAddon ? ADDON_PRODUCT_STEPS : STANDARD_PRODUCT_STEPS;
}

export function getNextStepKey(currentKey: StepKey, isAddon?: boolean): StepKey {
  const steps = getStepsForProduct(isAddon);
  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  if (currentIndex >= 0 && currentIndex < steps.length - 1) {
    return steps[currentIndex + 1].key;
  }
  return currentKey;
}

export function isStepKey(value: string): value is StepKey {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

export function resolveWizardStep(
  productId: string,
  rawStep: string | string[] | undefined,
  isAddon?: boolean,
): StepKey {
  if (productId === "draft") return "basic";
  const validStep = typeof rawStep === "string" && isStepKey(rawStep) ? rawStep : "basic";
  if (isAddon) {
    const addonStepKeys = ADDON_PRODUCT_STEPS.map((s) => s.key);
    if (!addonStepKeys.includes(validStep)) {
      if (validStep === "strategy" || validStep === "assets") {
        return "components";
      }
      return "review";
    }
  }
  return validStep;
}

export function buildProductSetupUrl(productId: string, step: StepKey): string {
  const query = new URLSearchParams({ step });
  return `/admin/products/${encodeURIComponent(productId)}/setup?${query.toString()}`;
}

