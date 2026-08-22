"use client";

import { useState, useMemo } from "react";
import { Plus, X, Loader2, Info, Settings2, CodeSquare } from "lucide-react";
import { upsertParametersAndRules, UpsertParameterInput, UpsertRuleInput } from "@/lib/admin/products/parameterMutations";

export type ParametersAndRulesSectionProps = {
    templateId: string | null;
    modelStrategy: string | null;
    initialData?: {
        parameters: any[];
        rules: any[];
        components: any[];
    };
    onSave: () => void;
};

export function ParametersAndRulesSection({ templateId, modelStrategy, initialData, onSave }: ParametersAndRulesSectionProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"parameters" | "rules">("parameters");

    const [parameters, setParameters] = useState<UpsertParameterInput[]>(() => {
        if (!initialData?.parameters || !Array.isArray(initialData.parameters)) {
            // Default params if none exist
            return [
                {
                    parameter_name: "Width",
                    parameter_key: "width",
                    parameter_type: "Number",
                    minimum_value: 500,
                    default_value: 1000,
                    maximum_value: 3000,
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
                    default_value: 2000,
                    maximum_value: 3000,
                    step_value: 1,
                    unit: "mm",
                    affects_structure: true,
                    display_order: 2
                }
            ];
        }
        return initialData.parameters;
    });

    const [rules, setRules] = useState<UpsertRuleInput[]>(() => {
        return Array.isArray(initialData?.rules) ? initialData.rules : [];
    });

    // Reference data for rules
    const componentKeys = useMemo(() => {
        if (!initialData?.components || !Array.isArray(initialData.components)) return [];
        return initialData.components.map(c => ({ key: c.component_key, name: c.component_name }));
    }, [initialData?.components]);

    const addParameter = () => {
        setParameters([
            ...parameters, 
            {
                parameter_name: "New Parameter",
                parameter_key: `param_${parameters.length + 1}`,
                parameter_type: "Number",
                minimum_value: 0,
                default_value: 0,
                maximum_value: 100,
                step_value: 1,
                unit: "mm",
                affects_structure: true,
                display_order: parameters.length + 1
            }
        ]);
    };

    const updateParameter = (index: number, updates: Partial<UpsertParameterInput>) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], ...updates };
        setParameters(newParams);
    };

    const removeParameter = (index: number) => {
        setParameters(parameters.filter((_, i) => i !== index));
    };

    const addRule = () => {
        setRules([
            ...rules,
            {
                rule_name: `Rule ${rules.length + 1}`,
                priority: rules.length + 1,
                condition_data: { parameter_key: parameters[0]?.parameter_key || "", operator: ">=", value: 0 },
                action_data: { target_type: "component", target_key: componentKeys[0]?.key || "", action_type: "set_quantity", value: 1 }
            }
        ]);
    };

    const updateRule = (index: number, updates: Partial<UpsertRuleInput>) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], ...updates };
        setRules(newRules);
    };

    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!templateId) return;
        setIsSaving(true);
        setErrorMsg(null);
        try {
            // Basic validation
            for (const param of parameters) {
                if (param.minimum_value !== null && param.maximum_value !== null && param.minimum_value > param.maximum_value) {
                    throw new Error(`Parameter ${param.parameter_name} has minimum > maximum.`);
                }
            }

            for (const rule of rules) {
                if (!parameters.find(p => p.parameter_key === rule.condition_data.parameter_key)) {
                    throw new Error(`Rule ${rule.rule_name} references an invalid parameter.`);
                }
                if (rule.action_data.target_type === "component" && !componentKeys.find(c => c.key === rule.action_data.target_key)) {
                    throw new Error(`Rule ${rule.rule_name} references a component (${rule.action_data.target_key}) that doesn't exist.`);
                }
            }

            await upsertParametersAndRules(templateId, parameters, rules);
            onSave();
        } catch (e: any) {
            setErrorMsg(e.message);
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
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    Dimensions & Structural Rules
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Define the adjustable dimensions and set behavioral rules (e.g. changing component quantities at specific sizes).
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-neutral-200 mt-2">
                <button
                    onClick={() => setActiveTab("parameters")}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                        activeTab === "parameters" ? "border-[#07b6d3] text-[#07b6d3]" : "border-transparent text-neutral-500 hover:text-neutral-800"
                    }`}
                >
                    <Settings2 className="size-4" /> Parameters
                </button>
                <button
                    onClick={() => setActiveTab("rules")}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                        activeTab === "rules" ? "border-[#07b6d3] text-[#07b6d3]" : "border-transparent text-neutral-500 hover:text-neutral-800"
                    }`}
                >
                    <CodeSquare className="size-4" /> Logic Rules
                </button>
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
                            <div className="flex flex-col gap-1 w-24">
                                <label className="text-xs font-medium text-neutral-600">Max</label>
                                <input 
                                    type="number" 
                                    value={param.maximum_value || 1000} 
                                    onChange={(e) => updateParameter(index, { maximum_value: parseFloat(e.target.value) })}
                                    className="border border-neutral-200 rounded-[8px] px-3 py-1.5 text-sm focus:border-[#07b6d3] outline-none"
                                />
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
                    {rules.length === 0 && (
                        <div className="p-6 text-center text-neutral-500 bg-neutral-50 rounded-[12px] border border-dashed border-neutral-200">
                            No rules defined. Components will use their base quantity.
                        </div>
                    )}
                    {rules.map((rule, index) => (
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
                                    value={rule.condition_data.operator}
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
                                    value={rule.condition_data.value}
                                    onChange={(e) => updateRule(index, { condition_data: { ...rule.condition_data, value: parseFloat(e.target.value) } })}
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
                                    value={rule.action_data.value}
                                    onChange={(e) => updateRule(index, { action_data: { ...rule.action_data, value: parseFloat(e.target.value) } })}
                                />
                            </div>
                        </div>
                    ))}

                    <button onClick={addRule} className="flex items-center gap-2 text-sm text-[#07b6d3] font-medium hover:text-[#06a2bc] px-2 py-1 self-start transition-colors">
                        <Plus className="size-4" /> Add Rule
                    </button>
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

// Temporary for missing icon
function AlertCircle({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
    );
}
