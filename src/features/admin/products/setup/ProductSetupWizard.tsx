"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdminSession } from "@/features/admin/auth/AdminSessionProvider";
import { AdminHelpButton } from "@/features/admin/onboarding/AdminHelpButton";
import { getProductDraft } from "@/lib/admin/products/productMutations";
import { ProductSetupOnboardingTour, type ProductRole } from "./ProductSetupOnboardingTour";
import { BasicInfoSection } from "./BasicInfoSection";
import { VisualizationStrategySection } from "./VisualizationStrategySection";
import { CatalogAssetsSection } from "./CatalogAssetsSection";
import { StructuralComponentsSection } from "./StructuralComponentsSection";
import { ParametersAndRulesSection } from "./ParametersAndRulesSection";
import { ValidationWorkspaceSection } from "./ValidationWorkspaceSection";
import { ReviewAndPublishSection } from "./ReviewAndPublishSection";
import type { UpsertParameterInput, UpsertRuleInput } from "@/lib/admin/products/parameterMutations";
import { buildProductSetupUrl, getStepsForProduct, type StepKey } from "@/lib/admin/products/wizardSteps";

import type { AccessoryCategory, AccessoryMountingType } from "@/lib/admin/products/types";
import type { DynamicBayConfig } from "@/lib/pricing/types";

export interface ProductAssetSummary {
    asset_id?: string;
    asset_type?: string;
    is_primary?: boolean;
    display_order?: number;
    file_name?: string;
    file_url?: string | null;
    storage_path?: string;
    r2_object_key?: string;
    file_size_bytes?: number;
    byte_size?: number;
    mime_type?: string;
    status?: string;
    [key: string]: unknown;
}

export interface ProductTemplateSummary {
    template_id?: string;
    model_strategy?: "PARAMETRIC_GLTF" | "PARAMETRIC_BOX_PROCEDURAL" | "HYBRID_DYNAMIC" | "Parametric" | "Fixed";
    base_configuration?: Record<string, unknown>;
    product_components?: unknown[];
    product_parameters?: unknown[];
    structural_rules?: unknown[];
    [key: string]: unknown;
}

export interface ProductSetupData {
    product_id?: string;
    product_name?: string;
    product_type?: string;
    description?: string | null;
    base_price?: number;
    status?: string;
    is_addon?: boolean;
    addon_type?: "screen" | "grill" | null;
    is_accessory?: boolean;
    accessory_category?: AccessoryCategory | null;
    accessory_mounting_type?: AccessoryMountingType | null;
    product_templates?: ProductTemplateSummary[] | ProductTemplateSummary;
    product_assets?: ProductAssetSummary[];
    [key: string]: unknown;
}

export type ProductSetupWizardProps = {
    productId: string;
    initialData: ProductSetupData | null;
    initialStep: StepKey;
};

export function ProductSetupWizard({ productId, initialData, initialStep }: ProductSetupWizardProps) {
    const router = useRouter();
    const { profileId } = useAdminSession();
    const [draftId, setDraftId] = useState<string>(productId === "draft" ? "" : productId);
    const [activeStep, setActiveStep] = useState<StepKey>(initialStep);
    
    // We maintain a local copy of data to share across steps
    const [productData, setProductData] = useState<ProductSetupData>(initialData ?? {});
    const [helpTriggerCount, setHelpTriggerCount] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [componentsState, setComponentsState] = useState({
        mappedFilesCount: 0,
        selectedPartsCount: 0,
        isDecomposing: false,
        decompositionModalOpen: false,
    });
    const [parametersTab, setParametersTab] = useState<"parameters" | "rules" | "addons">("parameters");
    const [validationState, setValidationState] = useState({
        activeTab: "dimensions" as "dimensions" | "materials",
        isLoading: true,
        hasError: false,
        hasDefinition: false,
    });
    const [reviewState, setReviewState] = useState({
        isLoading: true,
        hasError: false,
    });

    const resetStepTransientState = useCallback((targetStep: StepKey) => {
        if (targetStep === "parameters") {
            setParametersTab("parameters");
        } else if (targetStep === "validation") {
            setValidationState({
                activeTab: "dimensions",
                isLoading: true,
                hasError: false,
                hasDefinition: false,
            });
        } else if (targetStep === "review") {
            setReviewState({
                isLoading: true,
                hasError: false,
            });
        }
    }, []);

    const isDraft = !draftId;
    const currentProductId = draftId || productId;
    const isAddon = Boolean(productData?.is_addon);
    const isAccessory = Boolean(productData?.is_accessory);
    const productRole: ProductRole = isAccessory ? "accessory" : isAddon ? "addon" : "standard";
    const resolvedModelStrategy = isAccessory
        ? "Fixed"
        : (Array.isArray(productData?.product_templates)
            ? productData.product_templates[0]?.model_strategy
            : productData?.product_templates?.model_strategy) || (isAddon ? "Parametric" : null);
    const wholeModelAsset = productData?.product_assets?.find?.(
        (a: ProductAssetSummary) =>
            (a.asset_type === "Whole Model" || a.asset_type === "Catalog 3D Preview") &&
            a.status === "Active" &&
            Boolean(a.file_url || a.r2_object_key),
    ) || null;
    const steps = getStepsForProduct(isAddon, isAccessory);

    useEffect(() => {
        // Route state is authoritative when the server provides a new validated step.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveStep(initialStep);
        resetStepTransientState(initialStep);
    }, [initialStep, resetStepTransientState]);

    const refreshDraft = useCallback(async (idToFetch?: string) => {
        const id = idToFetch || draftId;
        if (!id || id === "draft") return;
        try {
            const fresh = await getProductDraft(id);
            if (fresh) {
                setProductData(fresh as unknown as ProductSetupData);
            }
        } catch (err) {
            console.error("Failed to revalidate product draft:", err);
        }
    }, [draftId]);

    const handleStepChange = async (targetStep: StepKey) => {
        resetStepTransientState(targetStep);
        setActiveStep(targetStep);
        if (currentProductId && currentProductId !== "draft") {
            router.replace(buildProductSetupUrl(currentProductId, targetStep), { scroll: false });
            await refreshDraft(currentProductId);
        }
    };

    const handleProductCreated = (newId: string, data: Record<string, unknown>) => {
        const isAddonProduct = Boolean(data.is_addon ?? productData?.is_addon);
        const isAccessoryProduct = Boolean(data.is_accessory ?? productData?.is_accessory);
        setDraftId(newId);
        setProductData({ ...productData, ...data, product_id: newId });
        const nextStep = (isAddonProduct || isAccessoryProduct) ? "components" : "strategy";
        resetStepTransientState(nextStep);
        setActiveStep(nextStep);
        router.replace(buildProductSetupUrl(newId, nextStep));
        refreshDraft(newId);
    };

    const handleStrategySaved = (data: Record<string, unknown>) => {
        const existingTemplate = Array.isArray(productData?.product_templates) 
            ? productData.product_templates[0] 
            : productData?.product_templates || {};
        const mergedTemplate: ProductTemplateSummary = {
            ...existingTemplate,
            ...data,
        };
        setProductData({
            ...productData,
            product_templates: Array.isArray(productData?.product_templates) ? [mergedTemplate] : mergedTemplate,
        });
        const nextStep = isAccessory ? "components" : "assets";
        resetStepTransientState(nextStep);
        setActiveStep(nextStep);
        router.replace(buildProductSetupUrl(currentProductId, nextStep), { scroll: false });
        if (draftId) refreshDraft(draftId);
    };

    return (
        <div className="flex flex-col items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12 select-none">
            <div className="w-full flex items-start justify-between gap-3 min-w-0">
                <div className="flex flex-col items-start min-w-0">
                    <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
                        {isDraft ? "Add Product" : "Edit Product Setup"}
                    </h1>
                    <p className="text-neutral-700 text-sm sm:text-base lg:text-lg font-normal leading-snug">
                        {isDraft ? "Start by entering the basic product information" : `Setting up product: ${productData?.product_name || draftId}`}
                    </p>
                </div>
                <AdminHelpButton
                    inlineOnMobile
                    onClick={() => setHelpTriggerCount((prev) => prev + 1)}
                    ariaLabel="Product setup guide help"
                />
            </div>

            {/* Stepper / Tabs */}
            <nav aria-label="Product setup steps" className="flex items-center gap-1.5 sm:gap-3 w-full overflow-x-auto pb-2">
                {steps.map((step) => {
                    const isActive = activeStep === step.key;
                    const activeIndex = steps.findIndex(item => item.key === activeStep);
                    const isComplete = step.number - 1 < activeIndex;
                    // Disable future steps if we are a draft
                    const isDisabled = isDraft && step.number > 1;

                    return (
                        <button
                            key={step.key}
                            type="button"
                            disabled={isDisabled}
                            aria-current={isActive ? "step" : undefined}
                            onClick={() => !isDisabled && handleStepChange(step.key)}
                            className={cn(
                                "shrink-0 h-9 sm:h-[45px] px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-[25px] flex items-center justify-center gap-1.5 sm:gap-3 transition-colors whitespace-nowrap",
                                isActive
                                    ? "bg-[#07b6d3] text-white shadow-xs"
                                    : isDisabled 
                                        ? "bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-60"
                                        : isComplete ? "bg-[#0f1422] text-white hover:bg-neutral-800 cursor-pointer" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                            )}
                        >
                            <div className={cn(
                                "rounded-[10px] px-1.5 py-[1px] text-[11px] sm:text-xs font-semibold text-center min-w-[16px] sm:min-w-[18px] shrink-0",
                                isActive ? "bg-white text-[#0f1422]" : "bg-neutral-200 text-neutral-500"
                            )}>
                                {step.number}
                            </div>
                            <span className="text-xs sm:text-base lg:text-lg font-normal leading-tight">
                                {step.label}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* Step Content Area */}
            <div className="w-full bg-white rounded-[20px] p-4 sm:p-6 lg:p-[30px] shadow-xs">
                {activeStep === "basic" && (
                    <BasicInfoSection 
                        productId={currentProductId}
                        initialData={productData} 
                        onSave={handleProductCreated} 
                        isEditing={!isDraft} 
                    />
                )}
                {activeStep === "strategy" && (
                    <VisualizationStrategySection 
                        productId={draftId}
                        initialData={Array.isArray(productData?.product_templates) ? productData.product_templates[0] : productData?.product_templates || null}
                        onSave={handleStrategySaved} 
                    />
                )}
                {activeStep === "assets" && (
                    <CatalogAssetsSection
                        productId={draftId}
                        initialData={{
                            catalogImages: productData?.product_assets?.filter?.((a: ProductAssetSummary) => a.asset_type === "Catalog Image" && a.status !== "Inactive"),
                            catalogImage: productData?.product_assets?.find?.((a: ProductAssetSummary) => a.asset_type === "Catalog Image" && a.is_primary !== false),
                            catalogPreview: productData?.product_assets?.find?.((a: ProductAssetSummary) => a.asset_type === "Catalog 3D Preview" && a.is_primary !== false)
                        }}
                        onSave={() => handleStepChange("components")}
                        onOnboardingStateChange={({ lightboxOpen: nextOpen }) => setLightboxOpen(nextOpen)}
                    />
                )}
                {activeStep === "components" && (
                    <StructuralComponentsSection
                        productId={draftId}
                        templateId={(Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.template_id : productData?.product_templates?.template_id) || ""}
                        modelStrategy={resolvedModelStrategy}
                        productType={productData?.product_type || "Window"}
                        productName={productData?.product_name}
                        initialData={Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.product_components : productData?.product_templates?.product_components}
                        wholeModelAsset={wholeModelAsset}
                        isAccessory={isAccessory}
                        isAddon={isAddon}
                        initialAccessoryCategory={(productData?.accessory_category as AccessoryCategory) || null}
                        productBasePrice={typeof productData?.base_price === "number" ? productData.base_price : undefined}
                        onSave={() => handleStepChange(isAccessory ? "validation" : "parameters")}
                        onOnboardingStateChange={setComponentsState}
                    />
                )}
                {activeStep === "parameters" && (
                    <ParametersAndRulesSection
                        productId={currentProductId}
                        isAddon={isAddon}
                        templateId={(Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.template_id : productData?.product_templates?.template_id) || null}
                        modelStrategy={resolvedModelStrategy}
                        productType={productData?.product_type || "Window"}
                        initialData={{
                            parameters: (Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.product_parameters : productData?.product_templates?.product_parameters) as UpsertParameterInput[] | undefined,
                            rules: (Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.structural_rules : productData?.product_templates?.structural_rules) as UpsertRuleInput[] | undefined,
                            components: ((Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.product_components : productData?.product_templates?.product_components) as Record<string, unknown>[]) || [],
                            dynamicBayConfig: ((productData?.dynamic_bay_config || (Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.dynamic_bay_config : productData?.product_templates?.dynamic_bay_config)) as DynamicBayConfig | null) || null,
                        }}
                        onSave={() => handleStepChange("validation")}
                        onOnboardingStateChange={({ activeTab }) => setParametersTab(activeTab)}
                    />
                )}
                {activeStep === "validation" && (
                    <ValidationWorkspaceSection
                        productId={currentProductId}
                        onSave={() => handleStepChange("review")}
                        onOnboardingStateChange={setValidationState}
                    />
                )}
                {activeStep === "review" && (
                    <ReviewAndPublishSection
                        productId={currentProductId}
                        onOnboardingStateChange={setReviewState}
                    />
                )}
            </div>

            <ProductSetupOnboardingTour
                profileId={profileId}
                manualTriggerCount={helpTriggerCount}
                activeStep={activeStep}
                isDraft={isDraft}
                productRole={productRole}
                modelStrategy={resolvedModelStrategy}
                hasWholeModelAsset={Boolean(wholeModelAsset?.file_url || wholeModelAsset?.r2_object_key)}
                mappedFilesCount={componentsState.mappedFilesCount}
                selectedPartsCount={componentsState.selectedPartsCount}
                isDecomposing={componentsState.isDecomposing}
                decompositionModalOpen={componentsState.decompositionModalOpen}
                lightboxOpen={lightboxOpen}
                parametersTab={parametersTab}
                validationTab={validationState.activeTab}
                validationLoading={validationState.isLoading}
                validationHasError={validationState.hasError}
                validationHasDefinition={validationState.hasDefinition}
                reviewLoading={reviewState.isLoading}
                reviewHasError={reviewState.hasError}
            />
        </div>
    );
}

