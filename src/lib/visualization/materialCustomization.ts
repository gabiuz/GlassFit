/**
 * Customer Workspace Material Customization and Rollup Engine (IMP-MS66)
 *
 * Upstream Specifications: docs/implementation/ms66.md
 * Traceability Codes: PRD-F1, PRD-F2, PRD-F5, PRD-F6, PRD-F10, SDD-C4, SDD-C5, SDD-C7, DSD-UI4, DSD-UI7, ERD-E11, ERD-E13, ERD-E14, QAD-TC81
 */

import type { ProductComponentDefinition, ProductStructuralDefinition } from "./types";
import type { RawMaterial, ComponentMaterialBinding } from "@/lib/pricing/types";

// ComponentKey -> RawMaterialId
export type CustomerMaterialSelections = Record<string, string>;

export interface MaterialCustomizationOption {
  materialId: string;
  materialCode: string;
  description: string;
  finishType: string;
  unitPrice: number;
  billingUnit: string;
  isDefault: boolean;
  swatchColor?: string;
  priceDeltaTotal: number; // In Philippine Pesos relative to default
}

export interface MaterialCustomizationGroup {
  groupId: string;
  groupLabel: string; // e.g. "Aluminum Frame Finish", "Glass Infill Option"
  presentationCategory: "Framing" | "Glazing" | "Hardware";
  affectedComponentKeys: string[];
  options: MaterialCustomizationOption[];
  selectedMaterialId: string;
  hasMultipleMaterialOptions?: boolean;
}

/**
 * Returns a hex color representation for finishes and glass tints.
 */
export function resolveSwatchColor(finishOrCategory: string, isGlass = false): string {
  const lower = finishOrCategory.toLowerCase().trim();
  if (isGlass) {
    if (lower.includes("bronze") || lower.includes("tinted")) return "#4a3b2c";
    if (lower.includes("blue")) return "#386b88";
    if (lower.includes("frosted")) return "#e2e8f0";
    if (lower.includes("tempered")) return "#e0f2fe";
    return "#e6f4f8";
  }
  if (lower.includes("analok") || lower.includes("dark") || lower.includes("bronze")) return "#221d1a";
  if (lower.includes("white") || lower.includes("powdercoatedwhite")) return "#f5f6f8";
  if (lower.includes("black") || lower.includes("powdercoatedblack")) return "#1a1a1a";
  if (lower.includes("silver") || lower.includes("anodized") || lower.includes("mill")) return "#d4d8dc";
  return "#94a3b8";
}

/**
 * Format price delta for consumer display.
 */
export function formatPriceDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded === 0) return "Base";
  if (rounded > 0) return `+₱${rounded.toLocaleString()}`;
  return `-₱${Math.abs(rounded).toLocaleString()}`;
}

/**
 * Human-readable label for finish types.
 */
export function formatFinishTypeLabel(finish: string): string {
  const lower = finish.toLowerCase().replace(/\s+/g, "");
  if (lower === "powdercoatedwhite") return "Powder Coated White";
  if (lower === "powdercoatedblack") return "Powder Coated Black";
  if (lower === "analok") return "Analok (Bronze)";
  if (lower === "mill" || lower === "anodized") return "Natural Anodized / Silver";
  return finish.charAt(0).toUpperCase() + finish.slice(1);
}

/**
 * Builds a comprehensive lookup map of all candidate materials across components.
 */
export function getAllCandidateMaterialsMap(
  definition?: ProductStructuralDefinition | null,
  extraMaterials?: RawMaterial[],
): Map<string, RawMaterial> {
  const map = new Map<string, RawMaterial>();

  if (extraMaterials) {
    for (const m of extraMaterials) {
      if (m?.id) map.set(m.id, m);
    }
  }

  if (definition?.components) {
    for (const comp of definition.components) {
      if (comp.rawMaterial?.id) {
        map.set(comp.rawMaterial.id, comp.rawMaterial);
      }
      if (comp.allowedMaterials) {
        for (const b of comp.allowedMaterials) {
          if (b.rawMaterial?.id) {
            map.set(b.rawMaterial.id, b.rawMaterial);
          }
        }
      }
    }
  }

  if (definition?.componentMaterials) {
    for (const b of definition.componentMaterials) {
      if (b.rawMaterial?.id) {
        map.set(b.rawMaterial.id, b.rawMaterial);
      }
    }
  }

  return map;
}

/**
 * Returns the default material selection map for all components in the product definition.
 */
export function getDefaultMaterialSelections(
  definition?: ProductStructuralDefinition | null,
  extraMaterials?: RawMaterial[],
): CustomerMaterialSelections {
  const selections: CustomerMaterialSelections = {};
  if (!definition?.components) return selections;

  const materialsMap = getAllCandidateMaterialsMap(definition, extraMaterials);

  for (const comp of definition.components) {
    const compAllowed = comp.allowedMaterials ?? definition.componentMaterials?.filter((cm: ComponentMaterialBinding) => cm.componentKey === comp.componentKey) ?? [];
    const defaultBinding = compAllowed.find((b: ComponentMaterialBinding) => b.isDefault);
    const targetMatId =
      defaultBinding?.rawMaterialId ||
      comp.defaultRawMaterialId ||
      comp.rawMaterialId ||
      comp.rawMaterial?.id;

    if (targetMatId) {
      selections[comp.componentKey] = targetMatId;
    } else if (compAllowed.length > 0) {
      selections[comp.componentKey] = compAllowed[0].rawMaterialId;
    } else {
      // Check if fallback material matches componentKey
      const foundMat = Array.from(materialsMap.values()).find((m) =>
        m.material_code.toLowerCase().includes(comp.componentKey.toLowerCase())
      );
      if (foundMat) {
        selections[comp.componentKey] = foundMat.id;
      }
    }
  }

  return selections;
}

/**
 * Returns candidate materials for a given component, resolving from bindings or fallbacks.
 */
export function getComponentCandidateMaterials(
  comp: ProductComponentDefinition,
  materialsMap: Map<string, RawMaterial>,
  definition?: ProductStructuralDefinition,
): Array<{ material: RawMaterial; isDefault: boolean }> {
  const candidates: Array<{ material: RawMaterial; isDefault: boolean }> = [];
  const seenIds = new Set<string>();

  const allowed = comp.allowedMaterials ?? definition?.componentMaterials?.filter((cm: ComponentMaterialBinding) => cm.componentKey === comp.componentKey) ?? [];

  if (allowed.length > 0) {
    for (const binding of allowed) {
      const mat = binding.rawMaterial || materialsMap.get(binding.rawMaterialId);
      if (mat && !seenIds.has(mat.id)) {
        seenIds.add(mat.id);
        candidates.push({ material: mat, isDefault: Boolean(binding.isDefault) });
      }
    }
  }

  if (candidates.length === 0) {
    const singleId = comp.rawMaterialId || comp.rawMaterial?.id;
    const mat = comp.rawMaterial || (singleId ? materialsMap.get(singleId) : null);
    if (mat && !seenIds.has(mat.id)) {
      seenIds.add(mat.id);
      candidates.push({ material: mat, isDefault: true });
    }
  }

  return candidates;
}

/**
 * Calculates component dimensional multiplier for price delta estimation.
 */
function getComponentMultiplier(
  comp: ProductComponentDefinition,
  dimensions?: { widthMm: number; heightMm: number; panelCount?: number },
): number {
  const widthM = (dimensions?.widthMm ?? 1800) / 1000;
  const heightM = (dimensions?.heightMm ?? 1500) / 1000;
  const span = comp.spanRatio ?? 1.0;
  const qty = comp.baseQuantity ?? 1;

  switch (comp.dimensionBinding) {
    case "WIDTH":
      return widthM * span * qty;
    case "HEIGHT":
      return heightM * span * qty;
    case "AREA":
      return widthM * heightM * span * qty;
    case "FIXED":
    default:
      return qty;
  }
}

/**
 * Checks whether a material customization group exposes multiple selectable choices.
 */
export function hasMultipleMaterialOptions(group: MaterialCustomizationGroup): boolean {
  return group.options.length > 1;
}

/**
 * Checks whether any group in the workspace exposes multiple selectable choices.
 */
export function hasAnyCustomizableMaterials(groups: MaterialCustomizationGroup[]): boolean {
  return groups.some((g) => hasMultipleMaterialOptions(g));
}

/**
 * Aggregates component-level material bindings into client-friendly customization groups.
 * Gated strictly by administrator multi-material configurations (IMP-MS64 / IMP-MS66).
 */
export function buildMaterialCustomizationGroups(
  definition: ProductStructuralDefinition,
  currentSelections: CustomerMaterialSelections,
  dimensions?: { widthMm: number; heightMm: number; panelCount?: number; hasSill?: boolean },
  extraMaterials?: RawMaterial[],
): MaterialCustomizationGroup[] {
  const groups: MaterialCustomizationGroup[] = [];
  if (!definition?.components || definition.components.length === 0) {
    return groups;
  }

  const materialsMap = getAllCandidateMaterialsMap(definition, extraMaterials);

  // Group components by presentation category
  const framingComponents: ProductComponentDefinition[] = [];
  const glazingComponents: ProductComponentDefinition[] = [];
  const hardwareComponents: ProductComponentDefinition[] = [];

  for (const comp of definition.components) {
    const cat = comp.presentationCategory || "Framing";
    if (cat === "Framing") {
      framingComponents.push(comp);
    } else if (cat === "Glazing") {
      glazingComponents.push(comp);
    } else if (cat === "Hardware") {
      hardwareComponents.push(comp);
    }
  }

  // 1. Framing Group: Roll up all framing extrusions by finish type
  if (framingComponents.length > 0) {
    const finishMap = new Map<
      string,
      {
        finishType: string;
        materialsByCompKey: Map<string, RawMaterial>;
        isDefault: boolean;
        primaryMaterial: RawMaterial;
      }
    >();

    for (const comp of framingComponents) {
      const candidates = getComponentCandidateMaterials(comp, materialsMap, definition);
      for (const { material, isDefault } of candidates) {
        const finish = material.finish_type || "Analok";
        const normFinish = finish.toLowerCase().replace(/\s+/g, "");

        if (!finishMap.has(normFinish)) {
          finishMap.set(normFinish, {
            finishType: finish,
            materialsByCompKey: new Map(),
            isDefault: false,
            primaryMaterial: material,
          });
        }

        const entry = finishMap.get(normFinish)!;
        entry.materialsByCompKey.set(comp.componentKey, material);
        if (isDefault) {
          entry.isDefault = true;
        }
      }
    }

    // Compute baseline default cost for framing
    let defaultFramingCost = 0;
    for (const comp of framingComponents) {
      const candidates = getComponentCandidateMaterials(comp, materialsMap, definition);
      const defaultCandidate = candidates.find((c) => c.isDefault) || candidates[0];
      if (defaultCandidate) {
        const multiplier = getComponentMultiplier(comp, dimensions);
        defaultFramingCost += defaultCandidate.material.unit_price * multiplier;
      }
    }

    const framingOptions: MaterialCustomizationOption[] = [];
    const finishEntries = Array.from(finishMap.values());

    for (const entry of finishEntries) {
      let optionCost = 0;
      for (const comp of framingComponents) {
        const mat =
          entry.materialsByCompKey.get(comp.componentKey) ||
          getComponentCandidateMaterials(comp, materialsMap, definition)[0]?.material;
        if (mat) {
          const multiplier = getComponentMultiplier(comp, dimensions);
          optionCost += mat.unit_price * multiplier;
        }
      }

      const priceDelta = Math.round((optionCost - defaultFramingCost) * 100) / 100;
      const isAnalok = entry.finishType.toLowerCase().includes("analok");

      framingOptions.push({
        materialId: entry.primaryMaterial.id,
        materialCode: entry.primaryMaterial.material_code,
        description: formatFinishTypeLabel(entry.finishType),
        finishType: entry.finishType,
        unitPrice: entry.primaryMaterial.unit_price,
        billingUnit: entry.primaryMaterial.billing_unit,
        isDefault: entry.isDefault || (isAnalok && !finishEntries.some((f) => f.isDefault && f !== entry)),
        swatchColor: resolveSwatchColor(entry.finishType, false),
        priceDeltaTotal: priceDelta,
      });
    }

    // Ensure default option is prioritized or marked
    const hasExplicitDefault = framingOptions.some((o) => o.isDefault);
    if (!hasExplicitDefault && framingOptions.length > 0) {
      framingOptions[0].isDefault = true;
    }

    // Determine current selected framing option
    let selectedOptionId = framingOptions[0]?.materialId ?? "";
    const activeCompMatIds = framingComponents
      .map((c) => currentSelections[c.componentKey])
      .filter(Boolean);

    for (const option of framingOptions) {
      const finishNorm = option.finishType.toLowerCase().replace(/\s+/g, "");
      const matches = activeCompMatIds.some((id) => {
        const mat = materialsMap.get(id);
        return (mat?.finish_type || "").toLowerCase().replace(/\s+/g, "") === finishNorm;
      });
      if (matches || activeCompMatIds.includes(option.materialId)) {
        selectedOptionId = option.materialId;
        break;
      }
    }

    groups.push({
      groupId: "group-framing",
      groupLabel: "Aluminum Frame Finish",
      presentationCategory: "Framing",
      affectedComponentKeys: framingComponents.map((c) => c.componentKey),
      options: framingOptions,
      selectedMaterialId: selectedOptionId,
      hasMultipleMaterialOptions: framingOptions.length > 1,
    });
  }

  // 2. Glazing Group: Roll up glass options
  if (glazingComponents.length > 0) {
    const primaryGlassComp = glazingComponents[0];
    const glassCandidates = getComponentCandidateMaterials(primaryGlassComp, materialsMap, definition);

    let defaultGlassCost = 0;
    const defaultCandidate = glassCandidates.find((c) => c.isDefault) || glassCandidates[0];
    if (defaultCandidate) {
      const multiplier = getComponentMultiplier(primaryGlassComp, dimensions);
      defaultGlassCost = defaultCandidate.material.unit_price * multiplier;
    }

    const glazingOptions: MaterialCustomizationOption[] = [];
    for (const { material, isDefault } of glassCandidates) {
      const multiplier = getComponentMultiplier(primaryGlassComp, dimensions);
      const optionCost = material.unit_price * multiplier;
      const priceDelta = Math.round((optionCost - defaultGlassCost) * 100) / 100;

      glazingOptions.push({
        materialId: material.id,
        materialCode: material.material_code,
        description: material.description || formatFinishTypeLabel(material.finish_type || "Clear"),
        finishType: material.finish_type || "Clear",
        unitPrice: material.unit_price,
        billingUnit: material.billing_unit,
        isDefault: Boolean(isDefault),
        swatchColor: resolveSwatchColor(material.finish_type || "clear", true),
        priceDeltaTotal: priceDelta,
      });
    }

    if (glazingOptions.length > 0 && !glazingOptions.some((o) => o.isDefault)) {
      glazingOptions[0].isDefault = true;
    }

    const currentGlassMatId =
      currentSelections[primaryGlassComp.componentKey] ||
      glazingOptions.find((o) => o.isDefault)?.materialId ||
      glazingOptions[0]?.materialId ||
      "";

    groups.push({
      groupId: "group-glazing",
      groupLabel: "Glass Infill Option",
      presentationCategory: "Glazing",
      affectedComponentKeys: glazingComponents.map((c) => c.componentKey),
      options: glazingOptions,
      selectedMaterialId: currentGlassMatId,
      hasMultipleMaterialOptions: glazingOptions.length > 1,
    });
  }

  // 3. Hardware Group (Optional, only if candidate options exist)
  if (hardwareComponents.length > 0) {
    const hardwareCandidates: Array<{ material: RawMaterial; isDefault: boolean }> = [];
    const seenIds = new Set<string>();

    for (const comp of hardwareComponents) {
      const candidates = getComponentCandidateMaterials(comp, materialsMap, definition);
      for (const c of candidates) {
        if (!seenIds.has(c.material.id)) {
          seenIds.add(c.material.id);
          hardwareCandidates.push(c);
        }
      }
    }

    if (hardwareCandidates.length > 0) {
      const defaultCandidate = hardwareCandidates.find((c) => c.isDefault) || hardwareCandidates[0];
      const hardwareOptions: MaterialCustomizationOption[] = hardwareCandidates.map(
        ({ material, isDefault }) => ({
          materialId: material.id,
          materialCode: material.material_code,
          description: material.description || "Standard Hardware Set",
          finishType: material.finish_type || "Standard",
          unitPrice: material.unit_price,
          billingUnit: material.billing_unit,
          isDefault: Boolean(isDefault),
          priceDeltaTotal: Math.round((material.unit_price - defaultCandidate.material.unit_price) * 100) / 100,
        })
      );

      const firstComp = hardwareComponents[0];
      const selectedHardwareId =
        currentSelections[firstComp.componentKey] ||
        hardwareOptions.find((o) => o.isDefault)?.materialId ||
        hardwareOptions[0]?.materialId ||
        "";

      groups.push({
        groupId: "group-hardware",
        groupLabel: "Hardware and Accessories",
        presentationCategory: "Hardware",
        affectedComponentKeys: hardwareComponents.map((c) => c.componentKey),
        options: hardwareOptions,
        selectedMaterialId: selectedHardwareId,
        hasMultipleMaterialOptions: hardwareOptions.length > 1,
      });
    }
  }

  return groups;
}

/**
 * Applies a customer finish selection across all affected components in a group.
 */
export function applyGroupSelection(
  definition: ProductStructuralDefinition,
  currentSelections: CustomerMaterialSelections,
  groupId: string,
  optionId: string,
): CustomerMaterialSelections;
export function applyGroupSelection(
  group: MaterialCustomizationGroup,
  option: MaterialCustomizationOption,
  currentSelections: CustomerMaterialSelections,
  definition: ProductStructuralDefinition,
  materialsMap?: Map<string, RawMaterial>,
): CustomerMaterialSelections;
export function applyGroupSelection(
  arg1: MaterialCustomizationGroup | ProductStructuralDefinition,
  arg2: MaterialCustomizationOption | CustomerMaterialSelections,
  arg3: CustomerMaterialSelections | string,
  arg4?: ProductStructuralDefinition | string,
  arg5?: Map<string, RawMaterial>,
): CustomerMaterialSelections {
  if ("product" in arg1 && typeof arg3 === "string" && typeof arg4 === "string") {
    const definition = arg1 as ProductStructuralDefinition;
    const currentSelections = arg2 as CustomerMaterialSelections;
    const groupId = arg3;
    const optionId = arg4;

    const groups = buildMaterialCustomizationGroups(definition, currentSelections);
    const targetGroup = groups.find((g) =>
      g.groupId === groupId ||
      (groupId.toLowerCase().includes("fram") && g.presentationCategory === "Framing") ||
      (groupId.toLowerCase().includes("glaz") && g.presentationCategory === "Glazing") ||
      (groupId.toLowerCase().includes("hard") && g.presentationCategory === "Hardware")
    );
    if (!targetGroup) return currentSelections;

    const targetOption = targetGroup.options.find((o) =>
      o.materialId === optionId ||
      o.finishType.toLowerCase() === optionId.toLowerCase() ||
      o.finishType.toLowerCase().replace(/\s+/g, "") === optionId.toLowerCase().replace(/\s+/g, "") ||
      definition.componentMaterials?.some((cm: ComponentMaterialBinding) =>
        cm.rawMaterialId === optionId &&
        (cm.rawMaterial?.finish_type || "").toLowerCase().replace(/\s+/g, "") === (o.finishType || "").toLowerCase().replace(/\s+/g, "")
      )
    );
    if (!targetOption) return currentSelections;

    return applyGroupSelection(targetGroup, targetOption, currentSelections, definition);
  }

  const group = arg1 as MaterialCustomizationGroup;
  const option = arg2 as MaterialCustomizationOption;
  const currentSelections = arg3 as CustomerMaterialSelections;
  const definition = arg4 as ProductStructuralDefinition;
  const materialsMap = arg5;

  const updated: CustomerMaterialSelections = { ...currentSelections };
  const map = materialsMap || getAllCandidateMaterialsMap(definition);
  const targetFinishNorm = (option.finishType || "").toLowerCase().replace(/\s+/g, "");

  for (const compKey of group.affectedComponentKeys) {
    const comp = definition.components.find((c) => c.componentKey === compKey);
    if (!comp) continue;

    const candidates = getComponentCandidateMaterials(comp, map, definition);

    // 1. Direct material ID match
    const directMatch = candidates.find((c) => c.material.id === option.materialId);
    if (directMatch) {
      updated[compKey] = directMatch.material.id;
      continue;
    }

    // 2. Finish type match (for framing groups rolling up multiple components)
    const finishMatch = candidates.find((c) => {
      const f = (c.material.finish_type || "").toLowerCase().replace(/\s+/g, "");
      return f === targetFinishNorm;
    });

    if (finishMatch) {
      updated[compKey] = finishMatch.material.id;
      continue;
    }

    // 3. Fallback: Keep current or set to primary candidate
    if (!updated[compKey] && candidates.length > 0) {
      updated[compKey] = candidates[0].material.id;
    }
  }

  return updated;
}

/**
 * Returns a concise summary of the selected materials for status pills and cards.
 */
export function formatGroupSummary(input: MaterialCustomizationGroup | MaterialCustomizationGroup[]): string {
  const groups = Array.isArray(input) ? input : [input];
  const labels: string[] = [];

  for (const group of groups) {
    const selected = group.options.find((o) => o.materialId === group.selectedMaterialId);
    if (selected) {
      labels.push(selected.description);
    } else if (group.options.length > 0) {
      labels.push(group.options[0].description);
    }
  }

  return labels.length > 0 ? labels.join(" / ") : "Standard Materials";
}
