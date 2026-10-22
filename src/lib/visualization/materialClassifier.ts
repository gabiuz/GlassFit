/**
 * Semantic Multi-Material Classification Engine (fix-02)
 *
 * Upstream Specifications: docs/implementation/fix-02.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F6, PRD-F14, PRD-F19, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, QAD-TC22, QAD-TC23
 */

import * as THREE from "three";
import { normalizeAluminumFinish, type AluminumFinishKey } from "./colorVariations";
import type { GlassAppearanceMode, GlassColorKey, GlassThicknessMm } from "./types";
import type { RawMaterial } from "@/lib/pricing/types";
import {
  findFinishOption,
  findGlassColorOption,
  findGlassThicknessOption,
} from "@/lib/products/materialMapping";

export type MaterialClassification = "Glass" | "Aluminum" | "Hardware";

export interface ProductMaterialCapabilities {
  hasAluminum: boolean;
  hasGlass: boolean;
}

export interface MaterialPaletteOptions {
  aluminumFinish: AluminumFinishKey;
  glassAppearance: GlassAppearanceMode;
  glassColor: GlassColorKey;
  glassThicknessMm: GlassThicknessMm;
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
      if (
        matName.includes("frame") ||
        matName.includes("aluminum") ||
        matName.includes("aluminium") ||
        matName.includes("alu_") ||
        matName.includes("_alu") ||
        matName.includes("kickplate") ||
        matName.includes("kick_plate")
      ) {
        return "Aluminum";
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

export function detectProductMaterialCapabilities(
  root: THREE.Object3D,
): ProductMaterialCapabilities {
  let hasAluminum = false;
  let hasGlass = false;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const classification = classifySceneMesh(object);
    if (classification === "Aluminum") hasAluminum = true;
    if (classification === "Glass") hasGlass = true;
  });

  return { hasAluminum, hasGlass };
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

  if (typeof document === "undefined") {
    cachedOutdoorTexture = new THREE.Texture();
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

export function createWindowGlassMaterial(
  mode: GlassAppearanceMode,
  glassColor: GlassColorKey = "clear",
  glassThicknessMm: GlassThicknessMm = 6,
): THREE.Material {
  const colorOption = findGlassColorOption(glassColor);
  const thicknessOption = findGlassThicknessOption(glassThicknessMm);
  if (!colorOption || !thicknessOption) {
    throw new Error("Unknown glass presentation option.");
  }
  const tint = new THREE.Color(colorOption.previewHex);
  const physicalOptics = {
    thickness: glassThicknessMm / 1000,
    attenuationColor: tint,
    attenuationDistance: thicknessOption.attenuationDistance,
  };
  switch (mode) {
    case "clear":
      return new THREE.MeshPhysicalMaterial({
        color: tint,
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
        ...physicalOptics,
      });
    case "reflective":
      return new THREE.MeshPhysicalMaterial({
        color: tint,
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
        ...physicalOptics,
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
        color: tint,
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
        ...physicalOptics,
      });
  }
}

export interface MaterialPaletteResult {
  frameMaterial: THREE.MeshPhysicalMaterial;
  glassMaterial: THREE.Material;
  hardwareMaterial: THREE.MeshStandardMaterial;
  framing: THREE.MeshPhysicalMaterial;
  glass: THREE.Material;
  hardware: THREE.MeshStandardMaterial;
}

/**
 * Creates decoupled material palettes for Aluminum Framing, Optical Glass, and Mechanical Hardware.
 */
export function createMaterialPalette(options: MaterialPaletteOptions | string): MaterialPaletteResult {
  const opts: MaterialPaletteOptions =
    typeof options === "string"
      ? {
          aluminumFinish: normalizeAluminumFinish(options),
          glassAppearance: "frosted",
          glassColor: "clear",
          glassThicknessMm: 6,
        }
      : options;

  const legacyFinish = opts.aluminumFinish === "black"
    ? { previewHex: "#232527", metalness: 0.45, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.2 }
    : opts.aluminumFinish === "silver"
      ? { previewHex: "#C8CBCE", metalness: 0.85, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 }
      : null;
  const finish = findFinishOption(opts.aluminumFinish) ?? legacyFinish;
  if (!finish) {
    throw new Error(`Unknown aluminum finish: ${opts.aluminumFinish}`);
  }

  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: finish.previewHex,
    metalness: finish.metalness,
    roughness: finish.roughness,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: finish.clearcoatRoughness,
  });

  // 2. Optical Glass Material (Driven strictly by glassAppearance)
  const glassMaterial = createWindowGlassMaterial(
    opts.glassAppearance,
    opts.glassColor,
    opts.glassThicknessMm,
  );

  // 3. Mechanical Hardware Material (Neutral Dark Metallic / Delrin Nylon)
  const hardwareMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2326,
    metalness: 0.70,
    roughness: 0.35,
  });

  return {
    frameMaterial,
    glassMaterial,
    hardwareMaterial,
    framing: frameMaterial,
    glass: glassMaterial,
    hardware: hardwareMaterial,
  };
}

export function applyPresentationMaterials(
  group: THREE.Group,
  options: MaterialPaletteOptions,
) {
  const { frameMaterial, glassMaterial, hardwareMaterial } = createMaterialPalette(options);

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    if (object.userData.preserveMaterial || object.userData.isScreenMesh) {
      return;
    }

    const classification = classifySceneMesh(object);
    object.userData.materialCategory = classification;
    if (classification === "Glass") {
      object.material = glassMaterial.clone();
      object.castShadow = false;
      object.receiveShadow = true;
      object.renderOrder = 1;
    } else if (classification === "Hardware") {
      object.material = hardwareMaterial.clone();
      object.castShadow = true;
      object.receiveShadow = true;
      object.renderOrder = 0;
    } else {
      object.material = frameMaterial.clone();
      object.castShadow = true;
      object.receiveShadow = true;
      object.renderOrder = 0;
    }

  });

  frameMaterial.dispose();
  glassMaterial.dispose();
  hardwareMaterial.dispose();
}

export interface InsectScreenMaterialOptions {
  wirePitchMm?: number;
  wireColor?: string;
  wireThicknessRatio?: number;
}

/**
 * Specialized PBR shader material for insect wire mesh with dynamic metric-invariant
 * wire pitch and high-contrast visibility (IMP-MS68, IMP-MS69).
 */
export function createInsectScreenMaterial(
  widthMm?: number,
  heightMm?: number,
  config?: InsectScreenMaterialOptions,
): THREE.MeshStandardMaterial {
  const wirePitchMm = config?.wirePitchMm ?? 2.5; // 2.5mm tight spacing between wires
  const wireColor = config?.wireColor ?? "#181a1d"; // Dark charcoal wire
  const effectiveWidthMm = widthMm && widthMm > 0 ? widthMm : 1200;
  const effectiveHeightMm = heightMm && heightMm > 0 ? heightMm : 1200;

  const repeatX = Math.max(1, Math.round(effectiveWidthMm / wirePitchMm));
  const repeatY = Math.max(1, Math.round(effectiveHeightMm / wirePitchMm));

  if (typeof document === "undefined") {
    const fallback = new THREE.MeshStandardMaterial({
      color: new THREE.Color(wireColor),
      transparent: true,
      alphaTest: 0.2, // Critical: Cutout geometry included in depth & transmission buffers
      depthWrite: true,
      depthTest: true,
      roughness: 0.35,
      metalness: 0.75,
      side: THREE.DoubleSide,
    });
    fallback.userData.repeatX = repeatX;
    fallback.userData.repeatY = repeatY;
    fallback.userData.wirePitchMm = wirePitchMm;
    return fallback;
  }

  const canvas = document.createElement("canvas");
  const size = 128; // High-DPI texture resolution
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.MeshStandardMaterial({
      color: new THREE.Color(wireColor),
      transparent: true,
      alphaTest: 0.2,
      depthWrite: true,
      depthTest: true,
      roughness: 0.35,
      metalness: 0.75,
      side: THREE.DoubleSide,
    });
    fallback.userData.repeatX = repeatX;
    fallback.userData.repeatY = repeatY;
    fallback.userData.wirePitchMm = wirePitchMm;
    return fallback;
  }

  // Clear aperture openings between wires
  ctx.clearRect(0, 0, size, size);

  // Wire thickness: ~28% of cell width for realistic insect screen wire gauge
  const wireWidth = Math.max(4, Math.round(size * (config?.wireThicknessRatio ?? 0.28)));

  // 1. Solid wire grid lines (woven criss-cross pattern and perimeter seam border)
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = wireWidth;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  ctx.strokeRect(0, 0, size, size);

  // 2. Subtle specular wire crown line for realistic metallic thread luster
  ctx.strokeStyle = "#4a525d";
  ctx.lineWidth = Math.max(2, Math.round(wireWidth * 0.28));
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.2, // Discards transparent openings; writes solid wire to depth and transmission passes
    depthWrite: true,
    depthTest: true,
    opacity: 0.98,
    roughness: 0.35,
    metalness: 0.75,
    side: THREE.DoubleSide,
  });

  material.userData.repeatX = repeatX;
  material.userData.repeatY = repeatY;
  material.userData.wirePitchMm = wirePitchMm;

  return material;
}

/**
 * Specialized architectural metal material for security window grills (IMP-MS68).
 */
export function createGrillMaterial(finishColor?: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: finishColor ? new THREE.Color(finishColor) : new THREE.Color(0x221d1a),
    metalness: 0.4,
    roughness: 0.5,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
  });
}


export interface PBRMaterialAttributes {
  color: THREE.Color;
  metalness: number;
  roughness: number;
  transmission?: number;
  opacity?: number;
  transparent?: boolean;
  ior?: number;
}

export function resolvePBRProperties(rawMaterial: RawMaterial | null): PBRMaterialAttributes {
  if (!rawMaterial) {
    return {
      color: new THREE.Color(0x888888),
      metalness: 0.1,
      roughness: 0.5,
    };
  }

  const category = (rawMaterial.category || "").toLowerCase();
  const finish = (rawMaterial.finish_type || "").toLowerCase().trim();

  if (category === "aluminum") {
    switch (finish) {
      case "analok":
        return {
          color: new THREE.Color(0x221d1a), // Deep dark bronze / warm black
          metalness: 0.65,
          roughness: 0.35,
        };
      case "powdercoatedwhite":
      case "powder coated white":
      case "white":
        return {
          color: new THREE.Color(0xf5f6f8), // Clean architectural white
          metalness: 0.05,
          roughness: 0.45,
        };
      case "powdercoatedblack":
      case "powder coated black":
      case "black":
        return {
          color: new THREE.Color(0x1a1a1a),
          metalness: 0.25,
          roughness: 0.45,
        };
      case "anodized":
      case "mill":
      default:
        return {
          color: new THREE.Color(0xd4d8dc), // Natural silver aluminum
          metalness: 0.85,
          roughness: 0.25,
        };
    }
  }

  if (category === "glass") {
    switch (finish) {
      case "bronze":
      case "tinted bronze":
        return {
          color: new THREE.Color(0x4a3b2c),
          metalness: 0.0,
          roughness: 0.05,
          transmission: 0.75,
          opacity: 0.65,
          transparent: true,
          ior: 1.52,
        };
      case "blue":
        return {
          color: new THREE.Color(0x386b88),
          metalness: 0.0,
          roughness: 0.05,
          transmission: 0.70,
          opacity: 0.60,
          transparent: true,
          ior: 1.52,
        };
      case "frosted":
        return {
          color: new THREE.Color(0xe6f4f8),
          metalness: 0.0,
          roughness: 0.82,
          transmission: 0.15,
          opacity: 0.82,
          transparent: true,
          ior: 1.45,
        };
      case "clear":
      default:
        return {
          color: new THREE.Color(0xe6f4f8),
          metalness: 0.0,
          roughness: 0.02,
          transmission: 0.92,
          opacity: 0.25,
          transparent: true,
          ior: 1.52,
        };
    }
  }

  if (category === "hardware") {
    return {
      color: new THREE.Color(0x1f2326),
      metalness: 0.70,
      roughness: 0.35,
    };
  }

  return {
    color: new THREE.Color(0x333333),
    metalness: 0.2,
    roughness: 0.6,
  };
}

export function applyPBRToMesh(mesh: THREE.Mesh, rawMaterial: RawMaterial | null): void {
  const pbr = resolvePBRProperties(rawMaterial);
  const isGlass = classifySceneMesh(mesh) === "Glass" || rawMaterial?.category === "Glass";

  if (isGlass) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;

    // Preserve outdoor view texture if assigned
    if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.map) {
      mesh.material.color.copy(pbr.color);
      mesh.material.needsUpdate = true;
      return;
    }

    if (mesh.material instanceof THREE.MeshPhysicalMaterial) {
      mesh.material.color.copy(pbr.color);
      mesh.material.attenuationColor = pbr.color.clone();
      mesh.material.transparent = true;
      mesh.material.transmission = pbr.transmission ?? (mesh.material.transmission > 0 ? mesh.material.transmission : 0.88);
      if (pbr.opacity !== undefined) {
        mesh.material.opacity = pbr.opacity;
      }
      if (pbr.roughness !== undefined && rawMaterial?.category === "Glass") {
        mesh.material.roughness = pbr.roughness;
      }
      if (pbr.ior !== undefined) {
        mesh.material.ior = pbr.ior;
      }
      mesh.material.needsUpdate = true;
      return;
    }

    const oldMat = mesh.material;
    mesh.material = new THREE.MeshPhysicalMaterial({
      color: pbr.color,
      attenuationColor: pbr.color.clone(),
      metalness: pbr.metalness ?? 0.02,
      roughness: pbr.roughness ?? 0.03,
      transmission: pbr.transmission ?? 0.88,
      opacity: pbr.opacity ?? 0.18,
      transparent: true,
      ior: pbr.ior ?? 1.52,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    if (Array.isArray(oldMat)) {
      oldMat.forEach((m) => m.dispose());
    } else {
      oldMat.dispose();
    }
    return;
  }

  if (mesh.material instanceof THREE.MeshPhysicalMaterial) {
    mesh.material.color.copy(pbr.color);
    mesh.material.metalness = pbr.metalness;
    mesh.material.roughness = pbr.roughness;
    mesh.material.transmission = pbr.transmission ?? 0;
    mesh.material.opacity = pbr.opacity ?? 1.0;
    mesh.material.transparent = Boolean(pbr.transparent || (pbr.opacity !== undefined && pbr.opacity < 1.0));
    mesh.material.ior = pbr.ior ?? 1.5;
    mesh.material.needsUpdate = true;
  } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
    if (pbr.transmission !== undefined && pbr.transmission > 0) {
      const oldMat = mesh.material;
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: pbr.color,
        metalness: pbr.metalness,
        roughness: pbr.roughness,
        transmission: pbr.transmission,
        opacity: pbr.opacity ?? 1.0,
        transparent: Boolean(pbr.transparent || (pbr.opacity !== undefined && pbr.opacity < 1.0)),
        ior: pbr.ior ?? 1.52,
        side: THREE.DoubleSide,
        depthWrite: pbr.opacity !== undefined && pbr.opacity < 0.5 ? false : true,
      });
      oldMat.dispose();
    } else {
      mesh.material.color.copy(pbr.color);
      mesh.material.metalness = pbr.metalness;
      mesh.material.roughness = pbr.roughness;
      mesh.material.opacity = pbr.opacity ?? 1.0;
      mesh.material.transparent = Boolean(pbr.transparent);
      mesh.material.needsUpdate = true;
    }
  } else {
    mesh.material = new THREE.MeshPhysicalMaterial({
      color: pbr.color,
      metalness: pbr.metalness,
      roughness: pbr.roughness,
      transmission: pbr.transmission ?? 0,
      opacity: pbr.opacity ?? 1.0,
      transparent: Boolean(pbr.transparent),
      ior: pbr.ior ?? 1.5,
      side: THREE.DoubleSide,
    });
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

