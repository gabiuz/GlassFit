"use client";

import * as THREE from "three";
import type { ComponentModelCache } from "./componentModelCache";
import { normalizeComponentKey } from "./structuralResolver";
import type {
  GlassAppearanceMode,
  ProductComponentDefinition,
  ProductStructuralDefinition,
  ResolvedStructure,
} from "./types";

const mmToMeters = (valueMm: number) => valueMm / 1000;

export type BuiltParametricProduct = {
  group: THREE.Group;
  resolved: ResolvedStructure;
};

export interface ParametricProductBuilderOptions {
  glassAppearance?: GlassAppearanceMode;
  includeSill?: boolean;
  alumFinish?: string;
}

export function buildParametricProduct(
  definition: ProductStructuralDefinition,
  resolved: ResolvedStructure,
  cache: ComponentModelCache,
  options: ParametricProductBuilderOptions = {},
): BuiltParametricProduct {
  const componentsByKey = new Map(
    definition.components.map((component) => [
      normalizeComponentKey(component.componentKey),
      component,
    ]),
  );

  const hasWindowKeys = [
    "frame-left",
    "frame-right",
    "frame-top",
    "frame-bottom",
    "glass-panel",
  ].every((key) => componentsByKey.has(key));

  if (hasWindowKeys) {
    return {
      group: buildWindowLikeProduct(definition, resolved, cache, componentsByKey, options),
      resolved,
    };
  }

  return {
    group: buildStackedProduct(definition, resolved, cache, options),
    resolved,
  };
}

function buildWindowLikeProduct(
  definition: ProductStructuralDefinition,
  resolved: ResolvedStructure,
  cache: ComponentModelCache,
  componentsByKey: Map<string, ProductComponentDefinition>,
  options: ParametricProductBuilderOptions,
) {
  const group = new THREE.Group();
  const frame = new THREE.Group();
  const mullions = new THREE.Group();
  const glass = new THREE.Group();
  const accessories = new THREE.Group();

  group.name = "GeneratedProduct";
  frame.name = "Frame";
  mullions.name = "Mullions";
  glass.name = "Glass";
  accessories.name = "Accessories";
  group.add(frame, mullions, glass, accessories);

  const profile = resolveWindowProfile(definition, componentsByKey, cache);
  const widthMm = Math.max(
    resolved.numericValuesMm.width ?? profile.defaultWidthMm,
    profile.leftFrameWidthMm + profile.rightFrameWidthMm + profile.mullionWidthMm + 160,
  );
  const heightMm = Math.max(
    resolved.numericValuesMm.height ?? profile.defaultHeightMm,
    profile.topFrameHeightMm + profile.bottomFrameHeightMm + 160,
  );
  const explicitMullionCount = resolved.componentQuantities["frame-center"];
  const explicitGlassCount = resolved.componentQuantities["glass-panel"];
  
  let mullionCount = 0;
  let paneCount = 1;

  if (explicitMullionCount !== undefined && explicitGlassCount !== undefined) {
      mullionCount = explicitMullionCount;
      paneCount = Math.max(1, explicitGlassCount);
  } else if (explicitMullionCount !== undefined) {
      mullionCount = explicitMullionCount;
      paneCount = mullionCount + 1;
  } else if (explicitGlassCount !== undefined) {
      paneCount = Math.max(1, explicitGlassCount);
      mullionCount = Math.max(0, paneCount - 1);
  } else {
      paneCount = Math.max(1, Math.round(toNumber(resolved.resolvedValues.pane_count, 2)));
      mullionCount = Math.max(0, Math.round(toNumber(resolved.resolvedValues.mullion_count, paneCount - 1)));
  }

  // Ensure window structural invariant: pane count must always be at least mullion count + 1
  if (paneCount < mullionCount + 1) {
      paneCount = mullionCount + 1;
  }

  const innerWidthMm =
    widthMm -
    profile.leftFrameWidthMm -
    profile.rightFrameWidthMm -
    mullionCount * profile.mullionWidthMm;
  const innerHeightMm =
    heightMm - profile.topFrameHeightMm - profile.bottomFrameHeightMm;
  const paneWidthMm = Math.max(80, innerWidthMm / paneCount);
  const horizontalFrameWidthMm =
    widthMm - profile.leftFrameWidthMm - profile.rightFrameWidthMm;
  const glassTargetWidthMm = Math.max(
    80,
    paneWidthMm - profile.horizontalClearanceMm * 2,
  );
  const glassTargetHeightMm = Math.max(
    80,
    innerHeightMm - profile.verticalClearanceMm * 2,
  );

  frame.add(
    createPart("Frame_Left", required(componentsByKey, "frame-left"), cache, {
      xMm: -widthMm / 2 + profile.leftFrameWidthMm / 2,
      yMm: 0,
      zMm: 0,
      targetHeightMm: heightMm,
    }),
    createPart("Frame_Right", required(componentsByKey, "frame-right"), cache, {
      xMm: widthMm / 2 - profile.rightFrameWidthMm / 2,
      yMm: 0,
      zMm: 0,
      targetHeightMm: heightMm,
    }),
    createPart("Frame_Top", required(componentsByKey, "frame-top"), cache, {
      xMm: 0,
      yMm: heightMm / 2 - profile.topFrameHeightMm / 2,
      zMm: 0,
      targetWidthMm: horizontalFrameWidthMm,
    }),
    createPart("Frame_Bottom", required(componentsByKey, "frame-bottom"), cache, {
      xMm: 0,
      yMm: -heightMm / 2 + profile.bottomFrameHeightMm / 2,
      zMm: 0,
      targetWidthMm: horizontalFrameWidthMm,
    }),
  );

  const frameCenter = componentsByKey.get("frame-center");
  if (frameCenter) {
    for (let index = 0; index < mullionCount; index += 1) {
      const xMm =
        -widthMm / 2 +
        profile.leftFrameWidthMm +
        paneWidthMm * (index + 1) +
        profile.mullionWidthMm * index +
        profile.mullionWidthMm / 2;

      mullions.add(
        createPart(`Mullion_${index + 1}`, frameCenter, cache, {
          xMm,
          yMm: 0,
          zMm: profile.glassDepthMm * 0.4,
          targetHeightMm: innerHeightMm,
        }),
      );
    }
  }

  const glassPanel = required(componentsByKey, "glass-panel");
  for (let index = 0; index < paneCount; index += 1) {
    const xMm =
      -widthMm / 2 +
      profile.leftFrameWidthMm +
      paneWidthMm * index +
      profile.mullionWidthMm * index +
      paneWidthMm / 2;

    glass.add(
      createPart(`Glass_${index + 1}`, glassPanel, cache, {
        xMm,
        yMm: 0,
        zMm: -profile.glassDepthMm * 0.8,
        targetWidthMm: glassTargetWidthMm,
        targetHeightMm: glassTargetHeightMm,
        targetDepthMm: profile.glassDepthMm,
      }),
    );
  }

  const sill =
    componentsByKey.get("window-sill") ||
    componentsByKey.get("sill") ||
    Array.from(componentsByKey.values()).find(
      (c) =>
        normalizeComponentKey(c.componentKey).includes("sill") ||
        (c.togglePropertyKey && c.togglePropertyKey.toLowerCase().includes("sill")) ||
        c.componentName.toLowerCase().includes("sill")
    );

  const includeSill =
    options.includeSill !== undefined
      ? Boolean(options.includeSill)
      : (
          readBoolean(resolved.resolvedValues.includeSill, true) &&
          readBoolean(resolved.resolvedValues.include_sill, true) &&
          readBoolean(resolved.resolvedValues.has_sill, true) &&
          readBoolean(resolved.resolvedValues.hasSill, true)
        );

  if (
    includeSill &&
    sill &&
    (resolved.componentQuantities[normalizeComponentKey(sill.componentKey)] ?? sill.baseQuantity) > 0
  ) {
    accessories.add(
      createPart("Window_Sill", sill, cache, {
        xMm: 0,
        yMm: -heightMm / 2 - profile.sillHeightMm / 2,
        zMm: profile.glassDepthMm * 1.5,
        targetWidthMm: widthMm,
      }),
    );
  }

  applyGeneratedMaterials(group, options.glassAppearance ?? "frosted", options.alumFinish);
  group.userData.productId = definition.product.productId;
  group.userData.templateId = definition.template.templateId;
  group.userData.resolvedStructure = resolved;

  return group;
}

function buildStackedProduct(
  definition: ProductStructuralDefinition,
  resolved: ResolvedStructure,
  cache: ComponentModelCache,
  options: ParametricProductBuilderOptions,
) {
  const group = new THREE.Group();
  group.name = "GeneratedProduct";
  let cursorX = 0;

  const includeSill =
    options.includeSill !== undefined
      ? Boolean(options.includeSill)
      : (
          readBoolean(resolved.resolvedValues.includeSill, true) &&
          readBoolean(resolved.resolvedValues.include_sill, true) &&
          readBoolean(resolved.resolvedValues.has_sill, true) &&
          readBoolean(resolved.resolvedValues.hasSill, true)
        );

  for (const component of definition.components) {
    const key = normalizeComponentKey(component.componentKey);
    const isSill =
      key.includes("sill") ||
      component.componentName.toLowerCase().includes("sill") ||
      (component.togglePropertyKey && component.togglePropertyKey.toLowerCase().includes("sill"));

    if (isSill && !includeSill) {
      continue;
    }

    const quantity = Math.max(0, Math.round(resolved.componentQuantities[key] ?? component.baseQuantity));

    for (let index = 0; index < quantity; index += 1) {
      const part = createPart(`${component.componentName}_${index + 1}`, component, cache, {
        xMm: cursorX,
        yMm: 0,
        zMm: 0,
      });
      const size = cache.getSourceSizeMeters(component.componentId);
      cursorX += size.x * 1000 + 40;
      group.add(part);
    }
  }

  recenterChildAtOrigin(group);
  applyGeneratedMaterials(group, options.glassAppearance ?? "frosted", options.alumFinish);
  return group;
}

type PartOptions = {
  xMm: number;
  yMm: number;
  zMm: number;
  targetWidthMm?: number;
  targetHeightMm?: number;
  targetDepthMm?: number;
};

function createPart(
  name: string,
  component: ProductComponentDefinition,
  cache: ComponentModelCache,
  options: PartOptions,
) {
  const wrapper = new THREE.Group();
  const clone = cache.getClone(component.componentId);
  const sourceSize = cache.getSourceSizeMeters(component.componentId);

  wrapper.name = name;
  wrapper.userData.componentKey = component.componentKey;
  wrapper.userData.componentId = component.componentId;
  wrapper.userData.componentName = component.componentName;
  clone.name = `${name}_Source`;
  clone.userData.componentKey = component.componentKey;
  clone.userData.componentId = component.componentId;
  clone.userData.componentName = component.componentName;
  recenterChildAtOrigin(clone);
  wrapper.add(clone);
  wrapper.position.set(
    mmToMeters(options.xMm),
    mmToMeters(options.yMm),
    mmToMeters(options.zMm),
  );
  wrapper.scale.set(
    getScale(mmToMeters(options.targetWidthMm ?? 0), sourceSize.x),
    getScale(mmToMeters(options.targetHeightMm ?? 0), sourceSize.y),
    getScale(mmToMeters(options.targetDepthMm ?? 0), sourceSize.z),
  );

  return wrapper;
}

function resolveWindowProfile(
  definition: ProductStructuralDefinition,
  componentsByKey: Map<string, ProductComponentDefinition>,
  cache: ComponentModelCache,
) {
  const profile = readRecord(definition.template.baseConfiguration.profile);
  const clearance = readRecord(definition.template.baseConfiguration.clearance);

  return {
    defaultWidthMm: toNumber(definition.template.baseConfiguration.width, 2100),
    defaultHeightMm: toNumber(definition.template.baseConfiguration.height, 1500),
    leftFrameWidthMm: readProfileNumber(profile, "leftFrameWidthMm", componentWidthMm("frame-left")),
    rightFrameWidthMm: readProfileNumber(profile, "rightFrameWidthMm", componentWidthMm("frame-right")),
    topFrameHeightMm: readProfileNumber(profile, "topFrameHeightMm", componentHeightMm("frame-top")),
    bottomFrameHeightMm: readProfileNumber(profile, "bottomFrameHeightMm", componentHeightMm("frame-bottom")),
    mullionWidthMm: readProfileNumber(profile, "mullionWidthMm", componentWidthMm("frame-center")),
    glassDepthMm: readProfileNumber(profile, "glassDepthMm", componentDepthMm("glass-panel")),
    sillHeightMm: componentHeightMm("window-sill"),
    horizontalClearanceMm: readProfileNumber(clearance, "horizontalMm", 4),
    verticalClearanceMm: readProfileNumber(clearance, "verticalMm", 4),
  };

  function componentWidthMm(key: string) {
    return componentSizeMm(key, "x", key === "frame-center" ? 80 : 120);
  }

  function componentHeightMm(key: string) {
    return componentSizeMm(key, "y", key === "window-sill" ? 100 : 120);
  }

  function componentDepthMm(key: string) {
    return componentSizeMm(key, "z", key === "glass-panel" ? 20 : 120);
  }

  function componentSizeMm(key: string, axis: "x" | "y" | "z", fallback: number) {
    const component = componentsByKey.get(key);
    if (!component) {
      return fallback;
    }

    return Math.max(1, cache.getSourceSizeMeters(component.componentId)[axis] * 1000);
  }
}

function applyGeneratedMaterials(
  group: THREE.Group, 
  glassAppearance: GlassAppearanceMode,
  alumFinish?: string
) {
  const isBlack = alumFinish === "black";
  const isWhite = alumFinish === "white";
  const isSilver = alumFinish === "silver";
  const isBronze = alumFinish === "bronze";
  
  // Real architectural finishes with specular sheen to highlight 3D chamfers and bevels
  const frameColor = isBlack
    ? 0x232527 // Dark anodized architectural charcoal
    : isWhite
      ? 0xeceae4 // Architectural powder-coated white, prevents chalky blowout
      : isSilver
        ? 0xc8cbce // Natural anodized silver
        : isBronze
          ? 0x3e332b // Architectural bronze
          : 0x232527;

  const frameMetalness = isWhite
    ? 0.08
    : isSilver
      ? 0.85
      : isBronze
        ? 0.55
        : 0.45;

  const frameRoughness = isBlack
    ? 0.28
    : isWhite
      ? 0.32
      : isSilver
        ? 0.22
        : 0.26;

  const frameClearcoat = isWhite
    ? 0.35
    : isSilver
      ? 0.60
      : isBronze
        ? 0.45
        : 0.40;

  const frameClearcoatRoughness = isWhite
    ? 0.25
    : isSilver
      ? 0.15
      : isBronze
        ? 0.20
        : 0.20;

  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: frameColor,
    metalness: frameMetalness,
    roughness: frameRoughness,
    clearcoat: frameClearcoat,
    clearcoatRoughness: frameClearcoatRoughness,
  });
  const glassMaterial = createWindowGlassMaterial(glassAppearance);

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.castShadow = true;
    object.receiveShadow = true;

    const text = [object.name, object.parent?.name].join(" ").toLowerCase();
    object.material = text.includes("glass")
      ? glassMaterial.clone()
      : frameMaterial.clone();
  });

  frameMaterial.dispose();
  glassMaterial.dispose();
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

function createWindowGlassMaterial(mode: GlassAppearanceMode) {
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
        reflectivity: 0.50,
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


function recenterChildAtOrigin(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  object.position.sub(center);
  object.updateMatrixWorld(true);
}

function getScale(targetMeters: number, sourceMeters: number) {
  if (!targetMeters || !sourceMeters) {
    return 1;
  }

  return targetMeters / sourceMeters;
}

function required(
  componentsByKey: Map<string, ProductComponentDefinition>,
  key: string,
) {
  const component = componentsByKey.get(key);
  if (!component) {
    throw new Error(`Missing structural component ${key}.`);
  }

  return component;
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function readProfileNumber(
  profile: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  return toNumber(profile[key], fallback);
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}
