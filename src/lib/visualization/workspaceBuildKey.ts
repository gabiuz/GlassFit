/**
 * Workspace Build Key Harmonization (IMP-MS84)
 *
 * Upstream Specifications: docs/implementation/ms84.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F6, SDD-C4, SDD-C5, QAD-TC99.1, QAD-TC99.12
 */

export interface WorkspaceBuildKeyParams {
  productId: string;
  widthCm: string | number;
  heightCm: string | number;
  panelCount: number;
  includeSill: boolean;
  selectedAddon: string;
  selectedAddonProductId: string | null;
  addonMountingSide: "front" | "back";
  addonAlumFinish: string;
  alumFinish: string;
  glassAppearance: string;
  glassColor: string;
  glassThicknessMm: number;
  includeHatch: boolean;
  screenMeshDensity: string;
  accessoriesKey: string;
  removableStatesKey: string;
}

export function computeWorkspaceBuildKey(params: WorkspaceBuildKeyParams): string {
  return [
    params.productId,
    params.widthCm,
    params.heightCm,
    params.panelCount,
    params.includeSill ? "sill:1" : "sill:0",
    params.selectedAddon,
    params.selectedAddonProductId ?? "none",
    params.addonMountingSide,
    params.addonAlumFinish,
    params.alumFinish,
    params.glassAppearance,
    params.glassColor,
    params.glassThicknessMm,
    params.includeHatch ? "hatch:1" : "hatch:0",
    params.screenMeshDensity,
    params.accessoriesKey,
    params.removableStatesKey,
  ].join("|");
}

