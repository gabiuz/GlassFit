import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder.js";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache.js";
import type { ProductStructuralDefinition, ResolvedStructure, SelectedAccessoryState } from "../../src/lib/visualization/types.js";

// QAD-TC91.2, QAD-TC91.3, QAD-TC91.10: registered model identity is asset driven.
test("registered handle model replaces original with its own geometry on either handing", () => {
  const original = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.03));
  original.position.set(0.35, 0.1, 0.18);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.3));
  const model = (id: string) => ({ assetId: id, r2ObjectKey: `${id}.glb`, url: `https://example.test/${id}.glb`, fileName: `${id}.glb`, sourceDimensionsMm: null });
  const definition = {
    product: { productId: "door", productName: "Door", productType: "Door", isAddon: false, isAccessory: false },
    template: { templateId: "door", templateName: "Door", modelStrategy: "Parametric", measurementUnit: "mm", baseConfiguration: {} },
    components: [
      { componentId: "frame", componentKey: "frame", componentName: "Frame", componentType: "Frame", baseQuantity: 1, componentData: {}, model: model("frame") },
      { componentId: "slot", componentKey: "door_handle", componentName: "Original", componentType: "Hardware", baseQuantity: 1, componentData: {}, model: model("slot"), isAccessorySlot: true, accessoryCategory: "handle", positionOptions: { allowHorizontalToggle: true, defaultHorizontal: "right", horizontalOffsetMm: 45, allowVerticalToggle: false, defaultVertical: "up", verticalOffsetMm: 1000 } },
    ], parameters: [], rules: [],
  } as ProductStructuralDefinition;
  const resolved = { numericValuesMm: { width: 800, height: 1000 }, resolvedValues: {}, appliedRuleIds: [], componentQuantities: { frame: 1, door_handle: 1 } } as ResolvedStructure;
  const cache: ComponentModelCache = {
    getClone: (id) => (id === "frame" ? frame : original).clone(true),
    getSourceSizeMeters: (id) => id === "frame" ? new THREE.Vector3(0.8, 1, 0.3) : new THREE.Vector3(0.04, 0.12, 0.03),
  };
  const selected = (handing: "left" | "right"): Record<string, SelectedAccessoryState> => ({ slot: {
    slotComponentId: "slot", accessoryId: "new-catalog-id", accessoryName: "Unrelated display name", category: "handle", price: 500,
    finish: "chrome", horizontalPosition: handing, verticalPosition: "up", glbUrl: "https://example.test/pull.glb",
  } });
  const pull = new THREE.Group();
  pull.add(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.34, 0.025), new THREE.MeshStandardMaterial()));
  const mountingPoint = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), new THREE.MeshStandardMaterial());
  mountingPoint.position.y = 0.12;
  pull.add(mountingPoint);
  for (const handing of ["right", "left"] as const) {
    const { group } = buildParametricProduct(definition, resolved, cache, { swappedAccessories: selected(handing), accessoryModels: new Map([["new-catalog-id", pull]]) });
    const replacements = group.children.filter((child) => child.userData.isAccessoryReplacement);
    assert.equal(replacements.length, 1);
    const meshes: THREE.Mesh[] = [];
    replacements[0].traverse((child) => { if (child instanceof THREE.Mesh) meshes.push(child); });
    assert.equal(meshes.length, 2, "pull bar and mounting point remain distinct");
    const bounds = new THREE.Box3().setFromObject(replacements[0]);
    assert.ok(bounds.max.y - bounds.min.y > 0.3, "asset height survives assembly");
    const center = bounds.getCenter(new THREE.Vector3());
    assert.equal(Math.sign(center.x), handing === "right" ? 1 : -1);
  }
  assert.throws(() => buildParametricProduct(definition, resolved, cache, { swappedAccessories: selected("right") }), /no loaded model/);
});
