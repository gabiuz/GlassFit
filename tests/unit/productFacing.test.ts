/** IMP-MS88 / QAD-TC103: physical facing, stable fit and configuration transport. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { getPlanarFitImageBounds } from "../../src/lib/visualization/perspectiveTransform";
import { applyProductFacing, getConfigurationProductFacing, resolveProductFacing } from "../../src/lib/visualization/productFacing";
import { ProductModelRenderer, computeFitFrameBounds } from "../../src/lib/visualization/modelRenderer";
import { createDuplicateConfiguration } from "../../src/lib/visualization/multiProductPresentation";
import { createVariationRenderFingerprint } from "../../src/lib/visualization/variationRenderFingerprint";
import { calculateOverlayPricing } from "../../src/lib/pricing/pricingEngine";
import type { ProductConfigurationSnapshot, VariationRenderRecipe, PlacedOverlay } from "../../src/lib/visualization/types";

const configuration: ProductConfigurationSnapshot = {
  widthCm: 120, heightCm: 150, thicknessMm: 6, quantity: 1, aluminumFinish: "white", glassAppearance: "clear",
  includeSill: true, yaw: 13, pitch: -8, rotateAngle: 25, isFlipped: true, productFacing: "back",
  selectedAddon: "screen", addonMountingSide: "back", addonPrice: 1500, hatchCount: 2,
  visualParameterValues: { productFacing: "back", dimension_source: "manual_tape", width: 1200, height: 1500 },
};

function assembly() {
  const model = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.12));
  frame.position.set(0.7, 0.3, -0.2);
  frame.userData.componentType = "Frame";
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.3));
  handle.position.set(1.6, 0.4, 0.1);
  handle.userData.componentType = "Hardware";
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.02));
  screen.position.set(0.7, 0.3, 0.35);
  screen.userData.isAddon = true;
  model.add(frame, handle, screen);
  model.updateMatrixWorld(true);
  return { model, frame, handle, screen };
}

function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`); }
function vector(actual: THREE.Vector3, expected: THREE.Vector3) { close(actual.distanceTo(expected), 0); }

describe("IMP-MS88 product facing", () => {
  it("QAD-TC103.9: defaults absent values and rejects invalid explicit enums at either boundary", () => {
    assert.equal(resolveProductFacing(undefined), "front");
    assert.equal(getConfigurationProductFacing(), "front");
    assert.equal(getConfigurationProductFacing({ visualParameterValues: { productFacing: "back" } }), "back");
    for (const invalid of [null, "rear", "", 0, {}, false]) {
      assert.throws(() => resolveProductFacing(invalid), /Product facing/);
      assert.throws(() => getConfigurationProductFacing({ productFacing: invalid, visualParameterValues: {} } as unknown as ProductConfigurationSnapshot), /Product facing/);
      assert.throws(() => getConfigurationProductFacing({ visualParameterValues: { productFacing: invalid } }), /Product facing/);
    }
  });

  it("QAD-TC103.2/.3/.6/.7: reverses handedness and physical depth coherently about an asymmetric installation pivot", () => {
    const { model, handle, screen } = assembly();
    const bounds = computeFitFrameBounds(model)!;
    const pivot = bounds.getCenter(new THREE.Vector3());
    const handleLocal = handle.position.clone();
    const screenLocal = screen.position.clone();
    applyProductFacing(model, pivot, 0, 0, "front", Math.PI);
    const frontHandle = handle.getWorldPosition(new THREE.Vector3());
    assert.ok(frontHandle.x < pivot.x && frontHandle.z < pivot.z);
    const frontScreen = screen.getWorldPosition(new THREE.Vector3());
    assert.ok(frontScreen.z < frontHandle.z);
    for (let i = 0; i < 20; i++) {
      applyProductFacing(model, pivot, 0, 0, "back", Math.PI);
      vector(handle.getWorldPosition(new THREE.Vector3()), handleLocal);
      vector(screen.getWorldPosition(new THREE.Vector3()), screenLocal);
      const reverseBounds = computeFitFrameBounds(model)!;
      vector(reverseBounds.min, bounds.min); vector(reverseBounds.max, bounds.max);
      applyProductFacing(model, pivot, 0, 0, "front", Math.PI);
      vector(handle.getWorldPosition(new THREE.Vector3()), frontHandle);
    }
    vector(handle.position, handleLocal); vector(screen.position, screenLocal);
  });

  it("QAD-TC103.4: independent image flip retains the structural reference with asymmetric padding", () => {
    const rect = { x: 0.07, y: 0.04, width: 0.8, height: 0.9 };
    const bounds = getPlanarFitImageBounds(rect, true)!;
    close(bounds.left, 0.13);
    close(bounds.width, rect.width);
    close(bounds.top, rect.y);
    const restored = getPlanarFitImageBounds({ ...rect, x: bounds.left }, true)!;
    close(restored.left, rect.x);
    assert.deepEqual(rect, { x: 0.07, y: 0.04, width: 0.8, height: 0.9 });
  });

  it("QAD-TC103.5: composes relative manual angles after the local face rotation", () => {
    const { model } = assembly();
    const pivot = computeFitFrameBounds(model)!.getCenter(new THREE.Vector3());
    applyProductFacing(model, pivot, 27, -14, "back");
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(-14 * Math.PI / 180, 27 * Math.PI / 180, 0))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    close(model.quaternion.angleTo(expected), 0);
    vector(pivot.clone().applyMatrix4(model.matrixWorld), pivot);
  });

  it("QAD-TC103.3/.6: renderer maps the structural perimeter to the same planar rectangle on both sides", () => {
    const { model, frame } = assembly();
    const canvas = { width: 1000, height: 800 };
    const camera = new THREE.PerspectiveCamera(38, 1.25, 0.1, 100);
    const renderer = Object.create(ProductModelRenderer.prototype) as ProductModelRenderer;
    Object.assign(renderer, {
      modelGroup: model, exteriorYaw: Math.PI, camera, canvas, baseWidth: 1000, baseHeight: 800,
      scene: new THREE.Scene(), fittedCanvas: { getContext: () => null },
      renderer: { setSize: (w: number, h: number) => { canvas.width = w; canvas.height = h; }, render: () => undefined },
    });
    for (const face of ["front", "back", "front"] as const) {
      assert.ok(renderer.render(0, 0, true, face));
      const rect = renderer.getPlanarFitRect()!;
      const box = new THREE.Box3().setFromObject(frame);
      for (const [x, expected] of [[box.min.x, rect.x], [box.max.x, rect.x + rect.width]]) {
        const projected = new THREE.Vector3(x, box.min.y, box.max.z).project(camera);
        close((projected.x + 1) / 2, expected);
      }
    }
  });

  it("QAD-TC103.4/.7/.8: JSON roundtrip and duplication preserve facing without changing pricing or physical mounting", () => {
    const restored = JSON.parse(JSON.stringify(configuration)) as ProductConfigurationSnapshot;
    const copy = createDuplicateConfiguration(restored);
    assert.equal(getConfigurationProductFacing(copy), "back");
    const front = { ...restored, productFacing: "front" as const, visualParameterValues: { ...restored.visualParameterValues, productFacing: "front" } };
    const price = (config: ProductConfigurationSnapshot) => calculateOverlayPricing({ configuration: config } as PlacedOverlay);
    assert.deepEqual(price(front), price(restored));
    assert.deepEqual({ ...front, productFacing: restored.productFacing, visualParameterValues: restored.visualParameterValues }, restored);
    assert.equal(copy.addonMountingSide, "back"); assert.equal(copy.hatchCount, 2);
    assert.equal(configuration.productFacing, "back");
  });

  it("QAD-TC103.11: comparison cache distinguishes facing even when it is only in the typed snapshot", () => {
    const recipe = { configuration: { ...configuration, visualParameterValues: {} } } as VariationRenderRecipe;
    const front = { ...recipe, configuration: { ...recipe.configuration, productFacing: "front" as const } };
    assert.notEqual(createVariationRenderFingerprint(recipe, "white"), createVariationRenderFingerprint(front, "white"));
  });
});
