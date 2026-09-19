/**
 * Semantic Multi-Material Classification Engine (fix-02)
 *
 * Upstream Specifications: docs/implementation/fix-02.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F6, PRD-F14, PRD-F19, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, QAD-TC22, QAD-TC23
 */

import * as THREE from "three";
import type { GlassAppearanceMode } from "./types";
import type { RawMaterial } from "@/lib/pricing/types";

export type MaterialClassification = "Glass" | "Aluminum" | "Hardware";

export interface MaterialPaletteOptions {
  alumFinish?: string; // "black" | "white" | "silver" | "bronze"
  glassAppearance: GlassAppearanceMode; // "clear" | "frosted" | "reflective" | "opaque" | "outdoor"
}

export interface MaterialClassificationContext {
  componentKey?: string | null;
  componentName?: string | null;
  componentType?: string | null;
  presentationCategory?: string | null;
  rawMaterialId?: string | null;
  rawMaterial?: RawMaterial | null;
  rawMaterialCategory?: string | null;
  fileName?: string | null;
}

const GLASS_KEYWORDS = [
  "glass",
  "window_pane",
  "glass_pane",
  "door_pane",
  "sash_glass",
  "glass_panel",
  "glass_shelf",
  "sliding_door",
  "door_leaf",
  "showcase_front",
  "display_panel",
  "side_glass",
  "top_glass",
  "rear_glass",
  "dc_shelf",
  "dc_sliding_door",
  "glazing",
  "infill",
  "shelf",
];

const HARDWARE_KEYWORDS = [
  "wheel",
  "caster",
  "roller",
  "lock",
  "latch",
  "handle",
  "screw",
  "bolt",
  "fastener",
  "cap",
  "gasket",
  "seal",
  "bearing",
  "guide_block",
  "guide",
  "dc_bottom_base",
  "base_assembly",
  "hinge",
];

const ALUMINUM_KEYWORDS = [
  "top_panel",
  "bottom_panel",
  "left_panel",
  "right_panel",
  "back_panel",
  "side_panel",
  "panel",
  "frame",
  "jamb",
  "stile",
  "rail",
  "track",
  "header",
  "sill",
  "base",
  "plinth",
  "mullion",
  "transom",
  "aluminum",
  "alu",
  "profile",
  "post",
  "trim",
  "bracket",
];

function matchesTaxonomyKeyword(text: string, keyword: string): boolean {
  if (keyword === "pane") {
    return /\bpanes?\b|[_-]pane\b|\bpane[_-]/.test(text);
  }
  return text.includes(keyword);
}

/**
 * Classify a Three.js scene graph node/mesh using a prioritized 5-tier evaluation hierarchy.
 * Priority 1: Raw Material linked to the part (Glass category -> Glass, Aluminum category -> Aluminum, Hardware -> Hardware)
 */
export function classifySceneMesh(object: THREE.Object3D): MaterialClassification {
  // Tier 1: Explicit UserData & Linked Raw Material / Component Metadata
  // Walk up scene graph hierarchy to inherit parent/container metadata
  let curr: THREE.Object3D | null = object;
  while (curr) {
    const data = curr.userData as Record<string, unknown> | undefined;
    if (data) {
      // Direct raw material link evaluation (Highest Precedence)
      const rawMat = data.rawMaterial as RawMaterial | undefined;
      const rawCategory = (
        rawMat?.category ||
        (typeof data.rawMaterialCategory === "string" ? data.rawMaterialCategory : null)
      )?.toLowerCase();

      if (rawCategory === "glass") {
        return "Glass";
      }
      if (rawCategory === "aluminum") {
        return "Aluminum";
      }
      if (rawCategory === "hardware" || rawCategory === "accessory") {
        return "Hardware";
      }

      // Explicit component type and presentation category
      const compType = typeof data.componentType === "string" ? data.componentType.toLowerCase() : "";
      const presCategory = typeof data.presentationCategory === "string" ? data.presentationCategory.toLowerCase() : "";
      const matCategory = typeof data.materialCategory === "string" ? data.materialCategory.toLowerCase() : "";

      if (compType === "glass" || presCategory === "glazing" || matCategory === "glass") {
        return "Glass";
      }
      if (compType === "hardware" || presCategory === "hardware" || matCategory === "hardware") {
        return "Hardware";
      }
      if (compType === "frame" || presCategory === "framing" || matCategory === "aluminum") {
        return "Aluminum";
      }
    }
    curr = curr.parent;
  }

  // Tier 2: Source GLTF Material Inspection
  if (object instanceof THREE.Mesh && object.material) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of materials) {
      const matName = (mat.name || "").toLowerCase();
      if (
        matName.includes("glass") ||
        matName.includes("glaz") ||
        matName.includes("transp") ||
        matName.includes("vitre") ||
        matName.includes("cristal") ||
        matName.includes("dc_mat_glass")
      ) {
        return "Glass";
      }
      if (
        matName.includes("wheel") ||
        matName.includes("caster") ||
        matName.includes("roller") ||
        matName.includes("dc_mat_wheel") ||
        matName.includes("screw") ||
        matName.includes("fastener") ||
        matName.includes("hardware")
      ) {
        return "Hardware";
      }

      // Optical physical properties check (transmission > 0.05 or transparent with lower opacity)
      if ("transmission" in mat && typeof (mat as THREE.MeshPhysicalMaterial).transmission === "number") {
        if ((mat as THREE.MeshPhysicalMaterial).transmission > 0.05) {
          return "Glass";
        }
      }
      if (mat.transparent && typeof mat.opacity === "number" && mat.opacity < 0.95) {
        return "Glass";
      }
    }
  }

  // Tier 3: Semantic Taxonomy (Concatenated Node Names, Parent Names, Component Keys, File Names)
  const nameTokens: string[] = [];
  curr = object;
  while (curr) {
    if (curr.name) nameTokens.push(curr.name.toLowerCase());
    const data = curr.userData as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.componentKey === "string") nameTokens.push(data.componentKey.toLowerCase());
      if (typeof data.componentName === "string") nameTokens.push(data.componentName.toLowerCase());
      if (typeof data.fileName === "string") nameTokens.push(data.fileName.toLowerCase());
    }
    curr = curr.parent;
  }
  const fullTaxonomy = nameTokens.join(" ");

  // Check Glass keywords
  for (const kw of GLASS_KEYWORDS) {
    if (matchesTaxonomyKeyword(fullTaxonomy, kw)) {
      return "Glass";
    }
  }

  // Check Hardware keywords
  for (const kw of HARDWARE_KEYWORDS) {
    if (matchesTaxonomyKeyword(fullTaxonomy, kw)) {
      return "Hardware";
    }
  }

  // Check Aluminum keywords
  for (const kw of ALUMINUM_KEYWORDS) {
    if (matchesTaxonomyKeyword(fullTaxonomy, kw)) {
      return "Aluminum";
    }
  }

  // Tier 4: Geometric Form Factor (Thin Sheet Aspect Ratio Fallback)
  if (object instanceof THREE.Mesh && object.geometry) {
    if (!object.geometry.boundingBox) {
      object.geometry.computeBoundingBox();
    }
    const box = object.geometry.boundingBox;
    if (box) {
      const size = new THREE.Vector3();
      box.getSize(size);
      const minDim = Math.min(size.x, size.y, size.z);
      const maxDim = Math.max(size.x, size.y, size.z);
      // Thin flat sheet (thickness <= 25mm and width/height >= 150mm)
      if (minDim <= 0.025 && maxDim >= 0.15) {
        // If part is in interior or door leaf slot, default to glass
        if (
          fullTaxonomy.includes("leaf") ||
          fullTaxonomy.includes("door") ||
          fullTaxonomy.includes("shelf") ||
          fullTaxonomy.includes("infill")
        ) {
          return "Glass";
        }
      }
    }
  }

  // Tier 5: Default Framing Fallback
  return "Aluminum";
}

/**
 * Classify a component definition or metadata object before 3D instantiation.
 */
export function classifyComponentContext(ctx: MaterialClassificationContext): MaterialClassification {
  const rawCat = (ctx.rawMaterial?.category || ctx.rawMaterialCategory || "")?.toLowerCase();
  if (rawCat === "glass") return "Glass";
  if (rawCat === "aluminum") return "Aluminum";
  if (rawCat === "hardware" || rawCat === "accessory") return "Hardware";

  const compType = (ctx.componentType || "").toLowerCase();
  const presCategory = (ctx.presentationCategory || "").toLowerCase();
  if (compType === "glass" || presCategory === "glazing") return "Glass";
  if (compType === "hardware" || presCategory === "hardware") return "Hardware";
  if (compType === "frame" || presCategory === "framing") return "Aluminum";

  const tokens = [ctx.componentKey, ctx.componentName, ctx.fileName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const kw of GLASS_KEYWORDS) {
    if (matchesTaxonomyKeyword(tokens, kw)) return "Glass";
  }
  for (const kw of HARDWARE_KEYWORDS) {
    if (matchesTaxonomyKeyword(tokens, kw)) return "Hardware";
  }
  for (const kw of ALUMINUM_KEYWORDS) {
    if (matchesTaxonomyKeyword(tokens, kw)) return "Aluminum";
  }

  return "Aluminum";
}

let cachedOutdoorTexture: THREE.Texture | null = null;
function getOutdoorTexture(): THREE.Texture {
  if (cachedOutdoorTexture) {
    return cachedOutdoorTexture;
  }

  const loader = new THREE.TextureLoader();
  const texture = loader.load("/textures/outdoor-view.jpg", (loadedTexture) => {
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
    loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
  });

  cachedOutdoorTexture = texture;
  return texture;
}

export function createWindowGlassMaterial(mode: GlassAppearanceMode): THREE.Material {
  switch (mode) {
    case "clear":
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xf0f5f7),
        transparent: true,
        opacity: 0.18,          // Low opacity allows the room background to show through naturally
        transmission: 0.88,     // High transmission for true clear glass behavior
        roughness: 0.03,        // Razor-smooth float glass surface
        metalness: 0.02,
        ior: 1.52,              // Standard architectural soda-lime glass
        clearcoat: 1.0,         // High specular reflections on outer face
        clearcoatRoughness: 0.04,
        side: THREE.DoubleSide,
        depthWrite: false,      // Prevents occlusion sorting artifacts with background image
      });
    case "reflective":
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x9eb1bc),
        transparent: true,
        opacity: 0.65,
        transmission: 0.35,
        roughness: 0.08,
        metalness: 0.45,
        ior: 1.65,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
    case "opaque":
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xe6ecef),
        transparent: false,
        opacity: 1.0,
        roughness: 0.52,
        metalness: 0.02,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
    case "outdoor":
      return new THREE.MeshStandardMaterial({
        map: getOutdoorTexture(),
        transparent: false,
        opacity: 1.0,
        roughness: 0.40,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
    case "frosted":
    default:
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xe4ebed),
        transparent: true,
        opacity: 0.82,
        transmission: 0.15,
        roughness: 0.82,
        metalness: 0.0,
        ior: 1.45,
        clearcoat: 0.20,
        clearcoatRoughness: 0.60,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
  }
}

/**
 * Creates decoupled material palettes for Aluminum Framing, Optical Glass, and Mechanical Hardware.
 */
export function createMaterialPalette(options: MaterialPaletteOptions) {
  const isBlack = options.alumFinish === "black";
  const isWhite = options.alumFinish === "white";
  const isSilver = options.alumFinish === "silver";
  const isBronze = options.alumFinish === "bronze";

  // 1. Aluminum Structural Frame Material (Driven strictly by alumFinish)
  const frameColor = isBlack
    ? 0x232527
    : isWhite
      ? 0xeceae4
      : isSilver
        ? 0xc8cbce
        : isBronze
          ? 0x3e332b
          : 0x232527;

  const frameMetalness = isWhite ? 0.08 : isSilver ? 0.85 : isBronze ? 0.55 : 0.45;
  const frameRoughness = isBlack ? 0.28 : isWhite ? 0.32 : isSilver ? 0.22 : 0.26;
  const frameClearcoat = isWhite ? 0.35 : isSilver ? 0.60 : isBronze ? 0.45 : 0.40;
  const frameClearcoatRoughness = isWhite ? 0.25 : isSilver ? 0.15 : isBronze ? 0.20 : 0.20;

  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: frameColor,
    metalness: frameMetalness,
    roughness: frameRoughness,
    clearcoat: frameClearcoat,
    clearcoatRoughness: frameClearcoatRoughness,
  });

  // 2. Optical Glass Material (Driven strictly by glassAppearance)
  const glassMaterial = createWindowGlassMaterial(options.glassAppearance);

  // 3. Mechanical Hardware Material (Neutral Dark Metallic / Delrin Nylon)
  const hardwareMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2326,
    metalness: 0.70,
    roughness: 0.35,
  });

  return { frameMaterial, glassMaterial, hardwareMaterial };
}

export function applyPresentationMaterials(
  group: THREE.Group,
  glassAppearance: GlassAppearanceMode,
  alumFinish?: string,
) {
  const { frameMaterial, glassMaterial, hardwareMaterial } = createMaterialPalette({
    alumFinish,
    glassAppearance,
  });

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const classification = classifySceneMesh(object);
    if (classification === "Glass") {
      object.material = glassMaterial.clone();
      object.castShadow = false;
      object.receiveShadow = true;
    } else if (classification === "Hardware") {
      object.material = hardwareMaterial.clone();
      object.castShadow = true;
      object.receiveShadow = true;
    } else {
      object.material = frameMaterial.clone();
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  frameMaterial.dispose();
  glassMaterial.dispose();
  hardwareMaterial.dispose();
}
