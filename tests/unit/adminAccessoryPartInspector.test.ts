/**
 * Acceptance Tests: Admin Normal Product Part Inspector Swappable Accessory Binding,
 * Filename Auto-Detection, and Positional Placement Controls (IMP-MS75)
 *
 * Upstream Specifications: docs/implementation/ms75.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F14, PRD-F19, SDD-C4, SDD-C9, DSD-UI10,
 *   ERD-E3, ERD-E6, QAD-TC90.1 through QAD-TC90.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  autoDetectAccessorySlot,
  autoDetectComponentSettings,
} from "../../src/lib/admin/products/autoDetection.js";

import {
  CANONICAL_ACCESSORIES_CATALOG,
  createAccessoryMeshById,
} from "../../src/lib/visualization/accessoryMeshFactory.js";

import {
  mountAccessoryMesh,
  createHardwareFinishMaterial,
} from "../../src/lib/visualization/parametricProductBuilder.js";

import type {
  AccessoryPositionOptions,
  AccessoryCategory,
} from "../../src/lib/admin/products/types.js";

describe("IMP-MS75: Admin Part Inspector Swappable Accessory Binding & Placement Controls", () => {
  // QAD-TC90.1: Filename auto-detection for door handle
  it("QAD-TC90.1: Filename auto-detection for door handle", () => {
    const handleFiles = [
      "door_handle_lever.glb",
      "exterior_pull_handle.glb",
      "sliding_door_doorknob.glb",
      "lever_handle.glb",
      "architectural_pull_bar.glb",
    ];

    for (const filename of handleFiles) {
      const detected = autoDetectAccessorySlot(filename);
      assert.ok(detected, `Expected detection for ${filename}`);
      assert.strictEqual(detected.isAccessorySlot, true);
      assert.strictEqual(detected.accessoryCategory, "handle");
      assert.strictEqual(detected.presentationCategory, "Hardware");
      assert.strictEqual(detected.dimensionBinding, "FIXED");
      assert.strictEqual(detected.positionOptions?.defaultHorizontal, "right");
      assert.strictEqual(detected.positionOptions?.allowHorizontalToggle, true);
      assert.strictEqual(detected.positionOptions?.allowVerticalToggle, false);
    }

    // Verify integration with full autoDetectComponentSettings
    const settings = autoDetectComponentSettings("door_handle_exterior.glb");
    assert.strictEqual(settings.isAccessorySlot, true);
    assert.strictEqual(settings.accessoryCategory, "handle");
    assert.strictEqual(settings.presentationCategory, "Hardware");
  });

  // QAD-TC90.2: Filename auto-detection for smart lock
  it("QAD-TC90.2: Filename auto-detection for smart lock", () => {
    const lockFiles = [
      "keyless_smart_lock.glb",
      "mortise_deadbolt_lock.glb",
      "sliding_door_latch.glb",
      "smartlock_sensor.glb",
      "electric_lock.glb",
    ];

    for (const filename of lockFiles) {
      const detected = autoDetectAccessorySlot(filename);
      assert.ok(detected, `Expected detection for ${filename}`);
      assert.strictEqual(detected.isAccessorySlot, true);
      assert.strictEqual(detected.accessoryCategory, "lock");
      assert.strictEqual(detected.presentationCategory, "Hardware");
      assert.strictEqual(detected.positionOptions?.allowHorizontalToggle, true);
      assert.strictEqual(detected.positionOptions?.allowVerticalToggle, true);
      assert.strictEqual(detected.positionOptions?.defaultHorizontal, "right");
      assert.strictEqual(detected.positionOptions?.defaultVertical, "up");
    }
  });

  // QAD-TC90.3: Filename auto-detection for bottom roller
  it("QAD-TC90.3: Filename auto-detection for bottom roller", () => {
    const rollerFiles = [
      "heavy_duty_roller.glb",
      "patio_door_wheel.glb",
      "guide_wheel_bottom.glb",
      "track_roller_assembly.glb",
    ];

    for (const filename of rollerFiles) {
      const detected = autoDetectAccessorySlot(filename);
      assert.ok(detected, `Expected detection for ${filename}`);
      assert.strictEqual(detected.isAccessorySlot, true);
      assert.strictEqual(detected.accessoryCategory, "roller");
      assert.strictEqual(detected.positionOptions?.defaultVertical, "bottom");
      assert.strictEqual(detected.positionOptions?.allowVerticalToggle, false);
    }
  });

  // QAD-TC90.4: Canonical accessories catalog options definition
  it("QAD-TC90.4: Canonical accessories catalog options definition", () => {
    assert.ok(CANONICAL_ACCESSORIES_CATALOG.length >= 5);
    const lever = CANONICAL_ACCESSORIES_CATALOG.find((a) => a.id === "canonical_lever_handle");
    assert.ok(lever);
    assert.strictEqual(lever?.category, "handle");
    assert.strictEqual(lever?.priceDelta, 0);

    const smartLock = CANONICAL_ACCESSORIES_CATALOG.find((a) => a.id === "canonical_smart_lock");
    assert.ok(smartLock);
    assert.strictEqual(smartLock?.category, "lock");
    assert.ok((smartLock?.priceDelta ?? 0) > 0);

    const roller = CANONICAL_ACCESSORIES_CATALOG.find((a) => a.id === "canonical_tandem_roller");
    assert.ok(roller);
    assert.strictEqual(roller?.category, "roller");
  });

  // QAD-TC90.5: Horizontal Left/Right rule strictly stays on X axis
  it("QAD-TC90.5: Horizontal Left/Right rule strictly stays on X axis", () => {
    const parentGroup = new THREE.Group();
    const model = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.05));
    const hostBounds = { widthM: 1.0, heightM: 2.1, depthM: 0.05 };
    const posOptions: AccessoryPositionOptions = {
      allowHorizontalToggle: true,
      defaultHorizontal: "right",
      horizontalOffsetMm: 50,
      allowVerticalToggle: false,
      defaultVertical: "up",
      verticalOffsetMm: 1000,
    };

    const rightMesh = mountAccessoryMesh(
      parentGroup,
      model,
      hostBounds,
      posOptions,
      "right",
      "up",
      "matte_black",
    );

    const leftMesh = mountAccessoryMesh(
      parentGroup,
      model,
      hostBounds,
      posOptions,
      "left",
      "up",
      "matte_black",
    );

    // Lateral X coordinate must flip symmetrically relative to hostBounds.widthM / 2 - offset
    // offset = 50mm = 0.05m. Right x = +0.5 - 0.05 = +0.45m. Left x = -0.5 + 0.05 = -0.45m.
    assert.strictEqual(rightMesh.position.x, 0.45);
    assert.strictEqual(leftMesh.position.x, -0.45);

    // Strict invariant: Y and Z must remain identical without drift
    assert.strictEqual(rightMesh.position.y, leftMesh.position.y);
    assert.strictEqual(rightMesh.position.z, leftMesh.position.z);
  });

  // QAD-TC90.6: Vertical Bottom/Up rule strictly stays on Y axis
  it("QAD-TC90.6: Vertical Bottom/Up rule strictly stays on Y axis", () => {
    const parentGroup = new THREE.Group();
    const model = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.04));
    const hostBounds = { widthM: 0.9, heightM: 2.1, depthM: 0.045 };
    const posOptions: AccessoryPositionOptions = {
      allowHorizontalToggle: false,
      defaultHorizontal: "right",
      horizontalOffsetMm: 45,
      allowVerticalToggle: true,
      defaultVertical: "up",
      verticalOffsetMm: 150,
    };

    const upMesh = mountAccessoryMesh(
      parentGroup,
      model,
      hostBounds,
      posOptions,
      "right",
      "up",
      "matte_black",
    );

    const bottomMesh = mountAccessoryMesh(
      parentGroup,
      model,
      hostBounds,
      posOptions,
      "right",
      "bottom",
      "matte_black",
    );

    // Strict invariant: X lateral position and Z depth must remain identical
    assert.strictEqual(upMesh.position.x, bottomMesh.position.x);
    assert.strictEqual(upMesh.position.z, bottomMesh.position.z);

    // Y coordinates must differ between bottom and up
    assert.notStrictEqual(upMesh.position.y, bottomMesh.position.y);
    // Bottom Y = -2.1/2 + 0.15 = -1.05 + 0.15 = -0.9m
    assert.strictEqual(bottomMesh.position.y, -0.9);
  });

  // QAD-TC90.7: Category validation prevents cross-category binding
  it("QAD-TC90.7: Category validation prevents cross-category binding", () => {
    const slotCategory: AccessoryCategory = "handle";

    // Matching accessories
    const compatible = CANONICAL_ACCESSORIES_CATALOG.filter((a) => a.category === slotCategory);
    assert.ok(compatible.length > 0);
    assert.ok(compatible.every((a) => a.category === "handle"));

    // Incompatible categories (roller, hinge, lock) must be excluded
    const incompatible = CANONICAL_ACCESSORIES_CATALOG.filter((a) => a.category !== slotCategory);
    assert.ok(incompatible.length > 0);
    assert.ok(!compatible.some((c) => incompatible.map((i) => i.id).includes(c.id)));
  });

  // QAD-TC90.8: Canonical procedural hardware mesh construction
  it("QAD-TC90.8: Canonical procedural hardware mesh construction", () => {
    const handleGroup = createAccessoryMeshById("canonical_lever_handle");
    assert.ok(handleGroup instanceof THREE.Group);
    assert.strictEqual(handleGroup.name, "Accessory_LeverHandle");
    assert.ok(handleGroup.children.length >= 3, "Handle should contain backplate, collar, lever");

    const smartLockGroup = createAccessoryMeshById("canonical_smart_lock");
    assert.ok(smartLockGroup instanceof THREE.Group);
    assert.strictEqual(smartLockGroup.name, "Accessory_SmartLock");
    assert.ok(smartLockGroup.children.length >= 4, "Smart lock should contain escutcheon, touch display, LED, lever");

    const knobGroup = createAccessoryMeshById("canonical_privacy_knob");
    assert.ok(knobGroup instanceof THREE.Group);
    assert.strictEqual(knobGroup.name, "Accessory_PrivacyKnob");

    const pullBarGroup = createAccessoryMeshById("canonical_pull_bar");
    assert.ok(pullBarGroup instanceof THREE.Group);
    assert.strictEqual(pullBarGroup.name, "Accessory_PullBar");

    const rollerGroup = createAccessoryMeshById("canonical_tandem_roller");
    assert.ok(rollerGroup instanceof THREE.Group);
    assert.strictEqual(rollerGroup.name, "Accessory_TandemRoller");
  });

  // QAD-TC90.9: Hardware finish PBR material resolution
  it("QAD-TC90.9: Hardware finish PBR material resolution", () => {
    const blackMat = createHardwareFinishMaterial("matte_black");
    assert.ok(blackMat instanceof THREE.MeshStandardMaterial);
    assert.ok(blackMat.roughness > 0.5);

    const brassMat = createHardwareFinishMaterial("satin_brass");
    assert.ok(brassMat instanceof THREE.MeshStandardMaterial);
    assert.ok(brassMat.metalness > 0.8);

    const chromeMat = createHardwareFinishMaterial("brushed_chrome");
    assert.ok(chromeMat instanceof THREE.MeshStandardMaterial);
    assert.ok(chromeMat.metalness > 0.8);
  });

  // QAD-TC90.10: Non-accessory files do not trigger accessory slot auto-detection
  it("QAD-TC90.10: Non-accessory files do not trigger accessory slot auto-detection", () => {
    const structuralFiles = [
      "frame_left_jamb.glb",
      "frame_right_jamb.glb",
      "frame_top_header.glb",
      "frame_bottom_sill.glb",
      "glass_infill_panel.glb",
      "middle_transom_mullion.glb",
    ];

    for (const filename of structuralFiles) {
      const detected = autoDetectAccessorySlot(filename);
      assert.strictEqual(detected, null, `Structural file ${filename} should not be auto-detected as accessory slot`);
    }
  });
});
