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

export function isStepKey(value: string): value is StepKey {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

export function resolveWizardStep(
  productId: string,
  rawStep: string | string[] | undefined,
): StepKey {
  if (productId === "draft") return "basic";
  return typeof rawStep === "string" && isStepKey(rawStep) ? rawStep : "basic";
}

export function buildProductSetupUrl(productId: string, step: StepKey): string {
  const query = new URLSearchParams({ step });
  return `/admin/products/${encodeURIComponent(productId)}/setup?${query.toString()}`;
}
