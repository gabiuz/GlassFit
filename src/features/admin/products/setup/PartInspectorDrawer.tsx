/**
 * Part Inspector Drawer Component (MS-3, DSD-UI10)
 *
 * Upstream Specifications: docs/pricing.md (Section 4.1), docs/milestone.md (MS-3)
 * Traceability Codes: PRD-F14, SDD-C9, DSD-UI10, ERD-E6
 */


'use client';

import React from 'react';
import type { DimensionBinding, PresentationCategory, RawMaterial } from '@/lib/pricing/types';
import type { ComponentType } from '@/lib/admin/products/componentMutations';

export interface PartInspectorConfig {
  id: string;
  componentKey: string;
  componentName: string;
  componentType: ComponentType;
  rawMaterialId: string | null;
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
  rawMaterials: RawMaterial[];
  onUpdateParts: (updates: Partial<PartInspectorConfig>) => void;
  onDeselect: () => void;
  onOpenMaterialMapping: () => void;
  onOpenPricingDrivers: () => void;
}

export function PartInspectorDrawer({
  selectedParts,
  rawMaterials,
  onUpdateParts,
  onDeselect,
  onOpenMaterialMapping,
  onOpenPricingDrivers,
}: PartInspectorDrawerProps) {
  if (selectedParts.length === 0) {
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


  const isMulti = selectedParts.length > 1;
  const primary = selectedParts[0];
  const sameMaterial = selectedParts.every((part) => part.rawMaterialId === primary.rawMaterialId);
  const sameDriver = selectedParts.every((part) => part.dimensionBinding === primary.dimensionBinding);
  const sameSpan = selectedParts.every((part) => part.spanRatio === primary.spanRatio);
  const currentRawMaterial = sameMaterial ? rawMaterials.find((m) => m.id === primary.rawMaterialId) : undefined;

  return (
    <div className="flex flex-col h-full bg-white divide-y divide-neutral-100">
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
          {!isMulti && (
            <p className="text-xs text-neutral-400 font-mono mt-0.5">{primary.componentKey}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDeselect}
          className="text-neutral-400 hover:text-neutral-600 text-xs font-medium px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="p-4 overflow-y-auto space-y-4 flex-1">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-700">Material Link (Catalog)</span>
            <button type="button" onClick={onOpenMaterialMapping} className="text-xs font-semibold text-[#078ca5] hover:underline focus-visible:outline-2 focus-visible:outline-[#07b6d3]">
              Map materials
            </button>
          </div>
          <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            {sameMaterial ? currentRawMaterial?.material_code ?? (primary.rawMaterialId ? 'Unavailable material' : 'Unassigned (Free component)') : 'Mixed materials'}
          </p>
          {currentRawMaterial && (
            <div className="space-y-1 rounded-[8px] border border-sky-100/80 bg-sky-50/50 p-2.5 text-[11px] text-neutral-600">
              <div className="flex items-center justify-between"><span>Base Unit Rate:</span><span>PHP {currentRawMaterial.unit_price.toFixed(2)} / {currentRawMaterial.billing_unit}</span></div>
              <div className="flex items-center justify-between"><span>Cutting Scrap Allowance:</span><span>+{(currentRawMaterial.waste_allowance * 100).toFixed(1)}%</span></div>
              <div className="flex items-center justify-between border-t border-sky-100 pt-1 font-medium text-[#078ca5]"><span>Effective Rate:</span><span>PHP {(currentRawMaterial.unit_price * (1 + currentRawMaterial.waste_allowance)).toFixed(2)} / {currentRawMaterial.billing_unit}</span></div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-700">Pricing Driver</span>
            <button type="button" onClick={onOpenPricingDrivers} className="text-xs font-semibold text-[#078ca5] hover:underline focus-visible:outline-2 focus-visible:outline-[#07b6d3]">
              Review drivers
            </button>
          </div>
          <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            {sameDriver ? primary.dimensionBinding : 'Mixed drivers'} · {sameSpan ? `${primary.spanRatio.toFixed(2)}x` : 'Mixed ratios'}
          </p>
        </div>

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
