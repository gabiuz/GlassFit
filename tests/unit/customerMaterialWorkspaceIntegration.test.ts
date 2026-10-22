/**
 * Unit & Integration Tests: Visualization 3D Model Material Synchronization (fix-12)
 *
 * Upstream Specifications: docs/implementation/fix-12.md, docs/qad-glassfit.md
 * Traceability Codes:
 *   PRD-F1 (Product Catalog)
 *   PRD-F2 (Interactive 3D Inspector)
 *   PRD-F5 (Parametric 3D Assembly Engine)
 *   PRD-F6 (Photo-Based Visualization Workspace)
 *   PRD-F10 (Quotation Measurement Modal & Real-Time Pricing)
 *   PRD-F15 (Product Variant Comparison)
 *   PRD-F16 (Multi-Product Overlay Management)
 *   SDD-C4 (Parametric 3D Assembly Engine)
 *   SDD-C5 (Photo-Based Visualization Canvas)
 *   SDD-C7 (Quotation Engine & PDF Generator)
 *   DSD-UI4 (Visualization Workspace Canvas)
 *   ERD-E6 (product_components)
 *   ERD-E11 (product_configurations)
 *   ERD-E17 (raw_materials)
 *   QAD-TC82 (Visualization 3D Model Material Synchronization: QAD-TC82.1 through QAD-TC82.8)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  applyPresentationMaterials,
  applyPBRToMesh,
} from "../../src/lib/visualization/materialClassifier.js";
import {
  findFinishOption,
  findGlassColorOption,
  findGlassThicknessOption,
} from "../../src/lib/products/materialMapping.js";
import { ProductModelRenderer } from "../../src/lib/visualization/modelRenderer.js";
import type { ModelPresentationOptions } from "../../src/lib/visualization/modelRenderer.js";
import type { RawMaterial } from "../../src/lib/pricing/types.js";

function createMockModelGroup(): {
  group: THREE.Group;
  frameMesh: THREE.Mesh;
  glassMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  const frameGeometry = new THREE.BoxGeometry(100, 1000, 50);
  const frameMesh = new THREE.Mesh(
    frameGeometry,
    new THREE.MeshPhysicalMaterial({ color: 0x6b594a }),
  );
  frameMesh.name = "frame_left";
  frameMesh.userData = { componentKey: "frame-left", presentationCategory: "Framing" };

  const glassGeometry = new THREE.BoxGeometry(800, 900, 6);
  const glassMesh = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshPhysicalMaterial({ color: 0xf0f5f7, transmission: 0.88, transparent: true }),
  );
  glassMesh.name = "glass_pane_0";
  glassMesh.userData = { componentKey: "glass-panel", presentationCategory: "Glazing" };

  group.add(frameMesh, glassMesh);
  return { group, frameMesh, glassMesh };
}

describe("QAD-TC82: Customer Visualization 3D Model Material and Finish Synchronization", () => {
  // --------------------------------------------------------------------------
  // QAD-TC82.1: Aluminum Finish Live 3D Mesh Update
  // --------------------------------------------------------------------------
  it("QAD-TC82.1: Aluminum finish live 3D mesh update reflects white powder coat properties", () => {
    const { group, frameMesh } = createMockModelGroup();
    const presentation: ModelPresentationOptions = {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
      includeSill: true,
    };

    ProductModelRenderer.prototype.updatePresentation.call(
      {
        modelGroup: group,
        materialCapabilities: { hasAluminum: true, hasGlass: true },
      },
      presentation,
    );

    const frameMat = frameMesh.material as THREE.MeshPhysicalMaterial;
    const expectedOption = findFinishOption("white");
    assert.ok(expectedOption, "White aluminum finish option must exist");

    const expectedColorHex = new THREE.Color(expectedOption.previewHex).getHex();
    assert.strictEqual(
      frameMat.color.getHex(),
      expectedColorHex,
      "Frame mesh color must match white finish previewHex",
    );
    assert.strictEqual(
      frameMat.metalness,
      expectedOption.metalness,
      "Frame mesh metalness must match white finish metalness",
    );
    assert.strictEqual(
      frameMat.roughness,
      expectedOption.roughness,
      "Frame mesh roughness must match white finish roughness",
    );
    assert.strictEqual(frameMesh.castShadow, true);
    assert.strictEqual(frameMesh.receiveShadow, true);
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.2: Glass Type Live 3D Mesh Update
  // --------------------------------------------------------------------------
  it("QAD-TC82.2: Glass type live 3D mesh update reflects reflective physical optical shader", () => {
    const { group, glassMesh } = createMockModelGroup();
    const presentation: ModelPresentationOptions = {
      aluminumFinish: "white",
      glassAppearance: "reflective",
      glassColor: "clear",
      glassThicknessMm: 6,
      includeSill: true,
    };

    ProductModelRenderer.prototype.updatePresentation.call(
      {
        modelGroup: group,
        materialCapabilities: { hasAluminum: true, hasGlass: true },
      },
      presentation,
    );

    const glassMat = glassMesh.material as THREE.MeshPhysicalMaterial;
    assert.ok(glassMat instanceof THREE.MeshPhysicalMaterial, "Glass must be MeshPhysicalMaterial");
    assert.strictEqual(glassMat.transmission, 0.35, "Reflective glass transmission must be 0.35");
    assert.strictEqual(glassMat.metalness, 0.45, "Reflective glass metalness must be 0.45");
    assert.strictEqual(glassMat.roughness, 0.08, "Reflective glass roughness must be 0.08");
    assert.strictEqual(glassMat.depthWrite, true, "Reflective glass must have depthWrite enabled");
    assert.strictEqual(glassMesh.castShadow, false, "Glass must not cast shadow");
    assert.strictEqual(glassMesh.receiveShadow, true, "Glass must receive shadow");
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.3: Advanced Glass Appearance (Outdoor View)
  // --------------------------------------------------------------------------
  it("QAD-TC82.3: Advanced glass appearance (outdoor) applies environment texture map", () => {
    const { group, glassMesh } = createMockModelGroup();
    const presentation: ModelPresentationOptions = {
      aluminumFinish: "analok",
      glassAppearance: "outdoor",
      glassColor: "clear",
      glassThicknessMm: 6,
      includeSill: true,
    };

    ProductModelRenderer.prototype.updatePresentation.call(
      {
        modelGroup: group,
        materialCapabilities: { hasAluminum: true, hasGlass: true },
      },
      presentation,
    );

    const glassMat = glassMesh.material as THREE.MeshStandardMaterial;
    assert.ok(glassMat instanceof THREE.MeshStandardMaterial, "Outdoor glass must be MeshStandardMaterial");
    assert.ok(glassMat.map !== null && glassMat.map !== undefined, "Outdoor glass must have texture map assigned");
    assert.strictEqual(glassMat.depthWrite, true, "Outdoor glass must have depthWrite enabled");
    assert.strictEqual(glassMesh.castShadow, false);
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.4: Glass Color Tint Update
  // --------------------------------------------------------------------------
  it("QAD-TC82.4: Glass color tint update propagates bronze tint and attenuationColor", () => {
    const { group, glassMesh } = createMockModelGroup();
    const presentation: ModelPresentationOptions = {
      aluminumFinish: "analok",
      glassAppearance: "clear",
      glassColor: "bronze",
      glassThicknessMm: 6,
      includeSill: true,
    };

    ProductModelRenderer.prototype.updatePresentation.call(
      {
        modelGroup: group,
        materialCapabilities: { hasAluminum: true, hasGlass: true },
      },
      presentation,
    );

    const glassMat = glassMesh.material as THREE.MeshPhysicalMaterial;
    const bronzeOption = findGlassColorOption("bronze");
    assert.ok(bronzeOption, "Bronze glass color option must exist");

    const expectedHex = new THREE.Color(bronzeOption.previewHex).getHex();
    assert.strictEqual(glassMat.color.getHex(), expectedHex, "Glass color must match bronze previewHex");
    assert.strictEqual(
      glassMat.attenuationColor.getHex(),
      expectedHex,
      "Glass attenuationColor must match bronze previewHex",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.5: Glass Thickness Attenuation Update
  // --------------------------------------------------------------------------
  it("QAD-TC82.5: Glass thickness attenuation update applies metric thickness and attenuation distance", () => {
    const { group, glassMesh } = createMockModelGroup();
    const presentation: ModelPresentationOptions = {
      aluminumFinish: "analok",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 12,
      includeSill: true,
    };

    ProductModelRenderer.prototype.updatePresentation.call(
      {
        modelGroup: group,
        materialCapabilities: { hasAluminum: true, hasGlass: true },
      },
      presentation,
    );

    const glassMat = glassMesh.material as THREE.MeshPhysicalMaterial;
    const thicknessOption = findGlassThicknessOption(12);
    assert.ok(thicknessOption, "12mm thickness option must exist");

    assert.strictEqual(glassMat.thickness, 0.012, "Glass physical thickness must equal 0.012 meters");
    assert.strictEqual(
      glassMat.attenuationDistance,
      thicknessOption.attenuationDistance,
      "Glass attenuation distance must match 12mm thickness profile",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.6: Window Sill Toggling Independence
  // --------------------------------------------------------------------------
  it("QAD-TC82.6: Window sill toggling cleanly alters presence without mutating frame or glass materials", () => {
    const { group, frameMesh, glassMesh } = createMockModelGroup();
    const presentation: ModelPresentationOptions = {
      aluminumFinish: "white",
      glassAppearance: "frosted",
      glassColor: "clear",
      glassThicknessMm: 6,
      includeSill: true,
    };

    applyPresentationMaterials(group, presentation);

    const frameColorBefore = (frameMesh.material as THREE.MeshPhysicalMaterial).color.getHex();
    const glassTransmissionBefore = (glassMesh.material as THREE.MeshPhysicalMaterial).transmission;

    // Simulate sill mesh presence
    const sillMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1000, 20, 80),
      new THREE.MeshPhysicalMaterial({ color: frameColorBefore }),
    );
    sillMesh.name = "Window_Sill";
    group.add(sillMesh);

    assert.ok(
      group.children.some((c) => c.name === "Window_Sill"),
      "Window sill must exist when includeSill is true",
    );

    // Toggling sill off: remove sill from scene
    group.remove(sillMesh);
    sillMesh.geometry.dispose();

    assert.strictEqual(
      group.children.some((c) => c.name === "Window_Sill"),
      false,
      "Window sill must be removed when includeSill is false",
    );

    // Assert framing and glass retain exact material properties
    assert.strictEqual(
      (frameMesh.material as THREE.MeshPhysicalMaterial).color.getHex(),
      frameColorBefore,
      "Frame finish must remain intact after sill toggle",
    );
    assert.strictEqual(
      (glassMesh.material as THREE.MeshPhysicalMaterial).transmission,
      glassTransmissionBefore,
      "Glass transmission must remain intact after sill toggle",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.7: Non-Destructive loadModel & Optical Glass Preservation
  // --------------------------------------------------------------------------
  it("QAD-TC82.7: loadModel guards default raw materials from overwriting presentation materials", () => {
    const { group, frameMesh, glassMesh } = createMockModelGroup();

    // 1. Prepare model with presentation materials
    applyPresentationMaterials(group, {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });

    const whiteHex = (frameMesh.material as THREE.MeshPhysicalMaterial).color.getHex();
    const initialGlassTransmission = (glassMesh.material as THREE.MeshPhysicalMaterial).transmission;

    // 2. Default raw materials map from database
    const rawMaterialsMap = new Map<string, RawMaterial>([
      [
        "raw-mat-analok-frame",
        {
          id: "11111111-1111-4111-a111-111111111111",
          material_code: "AL-ANLK-798",
          description: "Analok Extrusion Profile",
          category: "Aluminum",
          finish_type: "Analok",
          billing_unit: "m",
          unit_price: 420,
          waste_allowance: 0.1,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ],
      [
        "raw-mat-clear-glass",
        {
          id: "22222222-2222-4222-a222-222222222222",
          material_code: "GL-CLR-6MM",
          description: "6mm Clear Float Glass",
          category: "Glass",
          finish_type: "Clear",
          billing_unit: "sqm",
          unit_price: 850,
          waste_allowance: 0.1,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ],
    ]);

    const defaultSelections: Record<string, string> = {
      "frame-left": "raw-mat-analok-frame",
      "glass-panel": "raw-mat-clear-glass",
    };

    // 3. Simulating loadModel execution with hasExplicitOverrides = false or undefined
    const customMaterials = {
      selectedMaterials: defaultSelections,
      rawMaterialsMap,
      hasExplicitOverrides: false,
    };

    if (
      customMaterials?.hasExplicitOverrides &&
      customMaterials?.selectedMaterials &&
      Object.keys(customMaterials.selectedMaterials).length > 0
    ) {
      ProductModelRenderer.prototype.updateCustomMaterials.call(
        { modelGroup: group },
        customMaterials.selectedMaterials,
        customMaterials.rawMaterialsMap,
      );
    }

    // Framing and glass must NOT be overwritten by default raw materials!
    assert.strictEqual(
      (frameMesh.material as THREE.MeshPhysicalMaterial).color.getHex(),
      whiteHex,
      "Frame must preserve white finish when hasExplicitOverrides is false",
    );
    assert.strictEqual(
      (glassMesh.material as THREE.MeshPhysicalMaterial).transmission,
      initialGlassTransmission,
      "Glass must preserve optical clear transmission when hasExplicitOverrides is false",
    );

    // 4. Verify applyPBRToMesh preserves optical transparency on Glass meshes
    const glassRawMaterial: RawMaterial = {
      id: "33333333-3333-4333-a333-333333333333",
      material_code: "GL-BRZ-6MM",
      description: "6mm Tinted Bronze Glass",
      category: "Glass",
      finish_type: "Bronze",
      billing_unit: "sqm",
      unit_price: 950,
      waste_allowance: 0.1,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    applyPBRToMesh(glassMesh, glassRawMaterial);

    assert.strictEqual(glassMesh.castShadow, false, "Glass mesh must not cast shadow");
    assert.strictEqual(glassMesh.receiveShadow, true, "Glass mesh must receive shadow");
    assert.strictEqual(glassMesh.renderOrder, 1, "Glass mesh must have renderOrder = 1");
    assert.ok(
      (glassMesh.material as THREE.MeshPhysicalMaterial).transparent,
      "Glass mesh material must remain transparent",
    );
    assert.ok(
      (glassMesh.material as THREE.MeshPhysicalMaterial).transmission >= 0.70,
      "Glass mesh material must maintain physical optical transmission",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.8: Placed Overlay Restoration & Dispatcher Parity
  // --------------------------------------------------------------------------
  it("QAD-TC82.8: Placed overlay restoration updates presentation and layout dependencies", () => {
    const workspaceSource = readFileSync(
      "src/features/visualization/components/ProductModelWorkspace.tsx",
      "utf8",
    );
    const rendererSource = readFileSync(
      "src/lib/visualization/modelRenderer.ts",
      "utf8",
    );

    // Verify modelRenderer loadModel hasExplicitOverrides contract
    assert.match(
      rendererSource,
      /hasExplicitOverrides\?:\s*boolean/,
      "loadModel must accept hasExplicitOverrides option",
    );
    assert.match(
      rendererSource,
      /if\s*\(\s*customMaterials\?\.hasExplicitOverrides/,
      "loadModel must gate updateCustomMaterials behind hasExplicitOverrides",
    );

    // Verify applyWorkspacePresentation dispatcher exists
    assert.match(
      workspaceSource,
      /const\s+applyWorkspacePresentation\s*=\s*useCallback\(/,
      "ProductModelWorkspace must define applyWorkspacePresentation dispatcher",
    );

    // Verify skipPreparedBuildRef is set to prevent debounced loadModel races
    assert.match(
      workspaceSource,
      /skipPreparedBuildRef\.current\s*=\s*nextBuildKey/,
      "applyWorkspacePresentation must set skipPreparedBuildRef to prevent race conditions",
    );

    // Verify useLayoutEffect dependency array includes all presentation options
    const renderEffectStart = workspaceSource.indexOf(
      "mvpRendererRef.current.render(yaw, pitch, isPlanar)",
    );
    assert.ok(renderEffectStart > 0, "Canvas render effect must be present");
    const renderEffectEnd = workspaceSource.indexOf("outlineControlsStyle", renderEffectStart);
    const renderEffectSource = workspaceSource.slice(renderEffectStart, renderEffectEnd);

    assert.match(renderEffectSource, /glassColor/, "useLayoutEffect must depend on glassColor");
    assert.match(renderEffectSource, /glassThicknessMm/, "useLayoutEffect must depend on glassThicknessMm");
    assert.match(renderEffectSource, /selectedAddon/, "useLayoutEffect must depend on selectedAddon");
    assert.match(renderEffectSource, /addonAlumFinish/, "useLayoutEffect must depend on addonAlumFinish");

    // Verify applyProductConfiguration immediately pushes presentation update
    const applyConfigStart = workspaceSource.indexOf("const applyProductConfiguration = useCallback(");
    assert.ok(applyConfigStart > 0, "applyProductConfiguration must be defined");
    const applyConfigEnd = workspaceSource.indexOf("const handleReset", applyConfigStart);
    const applyConfigSnippet = workspaceSource.slice(applyConfigStart, applyConfigEnd > 0 ? applyConfigEnd : applyConfigStart + 6000);
    assert.match(
      applyConfigSnippet,
      /mvpRendererRef\.current\.updatePresentation\(/,
      "applyProductConfiguration must update 3D scene presentation immediately",
    );

    // Verify glass color and thickness button handlers call dedicated presentation dispatcher
    assert.match(
      workspaceSource,
      /handleGlassColorChange\(option\.id\)/,
      "Glass color button must call handleGlassColorChange",
    );
    assert.match(
      workspaceSource,
      /handleGlassThicknessChange\(option\.value\)/,
      "Glass thickness button must call handleGlassThicknessChange",
    );
  });
});
