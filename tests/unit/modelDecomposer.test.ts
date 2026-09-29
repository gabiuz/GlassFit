import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  decomposeSceneGraph,
  decomposeWholeModel,
  formatLabel,
  sanitizeComponentKey,
} from "../../src/lib/admin/products/modelDecomposer.js";

describe("Milestone 6: Assembled 3D Model Decomposition & Scene Graph Extraction (QAD-TC20)", () => {
  // --------------------------------------------------------------------------
  // 1. Label Formatting & Key Sanitization Helper Tests
  // --------------------------------------------------------------------------
  describe("Naming & Sanitization Utilities", () => {
    it("should sanitize node names into valid lowercase alphanumeric keys", () => {
      assert.strictEqual(sanitizeComponentKey("Series798_Double_Sill.glb"), "series798_double_sill");
      assert.strictEqual(sanitizeComponentKey("Jamb Left (Outer)"), "jamb_left__outer");
      assert.strictEqual(sanitizeComponentKey("___Glass_Pane___"), "glass_pane");
      assert.strictEqual(sanitizeComponentKey(""), "component");
    });

    it("should format node names into clean capitalized presentation labels", () => {
      assert.strictEqual(formatLabel("series798_double_sill.glb"), "Series798 Double Sill");
      assert.strictEqual(formatLabel("jamb-left"), "Jamb Left");
      assert.strictEqual(formatLabel("window_glass_pane"), "Window Glass Pane");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Multi-Node Scene Graph Traversal (QAD-TC20.1)
  // --------------------------------------------------------------------------
  describe("Multi-Node Scene Graph Traversal (QAD-TC20.1)", () => {
    it("should correctly traverse a multi-part scene and extract all distinct structural meshes", async () => {
      const root = new THREE.Group();
      root.name = "AssembledWindow";

      // 1. Frame Head
      const headGeom = new THREE.BoxGeometry(1.2, 0.05, 0.05);
      const headMesh = new THREE.Mesh(headGeom, new THREE.MeshStandardMaterial());
      headMesh.name = "series798_head";
      headMesh.position.set(0, 0.6, 0);
      root.add(headMesh);

      // 2. Frame Sill
      const sillGeom = new THREE.BoxGeometry(1.2, 0.05, 0.05);
      const sillMesh = new THREE.Mesh(sillGeom, new THREE.MeshStandardMaterial());
      sillMesh.name = "series798_sill";
      sillMesh.position.set(0, -0.6, 0);
      root.add(sillMesh);

      // 3. Left Jamb
      const leftJambGeom = new THREE.BoxGeometry(0.05, 1.2, 0.05);
      const leftJambMesh = new THREE.Mesh(leftJambGeom, new THREE.MeshStandardMaterial());
      leftJambMesh.name = "series798_jamb_left";
      leftJambMesh.position.set(-0.6, 0, 0);
      root.add(leftJambMesh);

      // 4. Right Jamb
      const rightJambGeom = new THREE.BoxGeometry(0.05, 1.2, 0.05);
      const rightJambMesh = new THREE.Mesh(rightJambGeom, new THREE.MeshStandardMaterial());
      rightJambMesh.name = "series798_jamb_right";
      rightJambMesh.position.set(0.6, 0, 0);
      root.add(rightJambMesh);

      // 5. Glass Pane
      const glassGeom = new THREE.BoxGeometry(0.55, 1.1, 0.006);
      const glassMesh = new THREE.Mesh(glassGeom, new THREE.MeshPhysicalMaterial({ transmission: 0.9 }));
      glassMesh.name = "window_glass_pane";
      glassMesh.position.set(0, 0, 0);
      root.add(glassMesh);

      const result = await decomposeSceneGraph(root, "assembled_window.glb");

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.totalNodesDetected, 5);
      assert.strictEqual(result.extractedParts.length, 5);

      const keys = result.extractedParts.map((p) => p.componentKey);
      assert.ok(keys.includes("series798_head"));
      assert.ok(keys.includes("series798_sill"));
      assert.ok(keys.includes("series798_jamb_left"));
      assert.ok(keys.includes("series798_jamb_right"));
      assert.ok(keys.includes("window_glass_pane"));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Assembly Coordinate Retention & Position Metadata (QAD-TC21.1)
  // --------------------------------------------------------------------------
  describe("Assembly Coordinate Retention & Position Metadata (QAD-TC21.1)", () => {
    it("should retain modeled assembly spatial offsets and populate assemblyPosition metadata", async () => {
      const root = new THREE.Group();

      // Place offset meshes at specific modeled assembly coordinates
      const offGeom = new THREE.BoxGeometry(0.8, 1.4, 0.08);
      const mesh1 = new THREE.Mesh(offGeom, new THREE.MeshStandardMaterial());
      mesh1.name = "offset_stile_left";
      mesh1.position.set(-0.616, 1.015, 0.0);
      root.add(mesh1);

      const mesh2 = new THREE.Mesh(offGeom.clone(), new THREE.MeshStandardMaterial());
      mesh2.name = "offset_stile_right";
      mesh2.position.set(0.616, 1.015, 0.0);
      root.add(mesh2);

      const result = await decomposeSceneGraph(root, "offset_test.glb");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.extractedParts.length, 2);

      const leftPart = result.extractedParts.find((p) => p.componentKey === "offset_stile_left");
      const rightPart = result.extractedParts.find((p) => p.componentKey === "offset_stile_right");

      assert.ok(leftPart);
      assert.ok(rightPart);

      // Verify assemblyPosition metadata
      assert.ok(leftPart.assemblyPosition);
      assert.strictEqual(leftPart.assemblyPosition.x, -0.616);
      assert.strictEqual(leftPart.assemblyPosition.y, 1.015);

      assert.ok(rightPart.assemblyPosition);
      assert.strictEqual(rightPart.assemblyPosition.x, 0.616);
      assert.strictEqual(rightPart.assemblyPosition.y, 1.015);

      // Verify geometry vertices retain spatial offset in preview mesh
      const leftBox = new THREE.Box3().setFromObject(leftPart.previewMesh);
      const leftCenter = new THREE.Vector3();
      leftBox.getCenter(leftCenter);
      assert.ok(Math.abs(leftCenter.x - -0.616) < 0.001);
      assert.ok(Math.abs(leftCenter.y - 1.015) < 0.001);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Topological Loose-Parts Segmentation (QAD-TC21.2)
  // --------------------------------------------------------------------------
  describe("Topological Loose-Parts Segmentation (QAD-TC21.2)", () => {
    it("should segment a merged composite mesh into multiple disconnected loose parts", async () => {
      const root = new THREE.Group();

      // Create two disconnected cubes merged into a single BufferGeometry
      const box1 = new THREE.BoxGeometry(0.4, 0.4, 0.4).toNonIndexed();
      box1.translate(-0.8, 0, 0);
      const box2 = new THREE.BoxGeometry(0.4, 0.4, 0.4).toNonIndexed();
      box2.translate(0.8, 0, 0);

      const pos1 = box1.attributes.position.array;
      const pos2 = box2.attributes.position.array;
      const mergedPos = new Float32Array(pos1.length + pos2.length);
      mergedPos.set(pos1, 0);
      mergedPos.set(pos2, pos1.length);

      const mergedGeom = new THREE.BufferGeometry();
      mergedGeom.setAttribute("position", new THREE.BufferAttribute(mergedPos, 3));
      mergedGeom.computeVertexNormals();

      const compositeMesh = new THREE.Mesh(mergedGeom, new THREE.MeshStandardMaterial());
      compositeMesh.name = "composite_cabinet";
      root.add(compositeMesh);

      const result = await decomposeSceneGraph(root, "composite_cabinet.glb");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.extractedParts.length, 2);

      const part1 = result.extractedParts[0];
      const part2 = result.extractedParts[1];

      assert.ok(part1.componentKey.includes("composite_cabinet"));
      assert.ok(part2.componentKey.includes("composite_cabinet"));

      // Verify that the two parts have distinct centers corresponding to original positions
      const centers = [part1.assemblyPosition?.x, part2.assemblyPosition?.x].sort((a, b) => (a ?? 0) - (b ?? 0));
      assert.ok(Math.abs((centers[0] ?? 0) - -0.8) < 0.01);
      assert.ok(Math.abs((centers[1] ?? 0) - 0.8) < 0.01);
    });

    it("should return success: false when model contains only 1 truly monolithic single volume", async () => {
      const root = new THREE.Group();
      const singleMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      singleMesh.name = "monolithic_window_assembly";
      root.add(singleMesh);

      const result = await decomposeSceneGraph(root, "monolithic.glb");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.extractedParts.length, 0);
      assert.ok(result.error?.includes("single merged mesh"));
    });

    it("should return success: false when model contains 0 meshes", async () => {
      const root = new THREE.Group();
      const result = await decomposeSceneGraph(root, "empty.glb");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.extractedParts.length, 0);
      assert.ok(result.error?.includes("single merged mesh"));
    });
  });

  // --------------------------------------------------------------------------
  // 5. Auto-Detection Binding Parity (QAD-TC20.4)
  // --------------------------------------------------------------------------
  describe("Auto-Detection Binding Parity (QAD-TC20.4)", () => {
    it("should correctly populate structural bindings matching autoDetectComponentSettings rules", async () => {
      const root = new THREE.Group();

      // Sill -> Removable, togglePropertyKey: has_sill, WIDTH driver
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05));
      sill.name = "series798_double_sill";
      root.add(sill);

      // Jamb -> HEIGHT driver, non-removable
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.05));
      jamb.name = "series798_lock_stile";
      root.add(jamb);

      // Glass -> AREA driver, Glazing category
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.006));
      glass.name = "tempered_glass_pane";
      root.add(glass);

      // Roller -> FIXED driver, Hardware category
      const roller = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02));
      roller.name = "pom_roller_heavy_duty";
      root.add(roller);

      const result = await decomposeSceneGraph(root, "test_window.glb");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.extractedParts.length, 4);

      const sillPart = result.extractedParts.find((p) => p.componentKey === "series798_double_sill");
      assert.ok(sillPart);
      assert.strictEqual(sillPart.dimensionBinding, "WIDTH");
      assert.strictEqual(sillPart.isRemovable, true);
      assert.strictEqual(sillPart.togglePropertyKey, "has_sill");
      assert.strictEqual(sillPart.presentationCategory, "Framing");
      assert.strictEqual(sillPart.componentType, "Frame");

      const jambPart = result.extractedParts.find((p) => p.componentKey === "series798_lock_stile");
      assert.ok(jambPart);
      assert.strictEqual(jambPart.dimensionBinding, "HEIGHT");
      assert.strictEqual(jambPart.isRemovable, false);

      const glassPart = result.extractedParts.find((p) => p.componentKey === "tempered_glass_pane");
      assert.ok(glassPart);
      assert.strictEqual(glassPart.dimensionBinding, "AREA");
      assert.strictEqual(glassPart.presentationCategory, "Glazing");
      assert.strictEqual(glassPart.componentType, "Glass");

      const rollerPart = result.extractedParts.find((p) => p.componentKey === "pom_roller_heavy_duty");
      assert.ok(rollerPart);
      assert.strictEqual(rollerPart.dimensionBinding, "FIXED");
      assert.strictEqual(rollerPart.presentationCategory, "Hardware");
      assert.strictEqual(rollerPart.componentType, "Hardware");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Binary GLB Re-Export Validity (QAD-TC20.5)
  // --------------------------------------------------------------------------
  describe("Binary GLB Re-Export Validity (QAD-TC20.5)", () => {
    it("should export binary GLB Files that can be parsed back by GLTFLoader", async () => {
      const root = new THREE.Group();

      const mesh1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      mesh1.name = "part_alpha";
      root.add(mesh1);

      const mesh2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 })
      );
      mesh2.name = "part_beta";
      root.add(mesh2);

      const result = await decomposeSceneGraph(root, "reexport_test.glb");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.extractedParts.length, 2);

      const loader = new GLTFLoader();

      for (const part of result.extractedParts) {
        assert.ok(part.file instanceof File);
        assert.strictEqual(part.file.type, "model/gltf-binary");
        assert.ok(part.file.size > 0);

        const arrayBuffer = await part.file.arrayBuffer();
        const parsed = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          loader.parse(
            arrayBuffer,
            "",
            (gltf) => resolve(gltf),
            (err) => reject(err)
          );
        });

        assert.ok(parsed.scene);
        const meshesInScene: THREE.Mesh[] = [];
        parsed.scene.traverse((n) => {
          if (n instanceof THREE.Mesh) meshesInScene.push(n);
        });
        assert.strictEqual(meshesInScene.length, 1);
      }
    });

    it("should accept an assembled GLB File and decompose all parts end-to-end via decomposeWholeModel", async () => {
      const root = new THREE.Group();

      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05));
      sill.name = "series798_double_sill";
      root.add(sill);

      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.05));
      jamb.name = "series798_jamb_left";
      root.add(jamb);

      // Export assembled GLB
      const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
      const exporter = new GLTFExporter();
      const glbBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          root,
          (result) => {
            if (result instanceof ArrayBuffer) resolve(result);
            else if (result instanceof Uint8Array) {
              const copy = new Uint8Array(result.byteLength);
              copy.set(result);
              resolve(copy.buffer as ArrayBuffer);
            } else reject(new Error("Expected ArrayBuffer"));
          },
          (err) => reject(err),
          { binary: true }
        );
      });

      const assembledFile = new File([glbBuffer], "series798_assembled.glb", {
        type: "model/gltf-binary",
      });

      const result = await decomposeWholeModel(assembledFile);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.totalNodesDetected, 2);
      assert.strictEqual(result.extractedParts.length, 2);
      assert.strictEqual(result.sourceFileName, "series798_assembled.glb");
    });
  });
});
