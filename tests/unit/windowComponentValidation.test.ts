/**
 * Unit Test: Non-Jalousie Fenestration Product Validation & Center Mullion Alignment
 *
 * Upstream Specifications: docs/sdd-glassfit.md, docs/prd-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F14, SDD-C4, SDD-C9, QAD-TC98.1
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import { analyzeJalousieGeometry } from "../../src/lib/visualization/jalousieGeometryAnalyzer";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder";
import { resolveProductStructure } from "../../src/lib/visualization/structuralResolver";
import { autoDetectComponentSettings, autoDetectAccessorySlot } from "../../src/lib/admin/products/autoDetection";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";
import type {
  ProductStructuralDefinition,
  ProductComponentDefinition,
  ResolvedStructure,
} from "../../src/lib/visualization/types";

describe("QAD-TC98.1: Non-Jalousie Fenestration Components & Center Mullion Positioning", () => {
  it("does not classify standard window glass panels as louver blades", () => {
    // Single glass panel standard box mesh (1200mm x 1200mm, thickness 6mm)
    const glassMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.1, 0.006),
      new THREE.MeshStandardMaterial({ name: "Clear_Glass", transparent: true, opacity: 0.3 })
    );
    glassMesh.name = "Glass_Pane";

    const group = new THREE.Group();
    group.name = "glass-panel";
    group.add(glassMesh);

    const result = analyzeJalousieGeometry(group, "glass-panel.glb");

    assert.strictEqual(result.isLouverBlade, false, "Standard glass panel must NOT be classified as a louver blade");
    assert.strictEqual(result.isLouverOperator, false, "Standard glass panel must NOT be an operator");
    assert.strictEqual(result.suggestedBinding, "AREA", "Standard glass panel must have AREA dimension binding");
    assert.strictEqual(result.suggestedBaseQuantity, 1, "Base quantity for standard glass must be 1");
    assert.strictEqual(result.louverCount, 0, "Louver count must be 0 for standard glass");
  });

  it("spawns center mullion at exact X = 0 for symmetric 2-panel window and centers glass in both bays", () => {
    // Create mock cache
    const mockCache: ComponentModelCache = {
      getClone: (id: string) => {
        const geom = id.includes("frame-center") || id.includes("mullion")
          ? new THREE.BoxGeometry(0.05, 1.1, 0.05)
          : id.includes("glass")
            ? new THREE.BoxGeometry(0.5, 1.1, 0.006)
            : new THREE.BoxGeometry(0.05, 1.2, 0.05);
        const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
        mesh.name = id;
        const g = new THREE.Group();
        g.name = id;
        g.add(mesh);
        return g;
      },
      getSourceSizeMeters: (id: string) => {
        if (id.includes("frame-center") || id.includes("mullion")) {
          return new THREE.Vector3(0.05, 1.1, 0.05);
        }
        if (id.includes("glass")) {
          return new THREE.Vector3(0.5, 1.1, 0.006);
        }
        return new THREE.Vector3(0.05, 1.2, 0.05);
      },
    };

    const createSyntheticModel = (fileName: string) => ({
      assetId: "synth_" + fileName,
      r2ObjectKey: "synthetic/" + fileName,
      url: "https://synthetic.test/" + fileName,
      fileName,
      sourceDimensionsMm: { width: 1200, height: 1200, depth: 80 },
    });

    const createComponent = (
      id: string,
      key: string,
      name: string,
      type: "Frame" | "Glass",
      category: "Framing" | "Glazing",
      binding: "HEIGHT" | "WIDTH" | "AREA"
    ): ProductComponentDefinition => ({
      componentId: id,
      componentKey: key,
      componentName: name,
      componentType: type,
      presentationCategory: category,
      dimensionBinding: binding,
      spanRatio: 1.0,
      baseQuantity: 1,
      isRemovable: false,
      isAccessorySlot: false,
      componentData: {},
      model: createSyntheticModel(`${key}.glb`),
    });

    const definition: ProductStructuralDefinition = {
      template: {
        templateId: "tmpl_test_window",
        templateName: "2-Panel Standard Window",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      product: {
        productId: "prod_test_window",
        productName: "2-Panel Standard Window",
        productType: "Window",
        isAccessory: false,
      },
      parameters: [
        {
          parameterId: "p_w",
          parameterName: "Width",
          parameterKey: "width",
          parameterType: "Number",
          minimumValue: 500,
          maximumValue: 3000,
          defaultValue: 1200,
          stepValue: 1,
          unit: "mm",
          affectsStructure: true,
          displayOrder: 1,
        },
        {
          parameterId: "p_h",
          parameterName: "Height",
          parameterKey: "height",
          parameterType: "Number",
          minimumValue: 500,
          maximumValue: 3000,
          defaultValue: 1200,
          stepValue: 1,
          unit: "mm",
          affectsStructure: true,
          displayOrder: 2,
        },
      ],
      components: [
        createComponent("c_fl", "frame-left", "Left Jamb", "Frame", "Framing", "HEIGHT"),
        createComponent("c_fr", "frame-right", "Right Jamb", "Frame", "Framing", "HEIGHT"),
        createComponent("c_ft", "frame-top", "Top Head", "Frame", "Framing", "WIDTH"),
        createComponent("c_fb", "frame-bottom", "Bottom Sill", "Frame", "Framing", "WIDTH"),
        createComponent("c_fc", "frame-center", "Center Mullion", "Frame", "Framing", "HEIGHT"),
        createComponent("c_gp", "glass-panel", "Glass Panel", "Glass", "Glazing", "AREA"),
      ],
      rules: [],
    };

    const resolved = resolveProductStructure({
      definition,
      values: { width: 1200, height: 1200 },
    });

    const built = buildParametricProduct(definition, resolved, mockCache);
    const group = built.group;

    // Mullions group
    const mullions = group.getObjectByName("Mullions");
    assert.ok(mullions, "Mullions group must exist");
    const mullionChild = mullions.getObjectByName("Mullion_1");
    assert.ok(mullionChild, "Mullion_1 must be mounted");

    // Center mullion should be located at X = 0 (tolerance 0.001m / 1mm)
    assert.ok(
      Math.abs(mullionChild.position.x) < 0.001,
      `Center mullion must spawn at X = 0, but was at X = ${mullionChild.position.x}`
    );

    // Glass group
    const glassGroup = group.getObjectByName("Glass");
    assert.ok(glassGroup, "Glass group must exist");
    assert.strictEqual(glassGroup.children.length, 2, "2-panel window must have exactly 2 glass panels (1 per bay)");

    const glass1 = glassGroup.getObjectByName("Glass_1");
    const glass2 = glassGroup.getObjectByName("Glass_2");
    assert.ok(glass1, "Glass_1 must exist");
    assert.ok(glass2, "Glass_2 must exist");

    // Glass 1 should be in left bay (negative X) and Glass 2 in right bay (positive X)
    assert.ok(glass1.position.x < -0.1, `Glass_1 should be in left bay, pos: ${glass1.position.x}`);
    assert.ok(glass2.position.x > 0.1, `Glass_2 should be in right bay, pos: ${glass2.position.x}`);

    // Symmetrical positioning across X = 0
    const sumX = glass1.position.x + glass2.position.x;
    assert.ok(
      Math.abs(sumX) < 0.001,
      `Glass panels must be symmetrically positioned around X = 0, sum was: ${sumX}`
    );
  });

  it("detects weep hole covers as Hardware and seals as Consumables without erroneous handing toggle", () => {
    const weepDetection = autoDetectComponentSettings("SW_Weep_Hole_Covers.glb");
    assert.strictEqual(weepDetection.presentationCategory, "Hardware");
    assert.strictEqual(weepDetection.componentType, "Hardware");
    assert.strictEqual(weepDetection.dimensionBinding, "FIXED");

    const weepSlot = autoDetectAccessorySlot("SW_Weep_Hole_Covers.glb");
    assert.strictEqual(weepSlot, null, "Weep hole covers must not be registered as a swappable accessory slot");

    const handleSlot = autoDetectAccessorySlot("SW_Handles.glb");
    assert.ok(handleSlot, "Handles must be recognized as accessory slot");
    assert.strictEqual(handleSlot.positionOptions.allowHorizontalToggle, false, "Multi-handle set must not allow unilateral horizontal toggle");

    const sealDetection = autoDetectComponentSettings("SW_Weather_Seals.glb");
    assert.strictEqual(sealDetection.presentationCategory, "Consumable");
    assert.strictEqual(sealDetection.dimensionBinding, "PERIMETER");
  });

  it("scales multi-handle and weep-hole-cover clusters symmetrically and preserves their 1:1 metric size when width changes", () => {
    // Synthetic multi-handle mesh with 3 handles: left (-0.85), center (-0.012), right (+0.85)
    const handlesGroup = new THREE.Group();
    handlesGroup.name = "SW_Handles";

    const createHandleMesh = (cx: number) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.027, 0.195, 0.04),
        new THREE.MeshStandardMaterial({ name: "Black_Hardware" })
      );
      mesh.position.set(cx, 0, 0.04);
      return mesh;
    };

    const leftHandle = createHandleMesh(-0.85);
    const centerHandle = createHandleMesh(-0.012);
    const rightHandle = createHandleMesh(0.85);
    leftHandle.updateMatrixWorld(true);
    centerHandle.updateMatrixWorld(true);
    rightHandle.updateMatrixWorld(true);
    handlesGroup.add(leftHandle, centerHandle, rightHandle);

    // Synthetic weep hole covers with 2 covers: left (-0.55), right (+0.55)
    const weepGroup = new THREE.Group();
    weepGroup.name = "SW_Weep_Hole_Covers";
    const createWeepMesh = (cx: number) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.014, 0.01),
        new THREE.MeshStandardMaterial({ name: "Black_Plastic" })
      );
      mesh.position.set(cx, -0.665, 0.06);
      return mesh;
    };
    const leftWeep = createWeepMesh(-0.55);
    const rightWeep = createWeepMesh(0.55);
    leftWeep.updateMatrixWorld(true);
    rightWeep.updateMatrixWorld(true);
    weepGroup.add(leftWeep, rightWeep);

    // Synthetic bottom frame (1.76m wide, X: [-0.88, 0.88])
    const frameBottomGroup = new THREE.Group();
    frameBottomGroup.name = "SW_Frame_Bottom";
    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.76, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ name: "Frame_Aluminum" })
    );
    frameBottomGroup.add(frameMesh);

    const mockSlidingCache: ComponentModelCache = {
      getClone: (id: string) => {
        if (id.includes("handle")) return handlesGroup.clone(true);
        if (id.includes("weep")) return weepGroup.clone(true);
        return frameBottomGroup.clone(true);
      },
      getSourceSizeMeters: (id: string) => {
        if (id.includes("handle")) return new THREE.Vector3(1.727, 0.195, 0.04);
        if (id.includes("weep")) return new THREE.Vector3(1.135, 0.014, 0.01);
        return new THREE.Vector3(1.76, 0.12, 0.12);
      },
    };

    const createModelMeta = (fileName: string) => ({
      assetId: "synth_" + fileName,
      r2ObjectKey: "synthetic/" + fileName,
      url: "https://synthetic.test/" + fileName,
      fileName,
      sourceDimensionsMm: { width: 1760, height: 1500, depth: 120 },
    });

    const definition: ProductStructuralDefinition = {
      template: {
        templateId: "tmpl_sliding_window",
        templateName: "2-Panel Sliding Window",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      product: {
        productId: "prod_sliding_window",
        productName: "2-Panel Sliding Window",
        productType: "Sliding Window",
        isAccessory: false,
      },
      parameters: [
        {
          parameterId: "p_width",
          parameterName: "Width",
          parameterKey: "width",
          parameterType: "Number",
          minimumValue: 500,
          maximumValue: 3000,
          defaultValue: 1760,
          stepValue: 1,
          unit: "mm",
          affectsStructure: true,
          displayOrder: 1,
        },
      ],
      components: [
        {
          componentId: "c_fb",
          componentKey: "frame-bottom",
          componentName: "SW_Frame_Bottom",
          componentType: "Frame",
          presentationCategory: "Framing",
          dimensionBinding: "WIDTH",
          spanRatio: 1.0,
          baseQuantity: 1,
          isRemovable: false,
          isAccessorySlot: false,
          componentData: {},
          model: createModelMeta("SW_Frame_Bottom.glb"),
        },
        {
          componentId: "c_handles",
          componentKey: "handles",
          componentName: "SW_Handles",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          dimensionBinding: "FIXED",
          spanRatio: 1.0,
          baseQuantity: 1,
          isRemovable: false,
          isAccessorySlot: true,
          positionOptions: {
            allowHorizontalToggle: false,
            defaultHorizontal: "right",
            horizontalOffsetMm: 45,
            allowVerticalToggle: false,
            defaultVertical: "up",
            verticalOffsetMm: 1000,
          },
          componentData: {},
          model: createModelMeta("SW_Handles.glb"),
        },
        {
          componentId: "c_weep",
          componentKey: "weep-hole-covers",
          componentName: "SW_Weep_Hole_Covers",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          dimensionBinding: "FIXED",
          spanRatio: 1.0,
          baseQuantity: 1,
          isRemovable: false,
          isAccessorySlot: false,
          componentData: {},
          model: createModelMeta("SW_Weep_Hole_Covers.glb"),
        },
      ],
      rules: [],
    };

    // Narrow width from 1760mm down to 880mm (scaleX = 0.5)
    const resolved = resolveProductStructure({
      definition,
      values: { width: 880 },
    });

    const built = buildParametricProduct(definition, resolved, mockSlidingCache);
    const group = built.group;

    group.updateMatrixWorld(true);

    // Frame bounds: width should now be 0.88m, span [-0.44, 0.44]
    const frameObj = group.getObjectByName("SW_Frame_Bottom");
    assert.ok(frameObj, "Frame bottom must be in assembly");
    const frameBox = new THREE.Box3().setFromObject(frameObj);
    assert.ok(Math.abs((frameBox.max.x - frameBox.min.x) - 0.88) < 0.01, `Frame width must be 0.88m, got ${frameBox.max.x - frameBox.min.x}`);

    // Handles: all 3 clusters must be inside [-0.44, 0.44]
    const handleCluster0 = group.getObjectByName("SW_Handles_cluster_0");
    const handleCluster1 = group.getObjectByName("SW_Handles_cluster_1");
    const handleCluster2 = group.getObjectByName("SW_Handles_cluster_2");
    assert.ok(handleCluster0, "Handle cluster 0 must exist");
    assert.ok(handleCluster1, "Handle cluster 1 must exist");
    assert.ok(handleCluster2, "Handle cluster 2 must exist");

    const boxH0 = new THREE.Box3().setFromObject(handleCluster0);
    const boxH1 = new THREE.Box3().setFromObject(handleCluster1);
    const boxH2 = new THREE.Box3().setFromObject(handleCluster2);

    const cH0 = new THREE.Vector3();
    const cH1 = new THREE.Vector3();
    const cH2 = new THREE.Vector3();
    boxH0.getCenter(cH0);
    boxH1.getCenter(cH1);
    boxH2.getCenter(cH2);

    // Left handle at -0.85 * 0.5 = -0.425
    assert.ok(Math.abs(cH0.x - (-0.425)) < 0.02, `Left handle should be at -0.425, got ${cH0.x}`);
    // Center handle at -0.012 * 0.5 = -0.006
    assert.ok(Math.abs(cH1.x - (-0.006)) < 0.02, `Center handle should be at -0.006, got ${cH1.x}`);
    // Right handle at +0.85 * 0.5 = +0.425
    assert.ok(Math.abs(cH2.x - 0.425) < 0.02, `Right handle should be at 0.425, got ${cH2.x}`);

    // All handles must retain unscaled 1:1 metric width (27.3mm)
    assert.ok(Math.abs((boxH0.max.x - boxH0.min.x) - 0.027) < 0.005, "Left handle must maintain 27.3mm width");
    assert.ok(Math.abs((boxH2.max.x - boxH2.min.x) - 0.027) < 0.005, "Right handle must maintain 27.3mm width");

    // Weep hole covers: both clusters must be inside [-0.44, 0.44]
    const weepCluster0 = group.getObjectByName("SW_Weep_Hole_Covers_cluster_0");
    const weepCluster1 = group.getObjectByName("SW_Weep_Hole_Covers_cluster_1");
    assert.ok(weepCluster0, "Weep cover cluster 0 must exist");
    assert.ok(weepCluster1, "Weep cover cluster 1 must exist");

    const boxW0 = new THREE.Box3().setFromObject(weepCluster0);
    const boxW1 = new THREE.Box3().setFromObject(weepCluster1);
    const cW0 = new THREE.Vector3();
    const cW1 = new THREE.Vector3();
    boxW0.getCenter(cW0);
    boxW1.getCenter(cW1);

    // Left weep cover at -0.55 * 0.5 = -0.275
    assert.ok(Math.abs(cW0.x - (-0.275)) < 0.02, `Left weep cover should be at -0.275, got ${cW0.x}`);
    // Right weep cover at +0.55 * 0.5 = +0.275
    assert.ok(Math.abs(cW1.x - 0.275) < 0.02, `Right weep cover should be at 0.275, got ${cW1.x}`);

    // Weep covers must retain unscaled 1:1 metric width (35mm)
    assert.ok(Math.abs((boxW0.max.x - boxW0.min.x) - 0.035) < 0.005, "Weep cover must maintain 35mm width");
    assert.ok(Math.abs((boxW1.max.x - boxW1.min.x) - 0.035) < 0.005, "Weep cover must maintain 35mm width");
  });

  it("strictly preserves multi-material PBR definitions on hardware handles during parametric assembly", () => {
    // Recreates the 4 distinct primitives of SW_Handles.glb:
    // Primitive 0: White powder coat (0xf3f4f6)
    // Primitive 1: Red indicator (0xcc1111)
    // Primitive 2: Black metal latch (0x111111)
    // Primitive 3: Silver hardware (0xd2d6dc)
    const handleGroup = new THREE.Group();
    handleGroup.name = "SW_Handles";

    const createMultiMaterialHandleMesh = (cx: number) => {
      const g = new THREE.Group();
      g.position.set(cx, 0, 0.04);

      const whiteMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.027, 0.15, 0.03),
        new THREE.MeshStandardMaterial({ name: "Mat_Handle_Powder_White", color: 0xf3f4f6 })
      );
      const redMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.02, 0.01),
        new THREE.MeshStandardMaterial({ name: "Mat_Indicator_Red", color: 0xcc1111 })
      );
      const blackMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.04, 0.015),
        new THREE.MeshStandardMaterial({ name: "Mat_Handle_Metal_Black", color: 0x111111 })
      );
      const silverMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.008, 0.01),
        new THREE.MeshStandardMaterial({ name: "Mat_Handle_Metal_Silver", color: 0xd2d6dc })
      );
      g.add(whiteMesh, redMesh, blackMesh, silverMesh);
      return g;
    };

    const leftSet = createMultiMaterialHandleMesh(-0.85);
    const centerSet = createMultiMaterialHandleMesh(-0.012);
    const rightSet = createMultiMaterialHandleMesh(0.85);
    leftSet.updateMatrixWorld(true);
    centerSet.updateMatrixWorld(true);
    rightSet.updateMatrixWorld(true);
    handleGroup.add(leftSet, centerSet, rightSet);

    const definition: ProductStructuralDefinition = {
      product: {
        productId: "prod_sw_window",
        productName: "Sliding Window",
        productType: "Window",
        isAddon: false,
        isAccessory: false,
      },
      template: {
        templateId: "tpl_sw",
        templateName: "Sliding Window Template",
        modelStrategy: "Fixed",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      components: [
        {
          componentId: "comp_handles",
          componentKey: "sw_handles",
          componentName: "SW_Handles",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          dimensionBinding: "FIXED",
          baseQuantity: 1,
          isAccessorySlot: true,
          positionOptions: {
            allowHorizontalToggle: false,
            allowVerticalToggle: false,
            defaultHorizontal: "right",
            defaultVertical: "up",
            horizontalOffsetMm: 0,
            verticalOffsetMm: 0,
          },
          componentData: {},
          model: {
            assetId: "a_handles",
            r2ObjectKey: "sw_handles.glb",
            fileName: "SW_Handles.glb",
            url: "https://r2.glassfit.local/sw_handles.glb",
            sourceDimensionsMm: { width: 1720, height: 195, depth: 80 },
          },
        },
      ],
      parameters: [],
      rules: [],
    };

    const resolved: ResolvedStructure = {
      resolvedValues: {},
      numericValuesMm: { width: 1760, height: 1400 },
      componentQuantities: {},
      appliedRuleIds: [],
    };

    const cache: ComponentModelCache = {
      getClone: (id: string) => {
        if (id === "comp_handles" || id === "sw_handles") return handleGroup.clone(true);
        throw new Error(`Unknown component ${id}`);
      },
      getSourceSizeMeters: () => new THREE.Vector3(1.76, 1.4, 0.08),
    };

    // Build with default accessory state (where swapped.finish is 'satin' by default from validation dock)
    const built = buildParametricProduct(definition, resolved, cache, {
      swappedAccessories: {
        comp_handles: {
          slotComponentId: "comp_handles",
          accessoryId: "default",
          accessoryName: "Default Sub-Mesh",
          category: "handle",
          price: 0,
          priceDelta: 0,
          finish: "satin",
          horizontalPosition: "right",
          verticalPosition: "up",
        },
      },
    });

    const group = built.group;
    group.updateMatrixWorld(true);

    // Verify all 3 handle clusters exist
    const c0 = group.getObjectByName("SW_Handles_cluster_0");
    const c1 = group.getObjectByName("SW_Handles_cluster_1");
    const c2 = group.getObjectByName("SW_Handles_cluster_2");
    assert.ok(c0, "Handle cluster 0 must exist");
    assert.ok(c1, "Handle cluster 1 must exist");
    assert.ok(c2, "Handle cluster 2 must exist");

    // Check cluster 0 materials: each constituent mesh must preserve its native material color
    const meshesInC0: THREE.Mesh[] = [];
    c0.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshesInC0.push(obj);
    });
    assert.strictEqual(meshesInC0.length, 4, "Cluster 0 must have all 4 constituent sub-meshes");

    const colors = meshesInC0.map((m) => (m.material as THREE.MeshStandardMaterial).color.getHex());
    assert.ok(colors.includes(0xf3f4f6), "White powder coat material must be preserved");
    assert.ok(colors.includes(0xcc1111), "Red indicator material must be preserved");
    assert.ok(colors.includes(0x111111), "Black metal latch material must be preserved");
    assert.ok(colors.includes(0xd2d6dc), "Silver hardware material must be preserved");

    // Crucial: No mesh in the handle should have been overwritten with dull satin hardware color 0x22262a
    assert.ok(!colors.includes(0x22262a), "Native handle materials must not be wiped with satin finish");
  });

  it("adjusts vertical sliding window handles to height changes without floating in glass or below sill", () => {
    // Recreates the vertical sliding window handle assembly (VSW_Handles):
    // 1. Bottom sash lift handle at Y = -0.670 (near sill rail)
    // 2. Meeting rail cam lock & keeper at Y = +0.087 (at meeting rail)
    const vswHandlesGroup = new THREE.Group();
    vswHandlesGroup.name = "VSW_Handles";

    const createLiftHandle = () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.028, 0.026),
        new THREE.MeshStandardMaterial({ name: "Mat_Handle_Powder_White", color: 0xf3f4f6 })
      );
      mesh.position.set(0, -0.670, 0.103);
      return mesh;
    };

    const createMeetingRailLock = () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.018, 0.026),
        new THREE.MeshStandardMaterial({ name: "Mat_Handle_Metal_Black", color: 0x111111 })
      );
      mesh.position.set(0, 0.087, 0.021);
      return mesh;
    };

    const liftHandle = createLiftHandle();
    const railLock = createMeetingRailLock();
    liftHandle.updateMatrixWorld(true);
    railLock.updateMatrixWorld(true);
    vswHandlesGroup.add(liftHandle, railLock);

    // Host vertical frame jamb: 1900mm height modeled, bounds [-0.95, +0.95]
    const leftJamb = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.9, 0.05),
      new THREE.MeshStandardMaterial({ name: "Mat_Frame_White" })
    );
    leftJamb.position.set(-0.55, 0, 0);

    const definition: ProductStructuralDefinition = {
      product: {
        productId: "prod_vsw_window",
        productName: "Vertical Sliding Window",
        productType: "Window",
        isAddon: false,
        isAccessory: false,
      },
      template: {
        templateId: "tpl_vsw",
        templateName: "Vertical Sliding Window Template",
        modelStrategy: "Fixed",
        measurementUnit: "mm",
        baseConfiguration: {},
      },
      components: [
        {
          componentId: "comp_vsw_jamb",
          componentKey: "vsw_frame_left",
          componentName: "VSW_Frame_Left",
          componentType: "Frame",
          presentationCategory: "Framing",
          dimensionBinding: "HEIGHT",
          baseQuantity: 1,
          componentData: {},
          model: {
            assetId: "a_jamb",
            r2ObjectKey: "vsw_frame_left.glb",
            fileName: "VSW_Frame_Left.glb",
            url: "https://r2.glassfit.local/vsw_frame_left.glb",
            sourceDimensionsMm: { width: 50, height: 1900, depth: 50 },
          },
        },
        {
          componentId: "comp_vsw_handles",
          componentKey: "vsw_handles",
          componentName: "VSW_Handles",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          dimensionBinding: "FIXED",
          baseQuantity: 1,
          isAccessorySlot: true,
          positionOptions: {
            allowHorizontalToggle: false,
            allowVerticalToggle: false,
            defaultHorizontal: "right",
            defaultVertical: "up",
            horizontalOffsetMm: 0,
            verticalOffsetMm: 0,
          },
          componentData: {},
          model: {
            assetId: "a_vsw_handles",
            r2ObjectKey: "vsw_handles.glb",
            fileName: "VSW_Handles.glb",
            url: "https://r2.glassfit.local/vsw_handles.glb",
            sourceDimensionsMm: { width: 120, height: 852, depth: 138 },
          },
        },
      ],
      parameters: [],
      rules: [],
    };

    const cache: ComponentModelCache = {
      getClone: (id: string) => {
        if (id === "comp_vsw_jamb" || id === "vsw_frame_left") return leftJamb.clone(true);
        if (id === "comp_vsw_handles" || id === "vsw_handles") return vswHandlesGroup.clone(true);
        throw new Error(`Unknown component ${id}`);
      },
      getSourceSizeMeters: () => new THREE.Vector3(1.1, 1.9, 0.1),
    };

    // Test 1: Window height reduced from 1900mm to 950mm (scaleY = 0.5)
    const shortResolved: ResolvedStructure = {
      resolvedValues: {},
      numericValuesMm: { width: 1100, height: 950 },
      componentQuantities: {},
      appliedRuleIds: [],
    };

    const builtShort = buildParametricProduct(definition, shortResolved, cache);
    const shortGroup = builtShort.group;
    shortGroup.updateMatrixWorld(true);

    const liftClusterShort = shortGroup.getObjectByName("VSW_Handles_cluster_0");
    const lockClusterShort = shortGroup.getObjectByName("VSW_Handles_cluster_1");
    assert.ok(liftClusterShort, "Lift handle cluster 0 must exist on short window");
    assert.ok(lockClusterShort, "Meeting rail lock cluster 1 must exist on short window");

    const boxLiftShort = new THREE.Box3().setFromObject(liftClusterShort);
    const boxLockShort = new THREE.Box3().setFromObject(lockClusterShort);
    const cLiftShort = new THREE.Vector3();
    const cLockShort = new THREE.Vector3();
    boxLiftShort.getCenter(cLiftShort);
    boxLockShort.getCenter(cLockShort);

    // Bottom lift handle must move up proportionally from -0.670 to -0.670 * 0.5 = -0.335
    assert.ok(
      Math.abs(cLiftShort.y - (-0.335)) < 0.02,
      `Bottom lift handle must adjust to Y = -0.335 on 950mm window, got ${cLiftShort.y}`
    );
    // Meeting rail lock must move to 0.087 * 0.5 = 0.0435
    assert.ok(
      Math.abs(cLockShort.y - 0.0435) < 0.02,
      `Meeting rail lock must adjust to Y = 0.0435 on 950mm window, got ${cLockShort.y}`
    );

    // Both handles must preserve their unscaled metric 1:1 dimensions
    assert.ok(
      Math.abs((boxLiftShort.max.y - boxLiftShort.min.y) - 0.028) < 0.005,
      "Lift handle height must remain unscaled at 28mm"
    );
    assert.ok(
      Math.abs((boxLockShort.max.y - boxLockShort.min.y) - 0.018) < 0.005,
      "Lock height must remain unscaled at 18mm"
    );

    // Test 2: Window height expanded from 1900mm to 2470mm (scaleY = 1.3)
    const tallResolved: ResolvedStructure = {
      resolvedValues: {},
      numericValuesMm: { width: 1100, height: 2470 },
      componentQuantities: {},
      appliedRuleIds: [],
    };

    const builtTall = buildParametricProduct(definition, tallResolved, cache);
    const tallGroup = builtTall.group;
    tallGroup.updateMatrixWorld(true);

    const liftClusterTall = tallGroup.getObjectByName("VSW_Handles_cluster_0");
    const lockClusterTall = tallGroup.getObjectByName("VSW_Handles_cluster_1");
    assert.ok(liftClusterTall, "Lift handle cluster 0 must exist on tall window");
    assert.ok(lockClusterTall, "Meeting rail lock cluster 1 must exist on tall window");

    const boxLiftTall = new THREE.Box3().setFromObject(liftClusterTall);
    const boxLockTall = new THREE.Box3().setFromObject(lockClusterTall);
    const cLiftTall = new THREE.Vector3();
    const cLockTall = new THREE.Vector3();
    boxLiftTall.getCenter(cLiftTall);
    boxLockTall.getCenter(cLockTall);

    // Bottom lift handle must move down to -0.670 * 1.3 = -0.871
    assert.ok(
      Math.abs(cLiftTall.y - (-0.871)) < 0.03,
      `Bottom lift handle must adjust to Y = -0.871 on 2470mm window, got ${cLiftTall.y}`
    );
    // Meeting rail lock must move to 0.087 * 1.3 = 0.1131
    assert.ok(
      Math.abs(cLockTall.y - 0.1131) < 0.03,
      `Meeting rail lock must adjust to Y = 0.1131 on 2470mm window, got ${cLockTall.y}`
    );
  });
});
