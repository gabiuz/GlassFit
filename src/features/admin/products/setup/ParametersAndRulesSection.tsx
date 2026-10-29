"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Plus, X, Loader2, Info, Settings2, CodeSquare, CheckCircle2, AlertCircle, Layers } from "lucide-react";
import {
    upsertParametersAndRules,
    UpsertParameterInput,
    UpsertRuleInput,
} from "@/lib/admin/products/parameterMutations";
import type { DynamicBayConfig } from "@/lib/pricing/types";
import { AddonInheritanceSection } from "./AddonInheritanceSection";

export type ParametersAndRulesSectionProps = {
    productId?: string;
    isAddon?: boolean;
    templateId: string | null;
    modelStrategy: string | null;
    productType?: string;
    initialData?: {
        parameters?: UpsertParameterInput[];
        rules?: UpsertRuleInput[];
        components?: Record<string, unknown>[];
        dynamicBayConfig?: DynamicBayConfig | null;
    };
    onSave: () => void;
};

export function ParametersAndRulesSection({ productId, isAddon = false, templateId, modelStrategy, productType = "Window", initialData, onSave }: ParametersAndRulesSectionProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"parameters" | "rules" | "addons">("parameters");

    // Reference data for rules
    const rawComponents = initialData?.components;
    const componentKeys = useMemo(() => {
        if (!rawComponents || !Array.isArray(rawComponents)) return [];
        return rawComponents.map(c => ({
            key: String(c.component_key || "").trim(),
            name: String(c.component_name || c.component_key || "").trim()
        }));
    }, [rawComponents]);

    const hasFrameCenter = useMemo(() => componentKeys.some(c => c.key.toLowerCase().includes("center") || c.key.toLowerCase().includes("mullion")), [componentKeys]);
    const hasGlassPanel = useMemo(() => componentKeys.some(c => c.key.toLowerCase().includes("glass") || c.key.toLowerCase().includes("pane")), [componentKeys]);

    const defaultCenterKey = useMemo(() => {
        const found = componentKeys.find(c => c.key.toLowerCase().includes("center") || c.key.toLowerCase().includes("mullion"));
        return found ? found.key : componentKeys[0]?.key || "frame-center";
    }, [componentKeys]);

    const defaultGlassKey = useMemo(() => {
        const found = componentKeys.find(c => c.key.toLowerCase().includes("glass") || c.key.toLowerCase().includes("pane"));
        return found ? found.key : componentKeys[0]?.key || "glass-panel";
    }, [componentKeys]);

    const [parameters, setParameters] = useState<UpsertParameterInput[]>(() => {
        if (Array.isArray(initialData?.parameters) && initialData.parameters.length > 0) {
            return initialData.parameters;
        }
        // Default standard parameters for fenestration products
        return [
            {
                parameter_name: "Width",
                parameter_key: "width",
                parameter_type: "Number",
                minimum_value: 500,
                default_value: 1200,
                maximum_value: null,
                step_value: 1,
                unit: "mm",
                affects_structure: true,
                display_order: 1
            },
            {
                parameter_name: "Height",
                parameter_key: "height",
                parameter_type: "Number",
                minimum_value: 500,
                default_value: 1200,
                maximum_value: null,
                step_value: 1,
                unit: "mm",
                affects_structure: true,
                display_order: 2
            }
        ];
    });

    const [rules, setRules] = useState<UpsertRuleInput[]>(() => {
        if (Array.isArray(initialData?.rules) && initialData.rules.length > 0) {
            return initialData.rules;
        }

        // Only seed default window rules if suitable components exist or default placeholders match
        const isWindow = productType.toLowerCase().includes("window");
        if (isWindow && componentKeys.length > 0) {
            const rulesList: UpsertRuleInput[] = [];

            if (hasFrameCenter) {
                rulesList.push({
                    rule_name: "2-Panel Wide Window (1 Center Mullion)",
                    priority: 1,
                    condition_data: { rule_type: "when_then", parameter_key: "width", operator: ">=", value: 1800 },
                    action_data: { target_type: "component", target_key: defaultCenterKey, action_type: "set_quantity", value: 1 }
                });
            }

            if (hasGlassPanel) {
                rulesList.push({
                    rule_name: "2-Panel Glass Infill (2 Glass Panels)",
                    priority: 2,
                    condition_data: { rule_type: "when_then", parameter_key: "width", operator: ">=", value: 1800 },
                    action_data: { target_type: "component", target_key: defaultGlassKey, action_type: "set_quantity", value: 2 }
                });
            }

            if (hasFrameCenter) {
                rulesList.push({
                    rule_name: "3-Panel Extra Wide Window (2 Center Mullions)",
                    priority: 3,
                    condition_data: { rule_type: "when_then", parameter_key: "width", operator: ">=", value: 2600 },
                    action_data: { target_type: "component", target_key: defaultCenterKey, action_type: "set_quantity", value: 2 }
                });
            }

            if (hasGlassPanel) {
                rulesList.push({
                    rule_name: "3-Panel Glass Infill (3 Glass Panels)",
                    priority: 4,
                    condition_data: { rule_type: "when_then", parameter_key: "width", operator: ">=", value: 2600 },
                    action_data: { target_type: "component", target_key: defaultGlassKey, action_type: "set_quantity", value: 3 }
                });
            }

            return rulesList;
        }

        return [];
    });

    const [dynamicBayConfig, setDynamicBayConfig] = useState<DynamicBayConfig>(() => {
        const initial = initialData?.dynamicBayConfig;
        if (initial) {
            return {
                enabled: Boolean(initial.enabled),
                primary_dimension: initial.primary_dimension ?? "width",
                nominal_bay_pitch_mm: initial.nominal_bay_pitch_mm ?? 600,
                min_bay_width_mm: initial.min_bay_width_mm ?? 400,
                max_bay_width_mm: initial.max_bay_width_mm ?? 1000,
                default_bay_count: initial.default_bay_count ?? 2,
                expansion_anchor: initial.expansion_anchor ?? "symmetric",
                expansion_anchor_mode: initial.expansion_anchor_mode ?? initial.expansion_anchor ?? "symmetric",
                bay_infill_component_keys: initial.bay_infill_component_keys ?? [],
                bay_hardware_component_keys: initial.bay_hardware_component_keys ?? [],
            };
        }
        return {
            enabled: false,
            primary_dimension: "width",
            nominal_bay_pitch_mm: 600,
            min_bay_width_mm: 400,
            max_bay_width_mm: 1000,
            default_bay_count: 2,
            expansion_anchor: "symmetric",
            expansion_anchor_mode: "symmetric",
            bay_infill_component_keys: [],
            bay_hardware_component_keys: [],
        };
    });

    // Auto-save logic with debounce
    const isFirstMount = useRef(true);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const performAutoSave = useCallback(async (
        paramsToSave: UpsertParameterInput[],
        rulesToSave: UpsertRuleInput[],
        bayConfigToSave?: DynamicBayConfig
    ) => {
        if (!templateId || modelStrategy !== "Parametric") return;
        
        try {
            setAutoSaveStatus("saving");
            setErrorMsg(null);

            // Filter out rules with invalid target components so parameters can always be saved cleanly
            const validRules = rulesToSave.filter(rule => {
                if (!paramsToSave.some(p => p.parameter_key === rule.condition_data.parameter_key)) {
                    return false;
                }
                if (rule.action_data.target_type === "component") {
                    return componentKeys.length === 0 || componentKeys.some(c => c.key === rule.action_data.target_key);
                }
                return true;
            });

            await upsertParametersAndRules(templateId, paramsToSave, validRules, bayConfigToSave);
            setAutoSaveStatus("saved");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Auto-save failed";
            console.error("Auto-save parameters failed:", err);
            setAutoSaveStatus("error");
            setErrorMsg(msg);
        }
    }, [templateId, modelStrategy, componentKeys]);

    // Initial mount auto-save for freshly generated default parameters
    useEffect(() => {
        if (!templateId || modelStrategy !== "Parametric") return;

        const hasDbParams = Array.isArray(initialData?.parameters) && initialData.parameters.length > 0;
        if (!hasDbParams && parameters.length > 0 && isFirstMount.current) {
            isFirstMount.current = false;
            performAutoSave(parameters, rules, dynamicBayConfig);
        } else {
            isFirstMount.current = false;
        }
    }, [templateId, modelStrategy, initialData?.parameters, parameters, rules, dynamicBayConfig, performAutoSave]);

    // Trigger debounced auto-save on parameter or rule edits
    const triggerDebouncedSave = (
        newParams: UpsertParameterInput[],
        newRules: UpsertRuleInput[],
        newBayConfig: DynamicBayConfig = dynamicBayConfig
    ) => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        setAutoSaveStatus("saving");
        saveTimerRef.current = setTimeout(() => {
            performAutoSave(newParams, newRules, newBayConfig);
        }, 600);
    };

    const updateDynamicBayConfig = (updates: Partial<DynamicBayConfig>) => {
        const updated: DynamicBayConfig = {
            ...dynamicBayConfig,
            ...updates,
        };
        setDynamicBayConfig(updated);
        triggerDebouncedSave(parameters, rules, updated);
    };

    const addParameter = () => {
        const newParams = [
            ...parameters, 
            {
                parameter_name: `Parameter ${parameters.length + 1}`,
                parameter_key: `param_${parameters.length + 1}`,
                parameter_type: "Number",
                minimum_value: 0,
                default_value: 0,
                maximum_value: null,
                step_value: 1,
                unit: "mm",
                affects_structure: true,
                display_order: parameters.length + 1
            }
        ];
        setParameters(newParams);
        triggerDebouncedSave(newParams, rules);
    };

    const updateParameter = (index: number, updates: Partial<UpsertParameterInput>) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], ...updates };
        setParameters(newParams);
        triggerDebouncedSave(newParams, rules);
    };

    const removeParameter = (index: number) => {
        const newParams = parameters.filter((_, i) => i !== index);
        setParameters(newParams);
        triggerDebouncedSave(newParams, rules);
    };

    const addRule = () => {
        const fallbackTarget = componentKeys[0]?.key || "frame-center";
        const newRules: UpsertRuleInput[] = [
            ...rules,
            {
                rule_name: `Rule ${rules.length + 1}`,
                priority: rules.length + 1,
                condition_data: { 
                    rule_type: "when_then",
                    parameter_key: parameters[0]?.parameter_key || "width", 
                    operator: ">=", 
                    value: 0 
                },
                action_data: { 
                    target_type: "component", 
                    target_key: fallbackTarget, 
                    action_type: "set_quantity", 
                    value: 1 
                }
            }
        ];
        setRules(newRules);
        triggerDebouncedSave(parameters, newRules);
    };

    const updateRule = (index: number, updates: Partial<UpsertRuleInput>) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], ...updates };
        setRules(newRules);
        triggerDebouncedSave(parameters, newRules);
    };

    const removeRule = (index: number) => {
        const newRules = rules.filter((_, i) => i !== index);
        setRules(newRules);
        triggerDebouncedSave(parameters, newRules);
    };

    const handleSave = async () => {
        if (!templateId) return;
        setIsSaving(true);
        setErrorMsg(null);
        try {
            // Basic validation
            for (const param of parameters) {
                if (param.minimum_value !== null && param.maximum_value !== null && param.minimum_value > param.maximum_value) {
                    throw new Error(`Parameter ${param.parameter_name} has minimum value greater than maximum value.`);
                }
            }

            for (const rule of rules) {
                if (!parameters.find(p => p.parameter_key === rule.condition_data.parameter_key)) {
                    throw new Error(`Rule ${rule.rule_name} references an invalid parameter (${rule.condition_data.parameter_key}).`);
                }
                if (rule.action_data.target_type === "component" && componentKeys.length > 0 && !componentKeys.find(c => c.key === rule.action_data.target_key)) {
                    throw new Error(`Rule ${rule.rule_name} references a component (${rule.action_data.target_key}) that is not in the uploaded components.`);
                }
            }

            await upsertParametersAndRules(templateId, parameters, rules, dynamicBayConfig);
            setAutoSaveStatus("saved");
            onSave();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to save parameters and rules.";
            setErrorMsg(msg);
        } finally {
            setIsSaving(false);
        }
    };

    if (modelStrategy !== "Parametric") {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-neutral-200 rounded-[16px] bg-neutral-50">
                <Info className="size-12 text-[#07b6d3] mb-4" />
                <h3 className="text-xl font-medium text-[#0f1422] mb-2">Fixed Model Selected</h3>
                <p className="text-neutral-500 max-w-md">
                    Parameters and structural rules are disabled because this product uses a fixed 3D model strategy.
                </p>
                <button type="button" onClick={onSave} className="mt-6 bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black font-medium transition-colors">
                    Continue to 3D Validation
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[#0f1422]">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                        Dimensions & Structural Rules
                    </h2>
                    <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                        Define the adjustable dimensions and set behavioral rules (e.g. changing component quantities at specific sizes).
                    </p>
                </div>

                {/* Auto-save badge */}
                <div className="flex items-center gap-1.5 text-xs font-medium self-start sm:self-auto shrink-0">
                    {autoSaveStatus === "saving" && (
                        <span className="flex items-center gap-1.5 text-[#07b6d3] bg-[#07b6d3]/10 px-2.5 py-1 rounded-full">
                            <Loader2 className="size-3 animate-spin" /> Saving...
                        </span>
                    )}
                    {autoSaveStatus === "saved" && (
                        <span className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="size-3 text-green-600" /> Saved
                        </span>
                    )}
                    {autoSaveStatus === "error" && (
                        <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                            <AlertCircle className="size-3" /> Auto-save paused
                        </span>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-neutral-200 mt-2">
                <button
                    onClick={() => setActiveTab("parameters")}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                        activeTab === "parameters" ? "border-[#07b6d3] text-[#07b6d3]" : "border-transparent text-neutral-500 hover:text-neutral-800"
                    }`}
                >
                    <Settings2 className="size-4" /> Parameters ({parameters.length})
                </button>
                <button
                    onClick={() => setActiveTab("rules")}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                        activeTab === "rules" ? "border-[#07b6d3] text-[#07b6d3]" : "border-transparent text-neutral-500 hover:text-neutral-800"
                    }`}
                >
                    <CodeSquare className="size-4" /> Logic Rules ({rules.length})
                </button>
                {productId && (
                    <button
                        onClick={() => setActiveTab("addons")}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                            activeTab === "addons" ? "border-[#07b6d3] text-[#07b6d3]" : "border-transparent text-neutral-500 hover:text-neutral-800"
                        }`}
                    >
                        <Layers className="size-4" /> Compatible Add-ons
                    </button>
                )}
            </div>

            {/* Parameters Tab */}
            {activeTab === "parameters" && (
                <div className="flex flex-col gap-4 mt-2">
                    {parameters.map((param, index) => (
                        <div key={index} className="flex flex-wrap gap-4 items-end bg-[#fcfcfc] border border-neutral-200 p-4 rounded-[12px]">
                            <div className="flex flex-col gap-1 w-full sm:w-[200px]">
                                <label className="text-xs font-medium text-neutral-600">Name</label>
                                <input 
                                    type="text" 
                                    value={param.parameter_name} 
                                    onChange={(e) => updateParameter(index, { parameter_name: e.target.value })}
                                    className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-full sm:w-[120px]">
                                <label className="text-xs font-medium text-neutral-600">Key</label>
                                <input 
                                    type="text" 
                                    value={param.parameter_key} 
                                    onChange={(e) => updateParameter(index, { parameter_key: e.target.value })}
                                    className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-24">
                                <label className="text-xs font-medium text-neutral-600">Min</label>
                                <input 
                                    type="number" 
                                    value={param.minimum_value || 0} 
                                    onChange={(e) => updateParameter(index, { minimum_value: parseFloat(e.target.value) })}
                                    className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-24">
                                <label className="text-xs font-medium text-neutral-600">Default</label>
                                <input 
                                    type="number" 
                                    value={param.default_value} 
                                    onChange={(e) => updateParameter(index, { default_value: parseFloat(e.target.value) })}
                                    className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-28">
                                <label className="text-xs font-medium text-neutral-600">Max</label>
                                {param.parameter_key === "width" || param.parameter_key === "height" ? (
                                    <div className="flex items-center h-[38px] px-2.5 rounded-[8px] bg-neutral-100 border border-neutral-200 text-xs text-neutral-500 font-medium">
                                        No Max (Open)
                                    </div>
                                ) : (
                                    <input 
                                        type="number" 
                                        placeholder="No Max"
                                        value={param.maximum_value ?? ""} 
                                        onChange={(e) => updateParameter(index, { 
                                            maximum_value: e.target.value === "" ? null : parseFloat(e.target.value) 
                                        })}
                                        className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                    />
                                )}
                            </div>
                            <div className="flex flex-col gap-1 w-20">
                                <label className="text-xs font-medium text-neutral-600">Step</label>
                                <input 
                                    type="number" 
                                    value={param.step_value || 1} 
                                    onChange={(e) => updateParameter(index, { step_value: parseFloat(e.target.value) })}
                                    className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-20">
                                <label className="text-xs font-medium text-neutral-600">Unit</label>
                                <input 
                                    type="text" 
                                    value={param.unit || ""} 
                                    onChange={(e) => updateParameter(index, { unit: e.target.value })}
                                    className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                />
                            </div>
                            <button onClick={() => removeParameter(index)} className="p-2 text-neutral-400 hover:text-red-500 mb-0.5 transition-colors">
                                <X className="size-5" />
                            </button>
                        </div>
                    ))}
                    
                    <button onClick={addParameter} className="flex items-center gap-2 text-sm text-[#07b6d3] font-medium hover:text-[#06a2bc] px-2 py-1 self-start transition-colors">
                        <Plus className="size-4" /> Add Parameter
                    </button>
                </div>
            )}

            {/* Rules Tab */}
            {activeTab === "rules" && (
                <div className="flex flex-col gap-4 mt-2">
                    {/* Smart Dynamic Bay Replication Card */}
                    <div className="bg-[#fcfcfc] border border-neutral-200 rounded-[12px] p-4 flex flex-col gap-4 shadow-xs">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={dynamicBayConfig.enabled}
                                        onChange={(e) => updateDynamicBayConfig({ enabled: e.target.checked })}
                                        className="rounded border-neutral-300 text-[#07b6d3] focus:ring-[#07b6d3] size-4 cursor-pointer"
                                    />
                                    <span className="font-semibold text-sm text-[#0f1422]">
                                        Enable Smart Dynamic Bay Replication
                                    </span>
                                </label>
                                <p className="text-xs text-neutral-500 pl-6">
                                    Automatically generates intermediate mullions, infills, and operating hardware as aperture dimensions scale, eliminating manual WHEN/THEN rules.
                                </p>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${dynamicBayConfig.enabled ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-neutral-100 text-neutral-500"}`}>
                                {dynamicBayConfig.enabled ? "Active" : "Disabled"}
                            </span>
                        </div>

                        {dynamicBayConfig.enabled && (
                            <div className="flex flex-col gap-4 pt-3 border-t border-neutral-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-neutral-600">
                                            Baseline Bay Count
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={dynamicBayConfig.default_bay_count ?? 2}
                                            onChange={(e) => updateDynamicBayConfig({ default_bay_count: parseInt(e.target.value, 10) || 1 })}
                                            className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm outline-none focus:border-[#07b6d3] bg-white font-mono"
                                        />
                                        <span className="text-[11px] text-neutral-400">Baseline dual-bay unit</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-neutral-600">
                                            Nominal Bay Pitch (mm)
                                        </label>
                                        <input
                                            type="number"
                                            min="200"
                                            max="2000"
                                            step="10"
                                            value={dynamicBayConfig.nominal_bay_pitch_mm ?? 600}
                                            onChange={(e) => updateDynamicBayConfig({ nominal_bay_pitch_mm: parseFloat(e.target.value) || 600 })}
                                            className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm outline-none focus:border-[#07b6d3] bg-white font-mono"
                                        />
                                        <span className="text-[11px] text-neutral-400">Target modular width per bay</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-neutral-600">
                                            Min Bay Width (mm)
                                        </label>
                                        <input
                                            type="number"
                                            min="100"
                                            max="2000"
                                            step="10"
                                            value={dynamicBayConfig.min_bay_width_mm ?? 400}
                                            onChange={(e) => updateDynamicBayConfig({ min_bay_width_mm: parseFloat(e.target.value) || 400 })}
                                            className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm outline-none focus:border-[#07b6d3] bg-white font-mono"
                                        />
                                        <span className="text-[11px] text-neutral-400">Narrowest structural aperture</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-neutral-600">
                                            Max Bay Width (mm)
                                        </label>
                                        <input
                                            type="number"
                                            min="200"
                                            max="4000"
                                            step="10"
                                            value={dynamicBayConfig.max_bay_width_mm ?? 1000}
                                            onChange={(e) => updateDynamicBayConfig({ max_bay_width_mm: parseFloat(e.target.value) || 1000 })}
                                            className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm outline-none focus:border-[#07b6d3] bg-white font-mono"
                                        />
                                        <span className="text-[11px] text-neutral-400">Widest structural aperture</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-neutral-600">
                                        Default Expansion Anchor
                                    </label>
                                    <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-100 self-start">
                                        <button
                                            type="button"
                                            onClick={() => updateDynamicBayConfig({ expansion_anchor: "symmetric" })}
                                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                                                (dynamicBayConfig.expansion_anchor || "symmetric") === "symmetric"
                                                    ? "bg-white text-[#0f1422] shadow-xs"
                                                    : "text-neutral-600 hover:text-neutral-900"
                                            }`}
                                        >
                                            Symmetric (Center)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateDynamicBayConfig({ expansion_anchor: "rightward" })}
                                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                                                dynamicBayConfig.expansion_anchor === "rightward"
                                                    ? "bg-white text-[#0f1422] shadow-xs"
                                                    : "text-neutral-600 hover:text-neutral-900"
                                            }`}
                                        >
                                            Expand Rightward
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateDynamicBayConfig({ expansion_anchor: "leftward" })}
                                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                                                dynamicBayConfig.expansion_anchor === "leftward"
                                                    ? "bg-white text-[#0f1422] shadow-xs"
                                                    : "text-neutral-600 hover:text-neutral-900"
                                            }`}
                                        >
                                            Expand Leftward
                                        </button>
                                    </div>
                                </div>

                                <div className="p-3 bg-sky-50 border border-sky-100 rounded-[8px] text-xs text-sky-800 flex items-center gap-2">
                                    <Info className="size-4 shrink-0 text-[#07b6d3]" />
                                    <span>
                                        Smart Bay Replication is active. Component quantities for mullions, louvers, and operators are computed dynamically.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {dynamicBayConfig.enabled ? (
                        <div className="p-4 bg-neutral-50 border border-dashed border-neutral-200 rounded-[12px] text-xs text-neutral-500 flex flex-col gap-2">
                            <span className="font-medium text-neutral-700">Manual Rules Suppressed</span>
                            <span>
                                Manual WHEN/THEN and Step Loop rules are bypassed while Smart Dynamic Bay Replication is active. Intermediate mullions and modular arrays will be replicated dynamically based on aperture width.
                            </span>
                        </div>
                    ) : (
                        <>
                            {rules.length === 0 && (
                                <div className="p-6 text-center text-neutral-500 bg-neutral-50 rounded-[12px] border border-dashed border-neutral-200">
                                    No rules defined. Components will use their base quantity.
                                </div>
                            )}
                    {rules.map((rule, index) => {
                        const isLoop = rule.condition_data.rule_type === "loop";
                        return (
                            <div key={index} className="flex flex-col gap-4 bg-[#fcfcfc] border border-neutral-200 p-4 rounded-[12px]">
                                <div className="flex items-center justify-between">
                                    <input 
                                        type="text" 
                                        value={rule.rule_name}
                                        onChange={(e) => updateRule(index, { rule_name: e.target.value })}
                                        className="font-medium bg-transparent outline-none text-[#0f1422] focus:border-b border-[#07b6d3]"
                                    />
                                    <button onClick={() => removeRule(index)} className="p-1 text-neutral-400 hover:text-red-500 transition-colors">
                                        <X className="size-4" />
                                    </button>
                                </div>

                                {/* Rule Type Selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-neutral-500">Rule Type:</span>
                                    <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
                                        <button
                                            type="button"
                                            onClick={() => updateRule(index, { 
                                                condition_data: { 
                                                    ...rule.condition_data, 
                                                    rule_type: "when_then",
                                                    operator: rule.condition_data.operator || ">=",
                                                    value: rule.condition_data.value ?? 1800
                                                } 
                                            })}
                                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                                !isLoop
                                                    ? "bg-white text-[#0f1422] shadow-xs"
                                                    : "text-neutral-500 hover:text-neutral-900"
                                            }`}
                                        >
                                            Threshold (WHEN / THEN)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateRule(index, { 
                                                condition_data: { 
                                                    ...rule.condition_data, 
                                                    rule_type: "loop",
                                                    step_value: rule.condition_data.step_value || 500,
                                                    start_value: rule.condition_data.start_value ?? 1000
                                                },
                                                action_data: {
                                                    ...rule.action_data,
                                                    action_type: rule.action_data.action_type || "add_quantity",
                                                    value: rule.action_data.value || 1
                                                }
                                            })}
                                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                                isLoop
                                                    ? "bg-white text-[#0f1422] shadow-xs"
                                                    : "text-neutral-500 hover:text-neutral-900"
                                            }`}
                                        >
                                            Step Loop (FOR EVERY ... ADD ...)
                                        </button>
                                    </div>
                                </div>

                                {isLoop ? (
                                    <div className="flex flex-col gap-3">
                                        {/* Loop Condition Row */}
                                        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-[8px] border border-neutral-100 shadow-sm text-sm">
                                            <span className="font-semibold text-[#07b6d3]">FOR EVERY</span>
                                            <input 
                                                type="number"
                                                min="1"
                                                placeholder="500"
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3] w-20 text-center font-mono"
                                                value={rule.condition_data.step_value ?? 500}
                                                onChange={(e) => updateRule(index, { condition_data: { ...rule.condition_data, step_value: parseFloat(e.target.value) || 0 } })}
                                            />
                                            <span className="text-neutral-600">mm added to</span>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3]"
                                                value={rule.condition_data.parameter_key}
                                                onChange={(e) => updateRule(index, { condition_data: { ...rule.condition_data, parameter_key: e.target.value } })}
                                            >
                                                <option value="">Select Param...</option>
                                                {parameters.map(p => (
                                                    <option key={p.parameter_key} value={p.parameter_key}>{p.parameter_name}</option>
                                                ))}
                                            </select>
                                            <span className="text-neutral-600">above</span>
                                            <input 
                                                type="number"
                                                placeholder="1000"
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3] w-24 text-center font-mono"
                                                value={rule.condition_data.start_value ?? 0}
                                                onChange={(e) => updateRule(index, { condition_data: { ...rule.condition_data, start_value: parseFloat(e.target.value) || 0 } })}
                                            />
                                            <span className="text-neutral-500 text-xs">mm</span>
                                        </div>

                                        {/* Loop Action Row */}
                                        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-[8px] border border-neutral-100 shadow-sm text-sm">
                                            <span className="font-semibold text-emerald-600">THEN</span>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3]"
                                                value={rule.action_data.action_type}
                                                onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, action_type: e.target.value } })}
                                            >
                                                <option value="add_quantity">Add to Quantity</option>
                                                <option value="set_quantity">Set Quantity</option>
                                            </select>
                                            <input 
                                                type="number" 
                                                min="1"
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3] w-20 text-center font-mono"
                                                value={rule.action_data.value ?? 1}
                                                onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, value: parseFloat(e.target.value) || 0 } })}
                                            />
                                            <span className="text-neutral-600">of component</span>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3]"
                                                value={rule.action_data.target_key}
                                                onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, target_key: e.target.value } })}
                                            >
                                                <option value="">Select Target...</option>
                                                {componentKeys.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[8px] border border-neutral-100 shadow-sm">
                                            <span className="text-sm font-semibold text-neutral-500 w-12">WHEN</span>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3]"
                                                value={rule.condition_data.parameter_key}
                                                onChange={(e) => updateRule(index, { condition_data: { ...rule.condition_data, parameter_key: e.target.value } })}
                                            >
                                                <option value="">Select Param...</option>
                                                {parameters.map(p => (
                                                    <option key={p.parameter_key} value={p.parameter_key}>{p.parameter_name}</option>
                                                ))}
                                            </select>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3] w-20"
                                                value={rule.condition_data.operator || ">="}
                                                onChange={(e) => updateRule(index, { condition_data: { ...rule.condition_data, operator: e.target.value } })}
                                            >
                                                <option value=">=">&gt;=</option>
                                                <option value="<=">&lt;=</option>
                                                <option value="==">==</option>
                                                <option value=">">&gt;</option>
                                                <option value="<">&lt;</option>
                                            </select>
                                            <input 
                                                type="number" 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3] w-24"
                                                value={rule.condition_data.value ?? 0}
                                                onChange={(e) => updateRule(index, { condition_data: { ...rule.condition_data, value: parseFloat(e.target.value) || 0 } })}
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[8px] border border-neutral-100 shadow-sm">
                                            <span className="text-sm font-semibold text-neutral-500 w-12">THEN</span>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3]"
                                                value={rule.action_data.target_type}
                                                onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, target_type: e.target.value } })}
                                            >
                                                <option value="component">Component</option>
                                                <option value="parameter">Parameter</option>
                                            </select>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3]"
                                                value={rule.action_data.target_key}
                                                onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, target_key: e.target.value } })}
                                            >
                                                <option value="">Select Target...</option>
                                                {rule.action_data.target_type === "component" 
                                                    ? componentKeys.map(c => <option key={c.key} value={c.key}>{c.name}</option>)
                                                    : parameters.map(p => <option key={p.parameter_key} value={p.parameter_key}>{p.parameter_name}</option>)
                                                }
                                            </select>
                                            <select 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3]"
                                                value={rule.action_data.action_type}
                                                onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, action_type: e.target.value } })}
                                            >
                                                <option value="set_quantity">Set Quantity</option>
                                                <option value="add_quantity">Add to Quantity</option>
                                                <option value="set_visibility">Set Visibility (1 or 0)</option>
                                            </select>
                                            <input 
                                                type="number" 
                                                className="border border-neutral-200 rounded-md px-2 py-1.5 text-sm outline-none focus:border-[#07b6d3] w-24"
                                                value={rule.action_data.value ?? 0}
                                                onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, value: parseFloat(e.target.value) || 0 } })}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}

                            <button onClick={addRule} className="flex items-center gap-2 text-sm text-[#07b6d3] font-medium hover:text-[#06a2bc] px-2 py-1 self-start transition-colors">
                                <Plus className="size-4" /> Add Rule
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Compatible Add-ons Tab */}
            {activeTab === "addons" && productId && (
                <div className="mt-2">
                    <AddonInheritanceSection
                        productId={productId}
                        isAddon={isAddon}
                        productType={productType}
                        hostComponents={Array.isArray(rawComponents) ? (rawComponents as Array<Record<string, unknown>>) : []}
                    />
                </div>
            )}

            {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-[8px] text-sm mt-4 border border-red-100 flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" /> {errorMsg}
                </div>
            )}

            <div className="flex justify-end pt-6 mt-4 border-t border-neutral-200">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
                >
                    {isSaving && <Loader2 className="size-4 animate-spin" />}
                    Save & Continue to Validation
                </button>
            </div>
        </div>
    );
}
