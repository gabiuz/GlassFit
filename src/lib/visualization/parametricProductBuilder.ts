"use client";

import * as THREE from "three";
import type { ComponentModelCache } from "./componentModelCache";
import { normalizeComponentKey } from "./structuralResolver";
import {
  applyPresentationMaterials,
  createMaterialPalette,
  createWindowGlassMaterial,
  createInsectScreenMaterial,
} from "./materialClassifier";
import { normalizeAluminumFinish } from "./colorVariations";
import {
  buildParametricScreenGroup,
  buildParametricGrillGroup,
  buildDynamicGrillPatternGroup,
  type AddonGeometryConfig,
} from "./addonGeometryBuilder";

import { calculateGrilleLinearBOM } from "../pricing/grillePricingEngine";
import type { GrilleLinearBOMResult } from "../pricing/types";
import type { AccessoryPositionOptions } from "@/lib/admin/products/types";
import type { SelectedAccessoryState } from "./types";
import { createAccessoryMeshById } from "./accessoryMeshFactory";
import { mirrorObjectHierarchyAcrossX, mirrorPartAcrossCenterline } from "@/lib/admin/products/meshMirroring";

export {
  createWindowGlassMaterial,
  createMaterialPalette,
  createInsectScreenMaterial,
  buildDynamicGrillPatternGroup,
};
export type { AddonGeometryConfig };
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
  activeAddon?: "screen" | "grill" | "none" | null;
  addonProductId?: string | null;
  addonAluminumFinish?: string;
  addonConfig?: AddonGeometryConfig;
  grilleBOM?: GrilleLinearBOMResult;
  swappedAccessories?: Record<string, SelectedAccessoryState>;
  accessoryModels?: Map<string, THREE.Object3D>;
  removableStates?: Record<string, boolean>;
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

  // If this product is a modular security grill add-on (e.g. authoring/validating in admin sandbox):
  if (definition.product.isAddon && definition.product.addonType === "grill") {
    const targetWidthMm = findDimensionMm(resolved, ["width", "quotation_width", "quotationWidth", "w"]) ?? 1200;
    const targetHeightMm = findDimensionMm(resolved, ["height", "quotation_height", "quotationHeight", "h"]) ?? 1200;
    const frameMat = createMaterialPalette(options.addonAluminumFinish ?? options.alumFinish ?? "analok").framing;
    const group = buildGrillAssembly(
      definition.components,
      targetWidthMm,
      targetHeightMm,
      cache,
      options,
      frameMat,
    );
    return {
      group,
      resolved,
    };
  }

  return {
    group: buildAssembledProduct(definition, resolved, cache, options),
    resolved,
  };
}

/**
 * Resolves a PBR finish material for metallic and coated hardware.
 * Traceability: PRD-F2, SDD-C5, IMP-MS76, QAD-TC91.5
 */
export function createHardwareFinishMaterial(finishKey: string): THREE.MeshStandardMaterial {
  const lower = (finishKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (lower.includes("brass") || lower.includes("gold") || lower.includes("satinbrass")) {
    return new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.35,
    });
  }
  if (lower.includes("black") || lower.includes("matteblack") || lower.includes("analok")) {
    return new THREE.MeshStandardMaterial({
      color: 0x18191a,
      metalness: 0.3,
      roughness: 0.75,
    });
  }
  if (lower.includes("chrome") || lower.includes("silver") || lower.includes("steel") || lower.includes("stainless")) {
    return new THREE.MeshStandardMaterial({
      color: 0xd2d6dc,
      metalness: 0.9,
      roughness: 0.22,
    });
  }
  if (lower.includes("white")) {
    return new THREE.MeshStandardMaterial({
      color: 0xf3f4f6,
      metalness: 0.15,
      roughness: 0.45,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: 0x22262a,
    metalness: 0.7,
    roughness: 0.35,
  });
}

/**
 * Creates procedural 3D geometry for modular accessories when external GLB models are not uploaded.
 * Supports ergonomic lever handles, round knobs, and biometric smart locks.
 * Traceability: PRD-F5, SDD-C4, IMP-MS76, QAD-TC91.2
 */
export function createProceduralAccessoryMesh(
  category: string,
  modelName: string,
  finishKey: string = "matte_black",
): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `ProceduralAccessory_${modelName}`;
  const mat = createHardwareFinishMaterial(finishKey);
  const lower = (modelName + " " + category).toLowerCase();

  if (lower.includes("smart") || lower.includes("electric") || lower.includes("digital") || lower.includes("keyless")) {
    // Smart Digital Lock: tall keypad escutcheon + handle lever
    const bodyGeom = new THREE.BoxGeometry(0.065, 0.28, 0.025);
    const bodyMesh = new THREE.Mesh(bodyGeom, mat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Keypad screen plate (glossy dark)
    const keypadGeom = new THREE.BoxGeometry(0.05, 0.12, 0.004);
    const keypadMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.1, metalness: 0.9 });
    const keypadMesh = new THREE.Mesh(keypadGeom, keypadMat);
    keypadMesh.position.set(0, 0.06, 0.014);
    group.add(keypadMesh);

    // Integrated lever handle
    const leverStemGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.035, 16);
    leverStemGeom.rotateX(Math.PI / 2);
    const leverStem = new THREE.Mesh(leverStemGeom, mat);
    leverStem.position.set(0, -0.04, 0.025);
    group.add(leverStem);

    const leverArmGeom = new THREE.BoxGeometry(0.12, 0.02, 0.015);
    const leverArm = new THREE.Mesh(leverArmGeom, mat);
    leverArm.position.set(0.05, -0.04, 0.04);
    leverArm.castShadow = true;
    group.add(leverArm);
  } else if (lower.includes("knob")) {
    // Round Privacy Doorknob: round rosette plate + spherical knob
    const rosetteGeom = new THREE.CylinderGeometry(0.038, 0.038, 0.008, 24);
    rosetteGeom.rotateX(Math.PI / 2);
    const rosette = new THREE.Mesh(rosetteGeom, mat);
    rosette.castShadow = true;
    group.add(rosette);

    const stemGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.025, 16);
    stemGeom.rotateX(Math.PI / 2);
    const stem = new THREE.Mesh(stemGeom, mat);
    stem.position.set(0, 0, 0.015);
    group.add(stem);

    const knobGeom = new THREE.SphereGeometry(0.026, 24, 16);
    const knob = new THREE.Mesh(knobGeom, mat);
    knob.position.set(0, 0, 0.035);
    knob.castShadow = true;
    group.add(knob);
  } else if (lower.includes("roller") || lower.includes("wheel")) {
    // Roller: housing bracket + small wheel
    const housingGeom = new THREE.BoxGeometry(0.08, 0.025, 0.018);
    const housing = new THREE.Mesh(housingGeom, mat);
    group.add(housing);

    const wheelGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.012, 20);
    wheelGeom.rotateZ(Math.PI / 2);
    const wheel = new THREE.Mesh(wheelGeom, mat);
    wheel.position.set(0, -0.01, 0);
    group.add(wheel);
  } else {
    // Standard Door Lever Handle: escutcheon plate + stem + horizontal lever
    const plateGeom = new THREE.BoxGeometry(0.042, 0.18, 0.01);
    const plate = new THREE.Mesh(plateGeom, mat);
    plate.castShadow = true;
    group.add(plate);

    const stemGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 16);
    stemGeom.rotateX(Math.PI / 2);
    const stem = new THREE.Mesh(stemGeom, mat);
    stem.position.set(0, 0.02, 0.02);
    group.add(stem);

    const leverGeom = new THREE.BoxGeometry(0.12, 0.018, 0.014);
    const lever = new THREE.Mesh(leverGeom, mat);
    lever.position.set(0.05, 0.02, 0.035);
    lever.castShadow = true;
    group.add(lever);
  }

  return group;
}

/**
 * Mounts and transforms an accessory mesh to a host product assembly.
 * Strictly enforces lateral X-axis translation for Left/Right handings
 * and vertical Y-axis translation for Bottom/Up elevations.
 * Traceability: PRD-F2, PRD-F5, SDD-C4, IMP-MS76, QAD-TC91.2, QAD-TC91.3, QAD-TC91.4, QAD-TC91.5
 */
export function mountAccessoryMesh(
  parentGroup: THREE.Group,
  accessoryModel: THREE.Object3D,
  hostBounds: { widthM: number; heightM: number; depthM: number },
  positionOptions?: AccessoryPositionOptions | null,
  horizontal: "left" | "right" = "right",
  vertical: "bottom" | "up" = "up",
  finishKey: string = "matte_black",
  handingVariantMesh?: THREE.Object3D | null,
  sourceHanding?: "left" | "right" | null,
): THREE.Object3D {
  // Support callers passing (accessoryModel, parentGroup) or (parentGroup, accessoryModel)
  let actualParent = parentGroup;
  let actualModel = accessoryModel;
  if (
    parentGroup &&
    parentGroup.children.length > 0 &&
    accessoryModel &&
    accessoryModel.children.length === 0 &&
    !(accessoryModel as THREE.Mesh).geometry
  ) {
    actualParent = accessoryModel as THREE.Group;
    actualModel = parentGroup;
  }

  // If a dedicated handed variant is provided, use it; otherwise evaluate bilateral reflection
  let targetModel = handingVariantMesh;
  if (!targetModel) {
    const baseHanding = sourceHanding ?? positionOptions?.defaultHorizontal ?? "right";
    if (horizontal !== baseHanding) {
      targetModel = mirrorObjectHierarchyAcrossX(actualModel);
    } else {
      targetModel = actualModel;
    }
  }

  const clone = targetModel.clone(true);

  // Apply PBR finish material (Matte Black, Brushed Chrome, Satin Brass, Stainless Steel, etc.)
  const hardwareMaterial = createHardwareFinishMaterial(finishKey);
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = hardwareMaterial;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Calculate strict lateral X-axis coordinate for Left vs Right handings
  const lateralMarginM = (positionOptions?.horizontalOffsetMm ?? 45) / 1000;
  const targetXM = horizontal === "left"
    ? -hostBounds.widthM / 2 + lateralMarginM
    : hostBounds.widthM / 2 - lateralMarginM;

  // Calculate strict vertical Y-axis coordinate for Bottom vs Up elevations
  const verticalMarginM = (positionOptions?.verticalOffsetMm ?? 1000) / 1000;
  const targetYM = vertical === "bottom"
    ? -hostBounds.heightM / 2 + verticalMarginM
    : hostBounds.heightM * 0.05; // Standard mid-height elevation

  // Maintain Z depth flush to the front surface of the door stile
  const targetZM = hostBounds.depthM / 2 + 0.002;

  // Apply translation matrix
  clone.position.set(targetXM, targetYM, targetZM);

  // Zero out rotation: geometry is already correctly handed without 180-degree yaw flip (IMP-MS78)
  clone.rotation.set(0, 0, 0);

  actualParent.add(clone);
  return clone;
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

  // Explicit Render Order Contract (IMP-MS70)
  // Window glass panels render at renderOrder = 1 after opaque framing & transmission passes
  glass.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.renderOrder = 1;
    }
  });
  frame.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.renderOrder = 0;
    }
  });
  mullions.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.renderOrder = 0;
    }
  });

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

  const isSillExcluded = Boolean(
    sill && options.removableStates && (
      options.removableStates[sill.componentId] === false ||
      options.removableStates[sill.componentKey] === false ||
      (sill.togglePropertyKey && options.removableStates[sill.togglePropertyKey] === false)
    )
  );

  if (
    includeSill &&
    !isSillExcluded &&
    sill &&
    (resolved.componentQuantities[normalizeComponentKey(sill.componentKey)] ?? sill.baseQuantity) > 0
  ) {
    const sillMesh = createPart("Window_Sill", sill, cache, {
      xMm: 0,
      yMm: -heightMm / 2 - profile.sillHeightMm / 2,
      zMm: profile.glassDepthMm * 1.5,
      targetWidthMm: widthMm,
    });
    sillMesh.renderOrder = 0;
    accessories.add(sillMesh);
  }

  // Attach procedural or uploaded front-layer add-on if active (IMP-MS68, IMP-MS69, IMP-MS70)
  if (options.activeAddon === "screen" || options.activeAddon === "grill") {
    const addonGroup = buildAddonAttachment(definition, widthMm, heightMm, cache, options);

    // Compute bounding surfaces of host window components
    group.updateMatrixWorld(true);
    const hostBounds = new THREE.Box3().setFromObject(group);

    addonGroup.updateMatrixWorld(true);
    const addonBounds = new THREE.Box3().setFromObject(addonGroup);

    const isRearMount = options.addonConfig?.mountPosition === "rear" || (options.addonConfig?.zOffsetMm !== undefined && options.addonConfig.zOffsetMm < 0);
    const clearanceGapMeters = 0.008;

    if (isRearMount) {
      // Rear mount: position behind the back-most surface of host window components
      const rearZ = hostBounds.min.z;
      const targetZ = rearZ - addonBounds.max.z - clearanceGapMeters;
      addonGroup.position.set(0, 0, targetZ);
    } else {
      // Front mount: position on front of product with a clear 8mm clearance gap
      const frontZ = hostBounds.max.z;
      const targetZ = frontZ - addonBounds.min.z + clearanceGapMeters;
      addonGroup.position.set(0, 0, targetZ);
    }

    accessories.add(addonGroup);
    group.updateMatrixWorld(true);
  }

  // Mount swapped accessories if active (IMP-MS76)
  if (options.swappedAccessories) {
    for (const [slotId, swapped] of Object.entries(options.swappedAccessories)) {
      if (!swapped || swapped.accessoryId === "default") continue;
      let accMesh = options.accessoryModels?.get(swapped.accessoryId);
      if (!accMesh) {
        try {
          accMesh = cache.getClone(swapped.accessoryId);
        } catch {
          // fallback
        }
      }
      if (!accMesh && (swapped.accessoryId.startsWith("canonical_") || swapped.accessoryId.startsWith("acc_"))) {
        try {
          accMesh = createAccessoryMeshById(swapped.accessoryId);
        } catch {
          // fallback
        }
      }
      if (!accMesh) {
        accMesh = createProceduralAccessoryMesh(swapped.category, swapped.accessoryName, swapped.finish);
      }
      const matchingComp = definition.components.find((c) => c.componentId === slotId || c.componentKey === slotId);
      const posOptions: AccessoryPositionOptions = matchingComp?.positionOptions ??
        ((matchingComp as Record<string, unknown> | undefined)?.position_options as AccessoryPositionOptions | undefined) ?? {
          allowHorizontalToggle: true,
          defaultHorizontal: "right",
          horizontalOffsetMm: 45,
          allowVerticalToggle: swapped.category === "lock",
          defaultVertical: "up",
          verticalOffsetMm: 1000,
        };
      const sourceHanding = swapped.handingMetadata?.sourceHanding ?? matchingComp?.handingMetadata?.sourceHanding ?? null;
      mountAccessoryMesh(
        accessories,
        accMesh,
        { widthM: widthMm / 1000, heightM: heightMm / 1000, depthM: profile.glassDepthMm / 1000 },
        posOptions,
        swapped.horizontalPosition,
        swapped.verticalPosition,
        swapped.finish,
        null,
        sourceHanding,
      );
    }
  }

  accessories.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.renderOrder = 0;
    }
  });


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

  // Natural Assembly: Identify accessory slots and measure host geometry
  const accessorySlotKeys = new Set<string>();
  const hostComponentsBox = new THREE.Box3();
  let hasHostComponents = false;

  for (const component of definition.components) {
    const compIdentity = (
      component.componentKey +
      " " +
      component.componentName +
      " " +
      (component.componentType || "") +
      " " +
      (component.presentationCategory || "")
    ).toLowerCase();

    const isSlot = Boolean(
      component.isAccessorySlot ||
      (component as Record<string, unknown>).is_accessory_slot ||
      compIdentity.includes("handle") ||
      compIdentity.includes("knob") ||
      compIdentity.includes("lever") ||
      compIdentity.includes("smartlock") ||
      compIdentity.includes("lock")
    );

    if (isSlot) {
      accessorySlotKeys.add(component.componentId);
      accessorySlotKeys.add(component.componentKey);
    } else {
      try {
        const cModel = cache.getClone(component.componentId);
        cModel.updateMatrixWorld(true);
        hostComponentsBox.expandByObject(cModel);
        hasHostComponents = true;
      } catch {
        // ignore missing model in measurement pass
      }
    }
  }

  const hostCenterVec = new THREE.Vector3();
  const hostSizeVec = new THREE.Vector3();
  if (hasHostComponents) {
    hostComponentsBox.getCenter(hostCenterVec);
    hostComponentsBox.getSize(hostSizeVec);
  }

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

    const toggleKey = component.togglePropertyKey || `has_${component.componentKey.replace(/-/g, "_")}`;
    const isRemovableExcluded = Boolean(
      (component.isRemovable || component.togglePropertyKey) &&
      (
        (options.removableStates && (
          options.removableStates[component.componentId] === false ||
          options.removableStates[component.componentKey] === false ||
          (component.togglePropertyKey && options.removableStates[component.togglePropertyKey] === false)
        )) ||
        (resolved.resolvedValues[toggleKey] === 0 || resolved.resolvedValues[toggleKey] === false) ||
        (component.togglePropertyKey && (resolved.resolvedValues[component.togglePropertyKey] === 0 || resolved.resolvedValues[component.togglePropertyKey] === false))
      )
    );

    if (isRemovableExcluded) {
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

    const compIdentity = (
      component.componentKey +
      " " +
      component.componentName +
      " " +
      (component.componentType || "") +
      " " +
      (component.presentationCategory || "")
    ).toLowerCase();

    const isScreenMeshComp =
      compIdentity.includes("mesh") ||
      compIdentity.includes("wire") ||
      compIdentity.includes("screen") ||
      component.componentType === "Screen" ||
      component.componentType === "Mesh";

    if (isScreenMeshComp) {
      clone.userData.isScreenMesh = true;
      clone.userData.preserveMaterial = true;
      clone.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.userData.isScreenMesh = true;
          c.userData.preserveMaterial = true;
          c.renderOrder = 0;
          if (c.material) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach((m) => {
              m.depthWrite = true;
              m.side = THREE.DoubleSide;
              if (m.transparent) {
                m.alphaTest = m.alphaTest || 0.2;
              }
            });
          }
        }
      });
    }

    const isAccessorySlot = accessorySlotKeys.has(component.componentId) || accessorySlotKeys.has(component.componentKey);

    const swapped = options.swappedAccessories?.[component.componentId] ??
      options.swappedAccessories?.[component.componentKey] ??
      (isAccessorySlot && options.swappedAccessories ? Object.values(options.swappedAccessories)[0] : undefined);

    const isAlternativeAccessory = Boolean(
      swapped &&
      swapped.accessoryId !== "default" &&
      swapped.accessoryId !== component.componentId
    );

    if (isAccessorySlot) {
      // Measure original handle in its natural modeled position
      clone.updateMatrixWorld(true);
      const origHandleBounds = new THREE.Box3().setFromObject(clone);
      const origHandleCenter = new THREE.Vector3();
      origHandleBounds.getCenter(origHandleCenter);

      const baseCenterX = hasHostComponents ? hostCenterVec.x : 0;
      const deltaX = origHandleCenter.x - baseCenterX;
      const modeledHanding: "left" | "right" = deltaX >= 0 ? "right" : "left";
      const activeHanding: "left" | "right" = swapped?.horizontalPosition ?? component.positionOptions?.defaultHorizontal ?? modeledHanding;

      const targetX = activeHanding === "left" ? (baseCenterX - Math.abs(deltaX)) : (baseCenterX + Math.abs(deltaX));
      const targetY = (component.positionOptions?.allowVerticalToggle && swapped?.verticalPosition === "bottom")
        ? (hostCenterVec.y - hostSizeVec.y * 0.35)
        : origHandleCenter.y;
      const targetZ = origHandleCenter.z;

      if (!isAlternativeAccessory) {
        // Original cabinet handle is active (positioned symmetrically at targetX, targetY, targetZ)
        const mountedHandle = mirrorPartAcrossCenterline(
          clone,
          baseCenterX,
          activeHanding,
          targetY,
          targetZ
        );

        if (swapped?.finish) {
          const hwMat = createHardwareFinishMaterial(swapped.finish);
          mountedHandle.traverse((c) => {
            if (c instanceof THREE.Mesh) c.material = hwMat;
          });
        }
        mountedHandle.userData = { ...clone.userData, isMirroredHanding: activeHanding !== modeledHanding };
        group.add(mountedHandle);
      } else if (swapped) {
        // An active hardware accessory was chosen: replace original cabinet handle
        let accMesh: THREE.Object3D | null = null;
        if (options.accessoryModels) {
          accMesh = options.accessoryModels.get(`${swapped.accessoryId}_${activeHanding}`) ??
            options.accessoryModels.get(swapped.accessoryId) ??
            null;
        }
        if (!accMesh) {
          try {
            accMesh = cache.getClone(swapped.accessoryId);
          } catch {
            // fallback
          }
        }
        if (!accMesh && (swapped.accessoryId.startsWith("canonical_") || swapped.accessoryId.startsWith("acc_"))) {
          try {
            accMesh = createAccessoryMeshById(swapped.accessoryId);
          } catch {
            // fallback
          }
        }
        if (!accMesh) {
          accMesh = createProceduralAccessoryMesh(swapped.category, swapped.accessoryName, swapped.finish);
        }

        const mountedAcc = accMesh.clone(true);

        // 1. Recenter mountedAcc geometry at local (0, 0, 0)
        mountedAcc.updateMatrixWorld(true);
        const curBox = new THREE.Box3().setFromObject(mountedAcc);
        const curCenter = new THREE.Vector3();
        curBox.getCenter(curCenter);
        mountedAcc.position.sub(curCenter);
        mountedAcc.updateMatrixWorld(true);

        const sourceHanding = swapped.handingMetadata?.sourceHanding ??
          component.handingMetadata?.sourceHanding ??
          "right";

        let finalAccMesh: THREE.Object3D = mountedAcc;
        if (activeHanding !== sourceHanding && !options.accessoryModels?.has(`${swapped.accessoryId}_${activeHanding}`)) {
          finalAccMesh = mirrorObjectHierarchyAcrossX(mountedAcc);
          finalAccMesh.updateMatrixWorld(true);
          const postBox = new THREE.Box3().setFromObject(finalAccMesh);
          const postCenter = new THREE.Vector3();
          postBox.getCenter(postCenter);
          finalAccMesh.position.sub(postCenter);
          finalAccMesh.updateMatrixWorld(true);
        }

        const hwMat = createHardwareFinishMaterial(swapped.finish || "satin");
        finalAccMesh.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.material = hwMat;
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });

        // 2. Wrap in container positioned at target coordinates (identical container hierarchy to mirrorPartAcrossCenterline)
        const container = new THREE.Group();
        container.name = `${swapped.accessoryName || "accessory"}_${activeHanding}`;
        container.userData = {
          ...clone.userData,
          componentKey: component.componentKey,
          componentId: component.componentId,
          isAccessoryReplacement: true,
          isMirroredHanding: activeHanding !== sourceHanding,
        };
        container.add(finalAccMesh);
        container.position.set(targetX, targetY, targetZ);
        container.rotation.set(0, 0, 0);
        container.updateMatrixWorld(true);

        group.add(container);
      }
      continue;
    }

    group.add(clone);
  }

  // Recenter assembled product around host structural components (invariant to swappable accessories)
  if (hasHostComponents) {
    group.position.sub(hostCenterVec);
    group.updateMatrixWorld(true);
  } else {
    recenterChildAtOrigin(group);
  }

  // Apply parametric scaling based on host structural components
  group.updateMatrixWorld(true);
  const naturalSize = new THREE.Vector3();
  if (hasHostComponents && hostSizeVec.x > 0.0001 && hostSizeVec.y > 0.0001) {
    naturalSize.copy(hostSizeVec);
  } else {
    const naturalBounds = new THREE.Box3().setFromObject(group);
    naturalBounds.getSize(naturalSize);
  }

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

  // Maintain 1:1 metric scale on hardware accessories and fixed parts
  if (scaleX !== 1 || scaleY !== 1 || scaleZ !== 1) {
    group.children.forEach((child) => {
      if (
        child.userData?.isAccessoryReplacement ||
        (child.userData?.componentId && accessorySlotKeys.has(child.userData.componentId)) ||
        (child.userData?.componentKey && accessorySlotKeys.has(child.userData.componentKey))
      ) {
        child.scale.set(
          scaleX > 0 ? 1 / scaleX : 1,
          scaleY > 0 ? 1 / scaleY : 1,
          scaleZ > 0 ? 1 / scaleZ : 1,
        );
      }
    });
  }

  // Attach procedural or uploaded front-layer add-on if active (IMP-MS68, IMP-MS69)
  if (options.activeAddon === "screen" || options.activeAddon === "grill") {
    const targetW = targetWidthMm ?? (naturalSize.x > 0 ? naturalSize.x * 1000 : 1200);
    const targetH = targetHeightMm ?? (naturalSize.y > 0 ? naturalSize.y * 1000 : 1200);

    const addonGroup = buildAddonAttachment(definition, targetW, targetH, cache, options);

    // Compute front-most surface and geometric center of host assembled product in world coordinates
    group.updateMatrixWorld(true);
    const hostBounds = new THREE.Box3().setFromObject(group);
    const hostCenter = new THREE.Vector3();
    hostBounds.getCenter(hostCenter);
    const frontZ = hostBounds.max.z;

    addonGroup.updateMatrixWorld(true);
    const addonBounds = new THREE.Box3().setFromObject(addonGroup);

    // Position on front of product with an 8mm clearance gap, aligned with host product center
    const clearanceGapMeters = 0.008;
    const localX = scaleX > 0 ? (hostCenter.x - group.position.x) / scaleX : 0;
    const localY = scaleY > 0 ? (hostCenter.y - group.position.y) / scaleY : 0;
    const localZ = scaleZ > 0 ? ((frontZ - group.position.z) - addonBounds.min.z + clearanceGapMeters) / scaleZ : frontZ + clearanceGapMeters;

    // Cancel out parent group scaling so add-on geometry maintains exact metric dimensions
    addonGroup.scale.set(
      scaleX > 0 ? 1 / scaleX : 1,
      scaleY > 0 ? 1 / scaleY : 1,
      scaleZ > 0 ? 1 / scaleZ : 1,
    );
    addonGroup.position.set(localX, localY, localZ);
    group.add(addonGroup);
    group.updateMatrixWorld(true);
  }

  // Mount swapped modular accessories if configured (IMP-MS76)
  if (options.swappedAccessories && Object.keys(options.swappedAccessories).length > 0) {
    const hostBounds = new THREE.Box3().setFromObject(group);
    const hostSize = new THREE.Vector3();
    hostBounds.getSize(hostSize);

    for (const [slotKey, swapped] of Object.entries(options.swappedAccessories)) {
      if (!swapped) continue;
      // Skip slots already mounted during component assembly to prevent duplication
      if (accessorySlotKeys.has(slotKey)) continue;
      const matchingComp = definition.components.find((c) => c.componentId === slotKey || c.componentKey === slotKey);
      if (matchingComp) continue;

      const isDefault = swapped.accessoryId === "default";

      if (!isDefault) {
        let accMesh = options.accessoryModels?.get(swapped.accessoryId);
        if (!accMesh) {
          try {
            accMesh = cache.getClone(swapped.accessoryId);
          } catch {
            // fallback
          }
        }
        if (!accMesh && (swapped.accessoryId.startsWith("canonical_") || swapped.accessoryId.startsWith("acc_"))) {
          try {
            accMesh = createAccessoryMeshById(swapped.accessoryId);
          } catch {
            // fallback
          }
        }
        if (!accMesh) {
          accMesh = createProceduralAccessoryMesh(swapped.category, swapped.accessoryName, swapped.finish);
        }

        const posOptions: AccessoryPositionOptions = {
          allowHorizontalToggle: true,
          defaultHorizontal: "right",
          horizontalOffsetMm: 45,
          allowVerticalToggle: swapped.category === "lock",
          defaultVertical: "up",
          verticalOffsetMm: 1000,
        };

        const sourceHanding = swapped.handingMetadata?.sourceHanding ?? null;
        const mounted = mountAccessoryMesh(
          group,
          accMesh,
          { widthM: hostSize.x || 1.2, heightM: hostSize.y || 2.1, depthM: hostSize.z || 0.08 },
          posOptions,
          swapped.horizontalPosition,
          swapped.verticalPosition,
          swapped.finish,
          null,
          sourceHanding,
        );

        // Cancel out group scaling on mounted accessory so it preserves exact dimensions
        mounted.scale.set(
          scaleX > 0 ? 1 / scaleX : 1,
          scaleY > 0 ? 1 / scaleY : 1,
          scaleZ > 0 ? 1 / scaleZ : 1,
        );
      }
    }
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

function buildAddonAttachment(
  definition: ProductStructuralDefinition,
  targetWidthMm: number,
  targetHeightMm: number,
  cache: ComponentModelCache,
  options: ParametricProductBuilderOptions,
): THREE.Group {
  const addonType = options.activeAddon;
  if (addonType !== "screen" && addonType !== "grill") {
    return new THREE.Group();
  }

  const addonFinish = options.addonAluminumFinish ?? options.alumFinish ?? "analok";
  const frameMat = createMaterialPalette(addonFinish).framing;
  const matchingAddon = definition.compatibleAddons?.find((a) =>
    options.addonProductId ? a.addonProductId === options.addonProductId : a.addonType === addonType
  );

  // Modular security grill add-on: use dedicated assembly with dynamic pattern repetition
  if (addonType === "grill") {
    return buildGrillAssembly(
      matchingAddon?.components ?? [],
      targetWidthMm,
      targetHeightMm,
      cache,
      options,
      frameMat,
    );
  }

  const targetWidthM = targetWidthMm / 1000;
  const targetHeightM = targetHeightMm / 1000;

  // 1. Prefer uploaded custom add-on components if present in catalog and cache
  if (matchingAddon && matchingAddon.components && matchingAddon.components.length > 0) {
    const uploadedGroup = new THREE.Group();
    uploadedGroup.name = `Addon_${addonType === "screen" ? "Screen" : "Grill"}_Assembly_Content`;

    let clonedCount = 0;
    for (const comp of matchingAddon.components) {
      try {
        let clone: THREE.Object3D | null = null;
        try {
          clone = cache.getClone(comp.componentId);
        } catch {
          clone = cache.getClone(comp.componentKey);
        }
        if (clone) {
          clone.name = comp.componentKey || comp.componentName;
          clone.userData.componentKey = comp.componentKey;
          clone.userData.componentName = comp.componentName;
          clone.userData.componentType = comp.componentType;
          clone.userData.presentationCategory = comp.presentationCategory;
          uploadedGroup.add(clone);
          clonedCount++;
        }
      } catch {
        // Component not in cache or missing model
      }
    }

    if (clonedCount > 0) {
      // Measure natural bounds of the uploaded components combined
      uploadedGroup.updateMatrixWorld(true);
      const naturalBounds = new THREE.Box3().setFromObject(uploadedGroup);
      const naturalCenter = new THREE.Vector3();
      const naturalSize = new THREE.Vector3();
      naturalBounds.getCenter(naturalCenter);
      naturalBounds.getSize(naturalSize);

      // Center the internal mesh geometry so that (0, 0, 0) is the exact center of the add-on
      for (const child of uploadedGroup.children) {
        child.position.sub(naturalCenter);
      }
      uploadedGroup.position.set(0, 0, 0);
      uploadedGroup.updateMatrixWorld(true);

      // Scale the uploaded group so it exactly spans targetWidthM and targetHeightM
      const scaleX = naturalSize.x > 0.0001 ? targetWidthM / naturalSize.x : 1;
      const scaleY = naturalSize.y > 0.0001 ? targetHeightM / naturalSize.y : 1;
      uploadedGroup.scale.set(scaleX, scaleY, 1);
      uploadedGroup.updateMatrixWorld(true);

      // Apply distinct materials and protect from global presentation overrides
      uploadedGroup.traverse((child) => {
        child.userData.isAddon = true;
        child.userData.addonType = addonType;
        if (child instanceof THREE.Mesh) {
          const nameKey = (child.name + " " + (child.userData.componentKey || "") + " " + (child.parent?.name || "")).toLowerCase();
          const isMesh =
            nameKey.includes("mesh") ||
            nameKey.includes("wire") ||
            nameKey.includes("screen") ||
            child.userData.isScreenMesh;

          if (isMesh) {
            // Preserve author's uploaded 3D component geometry & material from GLB
            child.userData.isScreenMesh = true;
            child.userData.preserveMaterial = true;
            child.renderOrder = 0;
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                m.depthWrite = true;
                m.side = THREE.DoubleSide;
                if (m.transparent) {
                  m.alphaTest = m.alphaTest || 0.2;
                }
              });
            }
          } else {
            child.material = frameMat.clone();
            child.userData.preserveMaterial = true;
            child.userData.presentationCategory = "Framing";
            child.renderOrder = 0;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        }
      });

      uploadedGroup.userData.addonType = addonType;
      uploadedGroup.userData.isUploadedAddon = true;
      uploadedGroup.userData.isAddon = true;

      // Wrap in outer assembly container to preserve scale and origin integrity
      const wrapperGroup = new THREE.Group();
      wrapperGroup.name = `Addon_${addonType === "screen" ? "Screen" : "Grill"}_Assembly`;
      wrapperGroup.userData.addonType = addonType;
      wrapperGroup.userData.isUploadedAddon = true;
      wrapperGroup.userData.isAddon = true;
      wrapperGroup.add(uploadedGroup);
      wrapperGroup.updateMatrixWorld(true);
      return wrapperGroup;
    }
  }

  // 2. Procedural parametric generation fallback (IMP-MS68)
  const proceduralGroup = buildParametricScreenGroup(targetWidthMm, targetHeightMm, options.addonConfig, frameMat);

  // Mark all procedural meshes with preserveMaterial=true to retain independent frame finish
  proceduralGroup.traverse((child) => {
    child.userData.isAddon = true;
    child.userData.addonType = addonType;
    if (child instanceof THREE.Mesh) {
      child.userData.preserveMaterial = true;
      child.renderOrder = 0;
    }
  });

  proceduralGroup.userData.addonType = addonType;
  proceduralGroup.userData.isAddon = true;

  const wrapperGroup = new THREE.Group();
  wrapperGroup.name = `Addon_${addonType === "screen" ? "Screen" : "Grill"}_Assembly`;
  wrapperGroup.userData.addonType = addonType;
  wrapperGroup.userData.isAddon = true;
  wrapperGroup.add(proceduralGroup);
  wrapperGroup.updateMatrixWorld(true);
  return wrapperGroup;
}

/**
 * Assembles a modular window security grill add-on, dynamically repeating the middle bars
 * pattern across width and height without stretching distortion, while sizing frame rails
 * along their length with constant profile cross-sections.
 */
export function buildGrillAssembly(
  components: ProductComponentDefinition[] = [],
  targetWidthMm: number,
  targetHeightMm: number,
  cache: ComponentModelCache,
  options: ParametricProductBuilderOptions,
  frameMaterial?: THREE.Material,
): THREE.Group {
  const targetWidthM = targetWidthMm / 1000;
  const targetHeightM = targetHeightMm / 1000;
  const zOffset = options.addonConfig?.zOffsetMm !== undefined
    ? Number((options.addonConfig.zOffsetMm * 0.001).toFixed(6))
    : 0.022;

  const addonFinish = options.addonAluminumFinish ?? options.alumFinish ?? "analok";
  const resolvedFrameMat = frameMaterial ?? createMaterialPalette(addonFinish).framing;

  const assembly = new THREE.Group();
  assembly.name = "Addon_Grill_Assembly";
  assembly.userData.addonType = "grill";
  assembly.userData.isAddon = true;
  assembly.userData.widthMm = targetWidthMm;
  assembly.userData.heightMm = targetHeightMm;

  const grilleBOM = options.grilleBOM ?? calculateGrilleLinearBOM({
    widthMm: targetWidthMm,
    heightMm: targetHeightMm,
    patternType: "staggered_brick",
    nominalPitchColMm: options.addonConfig?.nominalBarPitchMm ?? 140,
    nominalPitchRowMm: options.addonConfig?.nominalRowPitchMm ?? 191,
    includePerimeterFrame: true,
    grilleRawMaterial: {
      id: "default-grille-mat",
      material_code: "AL-GRILLE-TUBE-16MM",
      description: "16mm Square Tube Aluminum",
      unit_price: 160,
      waste_allowance: 0.12,
    },
  });
  assembly.userData.grilleBOM = grilleBOM;

  if (!components || components.length === 0) {
    const procedural = buildParametricGrillGroup(targetWidthMm, targetHeightMm, options.addonConfig, resolvedFrameMat);
    assembly.add(procedural);
    assembly.userData.verticalBarCount = procedural.userData.verticalBarCount;
    assembly.userData.horizontalBarCount = procedural.userData.horizontalBarCount;
    return assembly;
  }

  // 1. Identify perimeter frame rails and middle/center components
  const topComp = components.find((c) => (c.componentKey + " " + c.componentName).toLowerCase().includes("top"));
  const bottomComp = components.find((c) => (c.componentKey + " " + c.componentName).toLowerCase().includes("bottom"));
  const leftComp = components.find((c) => (c.componentKey + " " + c.componentName).toLowerCase().includes("left"));
  const rightComp = components.find((c) => (c.componentKey + " " + c.componentName).toLowerCase().includes("right"));

  const perimeterComps = new Set([topComp, bottomComp, leftComp, rightComp].filter(Boolean));

  let middleBarsComp = components.find((c) => {
    if (perimeterComps.has(c)) return false;
    const key = (c.componentKey + " " + c.componentName).toLowerCase();
    return (
      key.includes("middle") ||
      key.includes("bar") ||
      key.includes("infill") ||
      key.includes("center") ||
      key.includes("grid") ||
      key.includes("lattice") ||
      key.includes("picket") ||
      key.includes("pattern") ||
      key.includes("panel") ||
      key.includes("slat") ||
      key.includes("louver") ||
      c.dimensionBinding === "AREA"
    );
  });

  if (!middleBarsComp) {
    middleBarsComp = components.find((c) => !perimeterComps.has(c));
  }

  if (!middleBarsComp && components.length === 1) {
    middleBarsComp = components[0];
  }

  // 2. Measure perimeter frame rail thicknesses (default 28mm / 0.028m if frame rails exist)
  let frameWidthLeft = 0;
  let frameWidthRight = 0;
  let frameHeightTop = 0;
  let frameHeightBottom = 0;

  if (leftComp) {
    try {
      const sz = cache.getSourceSizeMeters(leftComp.componentId);
      frameWidthLeft = sz.x > 0.005 ? sz.x : 0.028;
    } catch {
      frameWidthLeft = 0.028;
    }
  }
  if (rightComp) {
    try {
      const sz = cache.getSourceSizeMeters(rightComp.componentId);
      frameWidthRight = sz.x > 0.005 ? sz.x : 0.028;
    } catch {
      frameWidthRight = 0.028;
    }
  }
  if (topComp) {
    try {
      const sz = cache.getSourceSizeMeters(topComp.componentId);
      frameHeightTop = sz.y > 0.005 ? sz.y : 0.028;
    } catch {
      frameHeightTop = 0.028;
    }
  }
  if (bottomComp) {
    try {
      const sz = cache.getSourceSizeMeters(bottomComp.componentId);
      frameHeightBottom = sz.y > 0.005 ? sz.y : 0.028;
    } catch {
      frameHeightBottom = 0.028;
    }
  }

  const hasPerimeter = !!(leftComp || rightComp || topComp || bottomComp);
  const innerWidthM = hasPerimeter
    ? Math.max(0.1, targetWidthM - frameWidthLeft - frameWidthRight)
    : targetWidthM;
  const innerHeightM = hasPerimeter
    ? Math.max(0.1, targetHeightM - frameHeightTop - frameHeightBottom)
    : targetHeightM;

  // 3. Mount Left Jamb
  if (leftComp) {
    try {
      const leftClone = cache.getClone(leftComp.componentId);
      if (leftClone) {
        recenterChildAtOrigin(leftClone);
        const sz = cache.getSourceSizeMeters(leftComp.componentId);
        const wrapper = new THREE.Group();
        wrapper.name = leftComp.componentKey || "Grill_Frame_Left";
        wrapper.userData.componentKey = leftComp.componentKey;
        wrapper.userData.componentName = leftComp.componentName;
        wrapper.userData.isAddon = true;
        wrapper.userData.addonType = "grill";
        wrapper.userData.presentationCategory = "Framing";
        wrapper.userData.preserveMaterial = true;
        wrapper.add(leftClone);
        wrapper.scale.set(1, sz.y > 0.001 ? targetHeightM / sz.y : 1, 1);
        wrapper.position.set(-targetWidthM / 2 + frameWidthLeft / 2, 0, zOffset);
        assembly.add(wrapper);
      }
    } catch {
      const sideGeo = new THREE.BoxGeometry(frameWidthLeft, targetHeightM, 0.025);
      const sideMesh = new THREE.Mesh(sideGeo, resolvedFrameMat);
      sideMesh.name = leftComp.componentKey || "Grill_Frame_Left";
      sideMesh.position.set(-targetWidthM / 2 + frameWidthLeft / 2, 0, zOffset);
      assembly.add(sideMesh);
    }
  }

  // 4. Mount Right Jamb
  if (rightComp) {
    try {
      const rightClone = cache.getClone(rightComp.componentId);
      if (rightClone) {
        recenterChildAtOrigin(rightClone);
        const sz = cache.getSourceSizeMeters(rightComp.componentId);
        const wrapper = new THREE.Group();
        wrapper.name = rightComp.componentKey || "Grill_Frame_Right";
        wrapper.userData.componentKey = rightComp.componentKey;
        wrapper.userData.componentName = rightComp.componentName;
        wrapper.userData.isAddon = true;
        wrapper.userData.addonType = "grill";
        wrapper.userData.presentationCategory = "Framing";
        wrapper.userData.preserveMaterial = true;
        wrapper.add(rightClone);
        wrapper.scale.set(1, sz.y > 0.001 ? targetHeightM / sz.y : 1, 1);
        wrapper.position.set(targetWidthM / 2 - frameWidthRight / 2, 0, zOffset);
        assembly.add(wrapper);
      }
    } catch {
      const sideGeo = new THREE.BoxGeometry(frameWidthRight, targetHeightM, 0.025);
      const sideMesh = new THREE.Mesh(sideGeo, resolvedFrameMat);
      sideMesh.name = rightComp.componentKey || "Grill_Frame_Right";
      sideMesh.position.set(targetWidthM / 2 - frameWidthRight / 2, 0, zOffset);
      assembly.add(sideMesh);
    }
  }

  // 5. Mount Top Rail
  if (topComp) {
    try {
      const topClone = cache.getClone(topComp.componentId);
      if (topClone) {
        recenterChildAtOrigin(topClone);
        const sz = cache.getSourceSizeMeters(topComp.componentId);
        const wrapper = new THREE.Group();
        wrapper.name = topComp.componentKey || "Grill_Frame_Top";
        wrapper.userData.componentKey = topComp.componentKey;
        wrapper.userData.componentName = topComp.componentName;
        wrapper.userData.isAddon = true;
        wrapper.userData.addonType = "grill";
        wrapper.userData.presentationCategory = "Framing";
        wrapper.userData.preserveMaterial = true;
        wrapper.add(topClone);
        wrapper.scale.set(sz.x > 0.001 ? innerWidthM / sz.x : 1, 1, 1);
        wrapper.position.set(0, targetHeightM / 2 - frameHeightTop / 2, zOffset);
        assembly.add(wrapper);
      }
    } catch {
      const topGeo = new THREE.BoxGeometry(innerWidthM, frameHeightTop, 0.025);
      const topMesh = new THREE.Mesh(topGeo, resolvedFrameMat);
      topMesh.name = topComp.componentKey || "Grill_Frame_Top";
      topMesh.position.set(0, targetHeightM / 2 - frameHeightTop / 2, zOffset);
      assembly.add(topMesh);
    }
  }

  // 6. Mount Bottom Rail
  if (bottomComp) {
    try {
      const bottomClone = cache.getClone(bottomComp.componentId);
      if (bottomClone) {
        recenterChildAtOrigin(bottomClone);
        const sz = cache.getSourceSizeMeters(bottomComp.componentId);
        const wrapper = new THREE.Group();
        wrapper.name = bottomComp.componentKey || "Grill_Frame_Bottom";
        wrapper.userData.componentKey = bottomComp.componentKey;
        wrapper.userData.componentName = bottomComp.componentName;
        wrapper.userData.isAddon = true;
        wrapper.userData.addonType = "grill";
        wrapper.userData.presentationCategory = "Framing";
        wrapper.userData.preserveMaterial = true;
        wrapper.add(bottomClone);
        wrapper.scale.set(sz.x > 0.001 ? innerWidthM / sz.x : 1, 1, 1);
        wrapper.position.set(0, -targetHeightM / 2 + frameHeightBottom / 2, zOffset);
        assembly.add(wrapper);
      }
    } catch {
      const botGeo = new THREE.BoxGeometry(innerWidthM, frameHeightBottom, 0.025);
      const botMesh = new THREE.Mesh(botGeo, resolvedFrameMat);
      botMesh.name = bottomComp.componentKey || "Grill_Frame_Bottom";
      botMesh.position.set(0, -targetHeightM / 2 + frameHeightBottom / 2, zOffset);
      assembly.add(botMesh);
    }
  }

  // 7. Middle Bars Pattern Repetition (Dynamic uploaded center with procedural fallback)
  let middleMounted = false;
  const middleAssembly = new THREE.Group();
  middleAssembly.name = middleBarsComp?.componentKey || "Grill_Middle_Bars_Assembly";
  if (middleBarsComp) {
    middleAssembly.userData.componentKey = middleBarsComp.componentKey;
    middleAssembly.userData.componentName = middleBarsComp.componentName;
  }

  if (middleBarsComp) {
    try {
      const middleClone = cache.getClone(middleBarsComp.componentId);
      if (middleClone) {
        let sourceSize: THREE.Vector3 | null = null;
        try {
          sourceSize = cache.getSourceSizeMeters(middleBarsComp.componentId);
        } catch {
          // ignore cache measurement error
        }

        if (!sourceSize || sourceSize.x <= 0.005 || sourceSize.y <= 0.005) {
          recenterChildAtOrigin(middleClone);
          const bbox = new THREE.Box3().setFromObject(middleClone);
          const computedSize = new THREE.Vector3();
          bbox.getSize(computedSize);
          sourceSize = computedSize;
        }

        const sourceW = sourceSize.x > 0.005 ? sourceSize.x : innerWidthM;
        const sourceH = sourceSize.y > 0.005 ? sourceSize.y : innerHeightM;

        // Dynamic Pattern Repetition across aperture
        const numCols = Math.max(1, Math.round(innerWidthM / sourceW));
        const numRows = Math.max(1, Math.round(innerHeightM / sourceH));

        const colSpan = innerWidthM / numCols;
        const rowSpan = innerHeightM / numRows;
        const scaleX = sourceW > 0.001 ? colSpan / sourceW : 1;
        const scaleY = sourceH > 0.001 ? rowSpan / sourceH : 1;

        for (let c = 0; c < numCols; c++) {
          const posX = -innerWidthM / 2 + (c + 0.5) * colSpan;
          for (let r = 0; r < numRows; r++) {
            const posY = -innerHeightM / 2 + (r + 0.5) * rowSpan;

            let tileClone: THREE.Object3D;
            if (c === 0 && r === 0) {
              tileClone = middleClone;
            } else {
              try {
                tileClone = cache.getClone(middleBarsComp.componentId);
              } catch {
                tileClone = middleClone.clone(true);
              }
            }

            recenterChildAtOrigin(tileClone);

            tileClone.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                if (!child.material) {
                  child.material = resolvedFrameMat;
                }
                child.userData.preserveMaterial = true;
                child.userData.presentationCategory = "Framing";
                child.renderOrder = 0;
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const tileWrapper = new THREE.Group();
            tileWrapper.name = `${middleBarsComp.componentKey || "Grill_Middle_Bars"}_${c}_${r}`;
            tileWrapper.userData.componentKey = middleBarsComp.componentKey;
            tileWrapper.userData.componentName = middleBarsComp.componentName;
            tileWrapper.userData.isAddon = true;
            tileWrapper.userData.addonType = "grill";
            tileWrapper.userData.presentationCategory = "Framing";
            tileWrapper.userData.preserveMaterial = true;
            tileWrapper.position.set(posX, posY, zOffset);
            tileWrapper.scale.set(scaleX, scaleY, 1);
            tileWrapper.add(tileClone);
            middleAssembly.add(tileWrapper);
          }
        }

        // Mount intermediate vertical seam bars between repeated columns to eliminate double gaps
        if (numCols > 1) {
          const barDepth = sourceSize.z > 0.005 ? sourceSize.z : 0.016;
          const barWidth = (options.addonConfig?.grillBarWidthMm ?? 14) * 0.001;

          let barMat: THREE.Material | undefined = undefined;
          middleClone.traverse((child) => {
            if (!barMat && child instanceof THREE.Mesh && child.material) {
              barMat = Array.isArray(child.material) ? child.material[0] : child.material;
            }
          });
          if (!barMat || options.addonAluminumFinish) {
            barMat = resolvedFrameMat;
          }

          const vSeamGeo = new THREE.BoxGeometry(barWidth, innerHeightM, barDepth);
          for (let c = 1; c < numCols; c++) {
            const seamX = -innerWidthM / 2 + c * colSpan;
            const seamMesh = new THREE.Mesh(vSeamGeo, barMat);
            seamMesh.name = `${middleBarsComp.componentKey || "Grill_Middle_Bars"}_Seam_V_${c}`;
            seamMesh.userData.componentKey = middleBarsComp.componentKey;
            seamMesh.userData.componentName = middleBarsComp.componentName;
            seamMesh.userData.isAddon = true;
            seamMesh.userData.addonType = "grill";
            seamMesh.userData.presentationCategory = "Framing";
            seamMesh.userData.preserveMaterial = true;
            seamMesh.position.set(seamX, 0, zOffset);
            seamMesh.castShadow = true;
            seamMesh.receiveShadow = true;
            seamMesh.renderOrder = 0;
            middleAssembly.add(seamMesh);
          }
        }

        // Mount intermediate horizontal seam bars between repeated rows to eliminate vertical gaps
        if (numRows > 1) {
          const barDepth = sourceSize.z > 0.005 ? sourceSize.z : 0.016;
          const barWidth = (options.addonConfig?.grillBarWidthMm ?? 14) * 0.001;

          let barMat: THREE.Material | undefined = undefined;
          middleClone.traverse((child) => {
            if (!barMat && child instanceof THREE.Mesh && child.material) {
              barMat = Array.isArray(child.material) ? child.material[0] : child.material;
            }
          });
          if (!barMat || options.addonAluminumFinish) {
            barMat = resolvedFrameMat;
          }

          const hSeamGeo = new THREE.BoxGeometry(innerWidthM, barWidth, barDepth);
          for (let r = 1; r < numRows; r++) {
            const seamY = -innerHeightM / 2 + r * rowSpan;
            const seamMesh = new THREE.Mesh(hSeamGeo, barMat);
            seamMesh.name = `${middleBarsComp.componentKey || "Grill_Middle_Bars"}_Seam_H_${r}`;
            seamMesh.userData.componentKey = middleBarsComp.componentKey;
            seamMesh.userData.componentName = middleBarsComp.componentName;
            seamMesh.userData.isAddon = true;
            seamMesh.userData.addonType = "grill";
            seamMesh.userData.presentationCategory = "Framing";
            seamMesh.userData.preserveMaterial = true;
            seamMesh.position.set(0, seamY, zOffset);
            seamMesh.castShadow = true;
            seamMesh.receiveShadow = true;
            seamMesh.renderOrder = 0;
            middleAssembly.add(seamMesh);
          }
        }

        middleAssembly.userData.verticalBarCount = numCols;
        middleAssembly.userData.horizontalBarCount = numRows;
        middleAssembly.userData.isAddon = true;
        middleAssembly.userData.addonType = "grill";
        assembly.add(middleAssembly);
        middleMounted = true;
      }
    } catch (err) {
      console.warn("Could not mount uploaded middle bars component:", err);
    }
  }

  // Fallback: If no middle bars component was uploaded or mounting failed, generate procedurally
  if (!middleMounted) {
    let barMat: THREE.Material | undefined = undefined;
    if (middleBarsComp) {
      try {
        const middleClone = cache.getClone(middleBarsComp.componentId);
        if (middleClone) {
          middleClone.traverse((child) => {
            if (!barMat && child instanceof THREE.Mesh && child.material) {
              barMat = Array.isArray(child.material) ? child.material[0] : child.material;
            }
          });
        }
      } catch {
        // Fallback
      }
    }

    if (!barMat || options.addonAluminumFinish) {
      barMat = resolvedFrameMat;
    }

    const patternGroup = buildDynamicGrillPatternGroup(
      innerWidthM,
      innerHeightM,
      {
        ...options.addonConfig,
        zOffsetMm: zOffset * 1000,
        grillBarWidthMm: options.addonConfig?.grillBarWidthMm ?? 14,
        nominalBarPitchMm: options.addonConfig?.nominalBarPitchMm ?? 230,
        nominalRowPitchMm: options.addonConfig?.nominalRowPitchMm ?? 191,
      },
      barMat,
    );
    if (middleBarsComp) {
      patternGroup.name = middleBarsComp.componentKey || "Grill_Middle_Bars_Assembly";
      patternGroup.userData.componentKey = middleBarsComp.componentKey;
      patternGroup.userData.componentName = middleBarsComp.componentName;
    }

    assembly.add(patternGroup);
    assembly.userData.verticalBarCount = patternGroup.userData.verticalBarCount;
    assembly.userData.horizontalBarCount = patternGroup.userData.horizontalBarCount;
  } else {
    assembly.userData.verticalBarCount = middleAssembly.userData.verticalBarCount;
    assembly.userData.horizontalBarCount = middleAssembly.userData.horizontalBarCount;
  }

  // 8. Enforce Material Flags and Depth Order
  assembly.traverse((child) => {
    child.userData.isAddon = true;
    child.userData.addonType = "grill";
    if (child instanceof THREE.Mesh) {
      child.userData.preserveMaterial = true;
      child.userData.presentationCategory = "Framing";
      child.renderOrder = 0;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return assembly;
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
