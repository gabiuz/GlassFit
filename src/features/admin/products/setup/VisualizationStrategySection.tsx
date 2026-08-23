"use client";

import { useState } from "react";
import { upsertProductTemplate } from "@/lib/admin/products/productMutations";

export type VisualizationStrategySectionProps = {
    productId: string;
    initialData: any;
    onSave: (data: any) => void;
};

const BUILDER_PROFILES = [
    { key: "fixed_model_v1", label: "Fixed Model", description: "Standard fixed 3D model, no parametric changes." },
    { key: "frame_panels_v1", label: "Frame + Panels", description: "Parametric frame with internal glass/panel divisions." },
    { key: "sliding_leaf_v1", label: "Sliding Leaf System", description: "Parametric sliding door/window system." },
    { key: "cabinet_box_v1", label: "Cabinet System", description: "Parametric cabinet with adjustable shelves/doors." },
    { key: "custom_parametric_v1", label: "Custom Parametric", description: "Advanced parametric product structure." }
];

export function VisualizationStrategySection({ productId, initialData, onSave }: VisualizationStrategySectionProps) {
    const [strategy, setStrategy] = useState<"Fixed" | "Parametric">(initialData?.model_strategy || "Fixed");
    const [builderKey, setBuilderKey] = useState(initialData?.base_configuration?.builder_key || "fixed_model_v1");
    
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
            const data = {
                model_strategy: strategy,
                builder_key: strategy === "Parametric" ? builderKey : undefined,
            };

            const returnedTemplateId = await upsertProductTemplate(productId, data);
            
            // Reconstruct saved data to update local state in wizard
            const savedData = {
                template_id: returnedTemplateId,
                model_strategy: strategy,
                base_configuration: strategy === "Parametric" ? { builder_key: builderKey } : null
            };

            onSave(savedData);
        } catch (err: any) {
            setError(err.message || "An error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    Visualization Strategy
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Determine how this product is constructed in the 3D viewer.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                    {error}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
                {/* Strategy Cards */}
                <label className={`flex-1 p-5 rounded-[12px] border-2 cursor-pointer transition-all ${
                    strategy === "Fixed" 
                        ? "border-[#07b6d3] bg-[#07b6d3]/5" 
                        : "border-[#e5e5e5] hover:border-[#c3c3c3] bg-white"
                }`}>
                    <div className="flex items-center gap-3 mb-2">
                        <input 
                            type="radio" 
                            name="strategy"
                            value="Fixed"
                            checked={strategy === "Fixed"}
                            onChange={() => setStrategy("Fixed")}
                            className="w-4 h-4 text-[#07b6d3] border-neutral-300 focus:ring-[#07b6d3]"
                        />
                        <span className="font-semibold text-[#0f1422] text-lg">Fixed</span>
                    </div>
                    <p className="text-sm text-neutral-600 ml-7">
                        Use when the product is represented by one complete runtime GLB and does not rebuild from parts.
                    </p>
                </label>

                <label className={`flex-1 p-5 rounded-[12px] border-2 cursor-pointer transition-all ${
                    strategy === "Parametric" 
                        ? "border-[#07b6d3] bg-[#07b6d3]/5" 
                        : "border-[#e5e5e5] hover:border-[#c3c3c3] bg-white"
                }`}>
                    <div className="flex items-center gap-3 mb-2">
                        <input 
                            type="radio" 
                            name="strategy"
                            value="Parametric"
                            checked={strategy === "Parametric"}
                            onChange={() => setStrategy("Parametric")}
                            className="w-4 h-4 text-[#07b6d3] border-neutral-300 focus:ring-[#07b6d3]"
                        />
                        <span className="font-semibold text-[#0f1422] text-lg">Parametric</span>
                    </div>
                    <p className="text-sm text-neutral-600 ml-7">
                        Use when dimensions affect the model structure or components repeat/resize.
                    </p>
                </label>
            </div>

            {strategy === "Parametric" && (
                <div className="flex flex-col gap-4 max-w-2xl bg-neutral-50 p-5 rounded-[12px] border border-neutral-200 mt-2">
                    <h3 className="font-medium text-[#0f1422]">Builder Profile</h3>
                    <p className="text-sm text-neutral-600 mb-2">Select the runtime construction strategy for this product.</p>
                    
                    <div className="flex flex-col gap-3">
                        {BUILDER_PROFILES.filter(p => p.key !== "fixed_model_v1").map(profile => (
                            <label key={profile.key} className="flex items-start gap-3 cursor-pointer">
                                <input 
                                    type="radio"
                                    name="builder_key"
                                    value={profile.key}
                                    checked={builderKey === profile.key}
                                    onChange={(e) => setBuilderKey(e.target.value)}
                                    className="w-4 h-4 mt-0.5 text-[#07b6d3] border-neutral-300 focus:ring-[#07b6d3]"
                                />
                                <div>
                                    <div className="font-medium text-[#0f1422] text-sm">{profile.label}</div>
                                    <div className="text-xs text-neutral-500">{profile.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-between pt-4 border-t border-neutral-200">
                <button
                    type="button"
                    onClick={() => onSave(initialData)} // Allow skipping/continuing if valid
                    className="text-neutral-500 hover:text-black text-sm font-medium transition-colors px-4 py-2"
                >
                    Back to Edit Basic Info (Not fully hooked up yet)
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors disabled:opacity-70 font-medium"
                >
                    {isSaving ? "Saving..." : "Save & Continue"}
                </button>
            </div>
        </form>
    );
}
