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

    it("mirrors non-swappable component across centerline when lateral handing is enabled", () => {
      const { definition, resolved, cache } = createCabinetFixture();
      // Configure comp_handle as NOT swappable with accessories, but with lateral handing enabled
      const handleDef = definition.components.find((c) => c.componentId === "comp_handle")!;
      handleDef.isAccessorySlot = false;
      handleDef.accessoryCategory = null;
      handleDef.positionOptions = {
        allowHorizontalToggle: true,
        defaultHorizontal: "right",
        horizontalOffsetMm: 45,
        allowVerticalToggle: false,
        defaultVertical: "up",
        verticalOffsetMm: 1000,
      };

      // 1. Handing: Left
      const leftResult = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_handle: {
            slotComponentId: "comp_handle",
            accessoryId: "default",
            accessoryName: "Handle",
            category: "handle",
            price: 0,
            finish: "matte_black",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
      });

      const handleLeft = leftResult.group.children.find(
        (c) => c.userData.componentId === "comp_handle"
      );
      assert.ok(handleLeft, "Non-swappable handle must be mounted");
      const boxLeft = new THREE.Box3().setFromObject(handleLeft);
      const centerLeft = new THREE.Vector3();
      boxLeft.getCenter(centerLeft);
      assert.ok(centerLeft.x < -0.3, `Left non-swappable handle X must be < -0.3, got ${centerLeft.x}`);
      assert.ok(Math.abs(centerLeft.y - 0.12) < 0.01, "Y position must match modeled height");

      // 2. Handing: Right
      const rightResult = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_handle: {
            slotComponentId: "comp_handle",
            accessoryId: "default",
            accessoryName: "Handle",
            category: "handle",
            price: 0,
            finish: "matte_black",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
      });

      const handleRight = rightResult.group.children.find(
        (c) => c.userData.componentId === "comp_handle"
      );
      assert.ok(handleRight, "Non-swappable handle must be mounted");
      const boxRight = new THREE.Box3().setFromObject(handleRight);
      const centerRight = new THREE.Vector3();
      boxRight.getCenter(centerRight);
      assert.ok(centerRight.x > 0.3, `Right non-swappable handle X must be > 0.3, got ${centerRight.x}`);
      assert.ok(Math.abs(centerRight.y - 0.12) < 0.01, "Y position must match modeled height");
    });

    it("honors removable components and lateral handing in modular add-on attachments", () => {
      const { definition, resolved, cache } = createCabinetFixture();

      // Register custom uploaded components on the insect screen add-on
      const screenMeshFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.2, 0.02),
        new THREE.MeshStandardMaterial()
      );
      const screenMeshLatch = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.08, 0.02),
        new THREE.MeshStandardMaterial()
      );
      screenMeshLatch.position.set(0.35, 0.1, 0.02);

      const addonModels: Record<string, THREE.Object3D> = {
        addon_screen_frame: screenMeshFrame,
        addon_screen_latch: screenMeshLatch,
      };
      const origGetClone = cache.getClone;
      cache.getClone = (id: string) => {
        if (addonModels[id]) return addonModels[id].clone(true);
        return origGetClone(id);
      };

      definition.compatibleAddons = [
        {
          id: "compat_addon_01",
          parentProductId: "prod_cabinet_01",
          addonProductId: "prod_addon_screen",
          addonType: "screen",
          components: [
            {
              componentId: "addon_screen_frame",
              componentKey: "screen-frame",
              componentName: "Insect Screen Frame",
              componentType: "Frame",
              dimensionBinding: "AREA",
              baseQuantity: 1,
              rawMaterialId: null,
              allowedMaterials: [],
              isAccessorySlot: false,
              accessoryCategory: null,
              allowedAccessoryIds: [],
              positionOptions: null,
              isRemovable: false,
              togglePropertyKey: null,
              pricingMethod: "Formula",
              unitPrice: 0,
              componentData: {},
              model: {
                assetId: "asset_screen_frame",
                r2ObjectKey: "screen_frame.glb",
                fileName: "screen_frame.glb",
                url: "https://r2.glassfit.local/screen_frame.glb",
                sourceDimensionsMm: { width: 800, height: 1200, depth: 20 },
              },
            },
            {
              componentId: "addon_screen_latch",
              componentKey: "screen-latch",
              componentName: "Screen Release Latch",
              componentType: "Hardware",
              dimensionBinding: "FIXED",
              baseQuantity: 1,
              rawMaterialId: null,
              allowedMaterials: [],
              isAccessorySlot: false,
              accessoryCategory: "handle",
              allowedAccessoryIds: [],
              positionOptions: {
                allowHorizontalToggle: true,
                defaultHorizontal: "right",
                horizontalOffsetMm: 20,
                allowVerticalToggle: false,
                defaultVertical: "up",
                verticalOffsetMm: 100,
              },
              isRemovable: true,
              togglePropertyKey: "has_screen_latch",
              pricingMethod: "Fixed",
              unitPrice: 50,
              componentData: {},
              model: {
                assetId: "asset_screen_latch",
                r2ObjectKey: "screen_latch.glb",
                fileName: "screen_latch.glb",
                url: "https://r2.glassfit.local/screen_latch.glb",
                sourceDimensionsMm: { width: 40, height: 80, depth: 20 },
              },
            },
          ],
        },
      ];

      // 1. Included with Left Handing
      const addonLeft = buildParametricProduct(definition, resolved, cache, {
        activeAddon: "screen",
        removableStates: {
          addon_screen_latch: true,
        },
        swappedAccessories: {
          addon_screen_latch: {
            slotComponentId: "addon_screen_latch",
            accessoryId: "default",
            accessoryName: "Screen Release Latch",
            category: "handle",
            price: 0,
            finish: "matte_black",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
      });

      const addonGroup = addonLeft.group.children.find(
        (c) => c.name.includes("Addon_Screen")
      );
      assert.ok(addonGroup, "Add-on screen assembly should be created");

      let latchLeft: THREE.Object3D | undefined;
      addonGroup.traverse((c) => {
        if (c.userData.componentKey === "screen-latch" || c.name.includes("screen-latch")) {
          latchLeft = c;
        }
      });
      assert.ok(latchLeft, "Screen latch should be present in add-on assembly");
      const latchBoxL = new THREE.Box3().setFromObject(latchLeft);
      const latchCenterL = new THREE.Vector3();
      latchBoxL.getCenter(latchCenterL);
      assert.ok(latchCenterL.x < 0, `Screen latch with left handing should have X < 0, got ${latchCenterL.x}`);

      // 2. Removable Latch Omitted
      const addonExcluded = buildParametricProduct(definition, resolved, cache, {
        activeAddon: "screen",
        removableStates: {
          addon_screen_latch: false,
        },
      });

      const addonGroupEx = addonExcluded.group.children.find(
        (c) => c.name.includes("Addon_Screen")
      );
      assert.ok(addonGroupEx, "Add-on assembly should exist");
      let latchEx: THREE.Object3D | undefined;
      addonGroupEx.traverse((c) => {
        if (c.userData.componentKey === "screen-latch" || c.name.includes("screen-latch")) {
          latchEx = c;
        }
      });
      assert.strictEqual(latchEx, undefined, "Removable screen latch must be omitted when toggled off");
    });

    it("preserves intact natural assembly of multi-part screens and doors when lateral handing is not configured on structural parts", () => {
      // Recreates the screen door structure from user report:
      // Left stile at -0.45m, right stile at +0.45m, mesh centered at 0, hatch at +0.35m
      const leftStileGeom = new THREE.BoxGeometry(0.05, 2.0, 0.05);
      leftStileGeom.translate(-0.45, 1.0, 0);
      const leftStileMesh = new THREE.Mesh(leftStileGeom, new THREE.MeshBasicMaterial());

      const rightStileGeom = new THREE.BoxGeometry(0.05, 2.0, 0.05);
      rightStileGeom.translate(0.45, 1.0, 0);
      const rightStileMesh = new THREE.Mesh(rightStileGeom, new THREE.MeshBasicMaterial());

      const meshGeom = new THREE.BoxGeometry(0.85, 1.9, 0.01);
      meshGeom.translate(0, 1.0, 0);
      const meshPart = new THREE.Mesh(meshGeom, new THREE.MeshBasicMaterial());

      const hatchGeom = new THREE.BoxGeometry(0.2, 0.4, 0.03);
      hatchGeom.translate(0.35, 0.8, 0.02);
      const hatchMesh = new THREE.Mesh(hatchGeom, new THREE.MeshBasicMaterial());

      const definition: ProductStructuralDefinition = {
        product: {
          productId: "prod_screen_door",
          productName: "Security Screen Door with Hatch",
          productType: "Door",
          isAddon: false,
          isAccessory: false,
        },
        template: {
          templateId: "tpl_screen_door",
          templateName: "Screen Door Template",
          modelStrategy: "Fixed",
          measurementUnit: "mm",
          baseConfiguration: {},
        },
        components: [
          {
            componentId: "comp_left_stile",
            componentKey: "left-stile",
            componentName: "Left Stile",
            componentType: "Frame",
            dimensionBinding: "HEIGHT",
            baseQuantity: 1,
            isAccessorySlot: false,
            componentData: {},
            model: {
              assetId: "a_left",
              r2ObjectKey: "l.glb",
              fileName: "l.glb",
              url: "https://r2.glassfit.local/l.glb",
              sourceDimensionsMm: { width: 50, height: 2000, depth: 50 },
            },
          },
          {
            componentId: "comp_right_stile",
            componentKey: "right-stile",
            componentName: "Right Stile",
            componentType: "Frame",
            dimensionBinding: "HEIGHT",
            baseQuantity: 1,
            isAccessorySlot: false,
            componentData: {},
            model: {
              assetId: "a_right",
              r2ObjectKey: "r.glb",
              fileName: "r.glb",
              url: "https://r2.glassfit.local/r.glb",
              sourceDimensionsMm: { width: 50, height: 2000, depth: 50 },
            },
          },
          {
            componentId: "comp_mesh",
            componentKey: "screen-mesh",
            componentName: "Screen Mesh",
            componentType: "Frame",
            dimensionBinding: "AREA",
            baseQuantity: 1,
            isAccessorySlot: false,
            componentData: {},
            model: {
              assetId: "a_mesh",
              r2ObjectKey: "m.glb",
              fileName: "m.glb",
              url: "https://r2.glassfit.local/m.glb",
              sourceDimensionsMm: { width: 850, height: 1900, depth: 10 },
            },
          },
          {
            componentId: "comp_hatch",
            componentKey: "access-hatch",
            componentName: "Access Hatch",
            componentType: "Hardware",
            dimensionBinding: "FIXED",
            baseQuantity: 1,
            isAccessorySlot: false,
            componentData: {},
            positionOptions: {
              allowHorizontalToggle: true,
              defaultHorizontal: "right",
              horizontalOffsetMm: 20,
              allowVerticalToggle: false,
              defaultVertical: "up",
              verticalOffsetMm: 100,
            },
            model: {
              assetId: "a_hatch",
              r2ObjectKey: "h.glb",
              fileName: "h.glb",
              url: "https://r2.glassfit.local/h.glb",
              sourceDimensionsMm: { width: 200, height: 400, depth: 30 },
            },
          },
        ],
        parameters: [],
        rules: [],
      };

      const resolved: ResolvedStructure = {
        numericValuesMm: { width: 950, height: 2000, depth: 50 },
        resolvedValues: {},
        appliedRuleIds: [],
        componentQuantities: {
          "left-stile": 1,
          "right-stile": 1,
          "screen-mesh": 1,
          "access-hatch": 1,
        },
      };

      const modelMap: Record<string, THREE.Object3D> = {
        comp_left_stile: leftStileMesh,
        comp_right_stile: rightStileMesh,
        comp_mesh: meshPart,
        comp_hatch: hatchMesh,
      };

      const cache: ComponentModelCache = {
        getClone: (id: string) => {
          if (modelMap[id]) return modelMap[id].clone(true);
          throw new Error(`Unknown component ${id}`);
        },
        getSourceSizeMeters: () => new THREE.Vector3(0.95, 2.0, 0.05),
      };

      // 1. Validation in default configuration (Right handing on hatch, no handing on stiles/mesh)
      const { group } = buildParametricProduct(definition, resolved, cache, {});

      // Invariant: Left stile must remain in place at X = -0.45m
      const leftChild = group.children.find((c) => c.userData.componentId === "comp_left_stile")!;
      assert.ok(leftChild, "Left stile must be present in group");
      const leftBox = new THREE.Box3().setFromObject(leftChild);
      const leftCenter = new THREE.Vector3();
      leftBox.getCenter(leftCenter);
      assert.ok(Math.abs(leftCenter.x - (-0.45)) < 0.001, `Left stile must remain at X=-0.45, got ${leftCenter.x}`);

      // Invariant: Right stile must remain in place at X = +0.45m (never detached or blown away)
      const rightChild = group.children.find((c) => c.userData.componentId === "comp_right_stile")!;
      assert.ok(rightChild, "Right stile must be present in group");
      const rightBox = new THREE.Box3().setFromObject(rightChild);
      const rightCenter = new THREE.Vector3();
      rightBox.getCenter(rightCenter);
      assert.ok(Math.abs(rightCenter.x - 0.45) < 0.001, `Right stile must remain at X=0.45, got ${rightCenter.x}`);

      // Invariant: Mesh remains centered at X = 0
      const meshChild = group.children.find((c) => c.userData.componentId === "comp_mesh")!;
      assert.ok(meshChild, "Mesh must be present");
      const meshBox = new THREE.Box3().setFromObject(meshChild);
      const meshCenter = new THREE.Vector3();
      meshBox.getCenter(meshCenter);
      assert.ok(Math.abs(meshCenter.x) < 0.001, `Mesh must remain centered at X=0, got ${meshCenter.x}`);

      // Invariant: Hatch in default right handing remains at modeled position X = +0.35m
      const hatchChild = group.children.find((c) => c.userData.componentId === "comp_hatch")!;
      assert.ok(hatchChild, "Hatch must be present");
      const hatchBox = new THREE.Box3().setFromObject(hatchChild);
      const hatchCenter = new THREE.Vector3();
      hatchBox.getCenter(hatchCenter);
      assert.ok(Math.abs(hatchCenter.x - 0.35) < 0.001, `Hatch must remain at modeled X=0.35, got ${hatchCenter.x}`);

      // 2. When hatch handing is toggled to Left Side:
      const leftHanded = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_hatch: {
            slotComponentId: "comp_hatch",
            accessoryId: "default",
            accessoryName: "Access Hatch",
            category: "handle",
            price: 0,
            finish: "satin",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
      });

      // Hatch mirrors symmetrically to X = -0.35m
      const hatchLeftChild = leftHanded.group.children.find((c) => c.userData.componentId === "comp_hatch")!;
      assert.ok(hatchLeftChild, "Left hatch must be present");
      const hatchBoxL = new THREE.Box3().setFromObject(hatchLeftChild);
      const hatchCenterL = new THREE.Vector3();
      hatchBoxL.getCenter(hatchCenterL);
      assert.ok(Math.abs(hatchCenterL.x - (-0.35)) < 0.01, `Hatch must mirror to X=-0.35, got ${hatchCenterL.x}`);

      // Crucial: Frame stiles and mesh still stay completely untouched
      const leftChildAfter = leftHanded.group.children.find((c) => c.userData.componentId === "comp_left_stile")!;
      const rightChildAfter = leftHanded.group.children.find((c) => c.userData.componentId === "comp_right_stile")!;
      const leftBoxAfter = new THREE.Box3().setFromObject(leftChildAfter);
      const rightBoxAfter = new THREE.Box3().setFromObject(rightChildAfter);
      const leftCenterAfter = new THREE.Vector3();
      const rightCenterAfter = new THREE.Vector3();
      leftBoxAfter.getCenter(leftCenterAfter);
      rightBoxAfter.getCenter(rightCenterAfter);
      assert.ok(Math.abs(leftCenterAfter.x - (-0.45)) < 0.001, "Left stile remains at -0.45m");
      assert.ok(Math.abs(rightCenterAfter.x - 0.45) < 0.001, "Right stile remains at +0.45m");
    });

    it("strictly preserves framing stiles even when legacy database records have allowHorizontalToggle: true", () => {
      const stileGeom = new THREE.BoxGeometry(0.05, 1.2, 0.04);
      const leftMesh = new THREE.Mesh(stileGeom);
      leftMesh.position.set(-0.45, 0, 0);

      const rightMesh = new THREE.Mesh(stileGeom);
      rightMesh.position.set(0.45, 0, 0);

      const hatchGeom = new THREE.BoxGeometry(0.16, 0.34, 0.02);
      const hatchMesh = new THREE.Mesh(hatchGeom);
      hatchMesh.position.set(0.35, 0, 0);

      const cache: ComponentModelCache = {
        getClone: (id: string) => {
          if (id === "comp_left_stile_legacy") return leftMesh.clone(true);
          if (id === "comp_right_stile_legacy") return rightMesh.clone(true);
          if (id === "comp_hatch_legacy") return hatchMesh.clone(true);
          throw new Error(`Unknown component ${id}`);
        },
        getSourceSizeMeters: () => new THREE.Vector3(0.05, 1.2, 0.04),
      };

      const definition: ProductStructuralDefinition = {
        product: {
          productId: "prod_screen_legacy",
          productName: "Legacy Screen Assembly",
          productType: "Door",
          description: "Legacy screen",
          basePrice: 1000,
          isAddon: true,
          addonType: "screen",
          isAccessory: false,
          accessoryCategory: null,
          accessoryMountingType: null,
        },
        template: {
          templateId: "tmpl_screen_legacy",
          templateName: "Screen Template",
          modelStrategy: "Parametric",
          measurementUnit: "mm",
          baseConfiguration: {},
        },
        components: [
          {
            componentId: "comp_left_stile_legacy",
            componentKey: "screen_frame_left",
            componentName: "Screen Frame Left",
            componentType: "Model",
            presentationCategory: "Framing",
            baseQuantity: 1,
            pricingMethod: "Included",
            unitPrice: 0,
            dimensionBinding: "HEIGHT",
            spanRatio: 1,
            isRemovable: false,
            togglePropertyKey: null,
            isAccessorySlot: false,
            accessoryCategory: null,
            allowedAccessoryIds: null,
            positionOptions: {
              allowHorizontalToggle: true,
              defaultHorizontal: "right",
              horizontalOffsetMm: 45,
              allowVerticalToggle: false,
              defaultVertical: "up",
              verticalOffsetMm: 1000,
            },
            componentData: {},
            model: {
              assetId: "a_stile_l",
              r2ObjectKey: "stile_l.glb",
              url: "https://r2.dev/stile.glb",
              fileName: "stile.glb",
              sourceDimensionsMm: { width: 50, height: 1200, depth: 40 },
            },
          },
          {
            componentId: "comp_right_stile_legacy",
            componentKey: "screen_frame_right",
            componentName: "Screen Frame Right",
            componentType: "Model",
            presentationCategory: "Framing",
            baseQuantity: 1,
            pricingMethod: "Included",
            unitPrice: 0,
            dimensionBinding: "HEIGHT",
            spanRatio: 1,
            isRemovable: false,
            togglePropertyKey: null,
            isAccessorySlot: false,
            accessoryCategory: null,
            allowedAccessoryIds: null,
            positionOptions: {
              allowHorizontalToggle: true,
              defaultHorizontal: "right",
              horizontalOffsetMm: 45,
              allowVerticalToggle: false,
              defaultVertical: "up",
              verticalOffsetMm: 1000,
            },
            componentData: {},
            model: {
              assetId: "a_stile_r",
              r2ObjectKey: "stile_r.glb",
              url: "https://r2.dev/stile_r.glb",
              fileName: "stile_r.glb",
              sourceDimensionsMm: { width: 50, height: 1200, depth: 40 },
            },
          },
          {
            componentId: "comp_hatch_legacy",
            componentKey: "screen_access_hatch",
            componentName: "Screen Access Hatch",
            componentType: "Hardware",
            presentationCategory: "Hardware",
            baseQuantity: 1,
            pricingMethod: "Included",
            unitPrice: 0,
            dimensionBinding: "FIXED",
            spanRatio: 1,
            isRemovable: true,
            togglePropertyKey: "has_hatch",
            isAccessorySlot: false,
            accessoryCategory: null,
            allowedAccessoryIds: null,
            positionOptions: {
              allowHorizontalToggle: true,
              defaultHorizontal: "right",
              horizontalOffsetMm: 45,
              allowVerticalToggle: false,
              defaultVertical: "up",
              verticalOffsetMm: 1000,
            },
            componentData: {},
            model: {
              assetId: "a_hatch",
              r2ObjectKey: "hatch.glb",
              url: "https://r2.dev/hatch.glb",
              fileName: "hatch.glb",
              sourceDimensionsMm: { width: 160, height: 340, depth: 20 },
            },
          },
        ],
        parameters: [],
        rules: [],
        compatibleAddons: [],
      };

      const resolved: ResolvedStructure = {
        componentQuantities: {
          screen_frame_left: 1,
          screen_frame_right: 1,
          screen_access_hatch: 1,
        },
        resolvedValues: {},
        numericValuesMm: {},
        appliedRuleIds: [],
      };

      const built = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {},
      });

      // Crucial: The left stile must NOT mirror to the right (+0.45m), it must stay at -0.45m!
      const stileObj = built.group.children.find((c) => c.userData.componentId === "comp_left_stile_legacy")!;
      assert.ok(stileObj, "Left stile must be in group");
      const stileBox = new THREE.Box3().setFromObject(stileObj);
      const stileCenter = new THREE.Vector3();
      stileBox.getCenter(stileCenter);
      assert.ok(
        Math.abs(stileCenter.x - (-0.45)) < 0.001,
        `Left stile must stay on left side at -0.45m even with legacy allowHorizontalToggle: true, got ${stileCenter.x}`
      );
    });

    it("preserves exact 1:1 metric source dimensions for fixed components when product width and height are scaled", () => {
      // Cabinet door fixture: 800mm base width, 1200mm base height, 40mm depth
      const stileGeom = new THREE.BoxGeometry(0.05, 1.2, 0.04);
      const leftStile = new THREE.Mesh(stileGeom);
      leftStile.position.set(-0.375, 0, 0);

      const rightStile = new THREE.Mesh(stileGeom);
      rightStile.position.set(0.375, 0, 0);

      // Handle has source size: 0.03m width x 0.20m height x 0.025m depth
      const handleGeom = new THREE.BoxGeometry(0.03, 0.20, 0.025);
      const handleMesh = new THREE.Mesh(handleGeom);
      handleMesh.position.set(0.35, 0, 0.02);

      const cache: ComponentModelCache = {
        getClone: (id: string) => {
          if (id === "comp_stile_l") return leftStile.clone(true);
          if (id === "comp_stile_r") return rightStile.clone(true);
          if (id === "comp_fixed_handle") return handleMesh.clone(true);
          throw new Error(`Unknown component ${id}`);
        },
        getSourceSizeMeters: () => new THREE.Vector3(0.8, 1.2, 0.04),
      };

      const definition: ProductStructuralDefinition = {
        product: {
          productId: "prod_cabinet",
          productName: "Cabinet Single Door",
          productType: "Cabinet",
          description: "Cabinet door",
          basePrice: 500,
        },
        template: {
          templateId: "tmpl_cabinet",
          templateName: "Cabinet Template",
          modelStrategy: "Parametric",
          measurementUnit: "mm",
          baseConfiguration: {},
        },
        components: [
          {
            componentId: "comp_stile_l",
            componentKey: "left_stile",
            componentName: "Left Stile",
            componentType: "Frame",
            presentationCategory: "Framing",
            dimensionBinding: "HEIGHT",
            baseQuantity: 1,
            isAccessorySlot: false,
            componentData: {},
            model: {
              assetId: "a_sl",
              r2ObjectKey: "sl.glb",
              url: "https://r2.dev/sl.glb",
              fileName: "sl.glb",
              sourceDimensionsMm: { width: 50, height: 1200, depth: 40 },
            },
          },
          {
            componentId: "comp_stile_r",
            componentKey: "right_stile",
            componentName: "Right Stile",
            componentType: "Frame",
            presentationCategory: "Framing",
            dimensionBinding: "HEIGHT",
            baseQuantity: 1,
            isAccessorySlot: false,
            componentData: {},
            model: {
              assetId: "a_sr",
              r2ObjectKey: "sr.glb",
              url: "https://r2.dev/sr.glb",
              fileName: "sr.glb",
              sourceDimensionsMm: { width: 50, height: 1200, depth: 40 },
            },
          },
          {
            componentId: "comp_fixed_handle",
            componentKey: "cabinet_handle",
            componentName: "Cabinet Handle",
            componentType: "Hardware",
            presentationCategory: "Hardware",
            dimensionBinding: "FIXED",
            baseQuantity: 1,
            isAccessorySlot: true,
            positionOptions: {
              allowHorizontalToggle: true,
              defaultHorizontal: "right",
              horizontalOffsetMm: 25,
              allowVerticalToggle: false,
              defaultVertical: "up",
              verticalOffsetMm: 600,
            },
            componentData: {},
            model: {
              assetId: "a_handle",
              r2ObjectKey: "handle.glb",
              url: "https://r2.dev/handle.glb",
              fileName: "handle.glb",
              sourceDimensionsMm: { width: 30, height: 200, depth: 25 },
            },
          },
        ],
        parameters: [],
        rules: [],
      };

      // Case A: 2.0x enlargement (Width: 1600mm, Height: 2400mm)
      const resolved2x: ResolvedStructure = {
        componentQuantities: { left_stile: 1, right_stile: 1, cabinet_handle: 1 },
        resolvedValues: {},
        numericValuesMm: { width: 1600, height: 2400 },
        appliedRuleIds: [],
      };

      const built2x = buildParametricProduct(definition, resolved2x, cache, {
        swappedAccessories: {
          comp_fixed_handle: {
            slotComponentId: "comp_fixed_handle",
            accessoryId: "default",
            accessoryName: "Cabinet Handle",
            category: "handle",
            price: 0,
            finish: "satin",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
      });

      assert.ok(Math.abs(built2x.group.scale.x - 2.0) < 0.001, `Group scale X should be 2.0, got ${built2x.group.scale.x}`);
      assert.ok(Math.abs(built2x.group.scale.y - 2.0) < 0.001, `Group scale Y should be 2.0, got ${built2x.group.scale.y}`);

      built2x.group.updateMatrixWorld(true);
      const handleChild2x = built2x.group.children.find((c) =>
        c.userData.componentId === "comp_fixed_handle" || c.userData.componentKey === "cabinet_handle"
      )!;
      assert.ok(handleChild2x, "Handle must exist in assembled product");

      const handleBox2x = new THREE.Box3().setFromObject(handleChild2x);
      const handleSize2x = new THREE.Vector3();
      handleBox2x.getSize(handleSize2x);

      assert.ok(Math.abs(handleSize2x.x - 0.03) < 0.001, `Handle width must stay 0.03m under 2x scale, got ${handleSize2x.x}`);
      assert.ok(Math.abs(handleSize2x.y - 0.20) < 0.001, `Handle height must stay 0.20m under 2x scale, got ${handleSize2x.y}`);
      assert.ok(Math.abs(handleSize2x.z - 0.025) < 0.001, `Handle depth must stay 0.025m under 2x scale, got ${handleSize2x.z}`);

      // Case B: 0.75x shrink (Width: 600mm, Height: 900mm)
      const resolved075x: ResolvedStructure = {
        componentQuantities: { left_stile: 1, right_stile: 1, cabinet_handle: 1 },
        resolvedValues: {},
        numericValuesMm: { width: 600, height: 900 },
        appliedRuleIds: [],
      };

      const built075x = buildParametricProduct(definition, resolved075x, cache, {
        swappedAccessories: {
          comp_fixed_handle: {
            slotComponentId: "comp_fixed_handle",
            accessoryId: "default",
            accessoryName: "Cabinet Handle",
            category: "handle",
            price: 0,
            finish: "satin",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
      });

      built075x.group.updateMatrixWorld(true);
      const handleChild075x = built075x.group.children.find((c) =>
        c.userData.componentId === "comp_fixed_handle" || c.userData.componentKey === "cabinet_handle"
      )!;
      assert.ok(handleChild075x, "Handle must exist in assembled product");

      const handleBox075x = new THREE.Box3().setFromObject(handleChild075x);
      const handleSize075x = new THREE.Vector3();
      handleBox075x.getSize(handleSize075x);

      assert.ok(Math.abs(handleSize075x.x - 0.03) < 0.001, `Handle width must stay 0.03m under 0.75x scale, got ${handleSize075x.x}`);
      assert.ok(Math.abs(handleSize075x.y - 0.20) < 0.001, `Handle height must stay 0.20m under 0.75x scale, got ${handleSize075x.y}`);
      assert.ok(Math.abs(handleSize075x.z - 0.025) < 0.001, `Handle depth must stay 0.025m under 0.75x scale, got ${handleSize075x.z}`);

      // Case C: Toggled to Left Handing on resized door
      const builtLeft2x = buildParametricProduct(definition, resolved2x, cache, {
        swappedAccessories: {
          comp_fixed_handle: {
            slotComponentId: "comp_fixed_handle",
            accessoryId: "default",
            accessoryName: "Cabinet Handle",
            category: "handle",
            price: 0,
            finish: "satin",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
      });

      builtLeft2x.group.updateMatrixWorld(true);
      const handleChildLeft = builtLeft2x.group.children.find((c) =>
        c.userData.componentId === "comp_fixed_handle" || c.userData.componentKey === "cabinet_handle"
      )!;
      assert.ok(handleChildLeft, "Handle must exist in assembled product");

      const handleBoxLeft = new THREE.Box3().setFromObject(handleChildLeft);
      const handleSizeLeft = new THREE.Vector3();
      handleBoxLeft.getSize(handleSizeLeft);

      assert.ok(Math.abs(handleSizeLeft.x - 0.03) < 0.001, `Left handle width must stay 0.03m, got ${handleSizeLeft.x}`);
      assert.ok(Math.abs(handleSizeLeft.y - 0.20) < 0.001, `Left handle height must stay 0.20m, got ${handleSizeLeft.y}`);
      assert.ok(Math.abs(handleSizeLeft.z - 0.025) < 0.001, `Left handle depth must stay 0.025m, got ${handleSizeLeft.z}`);
    });

    it("preserves exact 1:1 metric source dimensions for fixed components in modular add-on attachments on resized host window", () => {
      // Screen frame (1.0m x 2.0m) with an access hatch (0.16m x 0.34m x 0.02m, FIXED)
      const frameGeom = new THREE.BoxGeometry(1.0, 2.0, 0.05);
      const frameMesh = new THREE.Mesh(frameGeom);
      frameMesh.position.set(0, 0, 0);

      const hatchGeom = new THREE.BoxGeometry(0.16, 0.34, 0.02);
      const hatchMesh = new THREE.Mesh(hatchGeom);
      hatchMesh.position.set(0.35, 0, 0.01);

      const definition: ProductStructuralDefinition = {
        product: {
          productId: "prod_window_host",
          productName: "Sliding Window Host",
          productType: "Window",
          description: "Host window",
          basePrice: 2000,
        },
        template: {
          templateId: "tmpl_window_host",
          templateName: "Host Template",
          modelStrategy: "Parametric",
          measurementUnit: "mm",
          baseConfiguration: {},
        },
        components: [
          {
            componentId: "comp_screen_frame",
            componentKey: "screen_frame",
            componentName: "Screen Frame",
            componentType: "Frame",
            presentationCategory: "Framing",
            dimensionBinding: "HEIGHT",
            baseQuantity: 1,
            componentData: {},
            model: {
              assetId: "a_frame",
              r2ObjectKey: "frame.glb",
              url: "https://r2.dev/frame.glb",
              fileName: "frame.glb",
              sourceDimensionsMm: { width: 1000, height: 2000, depth: 50 },
            },
          },
        ],
        parameters: [],
        rules: [],
        compatibleAddons: [
          {
            id: "addon_screen",
            parentProductId: "prod_window_host",
            addonProductId: "prod_screen_addon",
            addonType: "screen",
            components: [
              {
                componentId: "comp_addon_frame",
                componentKey: "addon_frame",
                componentName: "Addon Frame",
                componentType: "Frame",
                presentationCategory: "Framing",
                dimensionBinding: "HEIGHT",
                baseQuantity: 1,
                componentData: {},
                model: {
                  assetId: "a_aframe",
                  r2ObjectKey: "aframe.glb",
                  url: "https://r2.dev/aframe.glb",
                  fileName: "aframe.glb",
                  sourceDimensionsMm: { width: 1000, height: 2000, depth: 50 },
                },
              },
              {
                componentId: "comp_addon_hatch",
                componentKey: "addon_hatch",
                componentName: "Addon Access Hatch",
                componentType: "Hardware",
                presentationCategory: "Hardware",
                dimensionBinding: "FIXED",
                baseQuantity: 1,
                componentData: {},
                model: {
                  assetId: "a_ahatch",
                  r2ObjectKey: "ahatch.glb",
                  url: "https://r2.dev/ahatch.glb",
                  fileName: "ahatch.glb",
                  sourceDimensionsMm: { width: 160, height: 340, depth: 20 },
                },
              },
            ],
          },
        ],
      };

      const resolvedResized: ResolvedStructure = {
        componentQuantities: { screen_frame: 1 },
        resolvedValues: {},
        numericValuesMm: { width: 2000, height: 3000 },
        appliedRuleIds: [],
      };

      const addonCache: ComponentModelCache = {
        getClone: (id: string) => {
          if (id === "comp_screen_frame") return frameMesh.clone(true);
          if (id === "comp_addon_frame") return frameMesh.clone(true);
          if (id === "comp_addon_hatch") return hatchMesh.clone(true);
          throw new Error(`Unknown component ${id}`);
        },
        getSourceSizeMeters: () => new THREE.Vector3(1.0, 2.0, 0.05),
      };

      const built = buildParametricProduct(definition, resolvedResized, addonCache, {
        activeAddon: "screen",
      });

      built.group.updateMatrixWorld(true);
      const addonGroup = built.group.children.find((c) => c.userData.isAddon);
      assert.ok(addonGroup, "Addon group must be attached to product");

      let hatchObject: THREE.Object3D | null = null;
      addonGroup.traverse((c) => {
        if (
          (c.userData.componentId === "comp_addon_hatch" || c.userData.componentKey === "addon_hatch") &&
          c.userData.isFixedDimension
        ) {
          hatchObject = c;
        }
      });
      assert.ok(hatchObject, "Hatch must be in addon group");

      const hatchBox = new THREE.Box3().setFromObject(hatchObject);
      const hatchSize = new THREE.Vector3();
      hatchBox.getSize(hatchSize);

      assert.ok(Math.abs(hatchSize.x - 0.16) < 0.001, `Addon hatch width must stay 0.16m under host resize, got ${hatchSize.x}`);
      assert.ok(Math.abs(hatchSize.y - 0.34) < 0.001, `Addon hatch height must stay 0.34m under host resize, got ${hatchSize.y}`);
      assert.ok(Math.abs(hatchSize.z - 0.02) < 0.001, `Addon hatch depth must stay 0.02m under host resize, got ${hatchSize.z}`);
    });

    it("strictly preserves zero-gap edge contact between stile and fixed hatch under parametric scaling", () => {
      // Replicate the Mesh Screen CAD geometry:
      // Host frame: width 800mm (left stile min -0.40, max -0.38; right stile min 0.38, max 0.40)
      // Hatch: min 0.22, max 0.38 (touching right stile inner face at 0.38 with 0 gap)
      const leftGeom = new THREE.BoxGeometry(0.02, 1.2, 0.012);
      const leftStile = new THREE.Mesh(leftGeom);
      leftStile.position.set(-0.39, 0.6, 0);

      const rightGeom = new THREE.BoxGeometry(0.02, 1.2, 0.012);
      const rightStile = new THREE.Mesh(rightGeom);
      rightStile.position.set(0.39, 0.6, 0);

      const hatchGeom = new THREE.BoxGeometry(0.16, 0.34, 0.025);
      const hatchMesh = new THREE.Mesh(hatchGeom);
      hatchMesh.position.set(0.30, 0.6, 0.01);

      const cache: ComponentModelCache = {
        getClone: (id: string) => {
          if (id === "comp_stile_l") return leftStile.clone(true);
          if (id === "comp_stile_r") return rightStile.clone(true);
          if (id === "comp_hatch") return hatchMesh.clone(true);
          throw new Error(`Unknown component ${id}`);
        },
        getSourceSizeMeters: () => new THREE.Vector3(0.8, 1.2, 0.012),
      };

      const definition: ProductStructuralDefinition = {
        product: {
          productId: "prod_screen_door",
          productName: "Mesh Screen Door",
          productType: "Door",
          basePrice: 1000,
        },
        template: {
          templateId: "tmpl_screen_door",
          templateName: "Mesh Screen Template",
          modelStrategy: "Parametric",
          measurementUnit: "mm",
          baseConfiguration: {},
        },
        components: [
          {
            componentId: "comp_stile_l",
            componentKey: "screen_frame_left",
            componentName: "Screen Frame Left",
            componentType: "Frame",
            presentationCategory: "Framing",
            dimensionBinding: "HEIGHT",
            baseQuantity: 1,
            componentData: {},
            model: {
              assetId: "a_sl",
              r2ObjectKey: "sl.glb",
              url: "https://r2.dev/sl.glb",
              fileName: "sl.glb",
              sourceDimensionsMm: { width: 20, height: 1200, depth: 12 },
            },
          },
          {
            componentId: "comp_stile_r",
            componentKey: "screen_frame_right",
            componentName: "Screen Frame Right",
            componentType: "Frame",
            presentationCategory: "Framing",
            dimensionBinding: "HEIGHT",
            baseQuantity: 1,
            componentData: {},
            model: {
              assetId: "a_sr",
              r2ObjectKey: "sr.glb",
              url: "https://r2.dev/sr.glb",
              fileName: "sr.glb",
              sourceDimensionsMm: { width: 20, height: 1200, depth: 12 },
            },
          },
          {
            componentId: "comp_hatch",
            componentKey: "screen_access_hatch",
            componentName: "Screen Access Hatch",
            componentType: "Hardware",
            presentationCategory: "Hardware",
            dimensionBinding: "FIXED",
            baseQuantity: 1,
            positionOptions: {
              allowHorizontalToggle: true,
              defaultHorizontal: "right",
              horizontalOffsetMm: 45,
              allowVerticalToggle: false,
              defaultVertical: "up",
              verticalOffsetMm: 600,
            },
            componentData: {},
            model: {
              assetId: "a_hatch",
              r2ObjectKey: "hatch.glb",
              url: "https://r2.dev/hatch.glb",
              fileName: "hatch.glb",
              sourceDimensionsMm: { width: 160, height: 340, depth: 25 },
            },
          },
        ],
        parameters: [],
        rules: [],
      };

      // 1. In validation at 1200mm (scaleX = 1.5x of 800mm)
      const resolved1200: ResolvedStructure = {
        componentQuantities: { screen_frame_left: 1, screen_frame_right: 1, screen_access_hatch: 1 },
        resolvedValues: {},
        numericValuesMm: { width: 1200, height: 1200 },
        appliedRuleIds: [],
      };

      const built1200 = buildParametricProduct(definition, resolved1200, cache, {
        swappedAccessories: {},
      });

      built1200.group.updateMatrixWorld(true);

      const rightChild = built1200.group.children.find((c) => c.userData.componentId === "comp_stile_r")!;
      const hatchChild = built1200.group.children.find((c) => c.userData.componentId === "comp_hatch")!;

      assert.ok(rightChild, "Right stile must exist");
      assert.ok(hatchChild, "Hatch must exist");

      const rightBox = new THREE.Box3().setFromObject(rightChild);
      const hatchBox = new THREE.Box3().setFromObject(hatchChild);

      // In validation, hatch.max.x must touch right stile inner edge rightBox.min.x with ZERO gap (under 0.001m)
      const gapMm = Math.abs(rightBox.min.x - hatchBox.max.x) * 1000;
      assert.ok(gapMm < 1.0, `Gap between hatch and stile in validation must be under 1mm, got ${gapMm.toFixed(2)}mm`);

      // 2. When toggled to left side at 1200mm
      const builtLeft = buildParametricProduct(definition, resolved1200, cache, {
        swappedAccessories: {
          comp_hatch: {
            slotComponentId: "comp_hatch",
            accessoryId: "default",
            accessoryName: "Screen Access Hatch",
            category: "handle",
            price: 0,
            finish: "satin",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
      });

      builtLeft.group.updateMatrixWorld(true);
      const leftChild = builtLeft.group.children.find((c) => c.userData.componentId === "comp_stile_l")!;
      const hatchLeftChild = builtLeft.group.children.find((c) => c.userData.componentId === "comp_hatch")!;

      const leftBox = new THREE.Box3().setFromObject(leftChild);
      const hatchLeftBox = new THREE.Box3().setFromObject(hatchLeftChild);

      // On left side, hatch.min.x must touch left stile inner edge leftBox.max.x with ZERO gap
      const leftGapMm = Math.abs(hatchLeftBox.min.x - leftBox.max.x) * 1000;
      assert.ok(leftGapMm < 1.0, `Gap between left hatch and left stile must be under 1mm, got ${leftGapMm.toFixed(2)}mm`);
    });

    // QAD-TC93.20: Standalone Hardware Accessory Validation Handing and Material Preservation
    it("QAD-TC93.20: standalone hardware accessory validation preserves original GLB materials and mirrors across X on handing toggle", () => {
      // 1. Create multi-material accessory mesh (white frame, black wire mesh, black handle)
      const frameGeom = new THREE.BoxGeometry(0.3, 0.6, 0.05);
      frameGeom.translate(0.1, 0, 0); // Asymmetric X to test reflection
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); // White frame
      const frameMesh = new THREE.Mesh(frameGeom, frameMat);

      const wireMeshGeom = new THREE.BoxGeometry(0.2, 0.5, 0.01);
      wireMeshGeom.translate(0.1, 0, 0);
      const wireMeshMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Black wire mesh
      const wireMesh = new THREE.Mesh(wireMeshGeom, wireMeshMat);

      const accessoryScene = new THREE.Group();
      accessoryScene.add(frameMesh);
      accessoryScene.add(wireMesh);

      const definition: ProductStructuralDefinition = {
        product: {
          productId: "acc-hatch-1",
          productName: "Screen Access Hatch",
          productType: "Other",
          isAddon: false,
          isAccessory: true,
          accessoryCategory: "other",
        },
        template: {
          templateId: "tpl-acc-1",
          templateName: "Accessory Template",
          modelStrategy: "Fixed",
          measurementUnit: "mm",
          baseConfiguration: {},
        },
        components: [
          {
            componentId: "comp_acc_hatch",
            componentKey: "screen_access_hatch",
            componentName: "Screen Access Hatch Assembly",
            componentType: "Model",
            presentationCategory: "Hardware",
            dimensionBinding: "FIXED",
            spanRatio: 1.0,
            baseQuantity: 1,
            isRemovable: false,
            componentData: {},
            handingMetadata: {
              sourceHanding: "right",
              uploadedGlbUrl: "https://r2.example.com/hatch_right.glb",
              leftGlbUrl: "https://r2.example.com/hatch_left.glb",
              rightGlbUrl: "https://r2.example.com/hatch_right.glb",
              mirroredAt: "2026-10-28T00:00:00.000Z",
            },
            model: {
              assetId: "ast-hatch-r",
              r2ObjectKey: "hatch_right.glb",
              url: "https://r2.example.com/hatch_right.glb",
              fileName: "hatch_right.glb",
              sourceDimensionsMm: { width: 300, height: 600, depth: 50 },
            },
          },
        ],
        parameters: [],
        rules: [],
      };

      const resolved: ResolvedStructure = {
        resolvedValues: {},
        numericValuesMm: { width: 300, height: 600 },
        componentQuantities: {},
        appliedRuleIds: [],
      };

      const cache: ComponentModelCache = {
        getClone: () => accessoryScene.clone(true),
        getSourceSizeMeters: () => new THREE.Vector3(0.3, 0.6, 0.05),
      };

      // 2. Build with default right handing
      const builtRight = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_acc_hatch: {
            slotComponentId: "comp_acc_hatch",
            accessoryId: "default",
            accessoryName: "Screen Access Hatch",
            category: "handle",
            price: 0,
            finish: "satin",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
      });

      builtRight.group.updateMatrixWorld(true);
      const rightMesh = builtRight.group.children[0] as THREE.Group;
      assert.strictEqual(rightMesh.userData.isMirroredHanding, false);
      assert.strictEqual(rightMesh.userData.preserveMaterial, true);

      // Verify materials are completely preserved
      const rightChildren = rightMesh.children as THREE.Mesh[];
      assert.strictEqual(rightChildren.length, 2);
      assert.strictEqual((rightChildren[0].material as THREE.MeshStandardMaterial).color.getHex(), 0xffffff); // White frame
      assert.strictEqual((rightChildren[1].material as THREE.MeshStandardMaterial).color.getHex(), 0x111111); // Black wire mesh

      const origRightBounds = new THREE.Box3().setFromObject(rightMesh);
      assert.ok(origRightBounds.max.x > 0);

      // 3. Build with toggled left handing
      const builtLeft = buildParametricProduct(definition, resolved, cache, {
        swappedAccessories: {
          comp_acc_hatch: {
            slotComponentId: "comp_acc_hatch",
            accessoryId: "default",
            accessoryName: "Screen Access Hatch",
            category: "handle",
            price: 0,
            finish: "satin",
            horizontalPosition: "left",
            verticalPosition: "up",
          },
        },
      });

      builtLeft.group.updateMatrixWorld(true);
      const leftMesh = builtLeft.group.children[0] as THREE.Group;
      assert.strictEqual(leftMesh.userData.isMirroredHanding, true);
      assert.strictEqual(leftMesh.userData.preserveMaterial, true);

      // Materials must remain untouched even after geometry reflection
      const leftChildren = leftMesh.children as THREE.Mesh[];
      assert.strictEqual(leftChildren.length, 2);
      assert.strictEqual((leftChildren[0].material as THREE.MeshStandardMaterial).color.getHex(), 0xffffff);
      assert.strictEqual((leftChildren[1].material as THREE.MeshStandardMaterial).color.getHex(), 0x111111);

      // Geometry positions must be laterally reflected across X
      const leftBounds = new THREE.Box3().setFromObject(leftMesh);
      assert.ok(Math.abs(leftBounds.min.x - (-origRightBounds.max.x)) < 0.001);
      assert.ok(Math.abs(leftBounds.max.x - (-origRightBounds.min.x)) < 0.001);
    });
  });
});
