/**
 * Automatic Filename & Geometry Inspector for 3D Components (MS-3)
 *
 * Upstream Specifications: docs/pricing.md (Section 4.2), docs/milestone.md (MS-3)
 * Traceability Codes: PRD-F14, SDD-C9, DSD-UI10, ERD-E6
 */

import type { DimensionBinding, PresentationCategory, RawMaterial } from "@/lib/pricing/types";
import type { ComponentType, AccessoryCategory, AccessoryPositionOptions } from "./types";

export interface AutoDetectionResult {
  dimensionBinding: DimensionBinding;
  spanRatio: number;
  isRemovable: boolean;
  togglePropertyKey: string | null;
  presentationCategory: PresentationCategory;
  componentType: ComponentType;
  suggestedMaterialCategory: string;
  isAccessorySlot?: boolean;
  accessoryCategory?: AccessoryCategory | null;
  positionOptions?: AccessoryPositionOptions;
}

export interface AutoDetectAccessorySlotResult {
  isAccessorySlot: boolean;
  accessoryCategory: AccessoryCategory;
  presentationCategory: PresentationCategory;
  dimensionBinding: DimensionBinding;
  positionOptions: AccessoryPositionOptions;
}

/**
 * Auto-detect swappable hardware accessory slot configuration from filename keywords.
 * Maps hardware elements (handles, locks, rollers, hinges) to compatible accessory categories
 * and canonical positional placement rules (Left vs Right on X axis, Bottom vs Up on Y axis).
 * Upstream Specification: IMP-MS75 (PRD-F5, PRD-F14, SDD-C4, SDD-C9)
 */
export function autoDetectAccessorySlot(fileName: string): AutoDetectAccessorySlotResult | null {
  const lower = fileName.toLowerCase();

  // Handles & Knobs
  if (/handle|doorknob|knob|lever|pull_bar|pullhandle/.test(lower)) {
    return {
      isAccessorySlot: true,
      accessoryCategory: "handle",
      presentationCategory: "Hardware",
      dimensionBinding: "FIXED",
      positionOptions: {
        allowHorizontalToggle: true,
        defaultHorizontal: "right",
        horizontalOffsetMm: 45,
        allowVerticalToggle: false,
        defaultVertical: "up",
        verticalOffsetMm: 1000,
      },
    };
  }

  // Locks, Latches, Smart Locks
  if (!lower.includes("stile") && !lower.includes("interlock") && /lock|latch|deadbolt|smartlock|electric_lock/.test(lower)) {
    return {
      isAccessorySlot: true,
      accessoryCategory: "lock",
      presentationCategory: "Hardware",
      dimensionBinding: "FIXED",
      positionOptions: {
        allowHorizontalToggle: true,
        defaultHorizontal: "right",
        horizontalOffsetMm: 35,
        allowVerticalToggle: true,
        defaultVertical: "up",
        verticalOffsetMm: 1000,
      },
    };
  }

  // Rollers & Guides
  if (/roller|wheel|guide_wheel|track_roller/.test(lower)) {
    return {
      isAccessorySlot: true,
      accessoryCategory: "roller",
      presentationCategory: "Hardware",
      dimensionBinding: "FIXED",
      positionOptions: {
        allowHorizontalToggle: false,
        defaultHorizontal: "left",
        horizontalOffsetMm: 0,
        allowVerticalToggle: false,
        defaultVertical: "bottom",
        verticalOffsetMm: 15,
      },
    };
  }

  // Hinges & Pivots
  if (/hinge|pivot/.test(lower)) {
    return {
      isAccessorySlot: true,
      accessoryCategory: "hinge",
      presentationCategory: "Hardware",
      dimensionBinding: "FIXED",
      positionOptions: {
        allowHorizontalToggle: true,
        defaultHorizontal: "left",
        horizontalOffsetMm: 10,
        allowVerticalToggle: true,
        defaultVertical: "up",
        verticalOffsetMm: 1000,
      },
    };
  }

  return null;
}

/**
 * Parse GLB file name to automatically determine dimension binding, span ratio,
 * removable toggles, presentation categories, swappable accessory slots, and suggested materials.
 */
export function autoDetectComponentSettings(fileName: string): AutoDetectionResult {
  const name = fileName.toLowerCase().replace(/\.glb$/, "");

  // Swappable Hardware Accessory Slots (IMP-MS75)
  const accessorySlot = autoDetectAccessorySlot(fileName);
  if (accessorySlot) {
    return {
      dimensionBinding: accessorySlot.dimensionBinding,
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: accessorySlot.presentationCategory,
      componentType: "Hardware",
      suggestedMaterialCategory: "Hardware",
      isAccessorySlot: true,
      accessoryCategory: accessorySlot.accessoryCategory,
      positionOptions: accessorySlot.positionOptions,
    };
  }

  // Grille middle bars, center infill, pickets, lattices, and louvers (IMP-MS72)
  if (
    name.includes("center_grille") ||
    name.includes("middle_bars") ||
    name.includes("grill_middle") ||
    name.includes("grill_bars") ||
    name.includes("grille_infill") ||
    name.includes("picket") ||
    name.includes("lattice") ||
    (name.includes("grill") && !name.includes("frame") && !name.includes("jamb") && !name.includes("rail")) ||
    (name.includes("grille") && !name.includes("frame") && !name.includes("jamb") && !name.includes("rail"))
  ) {
    return {
      dimensionBinding: "GRILLE_LINEAR",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Framing",
      componentType: "Frame",
      suggestedMaterialCategory: "Aluminum",
    };
  }

  // Perimeter frames, tubular subframes, surrounds, and outer casings
  if (
    name.includes("perimeter") ||
    name.includes("subframe") ||
    name.includes("sub_frame") ||
    name.includes("surround") ||
    name.includes("tubular_frame") ||
    name.includes("casing_frame") ||
    name.includes("outer_casing") ||
    name.includes("perimeter_tube") ||
    name.includes("frame_perimeter") ||
    (name.includes("outer_frame") && !name.includes("left") && !name.includes("right") && !name.includes("top") && !name.includes("bottom"))
  ) {
    return {
      dimensionBinding: "PERIMETER",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Framing",
      componentType: "Frame",
      suggestedMaterialCategory: "Aluminum",
    };
  }

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
    name.includes("frame_left") ||
    name.includes("left_frame") ||
    name.includes("frame_right") ||
    name.includes("right_frame") ||
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
    name.includes("frame_top") ||
    name.includes("top_frame") ||
    name.includes("frame_bottom") ||
    name.includes("bottom_frame") ||
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

  // 9. Screen & insect wire mesh
  if (name.includes("mesh") || name.includes("wire_mesh") || name.includes("screen_mesh") || (name.includes("screen") && !name.includes("door") && !name.includes("frame"))) {
    return {
      dimensionBinding: "AREA",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Hardware",
      componentType: "Hardware",
      suggestedMaterialCategory: "Hardware",
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

export interface SuggestedCandidateMaterial {
  rawMaterialId: string;
  isDefault: boolean;
  displayOrder: number;
}

export interface SuggestedMaterialConfig {
  materialBindings: SuggestedCandidateMaterial[];
  defaultRawMaterialId: string | null;
}

/**
 * Suggest standard multi-material candidate sets based on component classification
 * and presentation category per IMP-MS64.
 */
export function suggestCandidateMaterials(
  presentationCategory: PresentationCategory,
  rawMaterials: RawMaterial[],
  preferredFinish?: string
): SuggestedMaterialConfig {
  if (!rawMaterials || rawMaterials.length === 0) {
    return { materialBindings: [], defaultRawMaterialId: null };
  }

  let targetCategory: string;
  switch (presentationCategory) {
    case "Framing":
      targetCategory = "Aluminum";
      break;
    case "Glazing":
      targetCategory = "Glass";
      break;
    case "Hardware":
      targetCategory = "Hardware";
      break;
    case "Consumable":
      targetCategory = "Consumable";
      break;
    default:
      targetCategory = "Aluminum";
  }

  const matches = rawMaterials.filter(
    (m) => m.category.toLowerCase() === targetCategory.toLowerCase() && m.is_active !== false
  );

  if (matches.length === 0) {
    return { materialBindings: [], defaultRawMaterialId: null };
  }

  // Determine default material index based on preferredFinish or standard conventions
  let defaultIdx = 0;
  if (preferredFinish) {
    const prefIdx = matches.findIndex((m) =>
      m.finish_type.toLowerCase().includes(preferredFinish.toLowerCase())
    );
    if (prefIdx >= 0) defaultIdx = prefIdx;
  } else if (targetCategory === "Aluminum") {
    // Prefer Analok or Powder Coated White as primary default
    const analokIdx = matches.findIndex((m) =>
      m.finish_type.toLowerCase().includes("analok")
    );
    if (analokIdx >= 0) {
      defaultIdx = analokIdx;
    } else {
      const pcwIdx = matches.findIndex((m) =>
        m.finish_type.toLowerCase().includes("powdercoatedwhite") ||
        m.finish_type.toLowerCase().includes("white")
      );
      if (pcwIdx >= 0) defaultIdx = pcwIdx;
    }
  } else if (targetCategory === "Glass") {
    // Prefer Clear glass as primary default
    const clearIdx = matches.findIndex((m) =>
      m.finish_type.toLowerCase().includes("clear")
    );
    if (clearIdx >= 0) defaultIdx = clearIdx;
  }

  const materialBindings: SuggestedCandidateMaterial[] = matches.map((m, idx) => ({
    rawMaterialId: m.id,
    isDefault: idx === defaultIdx,
    displayOrder: idx,
  }));

  const defaultRawMaterialId = matches[defaultIdx]?.id || null;

  return {
    materialBindings,
    defaultRawMaterialId,
  };
}
