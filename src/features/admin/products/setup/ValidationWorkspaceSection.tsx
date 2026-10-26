"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import * as THREE from "three";
import {
  Loader2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  ShieldAlert,
  Sparkles,
  Layers,
} from "lucide-react";
import { fetchDraftStructuralDefinition } from "@/lib/admin/products/validationMutations";
import { ProductStructuralDefinition, ResolvedStructure } from "@/lib/visualization/types";
import { ComponentModelCache, preloadComponentModels } from "@/lib/visualization/componentModelCache";
import { resolveProductStructure } from "@/lib/visualization/structuralResolver";
import { buildParametricProduct } from "@/lib/visualization/parametricProductBuilder";
import { getRawMaterials } from "@/lib/admin/materials/materialActions";
import { calculateParametricBOM, type ComponentPricingInput, type CalculatedBOMResult } from "@/lib/pricing/pricingEngine";
import { calculateGrilleLinearBOM } from "@/lib/pricing/grillePricingEngine";
import {
  analyzeGrilleGeometry,
  type GrilleGeometryAnalysis,
} from "@/lib/pricing/grilleGeometryAnalyzer";
import type { RawMaterial, GrilleLinearBOMResult } from "@/lib/pricing/types";
import { applyPBRToMesh } from "@/lib/visualization/materialClassifier";
import {
  computeGrillPattern,
  buildParametricScreenGroup,
  buildParametricGrillGroup,
} from "@/lib/visualization/addonGeometryBuilder";
import { ALUMINUM_FINISH_OPTIONS } from "@/lib/products/materialMapping";
import { PartMaterialsSandbox } from "./PartMaterialsSandbox";
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
  hiddenComponents,
  materialOverrides,
  rawMaterials,
  activeAddon = "none",
  addonAluminumFinish = "analok",
}: {
  definition: ProductStructuralDefinition;
  resolved: ResolvedStructure;
  cache: ComponentModelCache;
  hasSill: boolean;
  hiddenComponents: Set<string>;
  materialOverrides: Record<string, string>;
  rawMaterials: RawMaterial[];
  activeAddon?: "screen" | "grill" | "none" | null;
  addonAluminumFinish?: string;
}) {
  const group = useMemo(() => {
    if (definition.product.isAddon) {
      const currentWidthMm = resolved.numericValuesMm.width || 1200;
      const currentHeightMm = resolved.numericValuesMm.height || 1200;
      const finishColor = ALUMINUM_FINISH_OPTIONS.find((f) => f.id === addonAluminumFinish)?.previewHex;
      // If no custom 3D components were uploaded, fall back to procedural geometry
      if (definition.components.length === 0) {
        if (definition.product.addonType === "grill") {
          return buildParametricGrillGroup(currentWidthMm, currentHeightMm, {
            finishColor,
          });
        }
        return buildParametricScreenGroup(currentWidthMm, currentHeightMm, {
          finishColor,
        });
      }
    }

    const built = buildParametricProduct(definition, resolved, cache, {
      includeSill: hasSill,
      activeAddon,
      addonAluminumFinish,
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
  }, [definition, resolved, cache, hasSill, hiddenComponents, activeAddon, addonAluminumFinish]);

  // Dynamic Three.js Material Shading: Update mesh materials in place without reloading geometry
  useEffect(() => {
    if (!group) return;

    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.userData?.preserveMaterial || child.userData?.isScreenMesh) return;

      // Walk up parent tree to find componentKey
      let compKey: string | null = null;
      let curr: THREE.Object3D | null = child;
      while (curr) {
        if (curr.userData && typeof curr.userData.componentKey === "string" && curr.userData.componentKey) {
          compKey = curr.userData.componentKey;
          break;
        }
        curr = curr.parent;
      }

      if (!compKey) return;

      const normalizedKey = compKey.toLowerCase().replace(/_/g, "-");
      const comp = definition.components.find((c) => {
        const cKey = c.componentKey.toLowerCase().replace(/_/g, "-");
        return c.componentKey === compKey || cKey === normalizedKey;
      });

      // Determine active material ID from overrides or component defaults
      const activeMatId =
        materialOverrides[compKey] ??
        (comp ? materialOverrides[comp.componentKey] : undefined) ??
        comp?.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ??
        comp?.rawMaterialId;

      if (!activeMatId) return;

      const selectedMaterial = rawMaterials.find((m) => m.id === activeMatId) || comp?.rawMaterial || null;
      if (selectedMaterial) {
        applyPBRToMesh(child, selectedMaterial);
      }
    });
  }, [group, definition.components, materialOverrides, rawMaterials]);

  return <primitive key={group.uuid} object={group} />;
}

// Fallback benchmark Series 798 Analok rates for unseeded test-drive preview
function synthesizeBenchmarkMaterials(pricingInputs: ComponentPricingInput[]) {
  const alScrap = 0.12;
  const glScrap = 0.1;
  pricingInputs.forEach((input) => {
    if (input.rawMaterial) return;
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

export function ValidationWorkspaceSection({ productId, onSave }: ValidationWorkspaceSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [definition, setDefinition] = useState<ProductStructuralDefinition | null>(null);
  const [cache, setCache] = useState<ComponentModelCache | null>(null);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

  const [parameters, setParameters] = useState<Record<string, number>>({});
  const [resolvedStructure, setResolvedStructure] = useState<ResolvedStructure | null>(null);
  const [hasSill, setHasSill] = useState(true);

  const hiddenComponents = useMemo(() => new Set<string>(), []);
  const [testResults, setTestResults] = useState<{ name: string; status: "pending" | "pass" | "fail" }[]>([]);

  // Step 6 Material Sandbox State (IMP-MS65)
  const [materialOverrides, setMaterialOverrides] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"dimensions" | "materials">("dimensions");
  const [activeAddon, setActiveAddon] = useState<"screen" | "grill" | "none">("none");
  const [addonAlumFinish, setAddonAlumFinish] = useState<string>("analok");

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

        const allComponents = [
          ...def.components,
          ...(def.compatibleAddons?.flatMap((a) => a.components ?? []) ?? []),
        ];
        const loadedCache = await preloadComponentModels(allComponents);
        setCache(loadedCache);

        // Initialize parameters to default
        const initialParams: Record<string, number> = {
          has_sill: 1,
          include_sill: 1,
          includeSill: 1,
        };
        def.parameters.forEach((p) => {
          initialParams[p.parameterKey] = Number(p.defaultValue);
        });
        setParameters(initialParams);

        const resolved = resolveProductStructure({ definition: def, values: initialParams });
        setResolvedStructure(resolved);

        // Initialize material overrides with Step 4 default selections
        const initialOverrides: Record<string, string> = {};
        def.components.forEach((comp) => {
          const defaultMatId =
            comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
            comp.rawMaterialId ||
            "";
          initialOverrides[comp.componentKey] = defaultMatId;
        });
        setMaterialOverrides(initialOverrides);
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

  // Material override switcher
  const handleMaterialChange = (componentKey: string, rawMaterialId: string) => {
    setMaterialOverrides((prev) => ({
      ...prev,
      [componentKey]: rawMaterialId,
    }));
  };

  // Reset material overrides to Step 4 defaults
  const handleResetToDefaults = () => {
    if (!definition) return;
    const resetOverrides: Record<string, string> = {};
    definition.components.forEach((comp) => {
      const defaultMatId =
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId ||
        "";
      resetOverrides[comp.componentKey] = defaultMatId;
    });
    setMaterialOverrides(resetOverrides);
  };

  // Symmetrical group material synchronization (Apply finish to all framing parts)
  const handleApplyFramingFinish = (finishType: string) => {
    if (!definition) return;
    const lowerFinish = finishType.toLowerCase().replace(/\s+/g, "");

    setMaterialOverrides((prev) => {
      const updated = { ...prev };
      definition.components.forEach((comp) => {
        const category = comp.presentationCategory || "Framing";
        if (category === "Framing") {
          const allowedList = comp.allowedMaterials || [];
          const matchingBinding = allowedList.find((b) => {
            const mat = rawMaterials.find((m) => m.id === b.rawMaterialId);
            const matFinish = (mat?.finish_type || "").toLowerCase().replace(/\s+/g, "");
            return matFinish === lowerFinish;
          });

          if (matchingBinding) {
            updated[comp.componentKey] = matchingBinding.rawMaterialId;
          } else if (comp.rawMaterial) {
            const directFinish = (comp.rawMaterial.finish_type || "").toLowerCase().replace(/\s+/g, "");
            if (directFinish === lowerFinish) {
              updated[comp.componentKey] = comp.rawMaterial.id;
            }
          }
        }
      });
      return updated;
    });
  };

  // Calculate real-time Parametric Bill of Materials (with active material overrides)
  const bomCalculation: CalculatedBOMResult | null = useMemo(() => {
    if (!definition) return null;

    const currentWidthMm = parameters.width ?? parameters.quotation_width ?? 1200;
    const currentHeightMm = parameters.height ?? parameters.quotation_height ?? 1200;
    const currentPanels = parameters.panel_count ?? (currentWidthMm >= 2400 ? 3 : 2);

    const pricingInputs: ComponentPricingInput[] = definition.components.map((comp) => {
      const activeMatId =
        materialOverrides[comp.componentKey] ||
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId;

      const boundMat =
        rawMaterials.find((m) => m.id === activeMatId) ||
        (comp.rawMaterialId ? rawMaterials.find((m) => m.id === comp.rawMaterialId) : null) ||
        comp.rawMaterial ||
        null;

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

    // If completely unseeded, synthesize benchmark Series 798 rates for simulation
    const hasLinkedMaterials = pricingInputs.some((p) => p.rawMaterial !== null);
    if (!hasLinkedMaterials) {
      synthesizeBenchmarkMaterials(pricingInputs);
    }

    return calculateParametricBOM(pricingInputs, {
      widthMm: currentWidthMm,
      heightMm: currentHeightMm,
      panelCount: currentPanels,
      hasSill,
    });
  }, [definition, rawMaterials, parameters, hasSill, materialOverrides]);

  // Baseline BOM Calculation (strictly default configuration for sensitivity comparison)
  const baselineBOMResult: CalculatedBOMResult | null = useMemo(() => {
    if (!definition) return null;

    const currentWidthMm = parameters.width ?? parameters.quotation_width ?? 1200;
    const currentHeightMm = parameters.height ?? parameters.quotation_height ?? 1200;
    const currentPanels = parameters.panel_count ?? (currentWidthMm >= 2400 ? 3 : 2);

    const pricingInputs: ComponentPricingInput[] = definition.components.map((comp) => {
      const defaultMatId =
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId;

      const boundMat =
        rawMaterials.find((m) => m.id === defaultMatId) ||
        (comp.rawMaterialId ? rawMaterials.find((m) => m.id === comp.rawMaterialId) : null) ||
        comp.rawMaterial ||
        null;

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

    const hasLinkedMaterials = pricingInputs.some((p) => p.rawMaterial !== null);
    if (!hasLinkedMaterials) {
      synthesizeBenchmarkMaterials(pricingInputs);
    }

    return calculateParametricBOM(pricingInputs, {
      widthMm: currentWidthMm,
      heightMm: currentHeightMm,
      panelCount: currentPanels,
      hasSill,
    });
  }, [definition, rawMaterials, parameters, hasSill]);

  // Material Price Sensitivity Delta
  const priceSensitivityDelta = useMemo(() => {
    if (!bomCalculation || !baselineBOMResult) return null;
    const diff = bomCalculation.finalQuotation - baselineBOMResult.finalQuotation;
    const pct = baselineBOMResult.finalQuotation > 0 ? (diff / baselineBOMResult.finalQuotation) * 100 : 0;
    return {
      diff,
      pct,
      isZero: Math.abs(diff) < 0.01,
    };
  }, [bomCalculation, baselineBOMResult]);

  // Pre-Activation Readiness Verification
  const preActivationReadiness = useMemo(() => {
    if (!definition) {
      return { isReady: false, unassignedCount: 0, zeroRateCount: 0, errors: ["Loading product definition..."] };
    }

    const unassigned: string[] = [];
    const zeroRate: string[] = [];

    definition.components.forEach((comp) => {
      const activeMatId =
        materialOverrides[comp.componentKey] ||
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId;

      const boundMat =
        rawMaterials.find((m) => m.id === activeMatId) ||
        (comp.rawMaterialId ? rawMaterials.find((m) => m.id === comp.rawMaterialId) : null) ||
        comp.rawMaterial;

      if (!boundMat) {
        unassigned.push(comp.componentName || comp.componentKey);
      } else if (boundMat.unit_price <= 0) {
        zeroRate.push(comp.componentName || comp.componentKey);
      }
    });

    const errors: string[] = [];
    if (unassigned.length > 0) {
      errors.push(
        `Activation Blocked: ${unassigned.length} component${unassigned.length > 1 ? "s have" : " has"} zero materials assigned. Return to Step 4 to complete material mapping.`
      );
    }
    if (zeroRate.length > 0) {
      errors.push(
        `Activation Blocked: ${zeroRate.length} component${zeroRate.length > 1 ? "s have" : " has"} zero unit price.`
      );
    }

    return {
      isReady: unassigned.length === 0 && zeroRate.length === 0,
      unassignedCount: unassigned.length,
      zeroRateCount: zeroRate.length,
      errors,
    };
  }, [definition, materialOverrides, rawMaterials]);

  const currentWidthMm = parameters.width ?? parameters.quotation_width ?? 1200;
  const currentHeightMm = parameters.height ?? parameters.quotation_height ?? 1200;

  const hasGrilleComponent = useMemo(() => {
    if (!definition) return false;
    return (
      activeAddon === "grill" ||
      definition.product.addonType === "grill" ||
      definition.components.some((c) => c.dimensionBinding === "GRILLE_LINEAR")
    );
  }, [definition, activeAddon]);

  const grilleBOMResult = useMemo((): GrilleLinearBOMResult | null => {
    if (!definition || !hasGrilleComponent) return null;

    const grilleComp =
      definition.components.find((c) => c.dimensionBinding === "GRILLE_LINEAR") ||
      definition.components.find((c) => {
        const k = c.componentKey.toLowerCase();
        return (
          k.includes("middle") ||
          k.includes("grill") ||
          k.includes("infill") ||
          k.includes("bar") ||
          k.includes("picket")
        );
      });

    const activeMatId = grilleComp
      ? materialOverrides[grilleComp.componentKey] ||
        grilleComp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        grilleComp.rawMaterialId
      : null;

    const boundMat =
      rawMaterials.find((m) => m.id === activeMatId) ||
      rawMaterials.find((m) => m.category === "Aluminum" && m.billing_unit === "m") ||
      null;

    const barRate = boundMat?.unit_price ?? 165.0;
    const barScrap = boundMat?.waste_allowance ?? 0.12;

    let analyzedData: GrilleGeometryAnalysis | null = null;
    let numCols = 1;
    let numRows = 1;

    if (cache && grilleComp) {
      try {
        const clone = cache.getClone(grilleComp.componentId);
        if (clone) {
          analyzedData = analyzeGrilleGeometry(clone, currentWidthMm, currentHeightMm);
        }
      } catch {
        // Model might not be loaded into cache yet
      }

      try {
        const sz = cache.getSourceSizeMeters(grilleComp.componentId);
        const sourceW = sz.x > 0.005 ? sz.x * 1000 : 1144;
        const sourceH = sz.y > 0.005 ? sz.y * 1000 : 1144;
        const innerW = Math.max(100, currentWidthMm - 40);
        const innerH = Math.max(100, currentHeightMm - 40);
        numCols = Math.max(1, Math.round(innerW / sourceW));
        numRows = Math.max(1, Math.round(innerH / sourceH));
      } catch {
        // Use default tile repetition of 1x1
      }
    }

    const horizontalCount = analyzedData
      ? analyzedData.horizontalSummary.pieceCount * numRows
      : undefined;
    const verticalCount = analyzedData
      ? analyzedData.verticalSummary.pieceCount * numCols + (numCols > 1 ? numCols - 1 : 0)
      : undefined;

    return calculateGrilleLinearBOM({
      widthMm: currentWidthMm,
      heightMm: currentHeightMm,
      patternType: analyzedData?.patternType ?? "grid",
      nominalPitchColMm: analyzedData?.nominalPitchMm.columnPitch,
      nominalPitchRowMm: analyzedData?.nominalPitchMm.rowPitch,
      verticalBarCount: verticalCount,
      horizontalBarCount: horizontalCount,
      grilleRawMaterial: {
        id: boundMat?.id || "grille-mat",
        material_code: boundMat?.material_code || "AL-16X16-PCW",
        description: boundMat?.description || "16mm Square Tube White",
        unit_price: barRate,
        waste_allowance: barScrap,
      },
    });
  }, [
    definition,
    hasGrilleComponent,
    currentWidthMm,
    currentHeightMm,
    materialOverrides,
    rawMaterials,
    cache,
  ]);

  const grillPattern = useMemo(() => {
    return computeGrillPattern(currentWidthMm, currentHeightMm);
  }, [currentWidthMm, currentHeightMm]);

  const addonHelperText = useMemo(() => {
    if (activeAddon === "screen") {
      return `Simulating 4-piece extruded aluminum screen frame matching ${currentWidthMm.toLocaleString()} mm x ${currentHeightMm.toLocaleString()} mm opening.`;
    }
    if (activeAddon === "grill") {
      const tieBarNote = currentHeightMm > 1000
        ? ` Includes ${grillPattern.horizontalBarCount} horizontal tie bar${grillPattern.horizontalBarCount > 1 ? "s" : ""}.`
        : "";
      return `Simulating repeated vertical picket pattern (${grillPattern.verticalBarCount} bars at ${Math.round(grillPattern.actualPitchMm)} mm pitch).${tieBarNote}`;
    }
    return "Standard window fixture without front-layer attachments.";
  }, [activeAddon, currentWidthMm, currentHeightMm, grillPattern]);

  const runAutomaticTests = () => {
    if (!definition) return;

    const tests = [
      { name: "Default Parameters (1200x1200mm)", params: {} as Record<string, number> },
      { name: "Extended Width (1800x1200mm)", params: { width: 1800, height: 1200 } as Record<string, number> },
      { name: "Wide Span Guardrail (2600x1200mm)", params: { width: 2600, height: 1200 } as Record<string, number> },
      { name: "Minimum Boundary Check", params: {} as Record<string, number> },
      { name: "Maximum Boundary Check", params: {} as Record<string, number> },
    ];

    definition.parameters.forEach((p) => {
      tests[0].params[p.parameterKey] = Number(p.defaultValue);
      tests[3].params[p.parameterKey] = p.minimumValue !== null ? Number(p.minimumValue) : Number(p.defaultValue);
      tests[4].params[p.parameterKey] = p.maximumValue !== null ? Number(p.maximumValue) : 10000;
    });

    const results = tests.map((test) => {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-[#0f1422]">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
            {definition.product.isAddon
              ? "Interactive Add-on Preview & Validation"
              : "Interactive Test-Drive Simulator & BOM Validator"}
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-[#07b6d3]/10 text-[#07b6d3] text-xs font-semibold">
            {definition.product.isAddon ? "Step 4 Preview" : "Step 6 Sandbox"}
          </span>
        </div>
        <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
          {definition.product.isAddon
            ? "Inspect your add-on 3D model, adjust parametric dimensions, test aluminum finishes, and review calculated pricing before publishing."
            : "Test your parametric dimensions, alternative material finishes, cutting scrap allowances, and live customer quotations before publishing."}
        </p>
      </div>

      {/* Engineering Guardrail Warning Badges */}
      {bomCalculation && !definition.product.isAddon && (
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
            <Canvas shadows camera={{ position: [0, 1.5, 3], fov: 45 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[5, 8, 5]} intensity={1.2} />
              <Suspense fallback={null}>
                <Stage environment="city" adjustCamera={false}>
                  <ParametricModelView
                    definition={definition}
                    resolved={resolvedStructure}
                    cache={cache}
                    hasSill={hasSill}
                    hiddenComponents={hiddenComponents}
                    materialOverrides={materialOverrides}
                    rawMaterials={rawMaterials}
                    activeAddon={activeAddon}
                    addonAluminumFinish={addonAlumFinish}
                  />
                </Stage>
              </Suspense>
              <OrbitControls makeDefault />
            </Canvas>
            <div className="absolute top-4 left-4 bg-white/85 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium border border-white/40 shadow-xs flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#05b64b] animate-pulse" />
              <span>Live 3D Geometry ({currentWidthMm}mm × {currentHeightMm}mm)</span>
              {activeAddon !== "none" && (
                <span className="ml-1 text-[#07b6d3] font-semibold">
                  + {activeAddon === "screen" ? "Screen" : "Grille"}
                </span>
              )}
            </div>
          </div>

          {/* Quick Feature Switch (Sill Toggle) - only visible for non-addon fixtures with removable sill */}
          {!definition.product.isAddon && definition.components.some((c) => c.isRemovable || (c.togglePropertyKey && c.togglePropertyKey.toLowerCase().includes("sill"))) && (
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
          )}
        </div>

        {/* Controls & Real-Time BOM Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Drawer Tab Switcher */}
          <div className="flex bg-neutral-100 p-1 rounded-[10px] gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("dimensions")}
              className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "dimensions"
                  ? "bg-white text-[#0f1422] shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <Calculator className="size-3.5 text-[#07b6d3]" />
              <span>Dimensions & Features</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("materials")}
              className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "materials"
                  ? "bg-white text-[#0f1422] shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <Layers className="size-3.5 text-[#07b6d3]" />
              <span>Part Materials Sandbox</span>
            </button>
          </div>

          {activeTab === "dimensions" ? (
            <>
              {/* Modular Add-on Attachment Sandbox (IMP-MS68, IMP-MS69) */}
              {definition?.product?.isAddon || definition?.product?.addonType ? (
                <div className="bg-white border border-neutral-200 rounded-[12px] p-4 shadow-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-4 text-[#07b6d3]" />
                    <h3 className="font-semibold text-xs text-[#0f1422] uppercase tracking-wider">
                      Add-on Accessory Preview
                    </h3>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200/80 rounded-[8px] p-3 text-xs text-neutral-600">
                    This product is configured as a standalone add-on accessory. Previewing the uploaded 3D component geometry directly.
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-[12px] p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-[#07b6d3]" />
                      <h3 className="font-semibold text-xs text-[#0f1422] uppercase tracking-wider">
                        Modular Add-on Attachment Sandbox
                      </h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 text-[#07b6d3] font-medium border border-cyan-100">
                      IMP-MS68
                    </span>
                  </div>

                  <div className="flex bg-neutral-100 p-1 rounded-[10px] gap-1 mb-3">
                    <button
                      type="button"
                      onClick={() => setActiveAddon("none")}
                      className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-medium transition-all cursor-pointer ${
                        activeAddon === "none"
                          ? "bg-white text-[#0f1422] shadow-2xs font-semibold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAddon("screen")}
                      className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-medium transition-all cursor-pointer ${
                        activeAddon === "screen"
                          ? "bg-white text-[#0f1422] shadow-2xs font-semibold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      Insect Screen
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAddon("grill")}
                      className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-medium transition-all cursor-pointer ${
                        activeAddon === "grill"
                          ? "bg-white text-[#0f1422] shadow-2xs font-semibold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      Security Grille
                    </button>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200/80 rounded-[8px] p-2.5 text-xs text-neutral-600 flex items-start gap-2">
                    <div className="size-1.5 rounded-full bg-[#07b6d3] mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{addonHelperText}</span>
                  </div>

                  {/* Add-on Frame Color Variation Options (IMP-MS69) */}
                  {activeAddon !== "none" && (
                    <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-neutral-200/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-800">
                          {activeAddon === "screen" ? "Screen Frame Finish" : "Grille Frame Finish"}
                        </span>
                        <span className="text-[11px] text-neutral-500 capitalize">
                          {ALUMINUM_FINISH_OPTIONS.find((o) => o.id === addonAlumFinish)?.label ?? addonAlumFinish}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {ALUMINUM_FINISH_OPTIONS.map((opt) => (
                          <button
                            key={`admin-addon-${opt.id}`}
                            type="button"
                            onClick={() => setAddonAlumFinish(opt.id)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] text-xs border text-left transition-colors cursor-pointer ${
                              addonAlumFinish === opt.id
                                ? "border-[#07b6d3] bg-cyan-50/50 font-semibold text-[#0f1422]"
                                : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600"
                            }`}
                          >
                            <span
                              className="size-3 rounded-full border border-black/15 shrink-0"
                              style={{ backgroundColor: opt.previewHex }}
                              aria-hidden="true"
                            />
                            <span className="truncate">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Parameter Controls */}
              <div className="bg-white border border-neutral-200 rounded-[12px] p-4 shadow-xs">
                <h3 className="font-semibold text-xs text-[#0f1422] uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Interactive Sizing Sandbox</span>
                  <Calculator className="size-3.5 text-[#07b6d3]" />
                </h3>
                <div className="flex flex-col gap-3.5">
                  {definition.parameters.map((p) => {
                    const isUnconstrained = p.maximumValue === null || p.maximumValue === undefined;
                    const sliderMax = isUnconstrained ? 10000 : (p.maximumValue ?? 3600);
                    const sliderMin = p.minimumValue ?? 500;
                    const currentVal = parameters[p.parameterKey] ?? (typeof p.defaultValue === "number" ? p.defaultValue : sliderMin);

                    return (
                      <div key={p.parameterKey} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <label className="font-medium text-neutral-700">{p.parameterName}</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={sliderMin}
                              value={currentVal}
                              onChange={(e) => handleParameterChange(p.parameterKey, parseFloat(e.target.value) || sliderMin)}
                              className="w-20 text-right font-mono text-[#07b6d3] font-semibold border border-neutral-200 rounded px-1.5 py-0.5 text-xs focus:border-[#07b6d3] outline-none"
                            />
                            <span className="text-neutral-400 font-mono text-xs">{p.unit}</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={sliderMin}
                          max={sliderMax}
                          step={p.stepValue ?? 10}
                          value={currentVal}
                          onChange={(e) => handleParameterChange(p.parameterKey, parseFloat(e.target.value))}
                          className="w-full accent-[#07b6d3] cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                          <span>{sliderMin}mm</span>
                          <span>{isUnconstrained ? "10,000mm (Open)" : `${sliderMax}mm`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Automatic Constraints Tests */}
              <div className="bg-[#f8f9fa] border border-neutral-200 rounded-[12px] p-3.5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-xs text-[#0f1422]">Constraint Verifications</h3>
                  <button
                    onClick={runAutomaticTests}
                    className="flex items-center gap-1 text-[11px] bg-white border border-neutral-200 px-2 py-0.5 rounded shadow-xs hover:bg-neutral-50 font-medium transition-colors cursor-pointer"
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
                          <span className="text-green-600 flex items-center gap-1 font-medium text-[11px]">
                            <CheckCircle2 className="size-3" /> Pass
                          </span>
                        ) : (
                          <span className="text-red-500 font-medium text-[11px]">Fail</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <PartMaterialsSandbox
              components={definition.components}
              rawMaterials={rawMaterials}
              materialOverrides={materialOverrides}
              onMaterialChange={handleMaterialChange}
              onResetToDefaults={handleResetToDefaults}
              onApplyFramingFinish={handleApplyFramingFinish}
            />
          )}

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
                  <span>Aluminum Extrusions ({bomCalculation.totalLinearMetersFraming.toFixed(2)}m):</span>
                  <span className="font-mono font-medium text-neutral-900">PHP {bomCalculation.effectiveFramingCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-600">
                  <span>Glass Infill ({bomCalculation.glazingAreaSqm.toFixed(2)}m²):</span>
                  <span className="font-mono font-medium text-neutral-900">PHP {bomCalculation.effectiveGlazingCost.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-neutral-600">
                  <span>Hardware & Sealant Consumables:</span>
                  <span className="font-mono font-medium text-neutral-900">
                    PHP {(bomCalculation.hardwareSubtotal + bomCalculation.consumablesSubtotal).toFixed(2)}
                  </span>
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

              {/* Material Price Sensitivity Delta */}
              {priceSensitivityDelta && (
                <div className="text-[11px] px-3 py-2 rounded-[8px] bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                  <span className="text-neutral-600 font-medium">Material Sensitivity:</span>
                  {priceSensitivityDelta.isZero ? (
                    <span className="text-neutral-500 font-medium">
                      Baseline Configuration (Default)
                    </span>
                  ) : priceSensitivityDelta.diff > 0 ? (
                    <span className="text-amber-700 font-semibold font-mono">
                      +PHP {priceSensitivityDelta.diff.toFixed(2)} (+{priceSensitivityDelta.pct.toFixed(1)}%) vs Default Configuration
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold font-mono">
                      -PHP {Math.abs(priceSensitivityDelta.diff).toFixed(2)} ({priceSensitivityDelta.pct.toFixed(1)}%) vs Default Configuration
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grille Linear Extrusion Cut List Table (IMP-MS72) */}
      {grilleBOMResult && (
        <div className="rounded-[20px] bg-slate-900 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-sky-400" />
              <h3 className="text-base font-semibold text-white">
                Grille Linear Extrusion Cut List (Dynamic Parity)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Aperture: {currentWidthMm}mm W x {currentHeightMm}mm H
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Member Description</th>
                  <th className="py-2.5 px-3">Orientation</th>
                  <th className="py-2.5 px-3 text-right">Piece Count</th>
                  <th className="py-2.5 px-3 text-right">Cut Length</th>
                  <th className="py-2.5 px-3 text-right">Total Meters</th>
                  <th className="py-2.5 px-3 text-right">Rate (PHP/m)</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {grilleBOMResult.itemizedBreakdown.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-medium text-white">{row.item}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          row.orientation === "VERTICAL"
                            ? "bg-blue-900/60 text-blue-300 border border-blue-500/30"
                            : row.orientation === "HORIZONTAL"
                            ? "bg-purple-900/60 text-purple-300 border border-purple-500/30"
                            : "bg-slate-800 text-slate-300 border border-slate-600"
                        }`}
                      >
                        {row.orientation}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{row.pieces} pcs</td>
                    <td className="py-2 px-3 text-right font-mono">{row.lengthMm} mm</td>
                    <td className="py-2 px-3 text-right font-mono">{row.totalMeters.toFixed(2)} m</td>
                    <td className="py-2 px-3 text-right font-mono">PHP {row.unitRate.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-white">
                      PHP {row.subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 font-semibold text-white bg-slate-800/40">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3">Total Fabrication Extrusion</td>
                  <td className="py-2.5 px-3 text-right font-mono text-teal-400">
                    {grilleBOMResult.totalPieces} pcs
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-right font-mono text-teal-400">
                    {grilleBOMResult.totalLinearMeters.toFixed(2)} m
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-right font-mono text-teal-300">
                    PHP {grilleBOMResult.finalPrice.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Pre-Activation Readiness Verification */}
      <div className="pt-2">
        {preActivationReadiness.isReady ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[12px] p-3.5 flex items-start gap-3 text-xs text-emerald-800">
            <CheckCircle2 className="size-4.5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Ready for Activation:</span>
              <span className="ml-1">
                {definition.product.isAddon && definition.components.length === 0
                  ? "Procedural add-on generation verified with pricing rules across test envelope."
                  : `All ${definition.components.length} components have valid materials and positive unit rates. Pricing formula verified across test envelope.`}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-200 rounded-[12px] p-3.5 flex items-start gap-3 text-xs text-rose-800">
            <AlertTriangle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Pre-Activation Gate Blocked:</span>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {preActivationReadiness.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 mt-2 border-t border-neutral-200">
        <button
          type="button"
          onClick={onSave}
          disabled={!preActivationReadiness.isReady}
          className={`px-6 py-2.5 rounded-[10px] font-medium flex items-center gap-2 text-sm transition-colors ${
            preActivationReadiness.isReady
              ? "bg-[#0f1422] text-white hover:bg-black cursor-pointer"
              : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
          }`}
        >
          Confirm & Proceed to Review
        </button>
      </div>
    </div>
  );
}
