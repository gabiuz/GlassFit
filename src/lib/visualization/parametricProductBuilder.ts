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
import {
  computeLouverBladeCount,
  computeLouverOperatorCount,
  computeLouverBladeYCoordinates,
  computeOperatorYCoordinates,
  extractLouverBladePrototype,
  extractOperatorTracks,
} from "./jalousieGeometryAnalyzer";

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
  addonMountingSide?: "front" | "back";
  hatchTargetComponentKeys?: string[];
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
  if (definition.product?.isAddon && definition.product.addonType === "grill") {
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

  // If this product is a standalone hardware accessory (IMP-MS78):
  if (definition.product?.isAccessory) {
    const group = new THREE.Group();
    group.name = "hardware_accessory_assembly";

    for (const component of definition.components) {
      try {
        let clone: THREE.Object3D | null = null;
        try {
          clone = cache.getClone(component.componentId);
        } catch {
          try {
            clone = cache.getClone(component.componentKey);
          } catch {
            // fallback
          }
        }

        if (!clone) continue;

        const swapped = options.swappedAccessories?.[component.componentId] ??
          options.swappedAccessories?.[component.componentKey];
        const sourceHanding: "left" | "right" = component.handingMetadata?.sourceHanding ?? "right";
        const activeHanding: "left" | "right" = swapped?.horizontalPosition ?? sourceHanding;

        let finalMesh = clone.clone(true);
        if (activeHanding !== sourceHanding) {
          finalMesh = mirrorObjectHierarchyAcrossX(finalMesh);
        }

        finalMesh.userData = {
          ...component,
          isMirroredHanding: activeHanding !== sourceHanding,
          preserveMaterial: true,
        };

        group.add(finalMesh);
      } catch (err) {
        console.warn("Could not build hardware accessory component:", err);
      }
    }

    group.updateMatrixWorld(true);
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

  // Attach procedural or uploaded front-layer add-on if active (IMP-MS68, IMP-MS69, IMP-MS70, IMP-MS80)
  if (options.activeAddon === "screen" || options.activeAddon === "grill") {
    const addonGroup = buildAddonAttachment(definition, widthMm, heightMm, cache, options, group);

    // Compute bounding surfaces of host window components
    group.updateMatrixWorld(true);
    const hostBounds = new THREE.Box3().setFromObject(group);

    addonGroup.updateMatrixWorld(true);
    const addonBounds = new THREE.Box3().setFromObject(addonGroup);

    const matchingAddon = definition.compatibleAddons?.find((a) =>
      options.addonProductId ? a.addonProductId === options.addonProductId : a.addonType === options.activeAddon
    );

    const resolvedMountingSide: "front" | "back" =
      options.addonMountingSide ??
      (matchingAddon?.allowedSides === "back"
        ? "back"
        : matchingAddon?.allowedSides === "front"
          ? "front"
          : matchingAddon?.defaultSide ?? (
              options.addonConfig?.mountPosition === "rear" || (options.addonConfig?.zOffsetMm !== undefined && options.addonConfig.zOffsetMm < 0)
                ? "back"
                : "front"
            ));

    const clearanceGapMeters = 0.008;

    if (resolvedMountingSide === "back") {
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
  group.userData.productId = definition.product?.productId;
  group.userData.templateId = definition.template?.templateId;
  group.userData.resolvedStructure = resolved;

  return group;
}

function findDimensionMm(resolved: ResolvedStructure, keys: string[]): number | null {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(resolved.numericValuesMm || {})) {
      if (k.toLowerCase() === lower && typeof v === "number" && Number.isFinite(v) && v > 0) {
        return v;
      }
    }
    for (const [k, v] of Object.entries(resolved.resolvedValues || {})) {
      if (k.toLowerCase() === lower) {
        const num = toNumber(v, 0);
        if (num > 0) return num;
      }
    }
  }

  // Compound key fallback (e.g. window_height, aperture_height, total_height)
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (lower.length < 4) continue;
    for (const [k, v] of Object.entries(resolved.numericValuesMm || {})) {
      if (k.toLowerCase().includes(lower) && typeof v === "number" && Number.isFinite(v) && v > 0) {
        return v;
      }
    }
    for (const [k, v] of Object.entries(resolved.resolvedValues || {})) {
      if (k.toLowerCase().includes(lower)) {
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

    const isFrameOrMeshOrPanel =
      component.presentationCategory === "Framing" ||
      component.componentType === "Frame" ||
      component.componentType === "Model" ||
      component.componentType === "Mesh" ||
      component.componentType === "Screen" ||
      component.componentType === "Glass" ||
      compIdentity.includes("frame") ||
      compIdentity.includes("mesh") ||
      compIdentity.includes("glass") ||
      compIdentity.includes("sill") ||
      compIdentity.includes("jamb") ||
      compIdentity.includes("header") ||
      compIdentity.includes("rail") ||
      compIdentity.includes("stile") ||
      compIdentity.includes("mullion") ||
      compIdentity.includes("bar");

    const isLouverBlade = Boolean(
      component.dimensionBinding === "LOUVER_BLADE" ||
      (component as Record<string, unknown>).dimension_binding === "LOUVER_BLADE"
    );
    const isLouverOperator = Boolean(
      component.dimensionBinding === "LOUVER_OPERATOR" ||
      (component as Record<string, unknown>).dimension_binding === "LOUVER_OPERATOR"
    );

    if (isLouverBlade || isLouverOperator) {
      if (isLouverOperator && (component.isAccessorySlot || (component as Record<string, unknown>).is_accessory_slot)) {
        accessorySlotKeys.add(component.componentId);
        accessorySlotKeys.add(component.componentKey);
      }
      continue;
    }

    const isFixedDimension = (
      component.dimensionBinding === "FIXED" ||
      (component as Record<string, unknown>).dimension_binding === "FIXED"
    );

    const isSlot = !isFrameOrMeshOrPanel && Boolean(
      component.isAccessorySlot ||
      (component as Record<string, unknown>).is_accessory_slot ||
      compIdentity.includes("handle") ||
      compIdentity.includes("knob") ||
      compIdentity.includes("lever") ||
      compIdentity.includes("smartlock") ||
      compIdentity.includes("lock")
    );

    if (isSlot || (isFixedDimension && !isFrameOrMeshOrPanel)) {
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

  // Pre-calculate target dimensions and parametric scaling factors upfront
  const targetWidthMm = findDimensionMm(resolved, ["width", "quotation_width", "quotationWidth", "w"]);
  const targetHeightMm = findDimensionMm(resolved, ["height", "quotation_height", "quotationHeight", "h"]);
  const targetDepthMm = findDimensionMm(resolved, ["depth", "quotation_depth", "quotationDepth", "d"]);

  const naturalWidthM = hasHostComponents && hostSizeVec.x > 0.0001 ? hostSizeVec.x : 0;
  const naturalHeightM = hasHostComponents && hostSizeVec.y > 0.0001 ? hostSizeVec.y : 0;
  const naturalDepthM = hasHostComponents && hostSizeVec.z > 0.0001 ? hostSizeVec.z : 0;

  const scaleX = targetWidthMm && naturalWidthM > 0.0001
    ? (targetWidthMm / 1000) / naturalWidthM
    : 1;

  const scaleY = targetHeightMm && naturalHeightM > 0.0001
    ? (targetHeightMm / 1000) / naturalHeightM
    : 1;

  const scaleZ = targetDepthMm && naturalDepthM > 0.0001
    ? (targetDepthMm / 1000) / naturalDepthM
    : 1;

  const _hostHalfWidth = naturalWidthM > 0.0001 ? naturalWidthM / 2 : 0;
  void _hostHalfWidth;

  // Detect natural aperture vertical bounds from frame top and bottom rails if present
  let naturalApertureTopY: number | null = null;
  let naturalApertureBottomY: number | null = null;

  for (const comp of definition.components) {
    const compKeyLower = (comp.componentKey + " " + comp.componentName).toLowerCase();
    const isTopRail = (compKeyLower.includes("top") || compKeyLower.includes("head")) && (compKeyLower.includes("frame") || compKeyLower.includes("rail"));
    const isBottomRail = (compKeyLower.includes("bottom") || compKeyLower.includes("sill")) && (compKeyLower.includes("frame") || compKeyLower.includes("rail")) && !compKeyLower.includes("window_sill");

    if (isTopRail || isBottomRail) {
      try {
        const fClone = cache.getClone(comp.componentId);
        fClone.updateMatrixWorld(true);
        const fBox = new THREE.Box3().setFromObject(fClone);
        if (isTopRail && Number.isFinite(fBox.min.y)) {
          naturalApertureTopY = fBox.min.y;
        }
        if (isBottomRail && Number.isFinite(fBox.max.y)) {
          naturalApertureBottomY = fBox.max.y;
        }
      } catch {
        // ignore missing model in cache
      }
    }
  }

  // Fallback: If no separate top/bottom rails exist (e.g. single perimeter frame GLB),
  // detect aperture bounds from the modeled louver blade assembly and frame geometry
  if (naturalApertureTopY === null || naturalApertureBottomY === null) {
    let louverBox: THREE.Box3 | null = null;
    for (const comp of definition.components) {
      const isLouverBladeComp = Boolean(
        comp.dimensionBinding === "LOUVER_BLADE" ||
        (comp as Record<string, unknown>).dimension_binding === "LOUVER_BLADE" ||
        (comp.componentKey + " " + comp.componentName).toLowerCase().includes("louver") ||
        (comp.componentKey + " " + comp.componentName).toLowerCase().includes("blade") ||
        (comp.componentKey + " " + comp.componentName).toLowerCase().includes("clips_and_glass")
      );
      if (isLouverBladeComp) {
        try {
          const lClone = cache.getClone(comp.componentId);
          lClone.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(lClone);
          if (Number.isFinite(b.min.y) && Number.isFinite(b.max.y) && b.max.y > b.min.y) {
            louverBox = b;
            break;
          }
        } catch {
          // ignore missing model in cache
        }
      }
    }

    if (louverBox) {
      // Find the perimeter frame mesh to scan for exact inner aperture boundaries
      let frameMesh: THREE.Object3D | null = null;
      for (const comp of definition.components) {
        const compKeyLower = (comp.componentKey + " " + comp.componentName).toLowerCase();
        if (
          compKeyLower.includes("frame") ||
          compKeyLower.includes("perimeter") ||
          comp.presentationCategory === "Framing" ||
          comp.componentType === "Frame"
        ) {
          try {
            frameMesh = cache.getClone(comp.componentId);
            frameMesh.updateMatrixWorld(true);
            break;
          } catch {
            // ignore
          }
        }
      }

      if (frameMesh) {
        // Scan frame vertices horizontally spanning the louver opening
        let detectedTopInnerY: number | null = null;
        let detectedBottomInnerY: number | null = null;
        const xMin = louverBox.min.x + 0.05;
        const xMax = louverBox.max.x - 0.05;

        frameMesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry?.attributes.position) {
            const pos = child.geometry.attributes.position;
            const vertex = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
              vertex.fromBufferAttribute(pos, i);
              vertex.applyMatrix4(child.matrixWorld);

              if (vertex.x >= xMin && vertex.x <= xMax) {
                if (vertex.y >= louverBox.max.y - 0.02) {
                  if (detectedTopInnerY === null || vertex.y < detectedTopInnerY) {
                    detectedTopInnerY = vertex.y;
                  }
                }
                if (vertex.y <= louverBox.min.y + 0.02) {
                  if (detectedBottomInnerY === null || vertex.y > detectedBottomInnerY) {
                    detectedBottomInnerY = vertex.y;
                  }
                }
              }
            }
          }
        });

        if (detectedTopInnerY !== null && detectedBottomInnerY !== null && detectedTopInnerY > detectedBottomInnerY) {
          naturalApertureTopY = detectedTopInnerY;
          naturalApertureBottomY = detectedBottomInnerY;
        }
      }

      // If vertex scan did not establish rails, bound tightly using louverBox with nominal clearance
      if (naturalApertureTopY === null || naturalApertureBottomY === null) {
        naturalApertureTopY = louverBox.max.y + 0.02;
        naturalApertureBottomY = louverBox.min.y - 0.02;
      }
    }
  }

  const hasApertureRails = naturalApertureTopY !== null && naturalApertureBottomY !== null && naturalApertureTopY > naturalApertureBottomY;
  const naturalApertureHeightM = (naturalApertureTopY !== null && naturalApertureBottomY !== null && naturalApertureTopY > naturalApertureBottomY)
    ? (naturalApertureTopY - naturalApertureBottomY)
    : naturalHeightM;
  const naturalApertureCenterY = (naturalApertureTopY !== null && naturalApertureBottomY !== null && naturalApertureTopY > naturalApertureBottomY)
    ? ((naturalApertureTopY + naturalApertureBottomY) / 2)
    : (hasHostComponents ? hostCenterVec.y : 0);
  const currentApertureHeightMm = hasApertureRails && scaleY > 0 && naturalHeightM > 0
    ? Math.round(naturalApertureHeightM * scaleY * 1000)
    : (targetHeightMm ?? (naturalHeightM > 0 ? Math.round(naturalHeightM * 1000) : 1200));

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
    clone.userData.dimensionBinding = component.dimensionBinding ?? (component as Record<string, unknown>).dimension_binding ?? "FIXED";
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

    const isFrameOrMeshOrPanel =
      component.presentationCategory === "Framing" ||
      component.componentType === "Frame" ||
      component.componentType === "Model" ||
      component.componentType === "Mesh" ||
      component.componentType === "Screen" ||
      component.componentType === "Glass" ||
      compIdentity.includes("frame") ||
      compIdentity.includes("mesh") ||
      compIdentity.includes("glass") ||
      compIdentity.includes("sill") ||
      compIdentity.includes("jamb") ||
      compIdentity.includes("header") ||
      compIdentity.includes("rail") ||
      compIdentity.includes("stile") ||
      compIdentity.includes("mullion") ||
      compIdentity.includes("bar");

    const isLouverBladeComp = Boolean(
      component.dimensionBinding === "LOUVER_BLADE" ||
      (component as Record<string, unknown>).dimension_binding === "LOUVER_BLADE"
    );
    const isLouverOperatorComp = Boolean(
      component.dimensionBinding === "LOUVER_OPERATOR" ||
      (component as Record<string, unknown>).dimension_binding === "LOUVER_OPERATOR"
    );

    const isAccessorySlot = !isFrameOrMeshOrPanel && !isLouverBladeComp && !isLouverOperatorComp && (
      accessorySlotKeys.has(component.componentId) ||
      accessorySlotKeys.has(component.componentKey)
    );
    const isAccessoryProduct = Boolean(definition.product?.isAccessory);
    const hasHanding = !isFrameOrMeshOrPanel && !isLouverBladeComp && !isLouverOperatorComp && Boolean(
      (component.positionOptions?.allowHorizontalToggle) ||
      (isAccessorySlot && component.positionOptions?.defaultHorizontal) ||
      (options.swappedAccessories?.[component.componentId]?.horizontalPosition && component.positionOptions?.allowHorizontalToggle) ||
      (options.swappedAccessories?.[component.componentKey]?.horizontalPosition && component.positionOptions?.allowHorizontalToggle) ||
      isAccessoryProduct ||
      (component.handingMetadata?.leftGlbUrl && component.handingMetadata?.rightGlbUrl)
    );

    const swapped = options.swappedAccessories?.[component.componentId] ??
      options.swappedAccessories?.[component.componentKey];

    const isAlternativeAccessory = Boolean(
      isAccessorySlot &&
      swapped &&
      swapped.accessoryId !== "default" &&
      swapped.accessoryId !== component.componentId
    );

    if (hasHanding) {
      // Measure original handle in its natural modeled position
      clone.updateMatrixWorld(true);
      const origHandleBounds = new THREE.Box3().setFromObject(clone);
      const origHandleCenter = new THREE.Vector3();
      const origHandleSize = new THREE.Vector3();
      origHandleBounds.getCenter(origHandleCenter);
      origHandleBounds.getSize(origHandleSize);

      const baseCenterX = hasHostComponents ? hostCenterVec.x : 0;
      const deltaX = origHandleCenter.x - baseCenterX;
      const modeledHanding: "left" | "right" = component.handingMetadata?.sourceHanding ?? (deltaX >= 0 ? "right" : "left");
      const activeHanding: "left" | "right" = swapped?.horizontalPosition ?? component.positionOptions?.defaultHorizontal ?? modeledHanding;

      const halfPartW = origHandleSize.x / 2;
      const modeledOuterEdgeDist = modeledHanding === "right"
        ? (origHandleBounds.max.x - baseCenterX)
        : (baseCenterX - origHandleBounds.min.x);

      let targetX: number;
      if (hasHostComponents && scaleX > 0 && Math.abs(scaleX - 1) > 0.0001) {
        if (activeHanding === "right") {
          targetX = baseCenterX + modeledOuterEdgeDist - (halfPartW / scaleX);
        } else {
          targetX = baseCenterX - modeledOuterEdgeDist + (halfPartW / scaleX);
        }
      } else if (!hasHostComponents) {
        targetX = 0;
      } else {
        targetX = activeHanding === "left" ? (baseCenterX - Math.abs(deltaX)) : (baseCenterX + Math.abs(deltaX));
      }

      const targetY = (component.positionOptions?.allowVerticalToggle && swapped?.verticalPosition === "bottom")
        ? (hostCenterVec.y - hostSizeVec.y * 0.35)
        : origHandleCenter.y;
      const targetZ = origHandleCenter.z;

      if (!isAlternativeAccessory) {
        if (activeHanding === modeledHanding && (!component.positionOptions?.allowVerticalToggle || swapped?.verticalPosition !== "bottom")) {
          if (swapped?.finish) {
            const hwMat = createHardwareFinishMaterial(swapped.finish);
            clone.traverse((c) => {
              if (c instanceof THREE.Mesh) c.material = hwMat;
            });
          }
          clone.userData = { ...clone.userData, isMirroredHanding: false };

          const container = new THREE.Group();
          container.name = `${component.componentName || "part"}_${activeHanding}`;
          container.userData = { ...clone.userData, isMirroredHanding: false };
          clone.position.sub(origHandleCenter);
          container.add(clone);
          container.position.set(targetX, targetY, targetZ);
          container.rotation.set(0, 0, 0);
          group.add(container);
        } else {
          const mountedHandle = mirrorPartAcrossCenterline(
            clone,
            baseCenterX,
            activeHanding,
            component.positionOptions?.allowVerticalToggle && swapped?.verticalPosition === "bottom" ? targetY : undefined,
            targetZ,
            targetX
          );

          if (swapped?.finish) {
            const hwMat = createHardwareFinishMaterial(swapped.finish);
            mountedHandle.traverse((c) => {
              if (c instanceof THREE.Mesh) c.material = hwMat;
            });
          }
          mountedHandle.userData = { ...clone.userData, isMirroredHanding: activeHanding !== modeledHanding };
          group.add(mountedHandle);
        }
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
        const curSize = new THREE.Vector3();
        curBox.getCenter(curCenter);
        curBox.getSize(curSize);
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

        const accHalfW = curSize.x / 2;
        let accTargetX: number;
        if (hasHostComponents && scaleX > 0 && Math.abs(scaleX - 1) > 0.0001) {
          if (activeHanding === "right") {
            accTargetX = baseCenterX + modeledOuterEdgeDist - (accHalfW / scaleX);
          } else {
            accTargetX = baseCenterX - modeledOuterEdgeDist + (accHalfW / scaleX);
          }
        } else {
          accTargetX = targetX;
        }

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
        container.position.set(accTargetX, targetY, targetZ);
        container.rotation.set(0, 0, 0);
        container.updateMatrixWorld(true);

        group.add(container);
      }
      continue;
    }

    const isLouverBlade = Boolean(
      component.dimensionBinding === "LOUVER_BLADE" ||
      (component as Record<string, unknown>).dimension_binding === "LOUVER_BLADE"
    );

    if (isLouverBlade) {
      const pitchMm = component.jalousieConfig?.pitch_mm ?? component.jalousieConfig?.pitchMm ?? 175;
      const bladeHeightMm = component.jalousieConfig?.blade_height_mm ?? component.jalousieConfig?.bladeHeightMm ?? 105.3;
      const bladeHeightM = bladeHeightMm / 1000;
      const pitchM = pitchMm / 1000;
      const effectiveApertureHeightM = currentApertureHeightMm / 1000;

      let louverCount = computeLouverBladeCount(currentApertureHeightMm, pitchMm);
      while (louverCount > 1 && ((louverCount - 1) * pitchM + bladeHeightM) > (effectiveApertureHeightM - 0.01)) {
        louverCount--;
      }

      const bladeElevations = computeLouverBladeYCoordinates(louverCount, pitchMm);
      const prototypeBlade = extractLouverBladePrototype(clone);

      const louverContainer = new THREE.Group();
      louverContainer.name = `${component.componentName || "louver_blades"}_assembly`;
      louverContainer.userData = {
        ...clone.userData,
        dimensionBinding: "LOUVER_BLADE",
        isLouverAssembly: true,
        louverCount,
      };

      for (let i = 0; i < louverCount; i++) {
        const bladeInstance = prototypeBlade.clone(true);
        bladeInstance.name = `${component.componentName || "louver_blade"}_instance_${i}`;
        bladeInstance.userData = {
          ...clone.userData,
          dimensionBinding: "LOUVER_BLADE",
          isLouverBladeInstance: true,
          bladeIndex: i,
        };
        // Clamping scale along Y and Z strictly to 1.0 (unscaled in world space)
        // Along X: 1.0 inside parent group scaled by scaleX -> net world scale along X is scaleX
        bladeInstance.scale.set(
          1,
          scaleY > 0 ? 1 / scaleY : 1,
          scaleZ > 0 ? 1 / scaleZ : 1
        );
        bladeInstance.position.set(
          0,
          scaleY > 0 ? (naturalApertureCenterY + bladeElevations[i] / scaleY) : (naturalApertureCenterY + bladeElevations[i]),
          0
        );
        louverContainer.add(bladeInstance);
      }

      group.add(louverContainer);
      continue;
    }

    const isLouverOperator = Boolean(
      component.dimensionBinding === "LOUVER_OPERATOR" ||
      (component as Record<string, unknown>).dimension_binding === "LOUVER_OPERATOR"
    );

    if (isLouverOperator) {
      const pitchMm = component.jalousieConfig?.pitch_mm ?? component.jalousieConfig?.pitchMm ?? 175;
      const bladeHeightMm = component.jalousieConfig?.blade_height_mm ?? component.jalousieConfig?.bladeHeightMm ?? 105.3;
      const bladeHeightM = bladeHeightMm / 1000;
      const pitchM = pitchMm / 1000;
      const effectiveApertureHeightM = currentApertureHeightMm / 1000;

      let louverCount = computeLouverBladeCount(currentApertureHeightMm, pitchMm);
      while (louverCount > 1 && ((louverCount - 1) * pitchM + bladeHeightM) > (effectiveApertureHeightM - 0.01)) {
        louverCount--;
      }

      const bladesPerOp = component.jalousieConfig?.blades_per_operator ?? component.jalousieConfig?.bladesPerOperator ?? 4;
      const operatorCount = computeLouverOperatorCount(louverCount, bladesPerOp);
      const operatorElevations = computeOperatorYCoordinates(louverCount, operatorCount, pitchMm);
      const operatorTracks = extractOperatorTracks(clone);

      const baseCenterX = hasHostComponents ? hostCenterVec.x : 0;
      const halfHostW = hasHostComponents ? hostSizeVec.x / 2 : (naturalWidthM > 0 ? naturalWidthM / 2 : 1.05);

      // Detect aperture reference boundaries from louver blade or jamb components
      let leftAnchorX: number | null = null;
      let rightAnchorX: number | null = null;

      for (const comp of definition.components) {
        const isLouverBladeComp = Boolean(
          comp.dimensionBinding === "LOUVER_BLADE" ||
          (comp as Record<string, unknown>).dimension_binding === "LOUVER_BLADE"
        );
        if (isLouverBladeComp) {
          try {
            const lClone = cache.getClone(comp.componentId);
            lClone.updateMatrixWorld(true);
            const lBox = new THREE.Box3().setFromObject(lClone);
            if (Number.isFinite(lBox.min.x) && Number.isFinite(lBox.max.x) && lBox.max.x > lBox.min.x) {
              leftAnchorX = lBox.min.x;
              rightAnchorX = lBox.max.x;
              break;
            }
          } catch {
            // ignore missing model in cache
          }
        }
      }

      if (leftAnchorX === null || rightAnchorX === null) {
        for (const comp of definition.components) {
          const compKeyLower = (comp.componentKey + " " + comp.componentName).toLowerCase();
          const isLeftJamb = compKeyLower.includes("left") && (compKeyLower.includes("jamb") || compKeyLower.includes("frame") || compKeyLower.includes("stile"));
          const isRightJamb = compKeyLower.includes("right") && (compKeyLower.includes("jamb") || compKeyLower.includes("frame") || compKeyLower.includes("stile"));

          if (isLeftJamb || isRightJamb) {
            try {
              const jClone = cache.getClone(comp.componentId);
              jClone.updateMatrixWorld(true);
              const jBox = new THREE.Box3().setFromObject(jClone);
              if (isLeftJamb && Number.isFinite(jBox.max.x)) {
                leftAnchorX = jBox.max.x;
              }
              if (isRightJamb && Number.isFinite(jBox.min.x)) {
                rightAnchorX = jBox.min.x;
              }
            } catch {
              // ignore missing model
            }
          }
        }
      }

      if (leftAnchorX === null) leftAnchorX = baseCenterX - halfHostW;
      if (rightAnchorX === null) rightAnchorX = baseCenterX + halfHostW;

      const operatorContainer = new THREE.Group();
      operatorContainer.name = `${component.componentName || "window_operators"}_assembly`;
      operatorContainer.userData = {
        ...clone.userData,
        dimensionBinding: "LOUVER_OPERATOR",
        isOperatorAssembly: true,
        operatorCount: operatorCount * operatorTracks.length,
      };

      // Check for swapped modular hardware accessory (IMP-MS76, IMP-MS81)
      const swapped = options.swappedAccessories?.[component.componentId] ??
        options.swappedAccessories?.[component.componentKey];
      const isAlternativeAccessory = Boolean(
        swapped &&
        swapped.accessoryId !== "default" &&
        swapped.accessoryId !== component.componentId
      );

      const getPreparedAccessoryMesh = (trackHanding: "left" | "right"): THREE.Object3D => {
        let resolvedMesh: THREE.Object3D | null = null;
        if (options.accessoryModels) {
          resolvedMesh = options.accessoryModels.get(`${swapped!.accessoryId}_${trackHanding}`) ??
            options.accessoryModels.get(swapped!.accessoryId) ??
            null;
        }
        if (!resolvedMesh) {
          try {
            resolvedMesh = cache.getClone(swapped!.accessoryId);
          } catch {
            // fallback
          }
        }
        if (!resolvedMesh && (swapped!.accessoryId.startsWith("canonical_") || swapped!.accessoryId.startsWith("acc_"))) {
          try {
            resolvedMesh = createAccessoryMeshById(swapped!.accessoryId);
          } catch {
            // fallback
          }
        }
        if (!resolvedMesh) {
          resolvedMesh = createProceduralAccessoryMesh(swapped!.category, swapped!.accessoryName, swapped!.finish);
        }

        const clonedAcc = resolvedMesh.clone(true);
        clonedAcc.updateMatrixWorld(true);
        const curBox = new THREE.Box3().setFromObject(clonedAcc);
        const curCenter = new THREE.Vector3();
        curBox.getCenter(curCenter);
        clonedAcc.position.sub(curCenter);
        clonedAcc.updateMatrixWorld(true);

        const sourceHanding = swapped!.handingMetadata?.sourceHanding ??
          component.handingMetadata?.sourceHanding ??
          "right";

        let finalMesh: THREE.Object3D = clonedAcc;
        if (trackHanding !== sourceHanding && !options.accessoryModels?.has(`${swapped!.accessoryId}_${trackHanding}`)) {
          finalMesh = mirrorObjectHierarchyAcrossX(clonedAcc);
          finalMesh.updateMatrixWorld(true);
          const postBox = new THREE.Box3().setFromObject(finalMesh);
          const postCenter = new THREE.Vector3();
          postBox.getCenter(postCenter);
          finalMesh.position.sub(postCenter);
          finalMesh.updateMatrixWorld(true);
        }

        if (swapped!.finish) {
          const hwMat = createHardwareFinishMaterial(swapped!.finish);
          finalMesh.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              c.material = hwMat;
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
        }

        const wrapper = new THREE.Group();
        wrapper.name = `PreparedAccessory_${trackHanding}`;
        wrapper.add(finalMesh);
        return wrapper;
      };

      if (!isAlternativeAccessory && swapped?.finish) {
        const hwMat = createHardwareFinishMaterial(swapped.finish);
        operatorTracks.forEach((track) => {
          track.prototype.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              c.material = hwMat;
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
        });
      }

      operatorTracks.forEach((track) => {
        let targetX = track.modeledCenterX;

        if (hasHostComponents && scaleX > 0 && Math.abs(scaleX - 1) > 0.0001) {
          const distToLeft = Math.abs(track.modeledCenterX - (leftAnchorX ?? -halfHostW));
          const distToRight = Math.abs((rightAnchorX ?? halfHostW) - track.modeledCenterX);
          const distToCenter = Math.abs(track.modeledCenterX - baseCenterX);

          if (distToLeft < distToRight && distToLeft < distToCenter && leftAnchorX !== null) {
            // Left jamb bank: anchored to left aperture/louver boundary with fixed physical offset
            const modeledOffset = track.modeledCenterX - leftAnchorX;
            targetX = leftAnchorX + (modeledOffset / scaleX);
          } else if (distToRight < distToLeft && distToRight < distToCenter && rightAnchorX !== null) {
            // Right jamb bank: anchored to right aperture/louver boundary with fixed physical offset
            const modeledOffset = rightAnchorX - track.modeledCenterX;
            targetX = rightAnchorX - (modeledOffset / scaleX);
          } else {
            // Center mullion bank: anchored to centerline
            const modeledOffset = track.modeledCenterX - baseCenterX;
            targetX = baseCenterX + (modeledOffset / scaleX);
          }
        }

        const isLeftTrack = track.modeledCenterX < (baseCenterX - 0.02);
        const trackHanding: "left" | "right" = isLeftTrack ? "left" : "right";
        const prototypeToUse = isAlternativeAccessory
          ? getPreparedAccessoryMesh(trackHanding)
          : track.prototype;

        for (let k = 0; k < operatorCount; k++) {
          const opInstance = prototypeToUse.clone(true);
          const globalIdx = track.trackIndex * operatorCount + k;
          opInstance.name = isAlternativeAccessory
            ? `${swapped!.accessoryName || "window_operator"}_instance_${globalIdx}`
            : `${component.componentName || "window_operator"}_instance_${globalIdx}`;
          opInstance.userData = {
            ...clone.userData,
            componentKey: component.componentKey,
            componentId: component.componentId,
            componentName: component.componentName,
            dimensionBinding: "LOUVER_OPERATOR",
            isFixedDimension: true,
            isLouverOperatorInstance: true,
            isAccessoryReplacement: isAlternativeAccessory,
            operatorIndex: globalIdx,
            trackIndex: track.trackIndex,
            bankIndex: k,
          };

          // Clamping scale strictly to 1.0 along all axes in world space
          opInstance.scale.set(
            scaleX > 0 ? 1 / scaleX : 1,
            scaleY > 0 ? 1 / scaleY : 1,
            scaleZ > 0 ? 1 / scaleZ : 1
          );
          opInstance.position.set(
            targetX,
            scaleY > 0 ? (naturalApertureCenterY + operatorElevations[k] / scaleY) : (naturalApertureCenterY + operatorElevations[k]),
            track.modeledCenterZ
          );
          operatorContainer.add(opInstance);
        }
      });

      group.add(operatorContainer);
      continue;
    }

    const isFixedDimension = Boolean(
      component.dimensionBinding === "FIXED" ||
      (component as Record<string, unknown>).dimension_binding === "FIXED" ||
      isAccessorySlot
    );

    if (isFixedDimension) {
      clone.updateMatrixWorld(true);
      const partBounds = new THREE.Box3().setFromObject(clone);
      const partCenter = new THREE.Vector3();
      const partSize = new THREE.Vector3();
      partBounds.getCenter(partCenter);
      partBounds.getSize(partSize);

      const baseCenterX = hasHostComponents ? hostCenterVec.x : 0;
      const deltaX = partCenter.x - baseCenterX;
      const halfPartW = partSize.x / 2;

      let targetX = partCenter.x;
      if (hasHostComponents && scaleX > 0 && Math.abs(scaleX - 1) > 0.0001) {
        if (deltaX > 0.02) {
          const modeledOuterEdgeDist = partBounds.max.x - baseCenterX;
          targetX = baseCenterX + modeledOuterEdgeDist - (halfPartW / scaleX);
        } else if (deltaX < -0.02) {
          const modeledOuterEdgeDist = baseCenterX - partBounds.min.x;
          targetX = baseCenterX - modeledOuterEdgeDist + (halfPartW / scaleX);
        }
      }

      const fixedContainer = new THREE.Group();
      fixedContainer.name = `${component.componentName || "fixed_part"}_container`;
      fixedContainer.userData = {
        ...clone.userData,
        dimensionBinding: "FIXED",
        isFixedDimension: true,
      };
      clone.position.sub(partCenter);
      fixedContainer.add(clone);
      fixedContainer.position.set(targetX, partCenter.y, partCenter.z);
      fixedContainer.rotation.set(0, 0, 0);
      group.add(fixedContainer);
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
  group.scale.set(scaleX, scaleY, scaleZ);

  // Maintain 1:1 metric scale on hardware accessories and fixed parts
  if (scaleX !== 1 || scaleY !== 1 || scaleZ !== 1) {
    group.children.forEach((child) => {
      if (child.userData?.isLouverAssembly || child.userData?.isOperatorAssembly) {
        return;
      }
      const binding = child.userData?.dimensionBinding;
      const isFixed = Boolean(
        binding === "FIXED" ||
        child.userData?.isFixedDimension ||
        child.userData?.isAccessoryReplacement ||
        (child.userData?.componentId && accessorySlotKeys.has(child.userData.componentId)) ||
        (child.userData?.componentKey && accessorySlotKeys.has(child.userData.componentKey))
      );

      if (isFixed) {
        child.scale.set(
          scaleX > 0 ? 1 / scaleX : 1,
          scaleY > 0 ? 1 / scaleY : 1,
          scaleZ > 0 ? 1 / scaleZ : 1,
        );
      }
    });
  }
  group.updateMatrixWorld(true);

  // Attach procedural or uploaded front-layer add-on if active (IMP-MS68, IMP-MS69, IMP-MS80)
  if (options.activeAddon === "screen" || options.activeAddon === "grill") {
    const targetW = targetWidthMm ?? (naturalWidthM > 0 ? naturalWidthM * 1000 : 1200);
    const targetH = targetHeightMm ?? (naturalHeightM > 0 ? naturalHeightM * 1000 : 1200);

    const addonGroup = buildAddonAttachment(definition, targetW, targetH, cache, options, group);

    // Compute bounding surfaces and geometric center of host assembled product in world coordinates
    group.updateMatrixWorld(true);
    const hostBounds = new THREE.Box3().setFromObject(group);
    const hostCenter = new THREE.Vector3();
    hostBounds.getCenter(hostCenter);

    addonGroup.updateMatrixWorld(true);
    const addonBounds = new THREE.Box3().setFromObject(addonGroup);

    const matchingAddon = definition.compatibleAddons?.find((a) =>
      options.addonProductId ? a.addonProductId === options.addonProductId : a.addonType === options.activeAddon
    );

    const resolvedMountingSide: "front" | "back" =
      options.addonMountingSide ??
      (matchingAddon?.allowedSides === "back"
        ? "back"
        : matchingAddon?.allowedSides === "front"
          ? "front"
          : matchingAddon?.defaultSide ?? (
              options.addonConfig?.mountPosition === "rear" || (options.addonConfig?.zOffsetMm !== undefined && options.addonConfig.zOffsetMm < 0)
                ? "back"
                : "front"
            ));

    // Position on front or back of product with an 8mm clearance gap, aligned with host product frame center (world origin)
    const clearanceGapMeters = 0.008;
    const localX = scaleX > 0 ? (0 - group.position.x) / scaleX : 0;
    const localY = scaleY > 0 ? (0 - group.position.y) / scaleY : 0;

    // In architectural window/door systems:
    // - "back" is the Interior face (inside the room, where operator handles, cam handles, and cranks reside) -> positive Z (+Z)
    // - "front" is the Exterior face (outside the building, where window sills and weather drip caps project) -> negative Z (-Z)
    const targetWorldZ = resolvedMountingSide === "back"
      ? hostBounds.max.z - addonBounds.min.z + clearanceGapMeters
      : hostBounds.min.z - addonBounds.max.z - clearanceGapMeters;

    const localZ = scaleZ > 0
      ? (targetWorldZ - group.position.z) / scaleZ
      : targetWorldZ;

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

  group.userData.productId = definition.product?.productId;
  group.userData.templateId = definition.template?.templateId;
  group.userData.resolvedStructure = resolved;

  return group;
}

function isTargetPartHorizontal(
  foundObj: THREE.Object3D | null,
  compDef?: ProductComponentDefinition | null,
  key?: string
): boolean {
  const kLower = (key || compDef?.componentKey || "").toLowerCase();
  const nLower = (compDef?.componentName || foundObj?.name || "").toLowerCase();

  // 1. Explicit keywords indicating horizontal parts (e.g. horizontal cam handle, awning handle, cam latch)
  if (
    kLower.includes("horizontal") ||
    kLower.includes("horiz") ||
    kLower.includes("cam_handle") ||
    kLower.includes("cam_latch") ||
    kLower.includes("camhandle") ||
    kLower.includes("camlock") ||
    nLower.includes("horizontal") ||
    nLower.includes("horiz") ||
    nLower.includes("cam_handle") ||
    nLower.includes("cam_latch") ||
    nLower.includes("camhandle") ||
    nLower.includes("camlock")
  ) {
    return true;
  }

  // 2. Explicit keywords indicating vertical hardware (e.g. jalousie operator, cremone bolt, espagnolette)
  if (
    kLower.includes("vertical") ||
    kLower.includes("vert") ||
    kLower.includes("operator") ||
    kLower.includes("rotopers") ||
    kLower.includes("cremone") ||
    nLower.includes("vertical") ||
    nLower.includes("vert") ||
    nLower.includes("operator") ||
    nLower.includes("rotopers") ||
    nLower.includes("cremone")
  ) {
    return false;
  }

  if (compDef?.model?.sourceDimensionsMm) {
    const w = compDef.model.sourceDimensionsMm.width;
    const h = compDef.model.sourceDimensionsMm.height;
    if (w > 0 && h > 0) {
      if (w > h * 1.05) return true;
      if (h > w * 1.05) return false;
    }
  }

  if (foundObj) {
    foundObj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(foundObj);
    const sz = b.getSize(new THREE.Vector3());
    if (sz.x > sz.y * 1.05) {
      return true;
    }
    if (sz.y > sz.x * 1.05) {
      return false;
    }
  }

  return false;
}

function resolveHostTargetCoordinates(
  targetKey: string,
  hostGroup?: THREE.Group,
  definition?: ProductStructuralDefinition,
  cache?: ComponentModelCache,
): { x: number; y: number; z: number; isHorizontal?: boolean } | null {
  if (hostGroup) {
    hostGroup.updateMatrixWorld(true);
    let found: THREE.Object3D | null = null;
    hostGroup.traverse((child) => {
      if (found) return;
      if (
        child.userData?.componentKey === targetKey ||
        child.userData?.componentId === targetKey ||
        child.name === targetKey
      ) {
        found = child;
      }
    });
    if (found) {
      (found as THREE.Object3D).updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(found);
      const c = new THREE.Vector3();
      b.getCenter(c);
      const comp = definition?.components?.find(
        (cp) => cp.componentKey === targetKey || cp.componentId === targetKey
      );
      const isHorizontal = isTargetPartHorizontal(found, comp, targetKey);
      return { x: c.x, y: c.y, z: c.z, isHorizontal };
    }
  }

  // Fallback: check definition.components and cache
  if (definition && cache) {
    const comp = definition.components?.find(
      (c) => c.componentKey === targetKey || c.componentId === targetKey
    );
    if (comp) {
      try {
        let m: THREE.Object3D | null = null;
        try {
          m = cache.getClone(comp.componentId);
        } catch {
          m = cache.getClone(comp.componentKey);
        }
        if (m) {
          m.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(m);
          const c = new THREE.Vector3();
          b.getCenter(c);
          const isHorizontal = isTargetPartHorizontal(m, comp, targetKey);
          return { x: c.x, y: c.y, z: c.z, isHorizontal };
        }
      } catch {
        // ignore missing model in fallback
      }
    }
  }

  return null;
}

function resolveAllHostTargetCoordinates(
  targetKeys: string[],
  hostGroup?: THREE.Group,
  definition?: ProductStructuralDefinition,
  cache?: ComponentModelCache,
): Array<{ x: number; y: number; z: number; targetKey: string; isHorizontal?: boolean }> {
  const results: Array<{ x: number; y: number; z: number; targetKey: string; isHorizontal?: boolean }> = [];

  if (hostGroup) {
    hostGroup.updateMatrixWorld(true);

    // 1. Check if host has dynamic jalousie operator instances (IMP-MS81, QAD-TC96.12)
    const operatorInstances: THREE.Object3D[] = [];
    hostGroup.traverse((child) => {
      if (child.userData?.isLouverOperatorInstance === true) {
        if (
          targetKeys.length === 0 ||
          targetKeys.some(
            (k) =>
              child.userData?.componentKey === k ||
              child.userData?.componentId === k ||
              child.name.toLowerCase().includes("operator") ||
              k.toLowerCase().includes("operator")
          )
        ) {
          operatorInstances.push(child);
        }
      }
    });

    if (operatorInstances.length > 0) {
      // Sort vertically from bottom to top
      operatorInstances.sort((a, b) => a.position.y - b.position.y);
      for (const op of operatorInstances) {
        op.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(op);
        const c = new THREE.Vector3();
        b.getCenter(c);
        const comp = definition?.components?.find(
          (cp) => cp.componentKey === op.userData?.componentKey || cp.componentId === op.userData?.componentId
        );
        const isHorizontal = isTargetPartHorizontal(op, comp, op.userData?.componentKey);
        results.push({
          x: c.x,
          y: c.y,
          z: c.z,
          targetKey: op.userData?.componentKey || targetKeys[0] || "operator",
          isHorizontal,
        });
      }
      return results;
    }

    // 2. Otherwise search for matching objects for each key in targetKeys
    for (const targetKey of targetKeys) {
      let found: THREE.Object3D | null = null;
      hostGroup.traverse((child) => {
        if (found) return;
        if (
          child.userData?.componentKey === targetKey ||
          child.userData?.componentId === targetKey ||
          child.name === targetKey
        ) {
          found = child;
        }
      });
      if (found) {
        (found as THREE.Object3D).updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(found);
        const c = new THREE.Vector3();
        b.getCenter(c);
        const comp = definition?.components?.find(
          (cp) => cp.componentKey === targetKey || cp.componentId === targetKey
        );
        const isHorizontal = isTargetPartHorizontal(found, comp, targetKey);
        results.push({ x: c.x, y: c.y, z: c.z, targetKey, isHorizontal });
      }
    }
  }

  // Fallback to resolveHostTargetCoordinates if results is empty
  if (results.length === 0 && targetKeys.length > 0) {
    for (const targetKey of targetKeys) {
      const coords = resolveHostTargetCoordinates(targetKey, hostGroup, definition, cache);
      if (coords) {
        results.push({ ...coords, targetKey });
      }
    }
  }

  return results;
}

function buildAddonAttachment(
  definition: ProductStructuralDefinition,
  targetWidthMm: number,
  targetHeightMm: number,
  cache: ComponentModelCache,
  options: ParametricProductBuilderOptions,
  hostGroup?: THREE.Group,
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
    const addonNaturalBounds = new THREE.Box3();
    let hasAddonGeom = false;
    for (const comp of matchingAddon.components) {
      try {
        let m: THREE.Object3D | null = null;
        try { m = cache.getClone(comp.componentId); } catch { m = cache.getClone(comp.componentKey); }
        if (m) {
          m.updateMatrixWorld(true);
          addonNaturalBounds.expandByObject(m);
          hasAddonGeom = true;
        }
      } catch {
        // ignore missing model in measurement pass
      }
    }

    const addonNaturalCenter = new THREE.Vector3();
    const addonNaturalSize = new THREE.Vector3();
    if (hasAddonGeom) {
      addonNaturalBounds.getCenter(addonNaturalCenter);
      addonNaturalBounds.getSize(addonNaturalSize);
    }

    const scaleX = addonNaturalSize.x > 0.0001 ? targetWidthM / addonNaturalSize.x : 1;
    const scaleY = addonNaturalSize.y > 0.0001 ? targetHeightM / addonNaturalSize.y : 1;
    const addonBaseCenterX = hasAddonGeom ? addonNaturalCenter.x : 0;

    const uploadedGroup = new THREE.Group();
    uploadedGroup.name = `Addon_${addonType === "screen" ? "Screen" : "Grill"}_Assembly_Content`;

    let clonedCount = 0;
    for (const comp of matchingAddon.components) {
      const toggleKey = comp.togglePropertyKey || `has_${comp.componentKey.replace(/-/g, "_")}`;
      const isHatch = Boolean(
        comp.componentKey.toLowerCase().includes("hatch") ||
        (comp.componentName || "").toLowerCase().includes("hatch") ||
        Boolean(comp.togglePropertyKey && comp.togglePropertyKey.toLowerCase().includes("hatch"))
      );
      const isRemovableExcluded = Boolean(
        (comp.isRemovable || comp.togglePropertyKey || isHatch) &&
        options.removableStates && (
          options.removableStates[comp.componentId] === false ||
          options.removableStates[comp.componentKey] === false ||
          options.removableStates[toggleKey] === false ||
          (comp.togglePropertyKey && options.removableStates[comp.togglePropertyKey] === false) ||
          (isHatch && (
            options.removableStates["screen_access_hatch"] === false ||
            options.removableStates["has_screen_access_hatch"] === false ||
            options.removableStates["has_hatch"] === false
          ))
        )
      );
      if (isRemovableExcluded) {
        continue;
      }

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
          clone.userData.dimensionBinding = comp.dimensionBinding ?? (comp as Record<string, unknown>).dimension_binding ?? "FIXED";

          const isHatch = Boolean(
            comp.componentKey.toLowerCase().includes("hatch") ||
            (comp.componentName || "").toLowerCase().includes("hatch") ||
            Boolean(comp.togglePropertyKey && comp.togglePropertyKey.toLowerCase().includes("hatch"))
          );

          const targetOperatorKeys = options.hatchTargetComponentKeys ?? matchingAddon.hatchTargetComponentKeys ?? [];

          if (isHatch && targetOperatorKeys.length > 0) {
            clone.updateMatrixWorld(true);
            const partBox = new THREE.Box3().setFromObject(clone);
            const partCenter = new THREE.Vector3();
            partBox.getCenter(partCenter);

            const resolvedTargets = resolveAllHostTargetCoordinates(targetOperatorKeys, hostGroup, definition, cache);

            for (let i = 0; i < resolvedTargets.length; i++) {
              const targetCoords = resolvedTargets[i];
              const targetKey = targetCoords.targetKey;
              const targetXi = targetCoords.x;
              const targetYi = targetCoords.y;

              const targetComp = definition?.components?.find(
                (c) => c.componentKey === targetKey || c.componentId === targetKey
              );
              // Only make the screen hatch horizontal when the target part is also horizontal
              const isHorizontalHatch = Boolean(
                targetCoords.isHorizontal ?? (
                  targetComp?.model?.sourceDimensionsMm
                    ? targetComp.model.sourceDimensionsMm.width > targetComp.model.sourceDimensionsMm.height * 1.05
                    : false
                )
              );

              let hatchInstanceMesh: THREE.Object3D | null = null;
              try {
                hatchInstanceMesh = cache.getClone(comp.componentId);
              } catch {
                hatchInstanceMesh = cache.getClone(comp.componentKey);
              }
              if (!hatchInstanceMesh) continue;

              // Rotate 90 degrees around Z if operator is on top/bottom rail (IMP-MS80)
              if (isHorizontalHatch) {
                hatchInstanceMesh.rotation.z = Math.PI / 2;
                hatchInstanceMesh.updateMatrixWorld(true);
              }

              hatchInstanceMesh.updateMatrixWorld(true);
              const origBox = new THREE.Box3().setFromObject(hatchInstanceMesh);
              const origCenter = new THREE.Vector3();
              origBox.getCenter(origCenter);
              const origSize = new THREE.Vector3();
              origBox.getSize(origSize);

              hatchInstanceMesh.position.sub(origCenter);
              hatchInstanceMesh.updateMatrixWorld(true);

              let finalMesh = hatchInstanceMesh;
              const targetHanding: "left" | "right" = targetXi >= 0 ? "right" : "left";
              const modeledHanding: "left" | "right" = (origCenter.x - addonBaseCenterX) >= 0 ? "right" : "left";

              if (!isHorizontalHatch && targetHanding !== modeledHanding) {
                finalMesh = mirrorObjectHierarchyAcrossX(hatchInstanceMesh);
                finalMesh.updateMatrixWorld(true);
                const postBox = new THREE.Box3().setFromObject(finalMesh);
                const postCenter = new THREE.Vector3();
                postBox.getCenter(postCenter);
                finalMesh.position.sub(postCenter);
                finalMesh.updateMatrixWorld(true);
              }

              // Clamp hatch coordinates so it stays strictly within the screen perimeter
              const halfHatchW = origSize.x / 2;
              const halfHatchH = origSize.y / 2;
              const screenHalfW = targetWidthM / 2;
              const screenHalfH = targetHeightM / 2;
              const frameRailMargin = 0.02; // 20mm extrusion rail margin

              let clampedXi = targetXi;
              let clampedYi = targetYi;

              if (isHorizontalHatch) {
                if (targetYi - halfHatchH < -screenHalfH) {
                  clampedYi = -screenHalfH + frameRailMargin + halfHatchH;
                } else if (targetYi + halfHatchH > screenHalfH) {
                  clampedYi = screenHalfH - frameRailMargin - halfHatchH;
                }
              }

              if (Math.abs(targetXi) + halfHatchW > screenHalfW) {
                clampedXi = targetXi >= 0
                  ? screenHalfW - halfHatchW
                  : -screenHalfW + halfHatchW;
              }

              const container = new THREE.Group();
              container.name = `${comp.componentKey || "screen_access_hatch"}_${isHorizontalHatch ? "horiz" : targetHanding}_instance_${i}`;
              container.userData = {
                ...clone.userData,
                componentId: comp.componentId,
                componentKey: comp.componentKey,
                componentName: comp.componentName,
                componentType: comp.componentType,
                presentationCategory: comp.presentationCategory,
                dimensionBinding: "FIXED",
                isFixedDimension: true,
                isAddon: true,
                addonType: "screen",
                hatchIndex: i,
                targetComponentKey: targetKey,
                isHorizontalHatch,
                isMirroredHanding: !isHorizontalHatch && targetHanding !== modeledHanding,
                isHatchClone: true,
              };
              container.add(finalMesh);

              const localTargetX = scaleX > 0 ? (clampedXi / scaleX) + addonNaturalCenter.x : clampedXi;
              const localTargetY = scaleY > 0 ? (clampedYi / scaleY) + addonNaturalCenter.y : clampedYi;
              container.position.set(localTargetX, localTargetY, origCenter.z);

              uploadedGroup.add(container);
              clonedCount++;
            }
            continue;
          }

          const swapped = options.swappedAccessories?.[comp.componentId] ?? options.swappedAccessories?.[comp.componentKey];
          const hasHanding = Boolean(
            comp.positionOptions?.allowHorizontalToggle ||
            (comp.isAccessorySlot && comp.positionOptions?.defaultHorizontal) ||
            (swapped?.horizontalPosition && comp.positionOptions?.allowHorizontalToggle)
          );
          if (hasHanding) {
            clone.updateMatrixWorld(true);
            const partBox = new THREE.Box3().setFromObject(clone);
            const partCenter = new THREE.Vector3();
            const partSize = new THREE.Vector3();
            partBox.getCenter(partCenter);
            partBox.getSize(partSize);
            const deltaX = partCenter.x - addonBaseCenterX;
            const modeledHanding: "left" | "right" = deltaX >= 0 ? "right" : "left";
            const activeHanding: "left" | "right" = swapped?.horizontalPosition ?? comp.positionOptions?.defaultHorizontal ?? modeledHanding;

            const halfPartW = partSize.x / 2;
            const modeledOuterEdgeDist = modeledHanding === "right"
              ? (partBox.max.x - addonBaseCenterX)
              : (addonBaseCenterX - partBox.min.x);

            let targetX: number;
            if (hasAddonGeom && scaleX > 0 && Math.abs(scaleX - 1) > 0.0001) {
              if (activeHanding === "right") {
                targetX = addonBaseCenterX + modeledOuterEdgeDist - (halfPartW / scaleX);
              } else {
                targetX = addonBaseCenterX - modeledOuterEdgeDist + (halfPartW / scaleX);
              }
            } else {
              targetX = activeHanding === "left" ? (addonBaseCenterX - Math.abs(deltaX)) : (addonBaseCenterX + Math.abs(deltaX));
            }

            if (activeHanding === modeledHanding) {
              const container = new THREE.Group();
              container.name = `${comp.componentName || "part"}_${activeHanding}`;
              container.userData = { ...clone.userData, isMirroredHanding: false, isFixedDimension: true };
              clone.position.sub(partCenter);
              container.add(clone);
              container.position.set(targetX, partCenter.y, partCenter.z);
              uploadedGroup.add(container);
            } else {
              const mountedPart = mirrorPartAcrossCenterline(
                clone,
                addonBaseCenterX,
                activeHanding,
                undefined,
                undefined,
                targetX
              );
              mountedPart.userData = { ...clone.userData, isMirroredHanding: true, isFixedDimension: true };
              uploadedGroup.add(mountedPart);
            }
          } else {
            const isFixed = Boolean(
              comp.dimensionBinding === "FIXED" ||
              (comp as Record<string, unknown>).dimension_binding === "FIXED"
            );
            if (isFixed) {
              clone.updateMatrixWorld(true);
              const partBox = new THREE.Box3().setFromObject(clone);
              const partCenter = new THREE.Vector3();
              const partSize = new THREE.Vector3();
              partBox.getCenter(partCenter);
              partBox.getSize(partSize);

              const deltaX = partCenter.x - addonBaseCenterX;
              const halfPartW = partSize.x / 2;
              let targetX = partCenter.x;
              if (hasAddonGeom && scaleX > 0 && Math.abs(scaleX - 1) > 0.0001) {
                if (deltaX > 0.02) {
                  const modeledOuterEdgeDist = partBox.max.x - addonBaseCenterX;
                  targetX = addonBaseCenterX + modeledOuterEdgeDist - (halfPartW / scaleX);
                } else if (deltaX < -0.02) {
                  const modeledOuterEdgeDist = addonBaseCenterX - partBox.min.x;
                  targetX = addonBaseCenterX - modeledOuterEdgeDist + (halfPartW / scaleX);
                }
              }

              const container = new THREE.Group();
              container.name = `${comp.componentName || "part"}_container`;
              container.userData = { ...clone.userData, isFixedDimension: true };
              clone.position.sub(partCenter);
              container.add(clone);
              container.position.set(targetX, partCenter.y, partCenter.z);
              uploadedGroup.add(container);
            } else {
              uploadedGroup.add(clone);
            }
          }
          clonedCount++;
        }
      } catch {
        // Component not in cache or missing model
      }
    }

    if (clonedCount > 0) {
      // Center the internal mesh geometry so that (0, 0, 0) is the exact center of the add-on
      for (const child of uploadedGroup.children) {
        child.position.sub(addonNaturalCenter);
      }
      uploadedGroup.position.set(0, 0, 0);
      uploadedGroup.updateMatrixWorld(true);

      // Scale the uploaded group so it exactly spans targetWidthM and targetHeightM
      uploadedGroup.scale.set(scaleX, scaleY, 1);

      // Maintain 1:1 metric scale on fixed components within the add-on attachment
      if (scaleX !== 1 || scaleY !== 1) {
        uploadedGroup.children.forEach((child) => {
          const binding = child.userData?.dimensionBinding;
          const isFixed = Boolean(
            binding === "FIXED" ||
            child.userData?.isFixedDimension ||
            child.userData?.isAccessoryReplacement
          );
          if (isFixed) {
            child.scale.set(
              scaleX > 0 ? 1 / scaleX : 1,
              scaleY > 0 ? 1 / scaleY : 1,
              1
            );
          }
        });
      }
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
  const isHatchDisabled = Boolean(
    options.removableStates && (
      options.removableStates["screen_access_hatch"] === false ||
      options.removableStates["has_screen_access_hatch"] === false ||
      options.removableStates["has_hatch"] === false
    )
  );
  const targetOperatorKeys = options.hatchTargetComponentKeys ?? matchingAddon?.hatchTargetComponentKeys ?? [];
  const proceduralHasHatch = options.addonConfig?.hasHatch !== undefined
    ? options.addonConfig.hasHatch
    : (!isHatchDisabled && targetOperatorKeys.length > 0);

  const proceduralHatchPositions: { x: number; y: number }[] = [];
  let isAnyTargetHorizontal = false;
  if (hostGroup && targetOperatorKeys.length > 0) {
    const resolvedTargets = resolveAllHostTargetCoordinates(targetOperatorKeys, hostGroup, definition, cache);
    for (const target of resolvedTargets) {
      proceduralHatchPositions.push({ x: target.x, y: target.y });
      if (target.isHorizontal) {
        isAnyTargetHorizontal = true;
      }
    }
  }

  // Only make procedural screen hatch horizontal when the aligned target part is actually horizontal
  const isProceduralHorizHatch = isAnyTargetHorizontal;

  const proceduralGroup = buildParametricScreenGroup(
    targetWidthMm,
    targetHeightMm,
    {
      ...options.addonConfig,
      hasHatch: proceduralHasHatch,
      isHatchHorizontal: isProceduralHorizHatch,
      hatchPositions: options.addonConfig?.hatchPositions ?? (proceduralHatchPositions.length > 0 ? proceduralHatchPositions : undefined),
    },
    frameMat
  );

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
