"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { Loader2, Play, CheckCircle2, ChevronRight, ChevronDown, Check, EyeOff } from "lucide-react";
import { fetchDraftStructuralDefinition } from "@/lib/admin/products/validationMutations";
import { ProductStructuralDefinition, ResolvedStructure } from "@/lib/visualization/types";
import { ComponentModelCache, preloadComponentModels } from "@/lib/visualization/componentModelCache";
import { resolveProductStructure } from "@/lib/visualization/structuralResolver";
import { buildParametricProduct } from "@/lib/visualization/parametricProductBuilder";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Stage } from "@react-three/drei";

export type ValidationWorkspaceSectionProps = {
    productId: string;
    onSave: () => void;
};

// Internal component for React Three Fiber rendering
function ParametricModelView({ definition, resolved, cache, hiddenComponents }: { definition: ProductStructuralDefinition, resolved: ResolvedStructure, cache: ComponentModelCache, hiddenComponents: Set<string> }) {
    const group = useMemo(() => {
        const built = buildParametricProduct(definition, resolved, cache);
        
        // Apply visibility overrides from the debugger
        built.group.traverse((child) => {
            // In our builder, we typically attach userData.componentKey or we can find it via the resolved structure logic.
            // For now, if the component key is hidden, we hide it.
            // Wait, buildParametricProduct generates a group structure. We need to hide specific components.
            // If the builder adds userData.componentKey, we can filter.
            if (child.userData && child.userData.componentKey) {
                child.visible = !hiddenComponents.has(child.userData.componentKey);
            }
        });
        
        return built.group;
    }, [definition, resolved, cache, hiddenComponents]);

    return (
        <primitive object={group} />
    );
}

export function ValidationWorkspaceSection({ productId, onSave }: ValidationWorkspaceSectionProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    const [definition, setDefinition] = useState<ProductStructuralDefinition | null>(null);
    const [cache, setCache] = useState<ComponentModelCache | null>(null);
    
    const [parameters, setParameters] = useState<Record<string, number>>({});
    const [resolvedStructure, setResolvedStructure] = useState<ResolvedStructure | null>(null);
    
    const [hiddenComponents, setHiddenComponents] = useState<Set<string>>(new Set());
    const [testResults, setTestResults] = useState<{name: string, status: "pending"|"pass"|"fail"}[]>([]);

    useEffect(() => {
        async function load() {
            try {
                setIsLoading(true);
                const def = await fetchDraftStructuralDefinition(productId);
                setDefinition(def);
                
                const loadedCache = await preloadComponentModels(def.components);
                setCache(loadedCache);
                
                // Initialize parameters to default
                const initialParams: Record<string, number> = {};
                def.parameters.forEach(p => {
                    initialParams[p.parameterKey] = Number(p.defaultValue);
                });
                setParameters(initialParams);
                
                const resolved = resolveProductStructure({ definition: def, values: initialParams });
                setResolvedStructure(resolved);
                
            } catch (e: any) {
                setErrorMsg(e.message);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [productId]);

    // Handle manual parameter changes
    const handleParameterChange = (key: string, value: number) => {
        if (!definition) return;
        const newParams = { ...parameters, [key]: value };
        setParameters(newParams);
        try {
            const resolved = resolveProductStructure({ definition, values: newParams });
            setResolvedStructure(resolved);
        } catch (e) {
            console.error("Resolver failed:", e);
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

    const runAutomaticTests = () => {
        if (!definition) return;
        
        const tests = [
            { name: "Default Parameters", params: {} as Record<string, number> },
            { name: "Minimum Boundaries", params: {} as Record<string, number> },
            { name: "Maximum Boundaries", params: {} as Record<string, number> }
        ];

        definition.parameters.forEach(p => {
            tests[0].params[p.parameterKey] = Number(p.defaultValue);
            tests[1].params[p.parameterKey] = p.minimumValue !== null ? Number(p.minimumValue) : Number(p.defaultValue);
            tests[2].params[p.parameterKey] = p.maximumValue !== null ? Number(p.maximumValue) : Number(p.defaultValue);
        });

        const results = tests.map(test => {
            try {
                resolveProductStructure({ definition, values: test.params });
                return { name: test.name, status: "pass" as const };
            } catch (e) {
                return { name: test.name, status: "fail" as const };
            }
        });

        setTestResults(results);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                <Loader2 className="size-8 animate-spin mb-4 text-[#07b6d3]" />
                <p>Loading structural workspace...</p>
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

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    3D Validation Workspace
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Test your parameters and structural rules in a live 3D environment before finalizing the product.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 3D Canvas */}
                <div className="lg:col-span-2 bg-[#e9e9e9] rounded-[16px] overflow-hidden border border-neutral-200 min-h-[500px] relative">
                    <Canvas shadows camera={{ position: [2, 2, 4], fov: 40 }}>
                        <ambientLight intensity={0.5} />
                        <directionalLight castShadow position={[5, 5, 5]} intensity={1} shadow-mapSize={[1024, 1024]} />
                        <Suspense fallback={null}>
                            <Stage environment="city" adjustCamera={false}>
                                <ParametricModelView 
                                    definition={definition} 
                                    resolved={resolvedStructure} 
                                    cache={cache} 
                                    hiddenComponents={hiddenComponents} 
                                />
                            </Stage>
                        </Suspense>
                        <OrbitControls makeDefault />
                    </Canvas>
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium border border-white/40 shadow-sm">
                        Live Render Preview
                    </div>
                </div>

                {/* Controls Sidebar */}
                <div className="flex flex-col gap-6">
                    {/* Parameters Control */}
                    <div className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-sm">
                        <h3 className="font-semibold text-[#0f1422] mb-4 flex items-center justify-between">
                            Parameters
                        </h3>
                        <div className="flex flex-col gap-4">
                            {definition.parameters.map(p => (
                                <div key={p.parameterKey} className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-neutral-700">{p.parameterName}</label>
                                        <span className="text-xs text-neutral-500">{parameters[p.parameterKey]} {p.unit}</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min={p.minimumValue ?? 0}
                                        max={p.maximumValue ?? 5000}
                                        step={p.stepValue ?? 1}
                                        value={parameters[p.parameterKey]}
                                        onChange={(e) => handleParameterChange(p.parameterKey, parseFloat(e.target.value))}
                                        className="w-full accent-[#07b6d3]"
                                    />
                                    <div className="flex justify-between text-[10px] text-neutral-400">
                                        <span>{p.minimumValue ?? 0}</span>
                                        <span>{p.maximumValue ?? 5000}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Component Debugger */}
                    <div className="bg-white border border-neutral-200 rounded-[12px] p-5 shadow-sm">
                        <h3 className="font-semibold text-[#0f1422] mb-4">Resolved Components</h3>
                        <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2">
                            {definition.components.map(c => {
                                const isHidden = hiddenComponents.has(c.componentKey);
                                const q = resolvedStructure.componentQuantities[c.componentKey] || 0;
                                return (
                                    <div key={c.componentKey} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm ${isHidden ? "text-neutral-400 line-through" : "text-neutral-700"}`}>
                                                {c.componentName}
                                            </span>
                                            {q > 0 && !isHidden && (
                                                <span className="bg-neutral-100 text-neutral-500 text-[10px] px-1.5 py-0.5 rounded-full">
                                                    x{q}
                                                </span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => toggleComponentVisibility(c.componentKey)}
                                            className={`p-1 rounded-md transition-colors ${isHidden ? "text-neutral-400 bg-neutral-100" : "text-[#07b6d3] hover:bg-[#e6f8fa]"}`}
                                            title={isHidden ? "Show component" : "Hide component"}
                                        >
                                            {isHidden ? <EyeOff className="size-4" /> : <Check className="size-4" />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Automatic Tests */}
                    <div className="bg-[#f8f9fa] border border-neutral-200 rounded-[12px] p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-[#0f1422]">Automatic Tests</h3>
                            <button 
                                onClick={runAutomaticTests}
                                className="flex items-center gap-1.5 text-xs bg-white border border-neutral-200 px-2 py-1 rounded-md shadow-sm hover:bg-neutral-50 font-medium transition-colors"
                            >
                                <Play className="size-3 text-[#07b6d3]" /> Run
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {testResults.length === 0 ? (
                                <p className="text-xs text-neutral-500">Run automatic tests to verify constraints.</p>
                            ) : (
                                testResults.map((tr, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-neutral-100 last:border-0">
                                        <span className="text-neutral-600">{tr.name}</span>
                                        {tr.status === "pass" ? (
                                            <span className="text-green-600 flex items-center gap-1 font-medium"><CheckCircle2 className="size-3" /> Pass</span>
                                        ) : (
                                            <span className="text-red-500 font-medium">Fail</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-6 mt-4 border-t border-neutral-200">
                <button
                    type="button"
                    onClick={onSave}
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors font-medium flex items-center gap-2"
                >
                    Confirm & Proceed to Review
                </button>
            </div>
        </div>
    );
}
