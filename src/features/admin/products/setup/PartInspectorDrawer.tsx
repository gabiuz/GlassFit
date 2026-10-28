/**
 * Part Inspector Drawer Component (MS-3, MS64, DSD-UI10)
 *
 * Upstream Specifications: docs/pricing.md, docs/implementation/ms64.md
 * Traceability Codes: PRD-F14, PRD-F19, SDD-C9, DSD-UI10, ERD-E6, QAD-TC79
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { fetchActiveCatalogAccessories, type CatalogAccessoryItem } from '@/lib/admin/products/accessoryActions';
import type {
  DimensionBinding,
  PresentationCategory,
  RawMaterial,
  ComponentMaterialBinding,
} from '@/lib/pricing/types';
import type {
  ComponentType,
  AccessoryCategory,
  AccessoryPositionOptions,
  HorizontalPosition,
  VerticalPosition,
} from '@/lib/admin/products/types';
import { calculateGrilleLinearBOM } from '@/lib/pricing/grillePricingEngine';
import type { GrilleGeometryAnalysis } from '@/lib/pricing/grilleGeometryAnalyzer';

export interface PartInspectorConfig {
  id: string;
  componentKey: string;
  componentName: string;
  componentType: ComponentType;
  rawMaterialId: string | null; // Keeps default material for backwards compatibility
  materialBindings?: ComponentMaterialBinding[];
  dimensionBinding: DimensionBinding;
  spanRatio: number;
  isRemovable: boolean;
  togglePropertyKey: string | null;
  presentationCategory: PresentationCategory;
  baseQuantity: number;
  assemblyGroup: string;
  isAccessorySlot?: boolean;
  accessoryCategory?: AccessoryCategory | null;
  allowedAccessoryIds?: string[] | null;
  positionOptions?: AccessoryPositionOptions | null;
  unitPrice?: number;
  pricingMethod?: string;
}

interface PartInspectorDrawerProps {
  selectedParts: PartInspectorConfig[];
  allParts?: PartInspectorConfig[];
  rawMaterials: RawMaterial[];
  analyzedGrilleData?: GrilleGeometryAnalysis | null;
  modelStrategy?: string | null;
  isAccessory?: boolean;
  productBasePrice?: number;
  onUpdateParts: (updates: Partial<PartInspectorConfig>) => void;
  onSyncAssemblyGroup?: (assemblyGroup: string, bindings: ComponentMaterialBinding[], defaultMaterialId: string | null) => void;
  onDeselect: () => void;
}

export function PartInspectorDrawer({
  selectedParts,
  allParts,
  rawMaterials,
  analyzedGrilleData,
  modelStrategy,
  isAccessory = false,
  productBasePrice,
  onUpdateParts,
  onSyncAssemblyGroup,
  onDeselect,
}: PartInspectorDrawerProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [accessorySearch, setAccessorySearch] = useState('');
  const [catalogAccessories, setCatalogAccessories] = useState<CatalogAccessoryItem[]>([]);
  const [accessoryLoading, setAccessoryLoading] = useState(false);
  const [accessoryError, setAccessoryError] = useState<string | null>(null);
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);

  const primary = selectedParts[0] as PartInspectorConfig | undefined;
  const isMulti = selectedParts.length > 1;
  const groupParts = (allParts || selectedParts).filter((part) => part.assemblyGroup === primary?.assemblyGroup);
  const slotCategory = primary?.accessoryCategory || 'handle';
  const selectedAccessoryIds = primary?.allowedAccessoryIds || [];

  useEffect(() => {
    if (!primary?.isAccessorySlot) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return [];
      setAccessoryLoading(true);
      setAccessoryError(null);
      return fetchActiveCatalogAccessories(slotCategory);
    }).then((items) => {
      if (!cancelled) setCatalogAccessories(items);
    }).catch((error: unknown) => {
      if (!cancelled) {
        setCatalogAccessories([]);
        setAccessoryError(error instanceof Error ? error.message : 'Could not load registered accessories.');
      }
    }).finally(() => {
      if (!cancelled) setAccessoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [primary?.isAccessorySlot, slotCategory]);

  const filteredAccessories = catalogAccessories.filter((item) =>
    item.category === slotCategory && item.name.toLowerCase().includes(accessorySearch.trim().toLowerCase()),
  );

  const updatePositionOptions = (opts: Partial<AccessoryPositionOptions>) => {
    const current = primary?.positionOptions || {
      allowHorizontalToggle: true,
      defaultHorizontal: 'right',
      horizontalOffsetMm: 45,
      allowVerticalToggle: false,
      defaultVertical: 'up',
      verticalOffsetMm: 1000,
    };
    onUpdateParts({
      positionOptions: {
        ...current,
        ...opts,
      },
    });
  };

  // Derive current bindings from primary part
  const currentBindings: ComponentMaterialBinding[] = useMemo(() => {
    if (!primary) return [];
    if (primary.materialBindings && primary.materialBindings.length > 0) {
      return primary.materialBindings;
    }
    if (primary.rawMaterialId) {
      return [{
        rawMaterialId: primary.rawMaterialId,
        isDefault: true,
        displayOrder: 0,
      }];
    }
    return [];
  }, [primary]);

  const checkedMaterialIds = useMemo(() => {
    return new Set(currentBindings.map((b) => b.rawMaterialId));
  }, [currentBindings]);

  const defaultMaterialId = useMemo(() => {
    if (!primary) return null;
    const foundDefault = currentBindings.find((b) => b.isDefault);
    return foundDefault ? foundDefault.rawMaterialId : primary.rawMaterialId || null;
  }, [currentBindings, primary]);

  const currentDefaultMaterial = useMemo(() => {
    return rawMaterials.find((m) => m.id === defaultMaterialId) || null;
  }, [rawMaterials, defaultMaterialId]);

  // Dynamic geometry analysis fallback for GRILLE_LINEAR
  const defaultGrilleAnalysis = useMemo((): GrilleGeometryAnalysis | null => {
    if (primary?.dimensionBinding !== 'GRILLE_LINEAR') return null;
    if (analyzedGrilleData) return analyzedGrilleData;

    const bom = calculateGrilleLinearBOM({
      widthMm: 1200,
      heightMm: 1200,
      patternType: 'grid',
      grilleRawMaterial: {
        id: currentDefaultMaterial?.id || 'default',
        material_code: currentDefaultMaterial?.material_code || 'AL-16X16-PCW',
        description: currentDefaultMaterial?.description || '16mm Square Tube White',
        unit_price: currentDefaultMaterial?.unit_price || 165,
        waste_allowance: currentDefaultMaterial?.waste_allowance || 0.12,
      },
    });

    return {
      patternType: 'grid',
      detectedFrameThicknessMm: { top: 20, bottom: 20, left: 20, right: 20 },
      innerApertureMm: { width: 1160, height: 1160 },
      nominalPitchMm: { columnPitch: 140, rowPitch: 191 },
      subBars: [],
      horizontalSummary: {
        distinctLengthsMm: [bom.horizontalBars.cutLengthMm],
        pieceCount: bom.horizontalBars.barCount,
        totalLinearM: bom.horizontalBars.totalLinearM,
      },
      verticalSummary: {
        distinctLengthsMm: [bom.verticalBars.cutLengthMm],
        pieceCount: bom.verticalBars.barCount,
        totalLinearM: bom.verticalBars.totalLinearM,
      },
    };
  }, [primary?.dimensionBinding, analyzedGrilleData, currentDefaultMaterial]);

  const displayGrilleData = analyzedGrilleData ?? defaultGrilleAnalysis;

  // Filtering materials list
  const filteredMaterials = useMemo(() => {
    return rawMaterials.filter((m) => {
      if (primary?.dimensionBinding === 'GRILLE_LINEAR') {
        // Grilles require linear profile extrusions billed per meter
        if (m.billing_unit !== 'm') return false;
      }
      if (categoryFilter !== 'All' && m.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const codeMatch = m.material_code.toLowerCase().includes(query);
        const descMatch = m.description.toLowerCase().includes(query);
        const finishMatch = m.finish_type.toLowerCase().includes(query);
        return codeMatch || descMatch || finishMatch;
      }
      return true;
    });
  }, [rawMaterials, categoryFilter, searchQuery, primary?.dimensionBinding]);

  const suggestedCategory = primary?.presentationCategory === 'Glazing' ? 'Glass'
    : primary?.presentationCategory === 'Hardware' ? 'Hardware'
    : primary?.presentationCategory === 'Consumable' ? 'Consumable' : 'Aluminum';

  if (!primary || selectedParts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-neutral-400">
        <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3 text-neutral-400">
          <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </div>
        <p className="text-sm font-medium text-neutral-600">No Part Selected</p>
        <p className="text-xs text-neutral-400 mt-1 max-w-[200px]">
          Click on a part in the 3D viewport or select from the list to inspect and configure properties.
        </p>
      </div>
    );
  }

  // Material Toggle Handler (Checkbox)
  const handleToggleMaterial = (rawMaterialId: string) => {
    const targetMat = rawMaterials.find((m) => m.id === rawMaterialId);
    if (primary.dimensionBinding === 'GRILLE_LINEAR') {
      if (targetMat && targetMat.billing_unit !== 'm') {
        setValidationWarning('Grilles require linear profile extrusions billed per meter.');
        return;
      }
      setValidationWarning(null);
      // Single-click material assignment applies to entire grille
      onUpdateParts({
        materialBindings: [{ rawMaterialId, isDefault: true, displayOrder: 0 }],
        rawMaterialId,
      });
      return;
    }

    if (checkedMaterialIds.has(rawMaterialId)) {
      // Unchecking this material
      const remaining = currentBindings.filter((b) => b.rawMaterialId !== rawMaterialId);
      if (remaining.length === 0) {
        onUpdateParts({
          materialBindings: [],
          rawMaterialId: null,
        });
      } else {
        const wasDefault = defaultMaterialId === rawMaterialId;
        const newBindings: ComponentMaterialBinding[] = remaining.map((b, idx) => ({
          ...b,
          isDefault: wasDefault ? idx === 0 : b.isDefault,
          displayOrder: idx,
        }));
        const newDefaultId = newBindings.find((b) => b.isDefault)?.rawMaterialId || null;
        onUpdateParts({
          materialBindings: newBindings,
          rawMaterialId: newDefaultId,
        });
      }
    } else {
      // Checking a new material
      const isFirst = currentBindings.length === 0;
      const newBindings: ComponentMaterialBinding[] = [
        ...currentBindings,
        {
          rawMaterialId,
          isDefault: isFirst,
          displayOrder: currentBindings.length,
        },
      ];
      const newDefaultId = isFirst ? rawMaterialId : defaultMaterialId;
      const isHardwareMaterial = targetMat?.category === "Hardware";

      onUpdateParts({
        materialBindings: newBindings,
        rawMaterialId: newDefaultId,
        ...(isHardwareMaterial && (targetMat.billing_unit === "pc" || targetMat.billing_unit === "set") ? {
          presentationCategory: "Hardware",
          dimensionBinding: "FIXED",
        } : {}),
      });
    }
  };

  // Set as Default Handler (Radio / Click)
  const handleSetDefault = (rawMaterialId: string) => {
    const targetMat = rawMaterials.find((m) => m.id === rawMaterialId);
    if (primary.dimensionBinding === 'GRILLE_LINEAR') {
      if (targetMat && targetMat.billing_unit !== 'm') {
        setValidationWarning('Grilles require linear profile extrusions billed per meter.');
        return;
      }
      setValidationWarning(null);
      onUpdateParts({
        materialBindings: [{ rawMaterialId, isDefault: true, displayOrder: 0 }],
        rawMaterialId,
      });
      return;
    }

    if (checkedMaterialIds.has(rawMaterialId)) {
      const newBindings = currentBindings.map((b) => ({
        ...b,
        isDefault: b.rawMaterialId === rawMaterialId,
      }));
      onUpdateParts({
        materialBindings: newBindings,
        rawMaterialId,
      });
    } else {
      // Ergonomic one-click: add to bindings and designate as default
      const newBindings: ComponentMaterialBinding[] = [
        ...currentBindings.map((b) => ({ ...b, isDefault: false })),
        {
          rawMaterialId,
          isDefault: true,
          displayOrder: currentBindings.length,
        },
      ];
      onUpdateParts({
        materialBindings: newBindings,
        rawMaterialId,
      });
    }
  };

  // Multi-part batch sync for assembly group
  const handleSyncGroup = () => {
    if (onSyncAssemblyGroup && primary.assemblyGroup) {
      onSyncAssemblyGroup(primary.assemblyGroup, currentBindings, defaultMaterialId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white divide-y divide-neutral-100">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-[#fcfcfc]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-[#0f1422]">
              {isMulti ? `${selectedParts.length} Parts Selected` : primary.componentName}
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#07b6d3]/10 text-[#07b6d3] font-medium">
              {primary.presentationCategory}
            </span>
          </div>
          {!isMulti ? (
            <p className="text-xs text-neutral-400 font-mono mt-0.5">{primary.componentKey}</p>
          ) : (
            <p className="text-xs text-neutral-400 mt-0.5">
              {selectedParts.map((part) => part.componentName).join(', ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDeselect}
          className="text-neutral-400 hover:text-neutral-600 text-xs font-medium px-2 py-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Main Configuration Content */}
      <div className="p-4 overflow-y-auto space-y-4 flex-1 min-h-0">
        {isMulti && <p className="text-sm text-neutral-700" role="status">Changes here apply to {selectedParts.length} selected parts: {selectedParts.map((part) => part.componentName).join(', ')}.</p>}
        {/* Multi-Part Symmetrical Synchronization Notification */}
        {primary.assemblyGroup && (
          <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-[8px] border border-neutral-200 text-xs">
            <span className="text-neutral-600 truncate mr-2">
              Group: <strong className="font-medium text-[#0f1422]">{primary.assemblyGroup}</strong>
            </span>
            {onSyncAssemblyGroup && (
              <button
                type="button"
                onClick={handleSyncGroup}
                className="text-xs font-medium text-[#067f98] hover:underline cursor-pointer"
              >
                Apply materials to {groupParts.length} {primary.assemblyGroup} parts
              </button>
            )}
          </div>
        )}
        {primary.assemblyGroup && onSyncAssemblyGroup && <p className="text-xs text-neutral-600">Group scope: {groupParts.map((part) => part.componentName).join(', ')}.</p>}

        {/* Validation Warning Alert */}
        {validationWarning && (
          <div className="flex items-center justify-between p-3 rounded-[10px] bg-amber-50 border border-amber-300 text-amber-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>{validationWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationWarning(null)}
              className="text-amber-700 hover:text-amber-900 font-semibold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hardware Accessory Specification Badge (Fixed Strategy, Base Price Inherited, Static 1:1 Metric) */}
        {isAccessory ? (
          <div className="bg-neutral-50 p-4 rounded-[12px] border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-[#0f1422] uppercase tracking-wider block">
                  Hardware Accessory
                </label>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Static 1:1 metric scale. No dimension driver or raw material mapping needed.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-[#07b6d3] text-[10px] font-semibold border border-cyan-100">
                Fixed Component
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-[8px] bg-white border border-neutral-200 text-xs">
              <div>
                <span className="text-neutral-600 font-medium block">Price (Step 1 Basic Info)</span>
                <span className="text-[10px] text-neutral-400">Directly inherited as fixed component price</span>
              </div>
              <div className="text-sm font-bold text-neutral-900 bg-neutral-100/70 px-2.5 py-1 rounded-[6px]">
                PHP {(productBasePrice ?? 0).toFixed(2)}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-[8px] bg-white border border-neutral-200 text-xs">
              <div>
                <span className="text-neutral-600 font-medium block">Dimension Driver</span>
                <span className="text-[10px] text-neutral-400">Non-parametric invariant sizing</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-[10px] font-semibold">
                FIXED (Static)
              </span>
            </div>
          </div>
        ) : (
          <>
        {/* Component Pricing & Connected Material Link */}
        <div className="bg-neutral-50 p-4 rounded-[12px] border border-neutral-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#0f1422] uppercase tracking-wider">
              Component Pricing
            </label>
            <span className="text-[11px] text-neutral-500">
              {primary.pricingMethod === "Fixed"
                ? (isAccessory ? "Inherited from Step 1 Base Price" : "Fixed price override")
                : (currentDefaultMaterial ? `Linked to ${currentDefaultMaterial.category}` : "Pricing source")}
            </span>
          </div>

          {currentDefaultMaterial && (
            <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-white border border-neutral-200 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                  currentDefaultMaterial.category === "Hardware"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : currentDefaultMaterial.category === "Aluminum"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : currentDefaultMaterial.category === "Glass"
                    ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {currentDefaultMaterial.category}
                </span>
                <span className="font-medium text-neutral-800 truncate" title={currentDefaultMaterial.description}>
                  {currentDefaultMaterial.description}
                </span>
              </div>
              <div className="font-semibold text-neutral-900 shrink-0 ml-2">
                PHP {currentDefaultMaterial.unit_price.toFixed(2)} / {currentDefaultMaterial.billing_unit}
              </div>
            </div>
          )}

          {/* Fixed Price Field or Toggle */}
          {(modelStrategy === "Fixed" || primary.pricingMethod === "Fixed" || isAccessory) ? (
            <div className="space-y-2 pt-1 border-t border-neutral-200/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-700">
                  Fixed Price {currentDefaultMaterial && !isAccessory ? "Override" : ""} (PHP)
                </span>
                {currentDefaultMaterial && !isAccessory && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateParts({
                        pricingMethod: "Material",
                        unitPrice: undefined,
                      });
                    }}
                    className="text-[11px] text-[#07b6d3] hover:text-[#069bb4] font-medium hover:underline cursor-pointer"
                  >
                    Use connected material rate (PHP {currentDefaultMaterial.unit_price.toFixed(2)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-400">
                  PHP
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    primary.unitPrice !== undefined && primary.unitPrice !== null
                      ? primary.unitPrice
                      : (isAccessory && productBasePrice !== undefined ? productBasePrice : "")
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = raw === "" ? undefined : parseFloat(raw);
                    onUpdateParts({
                      unitPrice: val !== undefined && !isNaN(val) ? val : undefined,
                      pricingMethod: val !== undefined && !isNaN(val) ? "Fixed" : (currentDefaultMaterial ? "Material" : "Fixed"),
                      dimensionBinding: "FIXED",
                    });
                  }}
                  placeholder={
                    isAccessory && productBasePrice !== undefined
                      ? productBasePrice.toFixed(2)
                      : (currentDefaultMaterial ? currentDefaultMaterial.unit_price.toFixed(2) : "0.00")
                  }
                  className="w-full pl-12 pr-4 py-2 bg-white border border-neutral-300 rounded-[8px] text-sm font-medium text-[#0f1422] focus:outline-none focus:border-[#07b6d3]"
                />
              </div>
              <p className="text-[11px] text-neutral-500">
                {isAccessory
                  ? "Direct unit cost for this accessory, defaulted to the Step 1 base price so no re-entry is required."
                  : currentDefaultMaterial
                  ? "Overrides the connected catalog material rate with a fixed per-unit price."
                  : "Direct unit cost for this component. Used in BOM summation and quotation generation."}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60">
              <span className="text-[11px] text-neutral-500">
                {currentDefaultMaterial
                  ? `Component price is connected to ${currentDefaultMaterial.description} (PHP ${currentDefaultMaterial.unit_price.toFixed(2)} / ${currentDefaultMaterial.billing_unit}).`
                  : "Select an allowed catalog material below to connect this part to a pricing rate."}
              </span>
              <button
                type="button"
                onClick={() => {
                  onUpdateParts({
                    pricingMethod: "Fixed",
                    unitPrice: currentDefaultMaterial ? currentDefaultMaterial.unit_price : 0,
                    dimensionBinding: "FIXED",
                  });
                }}
                className="text-[11px] text-[#07b6d3] hover:text-[#069bb4] font-medium hover:underline cursor-pointer whitespace-nowrap ml-2 shrink-0"
              >
                Set fixed override
              </button>
            </div>
          )}
        </div>

        {/* IMP-MS79 / DSD-UI10: one material chooser within the inspector scroll region. */}
        <section className="rounded-[10px] border border-neutral-200 bg-neutral-50 p-3 space-y-3" aria-label="Materials">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-[#0f1422]">Materials</h4>
              <p className="text-xs text-neutral-600">
                {modelStrategy === "Fixed" || isAccessory
                  ? "Optional finish choices for the 3D preview; fixed pricing is unchanged."
                  : "Choose allowed materials and one default."}
              </p>
            </div>
            <button type="button" aria-expanded={materialsOpen} aria-controls="material-chooser" onClick={() => setMaterialsOpen(!materialsOpen)} className="shrink-0 rounded-[8px] border border-[#07b6d3] px-3 py-2 text-sm font-medium text-[#067f98] hover:bg-[#07b6d3]/10 focus-visible:outline-2 focus-visible:outline-[#07b6d3]">
              {materialsOpen ? 'Done' : 'Change Materials'}
            </button>
          </div>
          <div className="rounded-[8px] border border-neutral-200 bg-white p-3 text-sm" aria-live="polite">
            {currentDefaultMaterial ? <>
              <p className="font-semibold text-[#0f1422]">{currentDefaultMaterial.description} <span className="font-normal text-neutral-600">({currentDefaultMaterial.material_code})</span></p>
              <p className="mt-1 text-neutral-700">Default · {currentBindings.length} allowed · PHP {(currentDefaultMaterial.unit_price * (1 + currentDefaultMaterial.waste_allowance)).toFixed(2)} / {currentDefaultMaterial.billing_unit} effective</p>
            </> : <p className="text-amber-800">{modelStrategy === 'Fixed' ? 'No optional material assigned' : 'No default material assigned'}</p>}
          </div>
          {materialsOpen && <div id="material-chooser" className="space-y-3">
            <div className="flex flex-wrap gap-1" aria-label="Material categories">
              {['All', 'Aluminum', 'Glass', 'Hardware', 'Consumable'].map((cat) => <button key={cat} type="button" aria-pressed={categoryFilter === cat} onClick={() => setCategoryFilter(cat)} className={`rounded-full px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#07b6d3] ${categoryFilter === cat ? 'bg-[#0f1422] text-white' : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'}`}>{cat}</button>)}
            </div>
            <label htmlFor="material-search" className="block text-sm font-medium text-neutral-700">Search materials</label>
            <input id="material-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Name, code, or finish" className="w-full rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm text-[#0f1422] focus-visible:outline-2 focus-visible:outline-[#07b6d3]" />
            <p className="text-sm text-neutral-600" role="status">{filteredMaterials.length} candidates · Suggested category: {suggestedCategory}</p>
            <div className="divide-y divide-neutral-200 rounded-[8px] border border-neutral-200 bg-white">
              {filteredMaterials.length === 0 && <p className="p-3 text-sm text-neutral-600">No materials match this search.</p>}
              {filteredMaterials.map((mat) => {
                const allowed = checkedMaterialIds.has(mat.id);
                const isDefault = defaultMaterialId === mat.id;
                const unusual = mat.category !== suggestedCategory;
                return <div key={mat.id} className={`p-3 space-y-2 ${allowed ? 'bg-cyan-50/50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0f1422]">{mat.description}</p>
                      <p className="text-sm text-neutral-600">{mat.material_code} · {mat.category} · {mat.finish_type}</p>
                      <p className="text-sm text-neutral-700">PHP {mat.unit_price.toFixed(2)} / {mat.billing_unit} · {(mat.waste_allowance * 100).toFixed(0)}% scrap</p>
                      {unusual && <p className="text-sm text-amber-800">Review category match for this part.</p>}
                    </div>
                    {isDefault && <span className="shrink-0 rounded-full bg-[#05b64b] px-2 py-1 text-xs font-semibold text-white">Default</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" aria-pressed={allowed} onClick={() => handleToggleMaterial(mat.id)} className="rounded-[6px] border border-neutral-300 px-3 py-1.5 text-sm font-medium text-[#0f1422] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-[#07b6d3]">{allowed ? 'Remove allowed' : 'Allow material'}</button>
                    {allowed ? <button type="button" aria-pressed={isDefault} disabled={isDefault} onClick={() => handleSetDefault(mat.id)} className="rounded-[6px] border border-[#07b6d3] px-3 py-1.5 text-sm font-medium text-[#067f98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#07b6d3]">{isDefault ? 'Current default' : 'Set as default'}</button> : <button type="button" onClick={() => handleSetDefault(mat.id)} className="rounded-[6px] border border-[#07b6d3] px-3 py-1.5 text-sm font-medium text-[#067f98] focus-visible:outline-2 focus-visible:outline-[#07b6d3]">Allow and set default</button>}
                  </div>
                </div>;
              })}
            </div>
            {modelStrategy === 'Fixed' && currentBindings.length > 0 && <button type="button" onClick={() => onUpdateParts({ materialBindings: [], rawMaterialId: null })} className="text-sm font-medium text-rose-700 underline">Clear all allowed materials</button>}
          </div>}
        </section>

        {/* Section 2: Dimension Driver */}
        <div className="space-y-1.5 pt-2 border-t border-neutral-100">
          <label className="text-xs font-medium text-neutral-700 block">
            Dimension Driver
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['WIDTH', 'HEIGHT', 'AREA', 'FIXED', 'GRILLE_LINEAR'] as DimensionBinding[]).map((driver) => (
              <button
                key={driver}
                type="button"
                aria-pressed={primary.dimensionBinding === driver}
                onClick={() => onUpdateParts({ dimensionBinding: driver })}
                className={`${
                  driver === 'GRILLE_LINEAR' ? 'col-span-2 ' : ''
                }${
                  primary.dimensionBinding === driver
                    ? 'px-3 py-2 rounded-[8px] text-xs font-medium border text-center transition-all border-[#07b6d3] bg-[#07b6d3]/10 text-[#07b6d3]'
                    : 'px-3 py-2 rounded-[8px] text-xs font-medium border text-center transition-all border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {driver === 'WIDTH' && 'Width (1D)'}
                {driver === 'HEIGHT' && 'Height (1D)'}
                {driver === 'AREA' && 'Area (2D)'}
                {driver === 'FIXED' && 'Static / Fixed'}
                {driver === 'GRILLE_LINEAR' && 'Grille Linear (Per Meter)'}
              </button>
            ))}
          </div>

          {/* Grille Linear Analysis Summary Card (IMP-MS72) */}
          {primary.dimensionBinding === 'GRILLE_LINEAR' && (
            <div className="mt-4 p-4 rounded-[16px] bg-slate-900/60 border border-teal-500/30 text-white">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                  <h4 className="text-sm font-semibold text-teal-300">
                    Grille Linear Pricing Engine Active
                  </h4>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-500/40">
                  Per Piece / Per Meter
                </span>
              </div>

              <p className="text-xs text-slate-300 mb-3">
                This center grille is measured accurately by linear cut length and piece count.
                All constituent vertical and horizontal bars dynamically scale and inherit the profile selected below.
              </p>

              {displayGrilleData ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-[12px] bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400 block mb-1">Vertical Bars:</span>
                    <span className="font-bold text-white text-sm">
                      {displayGrilleData.verticalSummary.pieceCount} pcs
                    </span>
                    {displayGrilleData.verticalSummary.distinctLengthsMm?.length > 0 && (
                      <span className="text-slate-300 block text-[11px] mt-0.5 font-mono">
                        Cut Length: {displayGrilleData.verticalSummary.distinctLengthsMm.join(', ')} mm
                      </span>
                    )}
                    <span className="text-slate-400 block text-[11px] mt-0.5">
                      Total: {displayGrilleData.verticalSummary.totalLinearM} linear meters
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[12px] bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400 block mb-1">Horizontal Bars:</span>
                    <span className="font-bold text-white text-sm">
                      {displayGrilleData.horizontalSummary.pieceCount} pcs
                    </span>
                    {displayGrilleData.horizontalSummary.distinctLengthsMm?.length > 0 && (
                      <span className="text-slate-300 block text-[11px] mt-0.5 font-mono">
                        Cut Length: {displayGrilleData.horizontalSummary.distinctLengthsMm.join(', ')} mm
                      </span>
                    )}
                    <span className="text-slate-400 block text-[11px] mt-0.5">
                      Total: {displayGrilleData.horizontalSummary.totalLinearM} linear meters
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Analyzing 3D geometry and sub-bar orientations...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Span Ratio / Multiplier */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-neutral-700">
              Span Ratio / Multiplier
            </label>
            <span className="text-xs font-mono text-neutral-500">
              {primary.spanRatio.toFixed(4)}x
            </span>
          </div>
          <div className="flex gap-1.5">
            {[
              { label: '1.0x (Full)', val: 1.0 },
              { label: '0.5x (Half)', val: 0.5 },
              { label: '0.33x (Third)', val: 0.3333 },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => onUpdateParts({ spanRatio: preset.val })}
                className={
                  Math.abs(primary.spanRatio - preset.val) < 0.01
                    ? 'flex-1 py-1.5 rounded-[6px] text-xs font-medium border text-center transition-all border-[#07b6d3] bg-[#07b6d3]/10 text-[#07b6d3]'
                    : 'flex-1 py-1.5 rounded-[6px] text-xs font-medium border text-center transition-all border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            max="10"
            value={primary.spanRatio}
            onChange={(e) => onUpdateParts({ spanRatio: parseFloat(e.target.value) || 0 })}
            className="w-full border border-neutral-200 rounded-[8px] px-3 py-1.5 text-xs focus:border-[#07b6d3] outline-none mt-1"
            placeholder="Custom Ratio"
          />
        </div>
        </>
        )}

        {/* Section 4: Removable Toggle (Omitted for Hardware Accessories since all accessories are client-removable) */}
        {!isAccessory && (
          <div className="bg-neutral-50 p-3 rounded-[10px] border border-neutral-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#0f1422]">Allow Client to Remove</p>
                <p className="text-[10px] text-neutral-500">Enables toggle switch in simulation</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={primary.isRemovable}
                  onChange={(e) => {
                    const isRemovable = e.target.checked;
                    const autoKey = isRemovable && !primary.togglePropertyKey
                      ? `has_${(primary.componentKey || primary.componentName || 'part').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
                      : primary.togglePropertyKey;
                    onUpdateParts({ isRemovable, togglePropertyKey: autoKey });
                  }}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#07b6d3]"></div>
              </label>
            </div>

            {primary.isRemovable && (
              <div className="pt-2 border-t border-neutral-200/60 space-y-1">
                <label className="text-[11px] font-medium text-neutral-600 block">
                  Toggle Property Key
                </label>
                <input
                  type="text"
                  value={primary.togglePropertyKey || ''}
                  onChange={(e) => onUpdateParts({ togglePropertyKey: e.target.value })}
                  placeholder={`e.g. has_${(primary.componentKey || 'part').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`}
                  className="w-full border border-neutral-200 rounded-[6px] px-2.5 py-1.5 text-xs focus:border-[#07b6d3] outline-none bg-white"
                />
              </div>
            )}
          </div>
        )}

        {/* Section: Accessory Configuration */}
        {isAccessory ? (
          <div className="bg-neutral-50 p-3.5 rounded-[10px] border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[#07b6d3]" />
                <div>
                  <p className="text-xs font-semibold text-[#0f1422]">Accessory Category</p>
                  <p className="text-[10px] text-neutral-500">
                    Template classification for this hardware model
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-[#07b6d3]/10 text-[#07b6d3] font-medium px-2 py-0.5 rounded-full">
                Hardware Template
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-medium text-neutral-700 block">
                Accessory Type <span className="text-red-500">*</span>
              </label>
              <select
                value={primary.accessoryCategory || "handle"}
                onChange={(e) => {
                  const nextCategory = e.target.value as AccessoryCategory;
                  onUpdateParts({ accessoryCategory: nextCategory });
                }}
                className="w-full border border-neutral-200 rounded-[8px] px-3 py-2 text-xs font-medium text-[#0f1422] focus:border-[#07b6d3] outline-none bg-white shadow-xs cursor-pointer"
              >
                <option value="handle">Handle / Knob / Pull</option>
                <option value="lock">Lock / Latch / Smart Lock</option>
                <option value="hinge">Hinge / Pivot</option>
                <option value="roller">Roller / Guide Wheel</option>
                <option value="other">Other Hardware</option>
              </select>
              <p className="text-[10px] text-neutral-500 leading-normal">
                Specifies which fixture slot type (e.g. door handles or sliding locks) can mount this hardware template.
              </p>
            </div>
          </div>
        ) : (
        <div className="space-y-3">
          {/* Positional Placement & Handing Controls */}
          {(!(
            primary.presentationCategory === "Framing" ||
            primary.componentType === "Model" ||
            primary.componentKey.includes("frame") ||
            primary.componentKey.includes("mesh") ||
            primary.componentKey.includes("sill") ||
            primary.componentKey.includes("bar")
          ) || primary.isAccessorySlot) && (
          <div className="bg-neutral-50 p-3 rounded-[10px] border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#0f1422]">Positional Handing & Placement</p>
                <p className="text-[10px] text-neutral-500">Enable Left / Right orientation and placement rules</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(primary.positionOptions?.allowHorizontalToggle)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked) {
                      updatePositionOptions({
                        allowHorizontalToggle: true,
                        defaultHorizontal: primary.positionOptions?.defaultHorizontal || "right",
                        horizontalOffsetMm: primary.positionOptions?.horizontalOffsetMm ?? 45,
                        allowVerticalToggle: primary.positionOptions?.allowVerticalToggle ?? false,
                        defaultVertical: primary.positionOptions?.defaultVertical || "up",
                        verticalOffsetMm: primary.positionOptions?.verticalOffsetMm ?? 1000,
                      });
                    } else {
                      onUpdateParts({ positionOptions: null });
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#07b6d3]"></div>
              </label>
            </div>

            {primary.positionOptions?.allowHorizontalToggle && (
              <div className="space-y-2.5 pt-2 border-t border-neutral-200/60 text-xs">
                {/* Horizontal Handing (Left vs Right) */}
                <div className="p-2.5 rounded-[8px] bg-white border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#0f1422]">Lateral Handing (Left vs Right)</span>
                    <span className="text-[10px] text-neutral-400 capitalize">
                      Default: {primary.positionOptions?.defaultHorizontal === "left" ? "Left Side" : "Right Side"}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Controls default mounting side on the X-axis and dynamic mirroring across centerline.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["left", "right"] as HorizontalPosition[]).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => updatePositionOptions({ defaultHorizontal: pos })}
                        className={`py-1.5 rounded-[6px] text-xs font-medium border text-center transition-all cursor-pointer ${
                          (primary.positionOptions?.defaultHorizontal ?? "right") === pos
                            ? "border-[#07b6d3] bg-[#07b6d3]/10 text-[#07b6d3] font-semibold"
                            : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        Default {pos === "left" ? "Left Side" : "Right Side"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical Placement (Bottom vs Up) */}
                <div className="p-2.5 rounded-[8px] bg-white border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#0f1422]">Vertical Placement (Bottom vs Up)</span>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={primary.positionOptions?.allowVerticalToggle ?? false}
                        onChange={(e) => updatePositionOptions({ allowVerticalToggle: e.target.checked })}
                        className="size-3.5 accent-[#07b6d3]"
                      />
                      <span className="text-[10px] text-neutral-600">Client Selectable</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Shifts the part along the vertical Y-axis, preserving lateral edge alignment and depth.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bottom", "up"] as VerticalPosition[]).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => updatePositionOptions({ defaultVertical: pos })}
                        className={`py-1.5 rounded-[6px] text-xs font-medium border text-center transition-all cursor-pointer ${
                          (primary.positionOptions?.defaultVertical ?? "up") === pos
                            ? "border-[#07b6d3] bg-[#07b6d3]/10 text-[#07b6d3] font-semibold"
                            : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        Default {pos === "bottom" ? "Bottom Position" : "Up / Mid Position"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Swappable with Accessories */}
          <div className="bg-neutral-50 p-3 rounded-[10px] border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#0f1422]">Swappable with Accessories</p>
                <p className="text-[10px] text-neutral-500">Allow customers to swap this part with catalog accessories</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(primary.isAccessorySlot)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onUpdateParts({
                      isAccessorySlot: checked,
                      ...(!checked && { allowedAccessoryIds: [] }),
                      ...(checked && !primary.accessoryCategory && { accessoryCategory: "handle" }),
                      ...(checked && { presentationCategory: "Hardware" }),
                    });
                  }}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#07b6d3]"></div>
              </label>
            </div>

            {primary.isAccessorySlot && (
              <div className="space-y-3 pt-2 border-t border-neutral-200/60 text-xs">
                {/* Category Dropdown */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-700 block">
                    Target Accessory Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={primary.accessoryCategory || "handle"}
                    onChange={(e) => {
                      const nextCategory = e.target.value as AccessoryCategory;
                      if (nextCategory === slotCategory) return;
                      onUpdateParts({ accessoryCategory: nextCategory, allowedAccessoryIds: [] });
                      setAccessorySearch('');
                      setCategoryNotice(selectedAccessoryIds.length > 0
                        ? 'Previously approved replacements were cleared because the category changed.'
                        : null);
                    }}
                    className="w-full border border-neutral-200 rounded-[6px] px-2.5 py-1.5 text-xs focus:border-[#07b6d3] outline-none bg-white"
                  >
                    <option value="handle">Handle / Knob / Pull</option>
                    <option value="lock">Lock / Latch / Smart Lock</option>
                    <option value="hinge">Hinge / Pivot</option>
                    <option value="roller">Roller / Guide Wheel</option>
                    <option value="other">Other Hardware</option>
                  </select>
                </div>

                {categoryNotice && <p role="status" className="text-[11px] text-amber-700">{categoryNotice}</p>}
                <div className="space-y-2 rounded-[8px] border border-neutral-200 bg-white p-2.5">
                  <label htmlFor="registered-accessory-search" className="block text-[11px] font-medium text-neutral-700">
                    Approved registered replacements
                  </label>
                  <input
                    id="registered-accessory-search"
                    type="search"
                    value={accessorySearch}
                    onChange={(event) => setAccessorySearch(event.target.value)}
                    placeholder="Search registered Accessories"
                    className="w-full border border-neutral-200 rounded-[6px] px-2.5 py-1.5 text-xs focus:border-[#07b6d3] outline-none"
                  />
                  {accessoryLoading ? (
                    <p role="status" className="text-[11px] text-neutral-500">Loading eligible Accessories...</p>
                  ) : accessoryError ? (
                    <p role="alert" className="text-[11px] text-red-600">{accessoryError}</p>
                  ) : filteredAccessories.length === 0 ? (
                    <p className="text-[11px] text-neutral-500">No eligible Accessories found. Register and publish a model in Accessories first.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1" aria-label="Available registered accessories">
                      {filteredAccessories.map((item) => {
                        const checked = selectedAccessoryIds.includes(item.id);
                        return <label key={item.id} className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 hover:bg-neutral-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onUpdateParts({ allowedAccessoryIds: checked
                              ? selectedAccessoryIds.filter((id) => id !== item.id)
                              : [...selectedAccessoryIds, item.id] })}
                            className="size-3.5 accent-[#07b6d3]"
                          />
                          <span className="min-w-0 flex-1 truncate text-neutral-700">{item.name}</span>
                          <span className="text-[10px] text-neutral-500">₱{item.price.toLocaleString('en-PH')}</span>
                        </label>;
                      })}
                    </div>
                  )}
                  <div className="border-t border-neutral-100 pt-2 space-y-1">
                    <p className="text-[11px] font-medium text-neutral-700">Selected ({selectedAccessoryIds.length})</p>
                    {selectedAccessoryIds.length === 0 ? <p className="text-[11px] text-amber-700">Select at least one replacement before publishing this product.</p> : selectedAccessoryIds.map((id) => {
                      const item = catalogAccessories.find((entry) => entry.id === id);
                      return <div key={id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={item ? 'text-neutral-700' : 'text-red-600'}>{item?.name || `Unavailable accessory (${id})`}</span>
                        <button type="button" onClick={() => onUpdateParts({ allowedAccessoryIds: selectedAccessoryIds.filter((entry) => entry !== id) })} className="text-[#07b6d3] hover:underline">Remove</button>
                      </div>;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Section 5: Base Quantity & Assembly Group */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-700 block">
              Base Quantity
            </label>
            <input
              type="number"
              min="1"
              value={primary.baseQuantity}
              onChange={(e) => onUpdateParts({ baseQuantity: intParse(e.target.value, 10) || 1 })}
              className="w-full border border-neutral-200 rounded-[8px] px-3 py-1.5 text-xs focus:border-[#07b6d3] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-700 block">
              Assembly Group
            </label>
            <input
              type="text"
              value={primary.assemblyGroup || ''}
              onChange={(e) => onUpdateParts({ assemblyGroup: e.target.value })}
              placeholder="frame"
              className="w-full border border-neutral-200 rounded-[8px] px-3 py-1.5 text-xs focus:border-[#07b6d3] outline-none"
            />
          </div>
        </div>

        {/* Section 6: Presentation Category */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-700 block">
            Presentation Category
          </label>
          <select
            value={primary.presentationCategory}
            onChange={(e) => onUpdateParts({ presentationCategory: e.target.value as PresentationCategory })}
            className="w-full border border-neutral-200 rounded-[8px] px-3 py-1.5 text-xs focus:border-[#07b6d3] outline-none bg-white"
          >
            <option value="Framing">Framing</option>
            <option value="Glazing">Glazing</option>
            <option value="Hardware">Hardware</option>
            <option value="Consumable">Consumable</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function intParse(val: string, radix: number): number {
  return parseInt(val, radix) || 1;
}
