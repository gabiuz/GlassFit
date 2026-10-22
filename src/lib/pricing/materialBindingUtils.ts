/**
 * Material Binding Utility Functions (MS64)
 *
 * Upstream Specifications: docs/implementation/ms64.md
 * Traceability Codes: PRD-F14, ERD-E6, ERD-E17, QAD-TC79
 */

export type ComponentMaterialBindingInput = {
  rawMaterialId: string;
  isDefault: boolean;
  displayOrder?: number;
};

/**
 * Normalizes material bindings to guarantee exactly one default if bindings exist.
 */
export function normalizeMaterialBindings<T extends { isDefault: boolean; displayOrder?: number }>(
  bindings?: T[]
): T[] {
  if (!bindings || bindings.length === 0) {
    return [];
  }

  const defaultIndex = bindings.findIndex((b) => b.isDefault);
  const normalizedDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;

  return bindings.map((b, idx) => ({
    ...b,
    isDefault: idx === normalizedDefaultIndex,
    displayOrder: typeof b.displayOrder === "number" ? b.displayOrder : idx,
  }));
}
