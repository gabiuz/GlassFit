/**
 * Part Inspector Drawer Component (MS-3, MS64, DSD-UI10)
 *
 * Upstream Specifications: docs/pricing.md, docs/implementation/ms64.md
 * Traceability Codes: PRD-F14, PRD-F19, SDD-C9, DSD-UI10, ERD-E6, QAD-TC79
 */

'use client';

import React, { useState, useMemo } from 'react';
import type {
  DimensionBinding,
  PresentationCategory,
  RawMaterial,
  ComponentMaterialBinding,
} from '@/lib/pricing/types';
import type { ComponentType } from '@/lib/admin/products/types';

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
}

interface PartInspectorDrawerProps {
  selectedParts: PartInspectorConfig[];
  allParts?: PartInspectorConfig[];
  rawMaterials: RawMaterial[];
  onUpdateParts: (updates: Partial<PartInspectorConfig>) => void;
  onSyncAssemblyGroup?: (assemblyGroup: string, bindings: ComponentMaterialBinding[], defaultMaterialId: string | null) => void;
  onDeselect: () => void;
}

export function PartInspectorDrawer({
  selectedParts,
  rawMaterials,
  onUpdateParts,
  onSyncAssemblyGroup,
  onDeselect,
}: PartInspectorDrawerProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const primary = selectedParts[0] as PartInspectorConfig | undefined;
  const isMulti = selectedParts.length > 1;

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

  // Filtering materials list
  const filteredMaterials = useMemo(() => {
    return rawMaterials.filter((m) => {
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
  }, [rawMaterials, categoryFilter, searchQuery]);

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
      onUpdateParts({
        materialBindings: newBindings,
        rawMaterialId: newDefaultId,
      });
    }
  };

  // Set as Default Handler (Radio / Click)
  const handleSetDefault = (rawMaterialId: string) => {
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
              Assembly: {primary.assemblyGroup || 'General Members'}
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
      <div className="p-4 overflow-y-auto space-y-4 flex-1">
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
                className="text-[11px] font-medium text-[#07b6d3] hover:text-[#069bb4] hover:underline cursor-pointer whitespace-nowrap"
              >
                Sync to Group Parts
              </button>
            )}
          </div>
        )}

        {/* Section 1: Multi-Material Selection Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-neutral-800 block">
                Allowed Raw Materials (Catalog)
              </label>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Select one or more materials. Designate one material as the default.
              </p>
            </div>
            {currentBindings.length > 0 && (
              <button
                type="button"
                onClick={() => onUpdateParts({ materialBindings: [], rawMaterialId: null })}
                className="text-[10px] text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
            {['All', 'Aluminum', 'Glass', 'Hardware', 'Consumable'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#0f1422] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Filter */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, description, or finish..."
              className="w-full border border-neutral-200 rounded-[8px] pl-3 pr-3 py-1.5 text-xs focus:border-[#07b6d3] outline-none bg-white"
            />
          </div>

          {/* Candidate Material Checklist */}
          <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 border border-neutral-200 rounded-[8px] bg-white">
            {filteredMaterials.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-400">
                No materials match the filter.
              </div>
            ) : (
              filteredMaterials.map((mat) => {
                const isChecked = checkedMaterialIds.has(mat.id);
                const isDefault = defaultMaterialId === mat.id;

                return (
                  <div
                    key={mat.id}
                    className={`p-2.5 flex items-start justify-between gap-2.5 transition-colors ${
                      isChecked ? 'bg-cyan-50/30' : 'hover:bg-neutral-50'
                    }`}
                  >
                    {/* Checkbox & Details */}
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleMaterial(mat.id)}
                        className="mt-0.5 size-4 rounded border-neutral-300 text-[#07b6d3] focus:ring-[#07b6d3] accent-[#07b6d3] cursor-pointer"
                        id={`mat-${mat.id}`}
                      />
                      <label htmlFor={`mat-${mat.id}`} className="flex-1 cursor-pointer min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-semibold text-neutral-800">
                            {mat.material_code}
                          </span>
                          {mat.finish_type && mat.finish_type !== 'None' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 font-medium">
                              {mat.finish_type}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-600 truncate mt-0.5" title={mat.description}>
                          {mat.description}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          PHP {mat.unit_price.toFixed(2)} / {mat.billing_unit}
                          {mat.waste_allowance > 0 && (
                            <span className="text-amber-600 ml-1">
                              (+{(mat.waste_allowance * 100).toFixed(0)}% scrap)
                            </span>
                          )}
                        </p>
                      </label>
                    </div>

                    {/* Default Selector */}
                    <div className="flex-shrink-0 pt-0.5">
                      {isChecked ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(mat.id)}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            isDefault
                              ? 'bg-[#05b64b] text-white'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                          title={isDefault ? 'Active Default Material' : 'Click to designate as default'}
                        >
                          <span className={`size-1.5 rounded-full ${isDefault ? 'bg-white' : 'bg-neutral-400'}`} />
                          {isDefault ? 'Default' : 'Set Default'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(mat.id)}
                          className="text-[10px] text-neutral-400 hover:text-neutral-600 hover:underline cursor-pointer"
                          title="Click to check and designate as default in one action"
                        >
                          Make Default
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Selection Summary */}
          <div className="pt-1">
            {currentBindings.length === 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <span className="size-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span>Unassigned component (Free component: no material cost)</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-600">
                  <span>
                    <strong className="text-neutral-900 font-medium">{currentBindings.length}</strong>{' '}
                    {currentBindings.length === 1 ? 'material allowed' : 'materials allowed'}
                  </span>
                  {currentDefaultMaterial && (
                    <span className="text-[#05b64b] font-medium flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-[#05b64b]" />
                      Default: {currentDefaultMaterial.material_code}
                    </span>
                  )}
                </div>

                {currentDefaultMaterial && (
                  <div className="text-[11px] text-neutral-600 bg-sky-50/50 p-2.5 rounded-[8px] border border-sky-100/80 space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Default Material:</span>
                      <span className="font-semibold text-[#0f1422] truncate ml-2">
                        {currentDefaultMaterial.description}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-500">
                      <span>Base Unit Rate:</span>
                      <span className="font-medium text-[#0f1422]">
                        PHP {currentDefaultMaterial.unit_price.toFixed(2)} / {currentDefaultMaterial.billing_unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-500">
                      <span>Cutting Scrap Allowance:</span>
                      <span className="font-medium text-amber-600">
                        +{(currentDefaultMaterial.waste_allowance * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-sky-100 text-[#07b6d3] font-medium">
                      <span>Effective Rate:</span>
                      <span>
                        PHP{' '}
                        {(
                          currentDefaultMaterial.unit_price *
                          (1 + currentDefaultMaterial.waste_allowance)
                        ).toFixed(2)}{' '}
                        / {currentDefaultMaterial.billing_unit}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Dimension Driver */}
        <div className="space-y-1.5 pt-2 border-t border-neutral-100">
          <label className="text-xs font-medium text-neutral-700 block">
            Dimension Driver
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['WIDTH', 'HEIGHT', 'AREA', 'FIXED'] as DimensionBinding[]).map((driver) => (
              <button
                key={driver}
                type="button"
                onClick={() => onUpdateParts({ dimensionBinding: driver })}
                className={
                  primary.dimensionBinding === driver
                    ? 'px-3 py-2 rounded-[8px] text-xs font-medium border text-center transition-all border-[#07b6d3] bg-[#07b6d3]/10 text-[#07b6d3]'
                    : 'px-3 py-2 rounded-[8px] text-xs font-medium border text-center transition-all border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }
              >
                {driver === 'WIDTH' && 'Width (1D)'}
                {driver === 'HEIGHT' && 'Height (1D)'}
                {driver === 'AREA' && 'Area (2D)'}
                {driver === 'FIXED' && 'Static / Fixed'}
              </button>
            ))}
          </div>
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

        {/* Section 4: Removable Toggle */}
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
                onChange={(e) => onUpdateParts({ isRemovable: e.target.checked })}
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
                placeholder="has_sill"
                className="w-full border border-neutral-200 rounded-[6px] px-2.5 py-1.5 text-xs focus:border-[#07b6d3] outline-none bg-white"
              />
            </div>
          )}
        </div>

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
