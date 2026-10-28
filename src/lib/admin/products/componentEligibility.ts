/** Shared Components and publication eligibility (FIX13-01, FIX13-02; PRD-F5, PRD-F10, QAD-TC94). */
export type ComponentEligibilityContext = {
    modelStrategy: string | null;
    isAccessory?: boolean;
    isAddon?: boolean;
};

export type EligibleComponent = {
    pricingMethod?: string | null;
    unitPrice?: number | null;
    dimensionBinding?: string | null;
    rawMaterialId?: string | null;
    materialBindings?: readonly { rawMaterialId: string; isDefault?: boolean }[] | null;
    isAccessorySlot?: boolean;
    hasModelPreview?: boolean;
};

export type ProductComponentEligibility = ComponentEligibilityContext & {
    componentsCount: number;
    hasQualifyingModelAsset: boolean;
};

export function isQualifyingModelAsset(asset: { asset_type?: string | null; status?: string | null }): boolean {
    return (asset.asset_type === "Whole Model" || asset.asset_type === "Catalog 3D Preview") && asset.status === "Active";
}

export function requiresComponentMaterial(part: EligibleComponent, context: ComponentEligibilityContext): boolean {
    return !context.isAccessory && !context.isAddon && context.modelStrategy !== "Fixed" &&
        part.pricingMethod !== "Fixed" && part.dimensionBinding !== "FIXED" &&
        !(typeof part.unitPrice === "number" && part.unitPrice > 0);
}

export function getComponentIssues(part: EligibleComponent, context: ComponentEligibilityContext): string[] {
    const issues: string[] = [];
    const hasDefaultMaterial = Boolean(part.rawMaterialId) || Boolean(part.materialBindings?.some(binding =>
        binding.isDefault && binding.rawMaterialId));
    if (!context.isAddon && !part.isAccessorySlot && requiresComponentMaterial(part, context) &&
        !hasDefaultMaterial) {
        issues.push("assign a default material");
    }
    if (!context.isAddon && !context.isAccessory && context.modelStrategy !== "Fixed" && !part.hasModelPreview) {
        issues.push("verify a model preview");
    }
    return issues;
}

export function getProductComponentIssue(input: ProductComponentEligibility): string | null {
    if (input.isAccessory || input.isAddon) return null;
    if (input.modelStrategy === "Fixed") {
        return input.componentsCount === 0 && !input.hasQualifyingModelAsset
            ? "Fixed products require a 3D model asset or component parts."
            : null;
    }
    if (input.modelStrategy === "Parametric" && input.componentsCount === 0) {
        return "Parametric products require at least one component.";
    }
    return null;
}
