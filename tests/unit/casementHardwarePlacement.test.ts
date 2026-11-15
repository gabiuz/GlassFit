/**
 * Unit and Acceptance Test Suite for Casement Window Hardware Placement
 * Verifies that casement window handles and friction stays properly track width and height adjustments
 * without protruding beyond outer frames or drifting off center meeting stiles.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";

import {
  autoDetectComponentSettings,
} from "../../src/lib/admin/products/autoDetection";

import {
  extractComponentClusters,
  buildParametricProduct,
} from "../../src/lib/visualization/parametricProductBuilder";

import { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";

import type {
  ProductStructuralDefinition,
  ResolvedStructure,
} from "../../src/lib/visualization/types";

describe("Casement Window Hardware Placement and Width Adjustment", () => {
  it("auto-detects friction stays and plural casement handles correctly as Hardware with FIXED dimension binding", () => {
    const frictionStaySettings = autoDetectComponentSettings("CW_Friction_Stays.glb");
    assert.strictEqual(frictionStaySettings.presentationCategory, "Hardware");
    assert.strictEqual(frictionStaySettings.componentType, "Hardware");
    assert.strictEqual(frictionStaySettings.dimensionBinding, "FIXED");

    const handlesSettings = autoDetectComponentSettings("CW_Handles.glb");
    assert.strictEqual(handlesSettings.presentationCategory, "Hardware");
    assert.strictEqual(handlesSettings.componentType, "Hardware");
    assert.strictEqual(handlesSettings.dimensionBinding, "FIXED");
    assert.strictEqual(handlesSettings.isAccessorySlot, undefined);

    const sashSettings = autoDetectComponentSettings("CW_Left_Sash_Frame.glb");
    assert.strictEqual(sashSettings.presentationCategory, "Framing");
    assert.strictEqual(sashSettings.dimensionBinding, "AREA");
    assert.strictEqual(sashSettings.spanRatio, 0.5);
  });

  it("decomposes bilateral handles into 2 distinct clusters at meeting stiles", () => {
    const handlesGroup = new THREE.Group();
    // Synthetic bilateral handle mesh: Left handle at [-0.197, -0.002], Right handle at [0.002, 0.197]
    const leftGeom = new THREE.BoxGeometry(0.195, 0.13, 0.05);
    leftGeom.translate(-0.0995, 0, 0.08);
    const leftMesh = new THREE.Mesh(leftGeom, new THREE.MeshBasicMaterial());

    const rightGeom = new THREE.BoxGeometry(0.195, 0.13, 0.05);
    rightGeom.translate(0.0995, 0, 0.08);
    const rightMesh = new THREE.Mesh(rightGeom, new THREE.MeshBasicMaterial());

    handlesGroup.add(leftMesh, rightMesh);
    handlesGroup.updateMatrixWorld(true);

    const clusters = extractComponentClusters(handlesGroup);
    assert.strictEqual(clusters.length, 2);

    const leftCluster = clusters.find((c) => c.modeledCenter.x < 0);
    const rightCluster = clusters.find((c) => c.modeledCenter.x > 0);

    assert.ok(leftCluster);
    assert.ok(rightCluster);
    assert.ok(leftCluster.maxX <= 0.001);
    assert.ok(rightCluster.minX >= -0.001);
  });

  it("decomposes 4-corner friction stays into 4 distinct clusters", () => {
    const staysGroup = new THREE.Group();
    // 4 stays at: Left-Top, Left-Bottom, Right-Top, Right-Bottom
    const stayGeom = new THREE.BoxGeometry(0.32, 0.005, 0.018);

    const lt = new THREE.Mesh(stayGeom.clone().translate(-0.71, 0.627, 0.02), new THREE.MeshBasicMaterial());
    const lb = new THREE.Mesh(stayGeom.clone().translate(-0.71, -0.627, 0.02), new THREE.MeshBasicMaterial());
    const rt = new THREE.Mesh(stayGeom.clone().translate(0.71, 0.627, 0.02), new THREE.MeshBasicMaterial());
    const rb = new THREE.Mesh(stayGeom.clone().translate(0.71, -0.627, 0.02), new THREE.MeshBasicMaterial());

    staysGroup.add(lt, lb, rt, rb);
    staysGroup.updateMatrixWorld(true);

    const clusters = extractComponentClusters(staysGroup);
    assert.strictEqual(clusters.length, 4);

    const leftStays = clusters.filter((c) => c.modeledCenter.x < 0);
    const rightStays = clusters.filter((c) => c.modeledCenter.x > 0);
    assert.strictEqual(leftStays.length, 2);
    assert.strictEqual(rightStays.length, 2);
  });

  it("anchors friction stays and handles properly when width is narrowed from 1880mm to 800mm", () => {
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

    // 1. Perimeter frame box: 1.88m wide (-0.94m to +0.94m), 1.38m high (-0.69m to +0.69m)
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.88, 1.38, 0.06));
    cacheMap.set("comp_frame", frameMesh);

    // 2. Friction stays: 4 stays modeled at +/-0.71m along X
    const staysGroup = new THREE.Group();
    const stayGeom = new THREE.BoxGeometry(0.32, 0.005, 0.018);
    staysGroup.add(
      new THREE.Mesh(stayGeom.clone().translate(-0.71, 0.627, 0.02)),
      new THREE.Mesh(stayGeom.clone().translate(-0.71, -0.627, 0.02)),
      new THREE.Mesh(stayGeom.clone().translate(0.71, 0.627, 0.02)),
      new THREE.Mesh(stayGeom.clone().translate(0.71, -0.627, 0.02))
    );
    cacheMap.set("comp_stays", staysGroup);

    // 3. Handles: bilateral handles meeting at X = 0
    const handlesGroup = new THREE.Group();
    const leftHandleGeom = new THREE.BoxGeometry(0.195, 0.13, 0.05);
    leftHandleGeom.translate(-0.0995, 0, 0.08);
    const rightHandleGeom = new THREE.BoxGeometry(0.195, 0.13, 0.05);
    rightHandleGeom.translate(0.0995, 0, 0.08);
    handlesGroup.add(
      new THREE.Mesh(leftHandleGeom),
      new THREE.Mesh(rightHandleGeom)
    );
    cacheMap.set("comp_handles", handlesGroup);

    const definition: ProductStructuralDefinition = {
      product: {
        productId: "casement-window",
        productName: "Casement Window",
        productType: "Casement Window",
        isAddon: false,
        isAccessory: false,
      },
      template: {
        templateId: "tpl-casement",
        templateName: "Casement Window Template",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {
          width: 1880,
          height: 1380,
        },
      },
      components: [
        {
          componentId: "comp_frame",
          componentKey: "cw_frame",
          componentName: "Outer Frame",
          componentType: "Frame",
          presentationCategory: "Framing",
          baseQuantity: 1,
          dimensionBinding: "PERIMETER",
          isRemovable: false,
          componentData: {},
          model: {
            assetId: "asset_frame",
            r2ObjectKey: "models/cw_frame.glb",
            url: "https://test.local/cw_frame.glb",
            fileName: "CW_Frame.glb",
            sourceDimensionsMm: { width: 1880, height: 1380, depth: 60 },
          },
        },
        {
          componentId: "comp_stays",
          componentKey: "cw_friction_stays",
          componentName: "Friction Stays",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
          model: {
            assetId: "asset_stays",
            r2ObjectKey: "models/cw_stays.glb",
            url: "https://test.local/cw_stays.glb",
            fileName: "CW_Friction_Stays.glb",
            sourceDimensionsMm: { width: 1880, height: 1380, depth: 20 },
          },
        },
        {
          componentId: "comp_handles",
          componentKey: "cw_handles",
          componentName: "Casement Handles",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
          model: {
            assetId: "asset_handles",
            r2ObjectKey: "models/cw_handles.glb",
            url: "https://test.local/cw_handles.glb",
            fileName: "CW_Handles.glb",
            sourceDimensionsMm: { width: 394, height: 130, depth: 50 },
          },
        },
      ],
      parameters: [],
      rules: [],
    };

    // Build at narrow width: 800mm (scaleX = 800 / 1880 ≈ 0.4255)
    const resolved: ResolvedStructure = {
      resolvedValues: { width: 800, height: 1380 },
      numericValuesMm: { width: 800, height: 1380 },
      componentQuantities: { cw_frame: 1, cw_friction_stays: 1, cw_handles: 1 },
      appliedRuleIds: [],
    };

    const built = buildParametricProduct(definition, resolved, cache);
    built.group.updateMatrixWorld(true);

    // Frame bounds in world space
    const frameObj = built.group.getObjectByName("Outer Frame");
    assert.ok(frameObj);
    frameObj.updateMatrixWorld(true);
    const frameBox = new THREE.Box3().setFromObject(frameObj);
    const frameW = frameBox.max.x - frameBox.min.x;
    assert.strictEqual(Math.round(frameW * 1000), 800);

    // Inspect friction stay clusters
    const stayClusters: THREE.Object3D[] = [];
    built.group.traverse((c) => {
      if (c.name.includes("Friction Stays_cluster")) {
        stayClusters.push(c);
      }
    });
    assert.strictEqual(stayClusters.length, 4);

    for (const stay of stayClusters) {
      stay.updateMatrixWorld(true);
      const stayBox = new THREE.Box3().setFromObject(stay);
      // Stay must not protrude beyond the outer window frame
      assert.ok(
        stayBox.min.x >= frameBox.min.x - 0.01,
        `Stay min.x (${stayBox.min.x.toFixed(4)}) must not extend past frame min.x (${frameBox.min.x.toFixed(4)})`
      );
      assert.ok(
        stayBox.max.x <= frameBox.max.x + 0.01,
        `Stay max.x (${stayBox.max.x.toFixed(4)}) must not extend past frame max.x (${frameBox.max.x.toFixed(4)})`
      );
    }

    // Inspect handle clusters
    const handleClusters: THREE.Object3D[] = [];
    built.group.traverse((c) => {
      if (c.name.includes("Casement Handles_cluster")) {
        handleClusters.push(c);
      }
    });
    assert.strictEqual(handleClusters.length, 2);

    for (const handle of handleClusters) {
      handle.updateMatrixWorld(true);
      const handleBox = new THREE.Box3().setFromObject(handle);
      // Handle must not protrude beyond the outer window frame
      assert.ok(
        handleBox.min.x >= frameBox.min.x - 0.01,
        `Handle min.x (${handleBox.min.x.toFixed(4)}) must not extend past frame min.x (${frameBox.min.x.toFixed(4)})`
      );
      assert.ok(
        handleBox.max.x <= frameBox.max.x + 0.01,
        `Handle max.x (${handleBox.max.x.toFixed(4)}) must not extend past frame max.x (${frameBox.max.x.toFixed(4)})`
      );
    }
  });
});
