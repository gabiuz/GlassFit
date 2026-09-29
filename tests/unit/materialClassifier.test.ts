/**
 * Multi-Material Classification & Finish Isolation Unit Tests (fix-02)
 *
 * Upstream Specifications: docs/implementation/fix-02.md
 * Traceability Codes: PRD-F5, PRD-F6, PRD-F14, PRD-F19, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, QAD-TC22, QAD-TC23
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import {
  classifySceneMesh,
  classifyComponentContext,
  createMaterialPalette,
  createWindowGlassMaterial,
  applyPresentationMaterials,
} from "../../src/lib/visualization/materialClassifier.js";
import { autoDetectComponentSettings } from "../../src/lib/admin/products/autoDetection.js";
import type { RawMaterial } from "../../src/lib/pricing/types.js";

describe("Fix-02: Multi-Material Classification & Photorealistic Glazing Physics", () => {
  it("applies the requested finish and glass appearance to a fixed-model scene", () => {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1));
    frame.name = "aluminum_frame";
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.01));
    glass.name = "glass_panel";
    group.add(frame, glass);

    applyPresentationMaterials(group, {
      aluminumFinish: "silver",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });

    assert.strictEqual(
      (frame.material as THREE.MeshPhysicalMaterial).color.getHex(),
      0xc8cbce,
    );
    assert.strictEqual(
      (glass.material as THREE.MeshPhysicalMaterial).transmission,
      0.88,
    );
    assert.strictEqual(frame.castShadow, true);
    assert.strictEqual(glass.castShadow, false);
  });
  // --------------------------------------------------------------------------
  // 1. Linked Raw Material Category Classification Priority (User Requirement)
  // --------------------------------------------------------------------------
  describe("Tier 1: Linked Raw Material Category Precedence", () => {
    it("should classify part as Glass if linked raw material category is Glass", () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.01));
      mesh.name = "Custom_Arbitrary_Node_001";
      const glassRawMat: RawMaterial = {
        id: "mat-glass-1",
        material_code: "GL-CLR-6MM",
        description: "6mm Clear Float Glass",
        category: "Glass",
        finish_type: "Analok",
        billing_unit: "sqm",
        unit_price: 850,
        waste_allowance: 0.1,
        is_active: true,
      };

      mesh.userData.rawMaterial = glassRawMat;
      mesh.userData.rawMaterialCategory = "Glass";

      const classification = classifySceneMesh(mesh);
      assert.strictEqual(classification, "Glass");
    });

    it("should classify part as Aluminum if linked raw material category is Aluminum", () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05));
      mesh.name = "Custom_Extrusion_Node";
      const alumRawMat: RawMaterial = {
        id: "mat-alum-1",
        material_code: "AL-TUB-1X2",
        description: "1x2 Tubular Aluminum Profile",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 320,
        waste_allowance: 0.15,
        is_active: true,
      };

      mesh.userData.rawMaterial = alumRawMat;
      mesh.userData.rawMaterialCategory = "Aluminum";

      const classification = classifySceneMesh(mesh);
      assert.strictEqual(classification, "Aluminum");
    });

    it("should classify part as Hardware if linked raw material category is Hardware", () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05));
      mesh.name = "Custom_Caster";
      const hwRawMat: RawMaterial = {
        id: "mat-hw-1",
        material_code: "HW-ROLLER-01",
        description: "Heavy Duty Sliding Roller Assembly",
        category: "Hardware",
        finish_type: "Analok",
        billing_unit: "pc",
        unit_price: 150,
        waste_allowance: 0.0,
        is_active: true,
      };

      mesh.userData.rawMaterial = hwRawMat;
      mesh.userData.rawMaterialCategory = "Hardware";

      const classification = classifySceneMesh(mesh);
      assert.strictEqual(classification, "Hardware");
    });

    it("should inherit linked raw material category from parent node userData", () => {
      const parent = new THREE.Group();
      parent.name = "DC_Sliding_Door_Left_Assembly";
      parent.userData.rawMaterialCategory = "Glass";

      const childMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.006));
      childMesh.name = "Mesh_0"; // Arbitrary Blender export name
      parent.add(childMesh);

      const classification = classifySceneMesh(childMesh);
      assert.strictEqual(classification, "Glass");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Source GLTF Material Inspection (Tier 2)
  // --------------------------------------------------------------------------
  describe("Tier 2: Source GLTF Material Inspection", () => {
    it("should classify mesh as Glass if original GLTF material has transmission > 0.05", () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.005));
      mesh.name = "Object_7";
      mesh.material = new THREE.MeshPhysicalMaterial({
        transmission: 0.85,
        transparent: true,
      });

      const classification = classifySceneMesh(mesh);
      assert.strictEqual(classification, "Glass");
    });

    it("should classify mesh as Glass if original GLTF material name contains glass identifier", () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.005));
      mesh.name = "Cube.039_2";
      mesh.material = new THREE.MeshStandardMaterial({
        name: "DC_Mat_Glass.003",
      });

      const classification = classifySceneMesh(mesh);
      assert.strictEqual(classification, "Glass");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Display Cabinet Component Taxonomy Verification (QAD-TC22)
  // --------------------------------------------------------------------------
  describe("Display Cabinet Component Mapping Taxonomy (QAD-TC22)", () => {
    const cabinetComponents = [
      { name: "DC_Left_Panel", expected: "Aluminum" },
      { name: "DC_Right_Panel", expected: "Aluminum" },
      { name: "DC_Back_Panel", expected: "Aluminum" },
      { name: "DC_Top_Panel", expected: "Aluminum" },
      { name: "DC_Bottom_Panel", expected: "Aluminum" },
      { name: "DC_Top_Sliding_Track", expected: "Aluminum" },
      { name: "DC_Bottom_Sliding_Track", expected: "Aluminum" },
      { name: "DC_Shelf_1", expected: "Glass" },
      { name: "DC_Shelf_2", expected: "Glass" },
      { name: "DC_Sliding_Door_Left", expected: "Glass" },
      { name: "DC_Sliding_Door_Right", expected: "Glass" },
      { name: "DC_Bottom_Base_Assembly", expected: "Hardware" },
    ];

    for (const item of cabinetComponents) {
      it(`should accurately classify ${item.name} as ${item.expected}`, () => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05));
        mesh.name = item.name;
        const classification = classifySceneMesh(mesh);
        assert.strictEqual(classification, item.expected);
      });
    }
  });

  // --------------------------------------------------------------------------
  // 4. Aluminum Finish Isolation Verification (QAD-TC22.2)
  // --------------------------------------------------------------------------
  describe("Aluminum Finish Isolation (QAD-TC22.2)", () => {
    it("should decouple aluminum finish color changes from optical glass material", () => {
      const whitePalette = createMaterialPalette({
        aluminumFinish: "white",
        glassAppearance: "clear",
        glassColor: "clear",
        glassThicknessMm: 6,
      });

      const blackPalette = createMaterialPalette({
        aluminumFinish: "black",
        glassAppearance: "clear",
        glassColor: "clear",
        glassThicknessMm: 6,
      });

      const silverPalette = createMaterialPalette({
        aluminumFinish: "silver",
        glassAppearance: "clear",
        glassColor: "clear",
        glassThicknessMm: 6,
      });

      // Frame materials should differ across finishes
      assert.notStrictEqual(whitePalette.frameMaterial.color.getHex(), blackPalette.frameMaterial.color.getHex());
      assert.notStrictEqual(blackPalette.frameMaterial.color.getHex(), silverPalette.frameMaterial.color.getHex());

      // Glass material physical properties MUST remain identical regardless of aluminum finish
      const whiteGlass = whitePalette.glassMaterial as THREE.MeshPhysicalMaterial;
      const blackGlass = blackPalette.glassMaterial as THREE.MeshPhysicalMaterial;
      const silverGlass = silverPalette.glassMaterial as THREE.MeshPhysicalMaterial;

      assert.strictEqual(whiteGlass.transmission, 0.88);
      assert.strictEqual(blackGlass.transmission, 0.88);
      assert.strictEqual(silverGlass.transmission, 0.88);

      assert.strictEqual(whiteGlass.opacity, 0.18);
      assert.strictEqual(blackGlass.opacity, 0.18);
      assert.strictEqual(silverGlass.opacity, 0.18);

      assert.strictEqual(whiteGlass.roughness, 0.03);
      assert.strictEqual(blackGlass.roughness, 0.03);
      assert.strictEqual(silverGlass.roughness, 0.03);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Optical Glass Appearance Modes Physical Parity (QAD-TC23)
  // --------------------------------------------------------------------------
  describe("Photorealistic Glazing Physics Modes (QAD-TC23)", () => {
    it("should configure Clear Glass float mode with optical transmission and low opacity", () => {
      const mat = createWindowGlassMaterial("clear") as THREE.MeshPhysicalMaterial;
      assert.strictEqual(mat.transparent, true);
      assert.strictEqual(mat.opacity, 0.18);
      assert.strictEqual(mat.transmission, 0.88);
      assert.strictEqual(mat.roughness, 0.03);
      assert.strictEqual(mat.metalness, 0.02);
      assert.strictEqual(mat.ior, 1.52);
      assert.strictEqual(mat.depthWrite, false);
    });

    it("should configure Frosted Glass satin privacy mode with diffuse roughness", () => {
      const mat = createWindowGlassMaterial("frosted") as THREE.MeshPhysicalMaterial;
      assert.strictEqual(mat.transparent, true);
      assert.strictEqual(mat.opacity, 0.82);
      assert.strictEqual(mat.transmission, 0.15);
      assert.strictEqual(mat.roughness, 0.82);
      assert.strictEqual(mat.metalness, 0.0);
      assert.strictEqual(mat.depthWrite, true);
    });

    it("should configure Reflective Glass solar coated mode with metallic sheen", () => {
      const mat = createWindowGlassMaterial("reflective") as THREE.MeshPhysicalMaterial;
      assert.strictEqual(mat.transparent, true);
      assert.strictEqual(mat.opacity, 0.65);
      assert.strictEqual(mat.transmission, 0.35);
      assert.strictEqual(mat.metalness, 0.45);
      assert.strictEqual(mat.depthWrite, true);
    });

    it("should configure Opaque Glass spandrel mode with solid opacity", () => {
      const mat = createWindowGlassMaterial("opaque") as THREE.MeshStandardMaterial;
      assert.strictEqual(mat.transparent, false);
      assert.strictEqual(mat.opacity, 1.0);
      assert.strictEqual(mat.roughness, 0.52);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Auto-Detection Component Taxonomy Updates
  // --------------------------------------------------------------------------
  describe("Auto-Detection Taxonomy Rules", () => {
    it("should auto-detect cabinet sliding doors as Glass and Glazing", () => {
      const detected = autoDetectComponentSettings("DC_Sliding_Door_Left.glb");
      assert.strictEqual(detected.componentType, "Glass");
      assert.strictEqual(detected.presentationCategory, "Glazing");
      assert.strictEqual(detected.suggestedMaterialCategory, "Glass");
    });

    it("should auto-detect cabinet shelves as Glass and Glazing", () => {
      const detected = autoDetectComponentSettings("DC_Shelf_1.glb");
      assert.strictEqual(detected.componentType, "Glass");
      assert.strictEqual(detected.presentationCategory, "Glazing");
      assert.strictEqual(detected.suggestedMaterialCategory, "Glass");
    });

    it("should auto-detect perimeter framing as Aluminum and Framing", () => {
      const detected = autoDetectComponentSettings("DC_Left_Panel.glb");
      assert.strictEqual(detected.componentType, "Frame");
      assert.strictEqual(detected.presentationCategory, "Framing");
      assert.strictEqual(detected.suggestedMaterialCategory, "Aluminum");
    });

    it("should auto-detect caster wheels as Hardware", () => {
      const detected = autoDetectComponentSettings("DC_Caster_Wheel.glb");
      assert.strictEqual(detected.componentType, "Hardware");
      assert.strictEqual(detected.presentationCategory, "Hardware");
      assert.strictEqual(detected.suggestedMaterialCategory, "Hardware");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Component Context Metadata Classification
  // --------------------------------------------------------------------------
  describe("Component Context Metadata Classification", () => {
    it("should classify component based on linked raw material category", () => {
      const glassResult = classifyComponentContext({
        componentKey: "shelf_1",
        rawMaterialCategory: "Glass",
      });
      assert.strictEqual(glassResult, "Glass");

      const alumResult = classifyComponentContext({
        componentKey: "sliding_door_frame",
        rawMaterialCategory: "Aluminum",
      });
      assert.strictEqual(alumResult, "Aluminum");

      const hwResult = classifyComponentContext({
        componentKey: "roller_assembly",
        rawMaterialCategory: "Hardware",
      });
      assert.strictEqual(hwResult, "Hardware");
    });

    it("should classify component based on componentType and presentationCategory", () => {
      const glassResult = classifyComponentContext({
        componentKey: "custom_panel",
        presentationCategory: "Glazing",
      });
      assert.strictEqual(glassResult, "Glass");

      const hwResult = classifyComponentContext({
        componentKey: "custom_accessory",
        componentType: "Hardware",
      });
      assert.strictEqual(hwResult, "Hardware");
    });
  });
});
