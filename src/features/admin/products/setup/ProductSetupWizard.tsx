"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getProductDraft } from "@/lib/admin/products/productMutations";
import { BasicInfoSection } from "./BasicInfoSection";
import { VisualizationStrategySection } from "./VisualizationStrategySection";
import { CatalogAssetsSection } from "./CatalogAssetsSection";
import { StructuralComponentsSection } from "./StructuralComponentsSection";
import { ParametersAndRulesSection } from "./ParametersAndRulesSection";
import { ValidationWorkspaceSection } from "./ValidationWorkspaceSection";
import { ReviewAndPublishSection } from "./ReviewAndPublishSection";

export type ProductSetupWizardProps = {
    productId: string;
    initialData: any; // We'll refine this later
};

type StepKey = 
    | "basic" 
    | "strategy" 
    | "assets" 
    | "components" 
    | "parameters" 
    | "validation" 
    | "review";

const steps: { key: StepKey; label: string; number: number }[] = [
    { key: "basic", label: "Basic Info", number: 1 },
    { key: "strategy", label: "Visualization", number: 2 },
    { key: "assets", label: "Assets", number: 3 },
    { key: "components", label: "Components", number: 4 },
    { key: "parameters", label: "Parameters", number: 5 },
    { key: "validation", label: "Validation", number: 6 },
    { key: "review", label: "Review", number: 7 },
];

export function ProductSetupWizard({ productId, initialData }: ProductSetupWizardProps) {
    const router = useRouter();
    // Default to basic if draft, or determine from initialData state
    const [activeStep, setActiveStep] = useState<StepKey>("basic");
    const [draftId, setDraftId] = useState<string>(productId === "draft" ? "" : productId);
    
    // We maintain a local copy of data to share across steps
    const [productData, setProductData] = useState<any>(initialData || {});

    const isDraft = !draftId;

    const refreshDraft = useCallback(async (idToFetch?: string) => {
        const id = idToFetch || draftId;
        if (!id || id === "draft") return;
        try {
            const fresh = await getProductDraft(id);
            if (fresh) {
                setProductData(fresh);
            }
        } catch (err) {
            console.error("Failed to revalidate product draft:", err);
        }
    }, [draftId]);

    const handleStepChange = async (targetStep: StepKey) => {
        setActiveStep(targetStep);
        if (draftId && draftId !== "draft") {
            refreshDraft(draftId);
        }
    };

    const handleProductCreated = (newId: string, data: any) => {
        setDraftId(newId);
        setProductData({ ...productData, ...data, product_id: newId });
        router.replace(`/admin/products/${newId}/setup`);
        setActiveStep("strategy");
    };

    const handleStrategySaved = (data: any) => {
        const existingTemplate = Array.isArray(productData?.product_templates) 
            ? productData.product_templates[0] 
            : productData?.product_templates || {};
        const mergedTemplate = {
            ...existingTemplate,
            ...data,
        };
        setProductData({
            ...productData,
            product_templates: Array.isArray(productData?.product_templates) ? [mergedTemplate] : mergedTemplate,
        });
        setActiveStep("assets");
        if (draftId) refreshDraft(draftId);
    };

    return (
        <div className="flex flex-col items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12 select-none">
            <div className="w-full flex flex-col items-start min-w-0">
                <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
                    {isDraft ? "Add Product" : "Edit Product Setup"}
                </h1>
                <p className="text-neutral-700 text-sm sm:text-base lg:text-lg font-normal leading-snug">
                    {isDraft ? "Start by entering the basic product information" : `Setting up product: ${productData?.product_name || draftId}`}
                </p>
            </div>

            {/* Stepper / Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-3 w-full overflow-x-auto pb-2">
                {steps.map((step) => {
                    const isActive = activeStep === step.key;
                    // Disable future steps if we are a draft
                    const isDisabled = isDraft && step.number > 1;

                    return (
                        <button
                            key={step.key}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => !isDisabled && handleStepChange(step.key)}
                            className={cn(
                                "flex-1 sm:flex-none h-9 sm:h-[45px] px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-[25px] flex items-center justify-center gap-1.5 sm:gap-3 transition-colors min-w-0",
                                isActive
                                    ? "bg-[#07b6d3] text-white shadow-xs"
                                    : isDisabled 
                                        ? "bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-60"
                                        : "bg-[#c3c3c3] text-white hover:bg-stone-400 cursor-pointer"
                            )}
                        >
                            <div className={cn(
                                "rounded-[10px] px-1.5 py-[1px] text-[11px] sm:text-xs font-semibold text-center min-w-[16px] sm:min-w-[18px] shrink-0",
                                isActive ? "bg-white text-[#0f1422]" : "bg-neutral-200 text-neutral-500"
                            )}>
                                {step.number}
                            </div>
                            <span className="text-xs sm:text-base lg:text-lg font-normal leading-tight truncate">
                                {step.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Step Content Area */}
            <div className="w-full bg-white rounded-[20px] p-4 sm:p-6 lg:p-[30px] shadow-xs">
                {activeStep === "basic" && (
                    <BasicInfoSection 
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
                            catalogImage: productData?.product_assets?.find?.((a: any) => a.asset_type === "Catalog Image" && a.is_primary !== false),
                            catalogPreview: productData?.product_assets?.find?.((a: any) => a.asset_type === "Catalog 3D Preview" && a.is_primary !== false)
                        }}
                        onSave={() => handleStepChange("components")}
                    />
                )}
                {activeStep === "components" && (
                    <StructuralComponentsSection
                        productId={draftId}
                        templateId={Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.template_id : productData?.product_templates?.template_id}
                        modelStrategy={Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.model_strategy : productData?.product_templates?.model_strategy}
                        productType={productData?.product_type || "Window"}
                        initialData={Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.product_components : productData?.product_templates?.product_components}
                        onSave={() => handleStepChange("parameters")}
                    />
                )}
                {activeStep === "parameters" && (
                    <ParametersAndRulesSection
                        templateId={Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.template_id : productData?.product_templates?.template_id}
                        modelStrategy={Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.model_strategy : productData?.product_templates?.model_strategy}
                        productType={productData?.product_type || "Window"}
                        initialData={{
                            parameters: Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.product_parameters : productData?.product_templates?.product_parameters,
                            rules: Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.structural_rules : productData?.product_templates?.structural_rules,
                            components: Array.isArray(productData?.product_templates) ? productData.product_templates[0]?.product_components : productData?.product_templates?.product_components
                        }}
                        onSave={() => handleStepChange("validation")}
                    />
                )}
                {activeStep === "validation" && (
                    <ValidationWorkspaceSection
                        productId={productId}
                        onSave={() => handleStepChange("review")}
                    />
                )}
                {activeStep === "review" && (
                    <ReviewAndPublishSection productId={productId} />
                )}
            </div>

        </div>
    );
}
