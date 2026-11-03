import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captureWorkspaceResetState, isWorkspaceResetCaptureReady, restoreWorkspaceResetState } from "../../src/lib/visualization/workspaceReset";
import type { ProductConfigurationSnapshot } from "../../src/lib/visualization/types";

const initial: ProductConfigurationSnapshot = {
  widthCm: 120, heightCm: 150, thicknessMm: 6, quantity: 1,
  aluminumFinish: "white", glassAppearance: "clear", includeSill: true,
  yaw: 0, pitch: 0, rotateAngle: 0, isFlipped: false, zoomLevel: 0,
  positionX: 20, positionY: -10, productFacing: "front",
  selectedMaterials: { frame: "original" }, visualParameterValues: {},
};

describe("QAD-TC6: reset restores the first rendered product", () => {
  it("ignores repeated mount effects and uncommitted canvas sizes until the model is visible", () => {
    let baseline: ReturnType<typeof captureWorkspaceResetState> | undefined;
    const attemptCapture = (modelReady: boolean, canvasWidth: number, measuredCanvasWidth: number, width: number) => {
      if (!baseline && isWorkspaceResetCaptureReady({ modelReady, canvasWidth, measuredCanvasWidth })) {
        baseline = captureWorkspaceResetState(initial, { width, height: width }, canvasWidth);
      }
    };
    // Strict Mode repeats effects with the provisional dimensions, before loading completes.
    attemptCapture(false, 1600, 600, 80);
    attemptCapture(false, 1600, 600, 80);
    assert.equal(baseline, undefined);
    // The DOM measurement can advance before React commits matching overlay geometry.
    attemptCapture(true, 1600, 600, 80);
    assert.equal(baseline, undefined);
    attemptCapture(true, 600, 600, 300);
    // Later edits must not replace the first visible baseline.
    attemptCapture(true, 600, 600, 1000);
    assert.deepEqual(restoreWorkspaceResetState(baseline!, 600).overlaySize, { width: 300, height: 300 });
  });

  it("retains original dimensions, appearance and actual footprint after edits", () => {
    const edited = structuredClone(initial);
    const baseline = captureWorkspaceResetState(edited, { width: 240, height: 300 }, 600);
    edited.widthCm = 600;
    edited.heightCm = 400;
    edited.yaw = 80;
    edited.productFacing = "back";
    edited.selectedMaterials!.frame = "changed";
    const restored = restoreWorkspaceResetState(baseline, 600);
    assert.deepEqual(restored.configuration, initial);
    assert.deepEqual(restored.overlaySize, { width: 240, height: 300 });
  });

  it("scales display size and placement with the viewport while preserving physical size", () => {
    const baseline = captureWorkspaceResetState(initial, { width: 240, height: 300 }, 600);
    const restored = restoreWorkspaceResetState(baseline, 300);
    assert.deepEqual(restored.overlaySize, { width: 120, height: 150 });
    assert.equal(restored.configuration.positionX, 10);
    assert.equal(restored.configuration.positionY, -5);
    assert.equal(restored.configuration.widthCm, 120);
    assert.equal(restored.configuration.heightCm, 150);
  });

  it("repeated resets cannot mutate the baseline or another product", () => {
    const first = captureWorkspaceResetState(initial, { width: 240, height: 300 }, 600);
    const second = captureWorkspaceResetState({ ...initial, widthCm: 90 }, { width: 180, height: 300 }, 600);
    const restored = restoreWorkspaceResetState(first, 600);
    restored.configuration.selectedMaterials!.frame = "edited again";
    restored.overlaySize.width = 1000;
    assert.deepEqual(restoreWorkspaceResetState(first, 600), first);
    assert.equal(restoreWorkspaceResetState(second, 600).configuration.widthCm, 90);
  });
});
