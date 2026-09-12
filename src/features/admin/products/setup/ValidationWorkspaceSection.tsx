"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { Loader2, Play, CheckCircle2, ChevronRight, ChevronDown, Check, EyeOff, AlertTriangle, Calculator, ShieldAlert, Sparkles } from "lucide-react";
import { fetchDraftStructuralDefinition } from "@/lib/admin/products/validationMutations";
import { ProductStructuralDefinition, ResolvedStructure } from "@/lib/visualization/types";
import { ComponentModelCache, preloadComponentModels } from "@/lib/visualization/componentModelCache";
import { resolveProductStructure } from "@/lib/visualization/structuralResolver";
import { buildParametricProduct } from "@/lib/visualization/parametricProductBuilder";
import { getRawMaterials } from "@/lib/admin/materials/materialActions";
import { calculateParametricBOM, type ComponentPricingInput, type CalculatedBOMResult } from "@/lib/pricing/pricingEngine";
import type { RawMaterial } from "@/lib/pricing/types";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";

export type ValidationWorkspaceSectionProps = {
    productId: string;
    onSave: () => void;
};

// Internal component for React Three Fiber rendering
function ParametricModelView({
    definition,
    resolved,
    cache,
    hasSill,
    hiddenComponents
}: {
    definition: ProductStructuralDefinition;
    resolved: ResolvedStructure;
    cache: ComponentModelCache;
    hasSill: boolean;
    hiddenComponents: Set<string>;
}) {
    const group = useMemo(() => {
        const built = buildParametricProduct(definition, resolved, cache, {
            includeSill: hasSill,
        });
        
        // Apply visibility overrides from the debugger
        built.group.traverse((child) => {
            if (child.userData && child.userData.componentKey) {
                const normalized = String(child.userData.componentKey).trim().toLowerCase().replace(/_/g, "-");
                const isHidden = hiddenComponents.has(child.userData.componentKey) || hiddenComponents.has(normalized);
                if (isHidden) {
                    child.visible = false;
                }
            }
        });
        
        return built.group;
    }, [definition, resolved, cache, hasSill, hiddenComponents]);

    return (
        <primitive object={group} />
    );
}

export function ValidationWorkspaceSection({ productId, onSave }: ValidationWorkspaceSectionProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    const [definition, setDefinition] = useState<ProductStructuralDefinition | null>(null);
    const [cache, setCache] = useState<ComponentModelCache | null>(null);
    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
    
    const [parameters, setParameters] = useState<Record<string, number>>({});
    const [resolvedStructure, setResolvedStructure] = useState<ResolvedStructure | null>(null);
    const [hasSill, setHasSill] = useState(true);
    
    const [hiddenComponents, setHiddenComponents] = useState<Set<string>>(new Set());
    const [testResults, setTestResults] = useState<{name: string, status: "pending"|"pass"|"fail"}[]>([]);

    useEffect(() => {
        async function load() {
            try {
                setIsLoading(true);
                const [def, mats] = await Promise.all([
                    fetchDraftStructuralDefinition(productId),
                    getRawMaterials({ is_active: true }),
                ]);
                setDefinition(def);
                setRawMaterials(mats);
                
                const loadedCache = await preloadComponentModels(def.components);
                setCache(loadedCache);
                
                // Initialize parameters to default
                const initialParams: Record<string, number> = {
                    has_sill: 1,
                    include_sill: 1,
                    includeSill: 1,
                };
                def.parameters.forEach(p => {
                    initialParams[p.parameterKey] = Number(p.defaultValue);
                });
                setParameters(initialParams);
                
                const resolved = resolveProductStructure({ definition: def, values: initialParams });
                setResolvedStructure(resolved);
                
            } catch (e: unknown) {
                setErrorMsg(e instanceof Error ? e.message : "Failed to load workspace");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [productId]);

    // Handle manual parameter changes
    const handleParameterChange = (key: string, value: number) => {
        if (!definition) return;
        const newParams = {
            ...parameters,
            [key]: value,
            has_sill: hasSill ? 1 : 0,
            include_sill: hasSill ? 1 : 0,
            includeSill: hasSill ? 1 : 0,
        };
        setParameters(newParams);
        try {
            const resolved = resolveProductStructure({ definition, values: newParams });
            setResolvedStructure(resolved);
        } catch (e) {
            console.error("Resolver failed:", e);
        }
    };

    const handleSillToggle = (newHasSill: boolean) => {
        setHasSill(newHasSill);
        if (!definition) return;
        const newParams = {
            ...parameters,
            has_sill: newHasSill ? 1 : 0,
            include_sill: newHasSill ? 1 : 0,
            includeSill: newHasSill ? 1 : 0,
        };
        setParameters(newParams);
        try {
            const resolved = resolveProductStructure({ definition, values: newParams });
            setResolvedStructure(resolved);
        } catch (e) {
            console.error("Resolver failed on sill toggle:", e);
        }
    };

    const toggleComponentVisibility = (key: string) => {
        setHiddenComponents(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Calculate real-time Parametric Bill of Materials
    const bomCalculation: CalculatedBOMResult | null = useMemo(() => {
        if (!definition) return null;

        const currentWidthMm = parameters.width ?? parameters.quotation_width ?? 1200;
        const currentHeightMm = parameters.height ?? parameters.quotation_height ?? 1200;
        const currentPanels = parameters.panel_count ?? (currentWidthMm >= 2400 ? 3 : 2);

        const pricingInputs: ComponentPricingInput[] = definition.components.map((comp) => {
            const boundMat = rawMaterials.find((m) => m.id === comp.rawMaterialId) || null;
            return {
                componentKey: comp.componentKey,
                componentName: comp.componentName,
                dimensionBinding: comp.dimensionBinding || "FIXED",
                spanRatio: comp.spanRatio ?? 1.0,
                baseQuantity: comp.baseQuantity ?? 1,
                isRemovable: comp.isRemovable ?? false,
                togglePropertyKey: comp.togglePropertyKey,
                presentationCategory: comp.presentationCategory || "Framing",
                rawMaterial: boundMat,
            };
        });

        // If no catalog materials are linked yet, synthesize benchmark Series 798 rates for simulation
        const hasLinkedMaterials = pricingInputs.some(p => p.rawMaterial !== null);
        if (!hasLinkedMaterials) {
            // Synthesize Series 798 Analok rates for test-drive preview
            const alScrap = 0.12;
            const glScrap = 0.10;
            pricingInputs.forEach(input => {
                const key = input.componentKey.toLowerCase();
                if (key.includes("head")) {
                    input.rawMaterial = { id: "m-head", material_code: "mat_al_798_head_anlk", description: "Series 798 Double Head", category: "Aluminum", finish_type: "Analok", billing_unit: "m", unit_price: 90.0, waste_allowance: alScrap, is_active: true };
                } else if (key.includes("sill")) {
                    input.rawMaterial = { id: "m-sill", material_code: "mat_al_798_sill_anlk", description: "Series 798 Double Sill", category: "Aluminum", finish_type: "Analok", billing_unit: "m", unit_price: 110.0, waste_allowance: alScrap, is_active: true };
                } else if (key.includes("jamb")) {
                    input.rawMaterial = { id: "m-jamb", material_code: "mat_al_798_jamb_anlk", description: "Series 798 Double Jamb", category: "Aluminum", finish_type: "Analok", billing_unit: "m", unit_price: 70.0, waste_allowance: alScrap, is_active: true };
                } else if (key.includes("rail")) {
                    input.rawMaterial = { id: "m-rail", material_code: "mat_al_798_rail_anlk", description: "Series 798 Sash Rail", category: "Aluminum", finish_type: "Analok", billing_unit: "m", unit_price: 72.0, waste_allowance: alScrap, is_active: true };
                } else if (key.includes("stile") || key.includes("interlock")) {
                    input.rawMaterial = { id: "m-stile", material_code: "mat_al_798_stle_anlk", description: "Series 798 Interlock/Lockstile", category: "Aluminum", finish_type: "Analok", billing_unit: "m", unit_price: 78.0, waste_allowance: alScrap, is_active: true };
                } else if (key.includes("glass") || key.includes("pane")) {
                    input.rawMaterial = { id: "m-glass", material_code: "mat_gl_6mm_float_brz", description: "6mm Annealed Float Tinted", category: "Glass", finish_type: "Bronze", billing_unit: "sqm", unit_price: 780.0, waste_allowance: glScrap, is_active: true };
                } else if (key.includes("roller")) {
                    input.rawMaterial = { id: "m-roller", material_code: "mat_hw_798_roller", description: "Series 798 Single POM Roller", category: "Hardware", finish_type: "None", billing_unit: "pc", unit_price: 25.0, waste_allowance: 0, is_active: true };
                } else if (key.includes("lock")) {
                    input.rawMaterial = { id: "m-lock", material_code: "mat_hw_flush_lock", description: "Mortise Flush Latch Lock", category: "Hardware", finish_type: "None", billing_unit: "pc", unit_price: 65.0, waste_allowance: 0, is_active: true };
                }
            });
        }

        return calculateParametricBOM(pricingInputs, {
            widthMm: currentWidthMm,
            heightMm: currentHeightMm,
            panelCount: currentPanels,
            hasSill,
        });
    }, [definition, rawMaterials, parameters, hasSill]);

    const runAutomaticTests = () => {
        if (!definition) return;
        
        const tests = [
            { name: "Default Parameters (1200x1200mm)", params: {} as Record<string, number> },
            { name: "Extended Width (1800x1200mm)", params: { width: 1800, height: 1200 } as Record<string, number> },
            { name: "Wide Span Guardrail (2600x1200mm)", params: { width: 2600, height: 1200 } as Record<string, number> },
            { name: "Minimum Boundary Check", params: {} as Record<string, number> },
            { name: "Maximum Boundary Check", params: {} as Record<string, number> }
        ];

        definition.parameters.forEach(p => {
            tests[0].params[p.parameterKey] = Number(p.defaultValue);
            tests[3].params[p.parameterKey] = p.minimumValue !== null ? Number(p.minimumValue) : Number(p.defaultValue);
            tests[4].params[p.parameterKey] = p.maximumValue !== null ? Number(p.maximumValue) : Number(p.defaultValue);
        });

        const results = tests.map(test => {
            try {
                resolveProductStructure({ definition, values: test.params });
                return { name: test.name, status: "pass" as const };
            } catch (e) {
                console.error("Test execution failed:", e);
                return { name: test.name, status: "fail" as const };
            }
        });

        setTestResults(results);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                <Loader2 className="size-8 animate-spin mb-4 text-[#07b6d3]" />
                <p>Loading interactive test-drive simulator...</p>
            </div>
        );
    }

    if (errorMsg || !definition || !cache || !resolvedStructure) {
        return (
            <div className="bg-red-50 text-red-600 p-6 rounded-[12px] border border-red-100">
                <h3 className="font-semibold text-lg mb-2">Workspace Failed to Load</h3>
                <p>{errorMsg || "Failed to initialize 3D workspace. Please ensure all components and assets are valid."}</p>
            </div>
        );
    }

    const currentWidthMm = parameters.width ?? parameters.quotation_width ?? 1200;
    const currentHeightMm = parameters.height ?? parameters.quotation_height ?? 1200;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                        Interactive Test-Drive Simulator & BOM Validator
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#07b6d3]/10 text-[#07b6d3] text-xs font-semibold">
                        Step 6 Sandbox
                    </span>
                </div>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Test your parametric dimensions, sill removal deduction, cutting scrap allowances, and live customer quotations before publishing.
                </p>
            </div>

            {/* Engineering Guardrail Warning Badges */}
            {bomCalculation && (
                <div className="space-y-2">
                    {bomCalculation.isCrabbingRisk && (
                        <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3.5 flex items-start gap-3 text-xs text-amber-800">
                            <AlertTriangle className="size-4.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-semibold">Aspect Ratio Alert (Crabbing / Racking Risk):</span>
                                <span className="ml-1">
                                    Current leaf aspect ratio is {bomCalculation.aspectRatio.toFixed(2)}:1 (exceeds 1.2:1 operational envelope).
                                    Excessive leaf width relative to height induces diagonal racking against jamb tracks.
                                </span>
                            </div>
                        </div>
                    )}

                    {bomCalculation.isSpanLimitExceeded && (
                        <div className="bg-rose-50 border border-rose-200 rounded-[12px] p-3.5 flex items-start gap-3 text-xs text-rose-800">
                            <ShieldAlert className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-semibold">NSCP 2015 Structural Span Threshold (W ≥ 2400mm):</span>
                                <span className="ml-1">
                                    Opening width of {currentWidthMm}mm on 2 panels exceeds Series 798 1200mm leaf limits (POM roller max 40kg).
                                    A 3-panel transition or signed structural waiver is mandated for live catalog customers.
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 3D Canvas (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                    <div className="bg-[#e9e9e9] rounded-[16px] overflow-hidden border border-neutral-200 min-h-[440px] relative">
                        <Canvas shadows camera={{ position: [2, 2, 4], fov: 40 }}>
                            <ambientLight intensity={0.6} />
                            <directionalLight castShadow position={[5, 5, 5]} intensity={1.2} shadow-mapSize={[1024, 1024]} />
                            <Suspense fallback={null}>
                                <Stage environment="city" adjustCamera={false}>
                                    <ParametricModelView 
                                        definition={definition} 
                                        resolved={resolvedStructure} 
                                        cache={cache} 
                                        hasSill={hasSill}
                                        hiddenComponents={hiddenComponents} 
                                    />
                                </Stage>
                            </Suspense>
                            <OrbitControls makeDefault />
                        </Canvas>
                        <div className="absolute top-4 left-4 bg-white/85 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium border border-white/40 shadow-xs flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-[#05b64b] animate-pulse" />
                            Live 3D Geometry ({currentWidthMm}mm × {currentHeightMm}mm)
                        </div>
                    </div>

                    {/* Quick Feature Switch (Sill Toggle) */}
                    <div className="bg-white border border-neutral-200 rounded-[12px] p-4 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2.5">
                            <Sparkles className="size-4 text-[#07b6d3]" />
                            <div>
                                <h4 className="text-xs font-semibold text-[#0f1422]">Bottom Sill Profile (has_sill)</h4>
                                <p className="text-[11px] text-neutral-500">Toggle bottom track inclusion to test net customer price adjustment</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hasSill}
                                onChange={(e) => handleSillToggle(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#07b6d3]"></div>
                        </label>
                    </div>
                </div>

                {/* Controls & Real-Time BOM Preview (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    {/* Interactive Parameter Controls */}
                    <div className="bg-white border border-neutral-200 rounded-[12px] p-4 shadow-xs">
                        <h3 className="font-semibold text-xs text-[#0f1422] uppercase tracking-wider mb-3 flex items-center justify-between">
                            <span>Interactive Sizing Sandbox</span>
                            <Calculator className="size-3.5 text-[#07b6d3]" />
                        </h3>
                        <div className="flex flex-col gap-3.5">
                            {definition.parameters.map(p => (
                                <div key={p.parameterKey} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center text-xs">
                                        <label className="font-medium text-neutral-700">{p.parameterName}</label>
                                        <span className="font-mono text-[#07b6d3] font-semibold">{parameters[p.parameterKey]} {p.unit}</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min={p.minimumValue ?? 600}
                                        max={p.maximumValue ?? 3600}
                                        step={p.stepValue ?? 10}
                                        value={parameters[p.parameterKey]}
                                        onChange={(e) => handleParameterChange(p.parameterKey, parseFloat(e.target.value))}
                                        className="w-full accent-[#07b6d3] cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                                        <span>{p.minimumValue ?? 600}mm</span>
                                        <span>{p.maximumValue ?? 3600}mm</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live Bill of Materials (BOM) Output Card */}
                    {bomCalculation && (
                        <div className="bg-gradient-to-b from-white to-[#fcfcfc] border border-neutral-200 rounded-[12px] p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                                <h3 className="font-semibold text-xs text-[#0f1422] uppercase tracking-wider">
                                    Live BOM Cost Breakdown
                                </h3>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                                    Option A Labor (25%)
                                </span>
                            </div>

                            {/* Itemized summary lines */}
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between items-center text-neutral-600">
                                    <span>Aluminum Extrusions ({bomCalculation.totalLinearMetersFraming.toFixed(2)}m + 12% scrap):</span>
                                    <span className="font-mono font-medium text-neutral-900">PHP {bomCalculation.effectiveFramingCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-neutral-600">
                                    <span>Glass Infill ({bomCalculation.glazingAreaSqm.toFixed(2)}m² + 10% scrap):</span>
                                    <span className="font-mono font-medium text-neutral-900">PHP {bomCalculation.effectiveGlazingCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-neutral-600">
                                    <span>Hardware & Sealant Consumables:</span>
                                    <span className="font-mono font-medium text-neutral-900">PHP {(bomCalculation.hardwareSubtotal + bomCalculation.consumablesSubtotal).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-neutral-500 pt-1 border-t border-neutral-100">
                                    <span>Direct Materials Subtotal:</span>
                                    <span className="font-mono font-medium text-neutral-800">PHP {bomCalculation.directMaterialsSubtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-neutral-600">
                                    <span>Workshop Fabrication Labor:</span>
                                    <span className="font-mono font-medium text-neutral-900">PHP {bomCalculation.fabricationLaborCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-neutral-600">
                                    <span>Contractor Gross Margin (25%):</span>
                                    <span className="font-mono font-medium text-neutral-900">PHP {bomCalculation.contractorMargin.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Final Quotation Banner */}
                            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between bg-[#0f1422] text-white p-3 rounded-[10px]">
                                <div>
                                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Estimated Quotation (PHP)</span>
                                    <span className="text-lg font-bold text-[#07b6d3]">
                                        PHP {bomCalculation.finalQuotation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="text-right text-[10px] text-neutral-300">
                                    <span>Unit Rate:</span>
                                    <div className="font-mono text-white">
                                        PHP {(bomCalculation.finalQuotation / (bomCalculation.glazingAreaSqm || 1.44)).toFixed(0)}/m²
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Automatic Constraints Tests */}
                    <div className="bg-[#f8f9fa] border border-neutral-200 rounded-[12px] p-3.5 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-xs text-[#0f1422]">Constraint Verifications</h3>
                            <button 
                                onClick={runAutomaticTests}
                                className="flex items-center gap-1 text-[11px] bg-white border border-neutral-200 px-2 py-0.5 rounded shadow-xs hover:bg-neutral-50 font-medium transition-colors"
                            >
                                <Play className="size-2.5 text-[#07b6d3]" /> Run
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {testResults.length === 0 ? (
                                <p className="text-[11px] text-neutral-500">Click run to test boundary calculations.</p>
                            ) : (
                                testResults.map((tr, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs py-0.5 border-b border-neutral-100 last:border-0">
                                        <span className="text-neutral-600 text-[11px]">{tr.name}</span>
                                        {tr.status === "pass" ? (
                                            <span className="text-green-600 flex items-center gap-1 font-medium text-[11px]"><CheckCircle2 className="size-3" /> Pass</span>
                                        ) : (
                                            <span className="text-red-500 font-medium text-[11px]">Fail</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 mt-2 border-t border-neutral-200">
                <button
                    type="button"
                    onClick={onSave}
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors font-medium flex items-center gap-2 text-sm"
                >
                    Confirm & Proceed to Review
                </button>
            </div>
        </div>
    );
}

