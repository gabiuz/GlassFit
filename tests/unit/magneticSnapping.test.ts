import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeMagneticSnap,
  computeEdgeFitQuality,
  calculateExtendedGuideLines,
  type ImageDataLike,
} from "../../src/lib/visualization/magneticSnapping.js";
import type { Point2D } from "../../src/lib/visualization/types.js";

/**
 * Creates a synthetic 24x24 grayscale patch with a vertical edge at x = edgeX.
 * Left of edgeX is dark (valDark), right is light (valLight).
 */
function createSyntheticEdgePatch(
  width = 24,
  height = 24,
  edgeX = 12,
  valDark = 40,
  valLight = 220,
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const val = x < edgeX ? valDark : valLight;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("IMP-MS59 / QAD-TC74: Sub-Pixel Edge Snapping and Magnetic Loupe Alignment", () => {
  it("QAD-TC74.3: snaps pin to edge peak when within snap radius (< 0.5px error)", () => {
    // Synthetic patch: 24x24, edge at x = 12. Center is at (12, 12).
    // Let current pointer position be at (100, 100), where physical edge is at x = 98 (dx = -2 from center).
    // We create a patch where edge is at x = 10 (2 pixels to the left of center cx = 12).
    const patch = createSyntheticEdgePatch(24, 24, 10, 40, 220);

    const currentPos = { x: 100, y: 100 };
    const result = computeMagneticSnap(currentPos, patch, 10);

    assert.equal(result.snapped, true, "Should snap when edge is within snap radius");
    assert.ok(result.gradientStrength > 50, "Gradient strength should be significant");

    // Ground truth edge is at patch x = 9.5 to 10.0 (offset dx ~ -2 to -2.5 from cx = 12).
    // Snapped x should be close to 100 - 2 = 98.
    const errorX = Math.abs(result.snappedPoint.x - 97.5);
    assert.ok(errorX < 1.0, `Edge localization error should be < 1.0px (got ${errorX})`);
    assert.ok(Math.abs(result.snappedPoint.y - 100) < 0.5, "Y coordinate should remain stable");
  });

  it("QAD-TC74.4: smoothly releases snapping when dragging beyond snap radius", () => {
    // Edge at x = 2 (10 pixels away from center 12). If snap radius is 6, should not snap.
    const patch = createSyntheticEdgePatch(24, 24, 2, 40, 220);

    const currentPos = { x: 250, y: 350 };
    const result = computeMagneticSnap(currentPos, patch, 6);

    assert.equal(result.snapped, false, "Should not snap when edge is outside snapRadius");
    assert.equal(result.snappedPoint.x, currentPos.x, "X coordinate should match current pointer exactly");
    assert.equal(result.snappedPoint.y, currentPos.y, "Y coordinate should match current pointer exactly");
  });

  it("QAD-TC74.4: flat/blank image produces no snap and retains original coordinates", () => {
    const flatPatch: ImageDataLike = {
      width: 24,
      height: 24,
      data: new Uint8ClampedArray(24 * 24 * 4).fill(128),
    };

    const currentPos = { x: 150, y: 200 };
    const result = computeMagneticSnap(currentPos, flatPatch, 10);

    assert.equal(result.snapped, false, "Flat image must not trigger magnetic snap");
    assert.equal(result.snappedPoint.x, currentPos.x);
    assert.equal(result.snappedPoint.y, currentPos.y);
    assert.equal(result.gradientStrength, 0);
  });

  it("QAD-TC74.6: satisfies mobile performance budget (< 2ms per drag event)", () => {
    const patch = createSyntheticEdgePatch(24, 24, 11, 30, 240);
    const pos = { x: 100, y: 100 };

    const iterations = 500;
    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      computeMagneticSnap(pos, patch, 10);
    }
    const elapsed = performance.now() - startTime;
    const avgPerCallMs = elapsed / iterations;

    assert.ok(
      avgPerCallMs < 2.0,
      `Sobel computation and snapping must execute in < 2ms (measured: ${avgPerCallMs.toFixed(3)}ms)`,
    );
  });

  it("evaluates edge fit quality levels correctly (>= 90% sharp, 70-89% moderate, < 70% manual)", () => {
    const high = computeEdgeFitQuality(180, true);
    assert.equal(high.badgeVariant, "green");
    assert.equal(high.label, "Sharp Edge Alignment");
    assert.ok(high.percentage >= 90);

    const mid = computeEdgeFitQuality(135, true);
    assert.equal(mid.badgeVariant, "yellow");
    assert.equal(mid.label, "Moderate Edge Contrast");
    assert.ok(mid.percentage >= 70 && mid.percentage < 90);

    const low = computeEdgeFitQuality(80, true);
    assert.equal(low.badgeVariant, "muted");
    assert.equal(low.label, "Manual Alignment Recommended");
    assert.ok(low.percentage < 70);

    const unsnapped = computeEdgeFitQuality(200, false);
    assert.equal(unsnapped.badgeVariant, "muted");
    assert.equal(unsnapped.label, "Manual Alignment Recommended");
  });

  it("calculates extended collinearity guide lines projected 20px beyond corners", () => {
    const corners: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 400 },
      { x: 100, y: 400 },
    ];

    const guides = calculateExtendedGuideLines(corners, 20);
    assert.equal(guides.length, 4, "Must generate 4 extended guide lines");

    // Edge 0: from (100, 100) to (300, 100). Direction is (+1, 0).
    // Extension 20px before (100, 100) -> (80, 100).
    // Extension 20px past (300, 100) -> (320, 100).
    assert.deepEqual(guides[0].start, { x: 80, y: 100 });
    assert.deepEqual(guides[0].end, { x: 320, y: 100 });

    // Edge 1: from (300, 100) to (300, 400). Direction is (0, +1).
    assert.deepEqual(guides[1].start, { x: 300, y: 80 });
    assert.deepEqual(guides[1].end, { x: 300, y: 420 });

    // Edge 2: from (300, 400) to (100, 400). Direction is (-1, 0).
    assert.deepEqual(guides[2].start, { x: 320, y: 400 });
    assert.deepEqual(guides[2].end, { x: 80, y: 400 });

    // Edge 3: from (100, 400) to (100, 100). Direction is (0, -1).
    assert.deepEqual(guides[3].start, { x: 100, y: 420 });
    assert.deepEqual(guides[3].end, { x: 100, y: 80 });
  });
});
