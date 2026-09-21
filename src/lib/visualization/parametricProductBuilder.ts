"use client";

import * as THREE from "three";
import type { ComponentModelCache } from "./componentModelCache";
import { normalizeComponentKey } from "./structuralResolver";
import {
  applyPresentationMaterials,
  createMaterialPalette,
  createWindowGlassMaterial,
} from "./materialClassifier";
import { normalizeAluminumFinish } from "./colorVariations";

export { createWindowGlassMaterial, createMaterialPalette };
import type {
  GlassAppearanceMode,
  GlassColorKey,
  GlassThicknessMm,
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
  glassColor?: GlassColorKey;
  glassThicknessMm?: GlassThicknessMm;
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

  const isWindowProductType = (definition.product?.productType || "").toLowerCase().includes("window");
  const hasWindowKeys = [
    "frame-left",
    "frame-right",
    "frame-top",
    "frame-bottom",
    "glass-panel",
  ].every((key) => componentsByKey.has(key));

  if (isWindowProductType && hasWindowKeys) {
    return {
      group: buildWindowLikeProduct(definition, resolved, cache, componentsByKey, options),
      resolved,
    };
  }

  return {
    group: buildAssembledProduct(definition, resolved, cache, options),
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

  applyPresentationMaterials(group, {
    aluminumFinish: normalizeAluminumFinish(options.alumFinish),
    glassAppearance: options.glassAppearance ?? "frosted",
    glassColor: options.glassColor ?? "clear",
    glassThicknessMm: options.glassThicknessMm ?? 6,
  });
  group.userData.productId = definition.product.productId;
  group.userData.templateId = definition.template.templateId;
  group.userData.resolvedStructure = resolved;

  return group;
}

function findDimensionMm(resolved: ResolvedStructure, keys: string[]): number | null {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(resolved.numericValuesMm)) {
      if (k.toLowerCase() === lower && typeof v === "number" && Number.isFinite(v) && v > 0) {
        return v;
      }
    }
    for (const [k, v] of Object.entries(resolved.resolvedValues)) {
      if (k.toLowerCase() === lower) {
        const num = toNumber(v, 0);
        if (num > 0) return num;
      }
    }
  }
  return null;
}

function buildAssembledProduct(
  definition: ProductStructuralDefinition,
  resolved: ResolvedStructure,
  cache: ComponentModelCache,
  options: ParametricProductBuilderOptions,
) {
  const group = new THREE.Group();
  group.name = "GeneratedProduct";

  const includeSill =
    options.includeSill !== undefined
      ? Boolean(options.includeSill)
      : (
        readBoolean(resolved.resolvedValues.includeSill, true) &&
        readBoolean(resolved.resolvedValues.include_sill, true) &&
        readBoolean(resolved.resolvedValues.has_sill, true) &&
        readBoolean(resolved.resolvedValues.hasSill, true)
      );

  // Natural Assembly: Place each component at its modeled origin
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
    if (quantity <= 0) continue;

    const clone = cache.getClone(component.componentId);
    clone.name = component.componentName;
    clone.userData.componentKey = component.componentKey;
    clone.userData.componentId = component.componentId;
    clone.userData.componentName = component.componentName;
    clone.userData.componentType = component.componentType;
    clone.userData.presentationCategory = component.presentationCategory;
    clone.userData.rawMaterialId = component.rawMaterialId ?? null;
    clone.userData.rawMaterialCategory = component.rawMaterial?.category ?? null;
    clone.userData.rawMaterial = component.rawMaterial ?? null;
    group.add(clone);
  }

  recenterChildAtOrigin(group);

  // Apply parametric scaling based on resolved width, height, and depth
  group.updateMatrixWorld(true);
  const naturalBounds = new THREE.Box3().setFromObject(group);
  const naturalSize = new THREE.Vector3();
  naturalBounds.getSize(naturalSize);

  const targetWidthMm = findDimensionMm(resolved, ["width", "quotation_width", "quotationWidth", "w"]);
  const targetHeightMm = findDimensionMm(resolved, ["height", "quotation_height", "quotationHeight", "h"]);
  const targetDepthMm = findDimensionMm(resolved, ["depth", "quotation_depth", "quotationDepth", "d"]);

  const scaleX = targetWidthMm && naturalSize.x > 0.0001
    ? (targetWidthMm / 1000) / naturalSize.x
    : 1;

  const scaleY = targetHeightMm && naturalSize.y > 0.0001
    ? (targetHeightMm / 1000) / naturalSize.y
    : 1;

  const scaleZ = targetDepthMm && naturalSize.z > 0.0001
    ? (targetDepthMm / 1000) / naturalSize.z
    : 1;

  group.scale.set(scaleX, scaleY, scaleZ);

  applyPresentationMaterials(group, {
    aluminumFinish: normalizeAluminumFinish(options.alumFinish),
    glassAppearance: options.glassAppearance ?? "frosted",
    glassColor: options.glassColor ?? "clear",
    glassThicknessMm: options.glassThicknessMm ?? 6,
  });

  group.userData.productId = definition.product.productId;
  group.userData.templateId = definition.template.templateId;
  group.userData.resolvedStructure = resolved;

  return group;
}

// Retain alias for backward compatibility
export const buildStackedProduct = buildAssembledProduct;

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
  wrapper.userData.componentType = component.componentType;
  wrapper.userData.presentationCategory = component.presentationCategory;
  wrapper.userData.rawMaterialId = component.rawMaterialId ?? null;
  wrapper.userData.rawMaterialCategory = component.rawMaterial?.category ?? null;
  wrapper.userData.rawMaterial = component.rawMaterial ?? null;

  clone.name = `${name}_Source`;
  clone.userData.componentKey = component.componentKey;
  clone.userData.componentId = component.componentId;
  clone.userData.componentName = component.componentName;
  clone.userData.componentType = component.componentType;
  clone.userData.presentationCategory = component.presentationCategory;
  clone.userData.rawMaterialId = component.rawMaterialId ?? null;
  clone.userData.rawMaterialCategory = component.rawMaterial?.category ?? null;
  clone.userData.rawMaterial = component.rawMaterial ?? null;

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
