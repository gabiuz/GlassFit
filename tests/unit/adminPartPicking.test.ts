import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { getFrontPartIds, getVisiblePartHits } from "../../src/lib/admin/products/partPicking";

function part(id: string, material = new THREE.MeshBasicMaterial()) {
    const group = new THREE.Group();
    group.userData.fileId = id;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    group.add(mesh);
    return { group, mesh };
}

test("front picking excludes a different part behind the visible surface", () => {
    const front = part("frame-right");
    const rear = part("louvers");
    const intersections = [
        { object: rear.mesh, distance: 3 },
        { object: front.mesh, distance: 2 },
        { object: front.mesh, distance: 2.5 },
    ];
    assert.deepEqual(getVisiblePartHits(intersections).map(hit => hit.id), ["frame-right", "louvers"]);
    assert.deepEqual(getFrontPartIds(intersections), ["frame-right"]);
});

test("coplanar visible parts retain the named overlap choice", () => {
    const frame = part("frame-right");
    const clips = part("clips");
    assert.deepEqual(getFrontPartIds([
        { object: frame.mesh, distance: 2 },
        { object: clips.mesh, distance: 2.0005 },
    ]), ["frame-right", "clips"]);
});

test("hidden and transparent surfaces do not steal a visible part hit", () => {
    const visible = part("frame-right");
    const hidden = part("hidden", new THREE.MeshBasicMaterial({ opacity: 0, transparent: true }));
    const invisible = part("invisible");
    invisible.group.visible = false;
    assert.deepEqual(getFrontPartIds([
        { object: hidden.mesh, distance: 1 },
        { object: invisible.mesh, distance: 1.2 },
        { object: visible.mesh, distance: 2 },
    ]), ["frame-right"]);
});
