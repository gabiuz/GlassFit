/** fix10 coverage. Traceability: PRD-F9, PRD-F16, QAD-TC28. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initialState,
  serializeVisualizationSession,
} from "../../src/lib/visualization/visualizationSession.js";
import type { PlacedOverlay } from "../../src/lib/visualization/types.js";

describe("QAD-TC28 metadata-only session persistence", () => {
  it("strips variation data URLs and object URLs while retaining asset refs and recipes", () => {
    const overlay = {
      overlayId: "overlay",
      productId: "product",
      productName: "Window",
      templateId: "template",
      configuration: {
        widthCm: 100,
        heightCm: 100,
        thicknessMm: 6,
        quantity: 1,
        aluminumFinish: "white",
        glassAppearance: "clear",
        includeSill: true,
        yaw: 0,
        pitch: 0,
        rotateAngle: 0,
        isFlipped: false,
        visualParameterValues: {},
        perspectiveFitCorners: [
          { x: 0.1, y: 0.2 },
          { x: 0.9, y: 0.2 },
          { x: 0.8, y: 0.85 },
          { x: 0.2, y: 0.85 },
        ],
      },
      flattenedImageDataUrl: "blob:runtime",
      variationImageDataUrls: { white: "data:image/png;base64,pixels" },
      variationAssetRefs: {
        white: {
          cacheKey: "session:overlay:white:fingerprint",
          mimeType: "image/png",
          byteLength: 4,
          width: 1,
          height: 1,
          fingerprint: "fingerprint",
        },
      },
    } satisfies PlacedOverlay;

    const serialized = serializeVisualizationSession({
      ...initialState,
      assetSessionId: "session",
      placedOverlays: [overlay],
      comparisonOverlays: [overlay],
    });
    const json = JSON.stringify(serialized);
    assert.doesNotMatch(json, /data:image/);
    assert.doesNotMatch(json, /blob:runtime/);
    assert.match(json, /session:overlay:white:fingerprint/);
    assert.equal(serialized.assetSessionId, "session");
    assert.deepEqual(
      serialized.placedOverlays[0]?.configuration.perspectiveFitCorners,
      overlay.configuration.perspectiveFitCorners,
    );
  });
});
