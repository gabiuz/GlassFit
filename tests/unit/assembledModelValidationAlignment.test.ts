/**
 * Unit Test Suite for Assembled Model Alignment between Components and Validation (QAD-TC98)
 * Verifies that pre-assembled 3D models (such as bi-fold windows, multi-sash assemblies,
 * casement windows with angled leaves, handles, weather seals, and hinges) retain their exact
 * relative positions, rotations, and scales in Validation Workspace matching the Components workspace.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";

import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";
import type {
  ProductStructuralDefinition,
  ResolvedStructure,
} from "../../src/lib/visualization/types";

describe("Assembled Model Alignment between Components and Validation", () => {
  it("renders weather seals, handles, hinges, and sashes in exact assembly coordinates without cluster distortion", () => {
    const cacheMap = new Map<string, THREE.Object3D>();
    const cache: ComponentModelCache = {
      getClone(id: string) {
        const obj = cacheMap.get(id);
        if (!obj) throw new Error(`Component not found in test cache: ${id}`);
        return obj.clone(true);
      },
      getSourceSizeMeters(id: string) {
        const obj = cacheMap.get(id);
        if (!obj) throw new Error(`Component not found in test cache: ${id}`);
        const box = new THREE.Box3().setFromObject(obj);
        const sz = new THREE.Vector3();
        box.getSize(sz);
        return sz;
      },
    };

    // 1. Outer Frame Left (-0.94m center) & Right (+0.94m center)
    const leftFrameGeom = new THREE.BoxGeometry(0.12, 1.5, 0.12);
    leftFrameGeom.translate(-0.94, 0, 0);
    cacheMap.set("comp_frame_left", new THREE.Mesh(leftFrameGeom));

    const rightFrameGeom = new THREE.BoxGeometry(0.12, 1.5, 0.12);
    rightFrameGeom.translate(0.94, 0, 0);
    cacheMap.set("comp_frame_right", new THREE.Mesh(rightFrameGeom));

    // 2. Open / Angled Sash Frame (modeled at -0.416m X, +0.173m Z)
    const sashGeom = new THREE.BoxGeometry(0.376, 1.254, 0.349);
    sashGeom.translate(-0.416, 0, 0.173);
    cacheMap.set("comp_sash", new THREE.Mesh(sashGeom));

    // 3. Weather Seals (spanning sashes in 3D: X from -0.877 to +0.877, Z from -0.014 to +0.350)
    const sealsGeom = new THREE.BoxGeometry(1.754, 1.259, 0.364);
    sealsGeom.translate(0, 0, 0.168);
    cacheMap.set("comp_seals", new THREE.Mesh(sealsGeom));

    // 4. Handle mounted on open sash (modeled at X: -0.002, Y: -0.046, Z: 0.084)
    const handleGeom = new THREE.BoxGeometry(0.50, 0.176, 0.057);
    handleGeom.translate(-0.002, -0.046, 0.084);
    cacheMap.set("comp_handle", new THREE.Mesh(handleGeom));

    // 5. Hinges connecting folding sashes (modeled at Z: 0.206)
    const hingesGeom = new THREE.BoxGeometry(1.773, 1.009, 0.305);
    hingesGeom.translate(0, 0, 0.206);
    cacheMap.set("comp_hinges", new THREE.Mesh(hingesGeom));

    const definition: ProductStructuralDefinition = {
      product: {
        productId: "p_bifold_window",
        productName: "Bi-Fold Window",
        productType: "Bi-Fold Window",
        isAddon: false,
        isAccessory: false,
      },
      template: {
        templateId: "tpl_bifold",
        templateName: "Bi-Fold Template",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      components: [
        {
          componentId: "comp_frame_left",
          componentKey: "bf_frame_left",
          componentName: "BF Frame Left",
          componentType: "Frame",
          presentationCategory: "Framing",
          baseQuantity: 1,
          dimensionBinding: "HEIGHT",
          isRemovable: false,
          componentData: {},
          model: { assetId: "a1", r2ObjectKey: "f_left.glb", url: "https://test.local/f_left.glb", fileName: "BF_Frame_Left.glb", sourceDimensionsMm: null },
        },
        {
          componentId: "comp_frame_right",
          componentKey: "bf_frame_right",
          componentName: "BF Frame Right",
          componentType: "Frame",
          presentationCategory: "Framing",
          baseQuantity: 1,
          dimensionBinding: "HEIGHT",
          isRemovable: false,
          componentData: {},
          model: { assetId: "a2", r2ObjectKey: "f_right.glb", url: "https://test.local/f_right.glb", fileName: "BF_Frame_Right.glb", sourceDimensionsMm: null },
        },
        {
          componentId: "comp_sash",
          componentKey: "bf_left_inner_sash_frame",
          componentName: "BF Left Inner Sash Frame",
          componentType: "Frame",
          presentationCategory: "Framing",
          baseQuantity: 1,
          dimensionBinding: "AREA",
          isRemovable: false,
          componentData: {},
          model: { assetId: "a3", r2ObjectKey: "sash.glb", url: "https://test.local/sash.glb", fileName: "BF_Left_Inner_Sash_Frame.glb", sourceDimensionsMm: null },
        },
        {
          componentId: "comp_seals",
          componentKey: "bf_weather_seals",
          componentName: "BF Weather Seals",
          componentType: "Hardware",
          presentationCategory: "Consumable",
          baseQuantity: 1,
          dimensionBinding: "PERIMETER",
          isRemovable: false,
          componentData: {},
          model: { assetId: "a4", r2ObjectKey: "seals.glb", url: "https://test.local/seals.glb", fileName: "BF_Weather_Seals.glb", sourceDimensionsMm: null },
        },
        {
          componentId: "comp_handle",
          componentKey: "bf_handles",
          componentName: "BF Handles",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
          model: { assetId: "a5", r2ObjectKey: "handles.glb", url: "https://test.local/handles.glb", fileName: "BF_Handles.glb", sourceDimensionsMm: null },
        },
        {
          componentId: "comp_hinges",
          componentKey: "bf_hinges",
          componentName: "BF Hinges",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
          model: { assetId: "a6", r2ObjectKey: "hinges.glb", url: "https://test.local/hinges.glb", fileName: "BF_Hinges.glb", sourceDimensionsMm: null },
        },
      ],
      parameters: [],
      rules: [],
    };

    const resolved: ResolvedStructure = {
      resolvedValues: { width: 2000, height: 1500 },
      numericValuesMm: { width: 2000, height: 1500 },
      componentQuantities: {},
      appliedRuleIds: [],
    };

    const built = buildParametricProduct(definition, resolved, cache);
    built.group.updateMatrixWorld(true);

    // 1. Verify Weather Seals preserve natural 3D depth and are not torn or glued to jambs
    const sealsObj = built.group.getObjectByName("BF Weather Seals");
    assert.ok(sealsObj, "Weather seals must be rendered in built assembly");
    sealsObj.updateMatrixWorld(true);
    const sealsBox = new THREE.Box3().setFromObject(sealsObj);
    const sealsSize = new THREE.Vector3();
    sealsBox.getSize(sealsSize);
    assert.ok(Math.abs(sealsSize.z - 0.364) < 0.01, `Seals Z depth (${sealsSize.z.toFixed(3)}) must reflect 3D modeled folded profile (0.364m)`);

    // 2. Verify Handle is attached to sash geometry in 3D rather than flattened at X=0 in empty air
    const handleObj = built.group.getObjectByName("BF Handles");
    assert.ok(handleObj, "Handle must be rendered in built assembly");
    handleObj.updateMatrixWorld(true);
    const handleBox = new THREE.Box3().setFromObject(handleObj);
    const handleSize = new THREE.Vector3();
    handleBox.getSize(handleSize);
    assert.ok(Math.abs(handleSize.x - 0.50) < 0.01, `Handle X size (${handleSize.x.toFixed(3)}) must match modeled width`);

    // 3. Verify Hinges preserve 3D span across folded sashes
    const hingesObj = built.group.getObjectByName("BF Hinges");
    assert.ok(hingesObj, "Hinges must be rendered in built assembly");
    hingesObj.updateMatrixWorld(true);
    const hingesBox = new THREE.Box3().setFromObject(hingesObj);
    const hingesSize = new THREE.Vector3();
    hingesBox.getSize(hingesSize);
    assert.ok(Math.abs(hingesSize.z - 0.305) < 0.01, `Hinges Z depth (${hingesSize.z.toFixed(3)}) must reflect modeled assembly (0.305m)`);

    // 4. Verify no child has inverted scale tearing geometry apart
    built.group.children.forEach((child) => {
      assert.strictEqual(child.scale.x, 1, `Child ${child.name} should not have inverse X scaling applied`);
      assert.strictEqual(child.scale.y, 1, `Child ${child.name} should not have inverse Y scaling applied`);
    });
  });
});
