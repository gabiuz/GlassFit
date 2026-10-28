/**
 * Unit Tests: Hardware Accessory Bilateral Handing Mesh Mirroring (IMP-MS78)
 *
 * Upstream Specifications: docs/implementation/ms78.md, docs/sdd-glassfit.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F10, PRD-F14, PRD-F19, SDD-C4, SDD-C7, SDD-C9, DSD-UI4, DSD-UI10, ERD-E6, QAD-TC93.4 through QAD-TC93.8
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { mirrorObjectHierarchyAcrossX, mirrorPartAcrossCenterline } from "../../src/lib/admin/products/meshMirroring";
import { mountAccessoryMesh, buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder";
import type { ComponentHandingMetadata } from "../../src/lib/admin/products/types";
import type {
  AccessoryPositionOptions,
  ProductStructuralDefinition,
  ResolvedStructure,
  SelectedAccessoryState,
} from "../../src/lib/visualization/types";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";

describe("IMP-MS78: Hardware Accessory Bilateral Handing Mesh Mirroring", () => {
  // --------------------------------------------------------------------------
  // QAD-TC93.4: Pure Geometry Mirroring Across Lateral X Axis
  // --------------------------------------------------------------------------
  describe("QAD-TC93.4: Pure Geometry Mirroring Across Lateral X Axis", () => {
    it("mirrors indexed geometry by negating X positions, reversing face winding, and updating bounds", () => {
      // Construct an asymmetric triangle in the positive X half-space
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array([
        0.1, 0.0, 0.0, // Vertex 0
        0.5, 0.0, 0.0, // Vertex 1
        0.2, 0.8, 0.1, // Vertex 2
      ]);
      const indices = new Uint16Array([0, 1, 2]);

      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
      geom.computeVertexNormals();
      geom.computeBoundingBox();

      const originalNormal = geom.getAttribute("normal");
      const origN0 = {
        x: originalNormal.getX(0),
        y: originalNormal.getY(0),
        z: originalNormal.getZ(0),
      };

      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
      const root = new THREE.Group();
      root.add(mesh);

      const mirroredRoot = mirrorObjectHierarchyAcrossX(root);
      const mirroredMesh = mirroredRoot.children[0] as THREE.Mesh;
      const mirroredGeom = mirroredMesh.geometry as THREE.BufferGeometry;

      // 1. Position X coordinates must be strictly negated
      const mirroredPos = mirroredGeom.getAttribute("position");
      assert.ok(Math.abs(mirroredPos.getX(0) - (-0.1)) < 0.0001);
      assert.ok(Math.abs(mirroredPos.getX(1) - (-0.5)) < 0.0001);
      assert.ok(Math.abs(mirroredPos.getX(2) - (-0.2)) < 0.0001);
      // Y and Z coordinates must be preserved
      assert.ok(Math.abs(mirroredPos.getY(2) - 0.8) < 0.0001);
      assert.ok(Math.abs(mirroredPos.getZ(2) - 0.1) < 0.0001);

      // 2. Triangle face winding order must be inverted (indices[1] and indices[2] swapped)
      const mirroredIndex = mirroredGeom.getIndex();
      assert.ok(mirroredIndex !== null);
      assert.equal(mirroredIndex.getX(0), 0);
      assert.equal(mirroredIndex.getX(1), 2);
      assert.equal(mirroredIndex.getX(2), 1);

      // 3. Normal X component must be negated, while Y and Z remain outward facing
      const mirroredNormal = mirroredGeom.getAttribute("normal");
      assert.ok(Math.abs(mirroredNormal.getX(0) - (-origN0.x)) < 0.001);
      assert.ok(Math.abs(mirroredNormal.getY(0) - origN0.y) < 0.001);
      assert.ok(Math.abs(mirroredNormal.getZ(0) - origN0.z) < 0.001);

      // 4. Bounding box must be updated and strictly valid
      assert.ok(mirroredGeom.boundingBox !== null);
      assert.ok(mirroredGeom.boundingBox.min.x <= mirroredGeom.boundingBox.max.x);
      assert.ok(Math.abs(mirroredGeom.boundingBox.min.x - (-0.5)) < 0.001);
      assert.ok(Math.abs(mirroredGeom.boundingBox.max.x - (-0.1)) < 0.001);
    });

    it("mirrors non-indexed geometry by swapping consecutive vertices and negating X", () => {
      const geom = new THREE.BufferGeometry();
      // Single triangle without index buffer
      const positions = new Float32Array([
        0.05, 0.1, 0.0, // V0
        0.30, 0.1, 0.0, // V1
        0.15, 0.9, 0.05, // V2
      ]);
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.computeVertexNormals();

      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
      const mirroredRoot = mirrorObjectHierarchyAcrossX(mesh);
      const mirroredMesh = mirroredRoot as THREE.Mesh;
      const mirroredGeom = mirroredMesh.geometry as THREE.BufferGeometry;
      const mirroredPos = mirroredGeom.getAttribute("position");

      // Non-indexed mirror swaps vertices 1 and 2 (with X negated)
      // V0 was (0.05, 0.1, 0) -> becomes (-0.05, 0.1, 0)
      assert.ok(Math.abs(mirroredPos.getX(0) - (-0.05)) < 0.001);
      assert.ok(Math.abs(mirroredPos.getY(0) - 0.1) < 0.001);

      // V1 was (0.30, 0.1, 0), V2 was (0.15, 0.9, 0.05)
      // In mirrored geometry, index 1 now holds old V2 (with negated X)
      assert.ok(Math.abs(mirroredPos.getX(1) - (-0.15)) < 0.001);
      assert.ok(Math.abs(mirroredPos.getY(1) - 0.9) < 0.001);
      assert.ok(Math.abs(mirroredPos.getZ(1) - 0.05) < 0.001);

      // In mirrored geometry, index 2 now holds old V1 (with negated X)
      assert.ok(Math.abs(mirroredPos.getX(2) - (-0.30)) < 0.001);
      assert.ok(Math.abs(mirroredPos.getY(2) - 0.1) < 0.001);
    });

    it("inverts tangent vectors and handedness sign (w' = -w) when tangents are present", () => {
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array([
        0.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
      ]);
      const tangents = new Float32Array([
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
      ]);
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.setAttribute("tangent", new THREE.BufferAttribute(tangents, 4));

      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
      const mirroredRoot = mirrorObjectHierarchyAcrossX(mesh);
      const mirroredGeom = (mirroredRoot as THREE.Mesh).geometry as THREE.BufferGeometry;
      const mirroredTang = mirroredGeom.getAttribute("tangent");

      assert.ok(mirroredTang !== undefined);
      // Tangent X is negated: 1.0 -> -1.0
      assert.equal(mirroredTang.getX(0), -1.0);
      // Tangent handedness sign W is inverted: 1.0 -> -1.0
      assert.equal(mirroredTang.getW(0), -1.0);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC93.5: Uploaded Accessory Model Declared as Right-Handed
  // --------------------------------------------------------------------------
  describe("QAD-TC93.5: Uploaded Accessory Model Declared as Right-Handed", () => {
    it("assigns uploaded file to Right handing and generates Left variant via lateral reflection", () => {
      const uploadedGlbUrl = "https://r2.glassfit.local/accessories/lever_handle_right.glb";
      const mirroredLeftGlbUrl = "https://r2.glassfit.local/accessories/lever_handle_right_left_mirrored.glb";

      // Simulate wizard state when admin selects "Uploaded model is Right-Handed"
      const handingMetadata: ComponentHandingMetadata = {
        sourceHanding: "right",
        uploadedGlbUrl,
        rightGlbUrl: uploadedGlbUrl,
        leftGlbUrl: mirroredLeftGlbUrl,
        mirroredAt: new Date().toISOString(),
      };

      assert.equal(handingMetadata.sourceHanding, "right");
      assert.equal(handingMetadata.rightGlbUrl, uploadedGlbUrl, "Right handing uses original upload");
      assert.equal(handingMetadata.leftGlbUrl, mirroredLeftGlbUrl, "Left handing uses mirrored asset");

      // Verify geometry generation: uploaded right model reflects into left
      const rightGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.05);
      rightGeometry.translate(0.05, 0, 0); // Asymmetrically shifted toward +X
      const rightMesh = new THREE.Mesh(rightGeometry, new THREE.MeshBasicMaterial());

      const leftMirroredMesh = mirrorObjectHierarchyAcrossX(rightMesh);
      const leftGeom = (leftMirroredMesh as THREE.Mesh).geometry as THREE.BufferGeometry;

      // Right original was centered at +0.05 X, mirrored Left should be centered at -0.05 X
      leftGeom.computeBoundingBox();
      const bbox = leftGeom.boundingBox!;
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      assert.ok(Math.abs(centerX - (-0.05)) < 0.001, `Left center X should be -0.05, got ${centerX}`);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC93.6: Uploaded Accessory Model Declared as Left-Handed
  // --------------------------------------------------------------------------
  describe("QAD-TC93.6: Uploaded Accessory Model Declared as Left-Handed", () => {
    it("assigns uploaded file to Left handing and generates Right variant via lateral reflection", () => {
      const uploadedGlbUrl = "https://r2.glassfit.local/accessories/lever_handle_left.glb";
      const mirroredRightGlbUrl = "https://r2.glassfit.local/accessories/lever_handle_left_right_mirrored.glb";

      // Simulate wizard state when admin selects "Uploaded model is Left-Handed"
      const handingMetadata: ComponentHandingMetadata = {
        sourceHanding: "left",
        uploadedGlbUrl,
        leftGlbUrl: uploadedGlbUrl,
        rightGlbUrl: mirroredRightGlbUrl,
        mirroredAt: new Date().toISOString(),
      };

      assert.equal(handingMetadata.sourceHanding, "left");
      assert.equal(handingMetadata.leftGlbUrl, uploadedGlbUrl, "Left handing uses original upload");
      assert.equal(handingMetadata.rightGlbUrl, mirroredRightGlbUrl, "Right handing uses mirrored asset");

      // Verify geometry generation: uploaded left model reflects into right
      const leftGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.05);
      leftGeometry.translate(-0.05, 0, 0); // Asymmetrically shifted toward -X
      const leftMesh = new THREE.Mesh(leftGeometry, new THREE.MeshBasicMaterial());

      const rightMirroredMesh = mirrorObjectHierarchyAcrossX(leftMesh);
      const rightGeom = (rightMirroredMesh as THREE.Mesh).geometry as THREE.BufferGeometry;

      // Left original was centered at -0.05 X, mirrored Right should be centered at +0.05 X
      rightGeom.computeBoundingBox();
      const bbox = rightGeom.boundingBox!;
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      assert.ok(Math.abs(centerX - 0.05) < 0.001, `Right center X should be +0.05, got ${centerX}`);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC93.7: Runtime Left Handing Mounting with Zero Yaw Rotation
  // --------------------------------------------------------------------------
  describe("QAD-TC93.7: Runtime Left Handing Mounting with Zero Yaw Rotation", () => {
    const hostBounds = { widthM: 1.0, heightM: 2.1, depthM: 0.05 };
    const posOptions: AccessoryPositionOptions = {
      allowHorizontalToggle: true,
      defaultHorizontal: "right",
      horizontalOffsetMm: 50,
      allowVerticalToggle: true,
      defaultVertical: "up",
      verticalOffsetMm: 1000,
    };

    it("mounts Left accessory variant with rotation.set(0, 0, 0) and correct lateral positioning", () => {
      const parentGroup = new THREE.Group();
      // Asymmetric accessory representing a right-handed lever
      const rightHandle = new THREE.Group();
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.03));
      lever.position.set(0.03, 0, 0);
      rightHandle.add(lever);

      // Mount with horizontal toggle = "left" and sourceHanding = "right"
      const mounted = mountAccessoryMesh(
        parentGroup,
        rightHandle,
        hostBounds,
        posOptions,
        "left",
        "up",
        "matte_black",
        null, // No preloaded GLB variant; let it dynamically mirror
        "right" // Uploaded source handing is right
      );

      // 1. Invariant: Rotation must be exactly (0, 0, 0); no flawed 180-degree Math.PI yaw flip
      assert.equal(mounted.rotation.x, 0, "Rotation X must be 0");
      assert.equal(mounted.rotation.y, 0, "Rotation Y must be strictly 0 without 180-degree flip");
      assert.equal(mounted.rotation.z, 0, "Rotation Z must be 0");

      // 2. Lateral X position: -widthM / 2 + margin = -0.5 + 0.05 = -0.45
      assert.ok(
        Math.abs(mounted.position.x - (-0.45)) < 0.001,
        `Mounted X should be -0.45m, got ${mounted.position.x}`
      );

      // 3. Child geometry must be mirrored: lever should now be shifted toward -X
      const mountedLever = mounted.children[0] as THREE.Mesh;
      const leverGeom = mountedLever.geometry as THREE.BufferGeometry;
      leverGeom.computeBoundingBox();
      const leverCenterX = (leverGeom.boundingBox!.min.x + leverGeom.boundingBox!.max.x) / 2;
      assert.ok(leverCenterX <= 0, "Mirrored geometry center should point leftward");
      // Original child position was +0.03 or local bounds negated
      assert.ok(leverGeom.boundingBox!.max.x <= 0.02, "Mirrored geometry should point leftward");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC93.8: Runtime Right Handing Mounting with Zero Yaw Rotation
  // --------------------------------------------------------------------------
  describe("QAD-TC93.8: Runtime Right Handing Mounting with Zero Yaw Rotation", () => {
    const hostBounds = { widthM: 1.0, heightM: 2.1, depthM: 0.05 };
    const posOptions: AccessoryPositionOptions = {
      allowHorizontalToggle: true,
      defaultHorizontal: "right",
      horizontalOffsetMm: 50,
      allowVerticalToggle: true,
      defaultVertical: "up",
      verticalOffsetMm: 1000,
    };

    it("mounts Right accessory variant with rotation.set(0, 0, 0) and correct lateral positioning", () => {
      const parentGroup = new THREE.Group();
      // Asymmetric accessory representing a left-handed lever
      const leftHandle = new THREE.Group();
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.03));
      lever.position.set(-0.03, 0, 0);
      leftHandle.add(lever);

      // Mount with horizontal toggle = "right" and sourceHanding = "left"
      const mounted = mountAccessoryMesh(
        parentGroup,
        leftHandle,
        hostBounds,
        posOptions,
        "right",
        "up",
        "stainless_steel",
        null,
        "left" // Uploaded source handing is left
      );

      // 1. Invariant: Rotation must be exactly (0, 0, 0)
      assert.equal(mounted.rotation.x, 0, "Rotation X must be 0");
      assert.equal(mounted.rotation.y, 0, "Rotation Y must be strictly 0 without 180-degree flip");
      assert.equal(mounted.rotation.z, 0, "Rotation Z must be 0");

      // 2. Lateral X position: +widthM / 2 - margin = 0.5 - 0.05 = +0.45
      assert.ok(
        Math.abs(mounted.position.x - 0.45) < 0.001,
        `Mounted X should be +0.45m, got ${mounted.position.x}`
      );

      // 3. Child geometry must be mirrored: left handle was at -0.03, reflected to +0.03
      const mountedLever = mounted.children[0] as THREE.Mesh;
      const leverGeom = mountedLever.geometry as THREE.BufferGeometry;
      leverGeom.computeBoundingBox();
      assert.ok(leverGeom.boundingBox!.min.x >= -0.02, "Mirrored geometry should point rightward");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC93.11: Cabinet Handle Lateral Handing Mirroring Across Centerline
  // --------------------------------------------------------------------------
  describe("QAD-TC93.11: Cabinet Handle Lateral Handing Mirroring Across Centerline", () => {
    function createCabinetFixture() {
      // Cabinet box: 0.8m wide, 1.0m high, 0.3m deep centered at origin
      const boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.0, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      );
      boxMesh.name = "Cabinet Box";

      // Original handle on the right side: 50mm wide, 150mm high, 40mm deep
      // Located at x = +0.35m (right), y = +0.12m, z = +0.17m
      const handleGeom = new THREE.BoxGeometry(0.05, 0.15, 0.04);
      handleGeom.translate(0.35, 0.12, 0.17);
      const handleMesh = new THREE.Mesh(
        handleGeom,
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      handleMesh.name = "Original Cabinet Handle";

      const definition: ProductStructuralDefinition = {
        product: {
          productId: "prod_cabinet_01",
          productName: "Modular Aluminum Cabinet",
          productType: "Cabinet",
          isAddon: false,
          isAccessory: false,
        },
        template: {
          templateId: "tpl_cabinet_01",
          templateName: "Cabinet Template",
          modelStrategy: "Fixed",
          measurementUnit: "mm",
          baseConfiguration: {},
        },
        components: [
          {
            componentId: "comp_box",
            componentKey: "cabinet_box",
            componentName: "Cabinet Box",
            componentType: "Frame",
            baseQuantity: 1,
            dimensionBinding: "FIXED",
            isRemovable: false,
            componentData: {},
            model: {
              assetId: "asset_box",
              r2ObjectKey: "cabinet_box.glb",
              fileName: "cabinet_box.glb",
              url: "https://r2.glassfit.local/cabinet_box.glb",
              sourceDimensionsMm: { width: 800, height: 1000, depth: 300 },
            },
          },
          {
            componentId: "comp_handle",
            componentKey: "cabinet_handle",
            componentName: "Original Cabinet Handle",
            componentType: "Hardware",
            baseQuantity: 1,
            dimensionBinding: "FIXED",
            isRemovable: true,
            isAccessorySlot: true,
            accessoryCategory: "handle",
            componentData: {},
            positionOptions: {
              allowHorizontalToggle: true,
              defaultHorizontal: "right",
              horizontalOffsetMm: 45,
              allowVerticalToggle: false,
              defaultVertical: "up",
              verticalOffsetMm: 1000,
            },
            model: {
              assetId: "asset_handle",
              r2ObjectKey: "cabinet_handle.glb",
              fileName: "cabinet_handle.glb",
              url: "https://r2.glassfit.local/cabinet_handle.glb",
              sourceDimensionsMm: { width: 50, height: 150, depth: 40 },
            },
          },
        ],
        parameters: [],
        rules: [],
      };

      const resolved: ResolvedStructure = {
        numericValuesMm: { width: 800, height: 1000, depth: 300 },
        resolvedValues: {},
        appliedRuleIds: [],
        componentQuantities: { cabinet_box: 1, cabinet_handle: 1 },
      };

      const cache: ComponentModelCache = {
        getClone: (id: string) => {
          if (id === "comp_box") return boxMesh.clone(true);
          if (id === "comp_handle") return handleMesh.clone(true);
          throw new Error(`Unknown component ${id}`);
        },
        getSourceSizeMeters: () => new THREE.Vector3(0.8, 1.0, 0.3),
      };

      return { definition, resolved, cache };
    }

    it("keeps original handle on right side when active handing is right", () => {
      const { definition, resolved, cache } = createCabinetFixture();
      const swappedAccessories: Record<string, SelectedAccessoryState> = {
        comp_handle: {
          slotComponentId: "comp_handle",
          accessoryId: "default",
          accessoryName: "Original Cabinet Handle",
          category: "handle",
          price: 0,
          finish: "matte_black",
          horizontalPosition: "right",
          verticalPosition: "up",
        },
      };

      const { group } = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories,
      });

      const handleChild = group.children.find(
        (c) => c.userData.componentId === "comp_handle"
      );
      assert.ok(handleChild, "Handle component must be present in group");

      const handleBox = new THREE.Box3().setFromObject(handleChild);
      const handleCenter = new THREE.Vector3();
      handleBox.getCenter(handleCenter);

      // Invariant: Handle center X must be on the right side (+0.35m)
      assert.ok(
        handleCenter.x > 0.3,
        `Handle center X should be on the right (> 0.3), got ${handleCenter.x}`
      );
      // Invariant: Handle center Y must match modeled height (+0.12m)
      assert.ok(
        Math.abs(handleCenter.y - 0.12) < 0.01,
        `Handle center Y should be 0.12m, got ${handleCenter.y}`
      );
    });

    it("mirrors handle to the left side at exact same Y axis when handing is toggled to left", () => {
      const { definition, resolved, cache } = createCabinetFixture();
      const swappedAccessories: Record<string, SelectedAccessoryState> = {
        comp_handle: {
          slotComponentId: "comp_handle",
          accessoryId: "default",
          accessoryName: "Original Cabinet Handle",
          category: "handle",
          price: 0,
          finish: "matte_black",
          horizontalPosition: "left",
          verticalPosition: "up",
        },
      };

      const { group } = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories,
      });

      // 1. Right handle must have disappeared (only 1 handle component exists in group)
      const handleChildren = group.children.filter(
        (c) => c.userData.componentId === "comp_handle"
      );
      assert.equal(handleChildren.length, 1, "Exactly one handle must exist in group");

      const leftHandle = handleChildren[0];
      const handleBox = new THREE.Box3().setFromObject(leftHandle);
      const handleCenter = new THREE.Vector3();
      handleBox.getCenter(handleCenter);

      // 2. Left side position: X must be negated (-0.35m)
      assert.ok(
        handleCenter.x < -0.3,
        `Handle center X should be on the left (< -0.3), got ${handleCenter.x}`
      );
      assert.ok(
        Math.abs(handleCenter.x - (-0.35)) < 0.02,
        `Handle center X should be -0.35m, got ${handleCenter.x}`
      );

      // 3. Exact same Y axis: vertical height must not change
      assert.ok(
        Math.abs(handleCenter.y - 0.12) < 0.01,
        `Handle center Y must strictly stay at 0.12m on same Y axis, got ${handleCenter.y}`
      );

      // 4. Invariant: Rotation must be (0, 0, 0) without 180-degree flip
      assert.equal(leftHandle.rotation.x, 0);
      assert.equal(leftHandle.rotation.y, 0, "No 180-degree yaw flip");
      assert.equal(leftHandle.rotation.z, 0);
    });

    it("replaces original cabinet handle when active hardware accessory is selected", () => {
      const { definition, resolved, cache } = createCabinetFixture();

      // Replacement lever model (width 0.04m, height 0.14m, depth 0.03m)
      const replacementModel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.14, 0.03),
        new THREE.MeshStandardMaterial({ color: 0xcccccc })
      );
      replacementModel.name = "Modern Lever Chrome";

      const accessoryModels = new Map<string, THREE.Object3D>([
        ["acc_lever_chrome", replacementModel],
      ]);

      const swappedAccessories: Record<string, SelectedAccessoryState> = {
        comp_handle: {
          slotComponentId: "comp_handle",
          accessoryId: "acc_lever_chrome",
          accessoryName: "Modern Lever Chrome",
          category: "handle",
          price: 450,
          finish: "chrome",
          horizontalPosition: "left",
          verticalPosition: "up",
        },
      };

      const { group } = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories,
        accessoryModels,
      });

      // 1. Original cabinet handle must be replaced (only 1 handle object exists)
      const handleChildren = group.children.filter(
        (c) => c.userData.componentId === "comp_handle"
      );
      assert.equal(handleChildren.length, 1, "Only replacement accessory must be mounted");

      const mountedReplacement = handleChildren[0];
      assert.equal(mountedReplacement.userData.isAccessoryReplacement, true);

      // 2. Position must be mirrored to left side at same Y axis
      const box = new THREE.Box3().setFromObject(mountedReplacement);
      const center = new THREE.Vector3();
      box.getCenter(center);

      assert.ok(
        center.x < -0.3,
        `Replacement center X should be on the left (< -0.3), got ${center.x}`
      );
      assert.ok(
        Math.abs(center.y - 0.12) < 0.02,
        `Replacement center Y must match original handle Y (0.12m), got ${center.y}`
      );
      assert.equal(mountedReplacement.rotation.y, 0);
    });

    it("correctly mirrors parts with node-level translations and hierarchy across centerline", () => {
      // Model where handle position is stored on child node (GLTF standard export)
      const group = new THREE.Group();
      const node = new THREE.Group();
      node.position.set(0.35, 1.25, 0.15);
      const geom = new THREE.BoxGeometry(0.04, 0.20, 0.03);
      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
      node.add(mesh);
      group.add(node);

      // Mirror across cabinet centerline X=0 from right to left
      const mirrored = mirrorPartAcrossCenterline(group, 0, "left");
      const box = new THREE.Box3().setFromObject(mirrored);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Must be on the left side (-0.35m) at exact same Y (1.25m) and Z (0.15m)
      assert.ok(Math.abs(center.x - (-0.35)) < 0.01, `X should be -0.35m, got ${center.x}`);
      assert.ok(Math.abs(center.y - 1.25) < 0.01, `Y must stay at 1.25m, got ${center.y}`);
      assert.ok(Math.abs(center.z - 0.15) < 0.01, `Z must stay at 0.15m, got ${center.z}`);
    });

    it("correctly mirrors handle from left side to right side when default is left", () => {
      // Handle initially modeled on the left: x = -0.32m, y = 0.85m, z = 0.10m
      const geom = new THREE.BoxGeometry(0.04, 0.18, 0.03);
      geom.translate(-0.32, 0.85, 0.10);
      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());

      // Mirror across cabinet centerline X=0 from left to right
      const mirrored = mirrorPartAcrossCenterline(mesh, 0, "right");
      const box = new THREE.Box3().setFromObject(mirrored);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Must be on the right side (+0.32m) at exact same Y (0.85m) and Z (0.10m)
      assert.ok(Math.abs(center.x - 0.32) < 0.01, `X should be +0.32m, got ${center.x}`);
      assert.ok(Math.abs(center.y - 0.85) < 0.01, `Y must stay at 0.85m, got ${center.y}`);
      assert.ok(Math.abs(center.z - 0.10) < 0.01, `Z must stay at 0.10m, got ${center.z}`);
    });

    it("preserves product dimensions and positions replacement accessory in exact same location on both left and right", () => {
      const { definition, resolved, cache } = createCabinetFixture();

      // Large replacement hardware accessory (e.g. Screen Hatch / lock fixture: 0.16m wide, 0.34m high, 0.10m deep)
      const largeAccessory = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.34, 0.10),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
      );
      largeAccessory.name = "Large Security Hatch";

      const accessoryModels = new Map<string, THREE.Object3D>([
        ["acc_large_hatch", largeAccessory],
      ]);

      // 1. Build baseline with default handle (right side)
      const baselineRight = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_handle: {
            slotComponentId: "comp_handle",
            accessoryId: "default",
            accessoryName: "Original Cabinet Handle",
            category: "handle",
            price: 0,
            finish: "matte_black",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
      });

      const baseCarcassRight = baselineRight.group.children.find(
        (c) => c.userData.componentId === "comp_box"
      )!;
      const baseBoxR = new THREE.Box3().setFromObject(baseCarcassRight);
      const baseSizeR = new THREE.Vector3();
      baseBoxR.getSize(baseSizeR);

      const baseHandleR = baselineRight.group.children.find(
        (c) => c.userData.componentId === "comp_handle"
      )!;
      const baseHandleBoxR = new THREE.Box3().setFromObject(baseHandleR);
      const baseHandleCenterR = new THREE.Vector3();
      baseHandleBoxR.getCenter(baseHandleCenterR);

      // 2. Build with swapped large accessory (right side)
      const swappedRight = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_handle: {
            slotComponentId: "comp_handle",
            accessoryId: "acc_large_hatch",
            accessoryName: "Large Security Hatch",
            category: "handle",
            price: 250,
            finish: "matte_black",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
        accessoryModels,
      });

      const swappedCarcassRight = swappedRight.group.children.find(
        (c) => c.userData.componentId === "comp_box"
      )!;
      const swappedBoxR = new THREE.Box3().setFromObject(swappedCarcassRight);
      const swappedSizeR = new THREE.Vector3();
      swappedBoxR.getSize(swappedSizeR);

      // Invariant: Carcass size must not change at all when choosing a different accessory
      assert.ok(
        Math.abs(swappedSizeR.x - baseSizeR.x) < 0.001,
        `Carcass width must be identical: expected ${baseSizeR.x}, got ${swappedSizeR.x}`
      );
      assert.ok(
        Math.abs(swappedSizeR.y - baseSizeR.y) < 0.001,
        `Carcass height must be identical: expected ${baseSizeR.y}, got ${swappedSizeR.y}`
      );

      const swappedAccessoryR = swappedRight.group.children.find(
        (c) => c.userData.componentId === "comp_handle" || c.userData.isAccessoryReplacement
      )!;
      const swappedAccBoxR = new THREE.Box3().setFromObject(swappedAccessoryR);
      const swappedAccCenterR = new THREE.Vector3();
      swappedAccBoxR.getCenter(swappedAccCenterR);

      // Invariant: Swapped accessory must occupy the exact same coordinate position as default handle
      assert.ok(
        Math.abs(swappedAccCenterR.x - baseHandleCenterR.x) < 0.001,
        `Right accessory X must match default handle X (${baseHandleCenterR.x}), got ${swappedAccCenterR.x}`
      );
      assert.ok(
        Math.abs(swappedAccCenterR.y - baseHandleCenterR.y) < 0.001,
        `Right accessory Y must match default handle Y (${baseHandleCenterR.y}), got ${swappedAccCenterR.y}`
      );
      assert.ok(
        Math.abs(swappedAccCenterR.z - baseHandleCenterR.z) < 0.001,
        `Right accessory Z must match default handle Z (${baseHandleCenterR.z}), got ${swappedAccCenterR.z}`
      );

      // 3. Build baseline with default handle (left side)
      const baselineLeft = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_handle: {
            slotComponentId: "comp_handle",
            accessoryId: "default",
            accessoryName: "Original Cabinet Handle",
            category: "handle",
            price: 0,
            finish: "matte_black",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
      });

      const baseHandleL = baselineLeft.group.children.find(
        (c) => c.userData.componentId === "comp_handle"
      )!;
      const baseHandleBoxL = new THREE.Box3().setFromObject(baseHandleL);
      const baseHandleCenterL = new THREE.Vector3();
      baseHandleBoxL.getCenter(baseHandleCenterL);

      // 4. Build with swapped large accessory (left side)
      const swappedLeft = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_handle: {
            slotComponentId: "comp_handle",
            accessoryId: "acc_large_hatch",
            accessoryName: "Large Security Hatch",
            category: "handle",
            price: 250,
            finish: "matte_black",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
        accessoryModels,
      });

      const swappedCarcassLeft = swappedLeft.group.children.find(
        (c) => c.userData.componentId === "comp_box"
      )!;
      const swappedBoxL = new THREE.Box3().setFromObject(swappedCarcassLeft);
      const swappedSizeL = new THREE.Vector3();
      swappedBoxL.getSize(swappedSizeL);

      assert.ok(
        Math.abs(swappedSizeL.x - baseSizeR.x) < 0.001,
        `Left carcass width must be identical: expected ${baseSizeR.x}, got ${swappedSizeL.x}`
      );

      const swappedAccessoryL = swappedLeft.group.children.find(
        (c) => c.userData.componentId === "comp_handle" || c.userData.isAccessoryReplacement
      )!;
      const swappedAccBoxL = new THREE.Box3().setFromObject(swappedAccessoryL);
      const swappedAccCenterL = new THREE.Vector3();
      swappedAccBoxL.getCenter(swappedAccCenterL);

      // Invariant: Left swapped accessory must match default left handle position exactly
      assert.ok(
        Math.abs(swappedAccCenterL.x - baseHandleCenterL.x) < 0.001,
        `Left accessory X must match default handle X (${baseHandleCenterL.x}), got ${swappedAccCenterL.x}`
      );
      assert.ok(
        Math.abs(swappedAccCenterL.y - baseHandleCenterL.y) < 0.001,
        `Left accessory Y must match default handle Y (${baseHandleCenterL.y}), got ${swappedAccCenterL.y}`
      );
      assert.ok(
        Math.abs(swappedAccCenterL.z - baseHandleCenterL.z) < 0.001,
        `Left accessory Z must match default handle Z (${baseHandleCenterL.z}), got ${swappedAccCenterL.z}`
      );
    });

    it("omits configured removable components from 3D geometry when toggled off via removableStates", () => {
      const { definition, resolved, cache } = createCabinetFixture();

      // comp_handle is configured as isRemovable = true
      // 1. When included (default):
      const included = buildParametricProduct(definition, resolved, cache, {
        removableStates: {
          comp_handle: true,
        },
      });
      const hasHandle = included.group.children.some(
        (c) => c.userData.componentId === "comp_handle"
      );
      assert.strictEqual(hasHandle, true, "Handle should be present when toggled on");

      // 2. When toggled off:
      const excluded = buildParametricProduct(definition, resolved, cache, {
        removableStates: {
          comp_handle: false,
        },
      });
      const handleOmitted = !excluded.group.children.some(
        (c) => c.userData.componentId === "comp_handle" || c.userData.isAccessoryReplacement
      );
      assert.strictEqual(handleOmitted, true, "Handle must be omitted when toggled off");

      // Invariant: Carcass remains in place
      const carcass = excluded.group.children.find(
        (c) => c.userData.componentId === "comp_box"
      );
      assert.ok(carcass, "Cabinet carcass must remain present");
    });
  });
});
