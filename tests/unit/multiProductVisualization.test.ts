import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDuplicateConfiguration,
  getVisualizationHeaderDetails,
} from "../../src/lib/visualization/multiProductPresentation";
import type {
  PlacedOverlay,
  ProductConfigurationSnapshot,
} from "../../src/lib/visualization/types";

const sourceConfiguration: ProductConfigurationSnapshot = {
  widthCm: 80,
  heightCm: 120,
  thicknessMm: 6,
  quantity: 1,
  aluminumFinish: "white",
  glassAppearance: "clear",
  includeSill: true,
  yaw: 12,
  pitch: -4,
  rotateAngle: 8,
  isFlipped: false,
  zoomLevel: -35,
  positionX: -140,
  positionY: 20,
  visualParameterValues: {},
};

function placedOverlay(overlayId: string): PlacedOverlay {
  return {
    overlayId,
    productId: "fixed-window",
    productName: "Fixed Window",
    templateId: "fixed-window-template",
    configuration: sourceConfiguration,
    flattenedImageDataUrl: "data:image/png;base64,layer",
  };
}

describe("QAD-TC6: multi-product quotation presentation", () => {
  it("preserves a duplicated product's visual size and orientation while centering it", () => {
    const duplicate = createDuplicateConfiguration(sourceConfiguration);

    assert.equal(duplicate.widthCm, sourceConfiguration.widthCm);
    assert.equal(duplicate.heightCm, sourceConfiguration.heightCm);
    assert.equal(duplicate.zoomLevel, sourceConfiguration.zoomLevel);
    assert.equal(duplicate.rotateAngle, sourceConfiguration.rotateAngle);
    assert.equal(duplicate.yaw, sourceConfiguration.yaw);
    assert.equal(duplicate.pitch, sourceConfiguration.pitch);
    assert.equal(duplicate.positionX, 0);
    assert.equal(duplicate.positionY, 0);
  });

  it("derives the quotation header count and labels from every product instance", () => {
    const details = getVisualizationHeaderDetails({
      originalFileName: "customer-room.jpg",
      placedOverlays: [placedOverlay("one"), placedOverlay("two")],
      activeProductName: "Fixed Window",
    });

    assert.equal(details.fileName, "customer-room.jpg");
    assert.equal(details.productCount, 3);
    assert.deepEqual(details.tags, ["Fixed Window x3"]);
  });
});
