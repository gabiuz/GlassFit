/** IMP-MS83: PRD-F5, PRD-F6, SDD-C4, SDD-C5, QAD-TC98.1, .3, .6, .7. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { computeFitFrameBounds } from "../../src/lib/visualization/modelRenderer.js";

function part(key: string, type: string, width: number, height: number, x = 0, y = 0) {
  const group = new THREE.Group();
  group.userData.componentKey = key;
  group.userData.componentType = type;
  group.userData.presentationCategory = "Framing";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1));
  mesh.position.set(x, y, 0);
  group.add(mesh);
  return group;
}

function windowWithSill(includeSill: boolean) {
  const group = new THREE.Group();
  group.add(part("OUTER_HEAD", "Frame", 2, 0.1, 0, 1));
  group.add(part("OUTER_SILL", "Frame", 2, 0.1, 0, -1));
  group.add(part("OUTER_JAMB_LEFT", "Frame", 0.1, 2, -1));
  group.add(part("OUTER_JAMB_RIGHT", "Frame", 0.1, 2, 1));
  if (includeSill) group.add(part("window_sill", "Sill", 2.5, 0.15, 0, -1.15));
  group.updateMatrixWorld(true);
  return group;
}

describe("IMP-MS83 installation perimeter", () => {
  it("QAD-TC98.1/.3: sill toggle leaves frame extents and center invariant", () => {
    const without = computeFitFrameBounds(windowWithSill(false));
    const withSill = computeFitFrameBounds(windowWithSill(true));
    assert.ok(without);
    assert.ok(withSill);
    assert.deepEqual(withSill.min.toArray(), without.min.toArray());
    assert.deepEqual(withSill.max.toArray(), without.max.toArray());
    assert.ok(Math.abs(without.min.y + 1.05) < 1e-6, "Permanent OUTER_SILL stays in the perimeter");
  });

  it("QAD-TC98.7: add-on framing and protruding hardware cannot widen the fit", () => {
    const model = windowWithSill(false);
    const expected = computeFitFrameBounds(model);
    assert.ok(expected);
    const addon = part("screen_frame", "Frame", 3, 3);
    addon.userData.isAddon = true;
    model.add(addon);
    const hardware = part("handle_frame", "Hardware", 0.4, 0.4, 1.5);
    hardware.userData.presentationCategory = "Hardware";
    model.add(hardware);
    model.updateMatrixWorld(true);
    const actual = computeFitFrameBounds(model);
    assert.ok(actual);
    assert.deepEqual(actual.min.toArray(), expected.min.toArray());
    assert.deepEqual(actual.max.toArray(), expected.max.toArray());
  });

  it("QAD-TC98.9: missing frame metadata returns no fabricated perimeter", () => {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1)));
    model.updateMatrixWorld(true);
    assert.equal(computeFitFrameBounds(model), null);
  });
});
