/**
 * Automatic Filename & Geometry Inspector for 3D Components (MS-3)
 *
 * Upstream Specifications: docs/pricing.md (Section 4.2), docs/milestone.md (MS-3)
 * Traceability Codes: PRD-F14, SDD-C9, DSD-UI10, ERD-E6
 */

import type { DimensionBinding, PresentationCategory } from '@/lib/pricing/types';
import type { ComponentType } from './componentMutations';

export interface AutoDetectionResult {
  dimensionBinding: DimensionBinding;
  spanRatio: number;
  isRemovable: boolean;
  togglePropertyKey: string | null;
  presentationCategory: PresentationCategory;
  componentType: ComponentType;
  suggestedMaterialCategory: string;
}

/**
 * Parse GLB file name to automatically determine dimension binding, span ratio,
 * removable toggles, presentation categories, and suggested raw material categories.
 */
export function autoDetectComponentSettings(fileName: string): AutoDetectionResult {
  const name = fileName.toLowerCase().replace(/\.glb$/, '');

  // 1. Sill profiles
  if (name.includes('sill') || name.includes('threshold') || name.includes('bottom_track')) {
    return {
      dimensionBinding: 'WIDTH',
      spanRatio: 1.0,
      isRemovable: true,
      togglePropertyKey: 'has_sill',
      presentationCategory: 'Framing',
      componentType: 'Frame',
      suggestedMaterialCategory: 'Aluminum',
    };
  }

  // 2. Vertical perimeter members: Jambs & Stiles
  if (
    name.includes('jamb') ||
    name.includes('stile') ||
    name.includes('interlock') ||
    name.includes('lockstile') ||
    name.includes('mullion')
  ) {
    return {
      dimensionBinding: 'HEIGHT',
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: 'Framing',
      componentType: 'Frame',
      suggestedMaterialCategory: 'Aluminum',
    };
  }

  // 3. Horizontal sash members: Rails
  if (name.includes('rail') || name.includes('transom') || name.includes('sash_top') || name.includes('sash_bot')) {
    // Check if 3-panel or 2-panel keyword exists
    const isThird = name.includes('3p') || name.includes('triple') || name.includes('third');
    return {
      dimensionBinding: 'WIDTH',
      spanRatio: isThird ? 0.3333 : 0.5,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: 'Framing',
      componentType: 'Frame',
      suggestedMaterialCategory: 'Aluminum',
    };
  }

  // 4. Horizontal head track
  if (name.includes('head') || name.includes('top_track') || name.includes('header')) {
    return {
      dimensionBinding: 'WIDTH',
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: 'Framing',
      componentType: 'Frame',
      suggestedMaterialCategory: 'Aluminum',
    };
  }

  // 5. Glazing infill
  if (name.includes('glass') || name.includes('pane') || name.includes('infill') || name.includes('glazing')) {
    return {
      dimensionBinding: 'AREA',
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: 'Glazing',
      componentType: 'Glass',
      suggestedMaterialCategory: 'Glass',
    };
  }

  // 6. Mechanical hardware
  if (
    name.includes('roller') ||
    name.includes('wheel') ||
    name.includes('lock') ||
    name.includes('latch') ||
    name.includes('guide') ||
    name.includes('cap') ||
    name.includes('screw') ||
    name.includes('fastener')
  ) {
    return {
      dimensionBinding: 'FIXED',
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: 'Hardware',
      componentType: 'Hardware',
      suggestedMaterialCategory: 'Hardware',
    };
  }

  // Default fallback
  return {
    dimensionBinding: 'FIXED',
    spanRatio: 1.0,
    isRemovable: false,
    togglePropertyKey: null,
    presentationCategory: 'Framing',
    componentType: 'Model',
    suggestedMaterialCategory: 'Aluminum',
  };
}
