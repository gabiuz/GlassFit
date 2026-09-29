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
  const name = fileName.toLowerCase().replace(/\.glb$/, "");

  // 1. Sill profiles
  if (name.includes("sill") || name.includes("threshold") || name.includes("bottom_track") || name.includes("bottom_sliding_track")) {
    return {
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      isRemovable: true,
      togglePropertyKey: "has_sill",
      presentationCategory: "Framing",
      componentType: "Frame",
      suggestedMaterialCategory: "Aluminum",
    };
  }

  // 2. Back panels
  if (name.includes("back_panel") || name.includes("rear_panel") || name.includes("backpanel")) {
    return {
      dimensionBinding: "AREA",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Framing",
      componentType: "Frame",
      suggestedMaterialCategory: "Aluminum",
    };
  }

  // 3. Vertical perimeter members: Left/Right panels, Jambs & Stiles
  if (
    name.includes("left_panel") ||
    name.includes("right_panel") ||
    name.includes("side_panel") ||
    name.includes("jamb") ||
    name.includes("stile") ||
    name.includes("interlock") ||
    name.includes("lockstile") ||
    name.includes("mullion")
  ) {
    return {
      dimensionBinding: "HEIGHT",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Framing",
      componentType: "Frame",
      suggestedMaterialCategory: "Aluminum",
    };
  }

  // 4. Shelves & glass showcase panels
  if (name.includes("shelf") || name.includes("glass_shelf") || name.includes("showcase_front") || name.includes("display_panel")) {
    return {
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Glazing",
      componentType: "Glass",
      suggestedMaterialCategory: "Glass",
    };
  }

  // 5. Horizontal panels, bases, plinths & headers
  if (
    name.includes("top_panel") ||
    name.includes("bottom_panel") ||
    name.includes("bottom_base") ||
    name.includes("head") ||
    name.includes("top_track") ||
    name.includes("top_sliding_track") ||
    name.includes("header") ||
    name.includes("base") ||
    name.includes("plinth") ||
    name.includes("kickplate") ||
    name.includes("divider") ||
    name.includes("partition")
  ) {
    return {
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Framing",
      componentType: "Frame",
      suggestedMaterialCategory: "Aluminum",
    };
  }

  // 6. Horizontal sash members: Rails
  if (name.includes("rail") || name.includes("transom") || name.includes("sash_top") || name.includes("sash_bot") || name.includes("track")) {
    // Check if 3-panel or 2-panel keyword exists
    const isThird = name.includes("3p") || name.includes("triple") || name.includes("third");
    return {
      dimensionBinding: "WIDTH",
      spanRatio: isThird ? 0.3333 : 0.5,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Framing",
      componentType: "Frame",
      suggestedMaterialCategory: "Aluminum",
    };
  }

  // 7. Sliding doors & door leaves (Cabinet & Window glazing)
  if (name.includes("sliding_door") || name.includes("door_leaf") || name.includes("door_pane") || name.includes("sash_glass")) {
    return {
      dimensionBinding: "AREA",
      spanRatio: 0.5,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Glazing",
      componentType: "Glass",
      suggestedMaterialCategory: "Glass",
    };
  }

  // 8. General Glazing infill
  if (name.includes("glass") || name.includes("pane") || name.includes("infill") || name.includes("glazing")) {
    return {
      dimensionBinding: "AREA",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Glazing",
      componentType: "Glass",
      suggestedMaterialCategory: "Glass",
    };
  }

  // 8. Mechanical hardware & wheels
  if (
    name.includes("roller") ||
    name.includes("wheel") ||
    name.includes("caster") ||
    name.includes("lock") ||
    name.includes("latch") ||
    name.includes("guide") ||
    name.includes("cap") ||
    name.includes("screw") ||
    name.includes("fastener")
  ) {
    return {
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Hardware",
      componentType: "Hardware",
      suggestedMaterialCategory: "Hardware",
    };
  }

  // Default fallback
  return {
    dimensionBinding: "FIXED",
    spanRatio: 1.0,
    isRemovable: false,
    togglePropertyKey: null,
    presentationCategory: "Framing",
    componentType: "Model",
    suggestedMaterialCategory: "Aluminum",
  };
}
