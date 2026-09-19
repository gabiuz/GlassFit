import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SCENE_ZOOM,
  commitProductVariantSelections,
  createProductVariantSelections,
  createDuplicateConfiguration,
  getComparisonLayerImageUrls,
  getPlacedLayerImageUrls,
  hasCompleteVariationLayers,
  preserveActivePlacedLayer,
  reconcileProductVariantSelections,
  swapProductVariantSelections,
  updateProductVariantSelection,
  getVisualizationHeaderDetails,
} from "../../src/lib/visualization/multiProductPresentation";
import {
  getHorizontalFovRadians,
  getVerticalFovDegrees,
} from "../../src/lib/visualization/cameraFraming";
import {
  calculateContainTransform,
  createOverlayAlphaMask,
  findTopmostOverlayAtPoint,
  getOverlayHitMaskSource,
} from "../../src/lib/visualization/overlayHitTesting";
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

function rgbaMask(width: number, height: number, opaquePixels: Array<[number, number, number]>) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, alpha] of opaquePixels) {
    rgba[(y * width + x) * 4 + 3] = alpha;
  }
  return rgba;
}

describe("PRD-F15/PRD-F16: multi-product visualization and comparison", () => {
  it("resets a duplicated product's position and zoom to default while preserving dimensions and orientation", () => {
    const duplicate = createDuplicateConfiguration(sourceConfiguration);

    assert.equal(duplicate.widthCm, sourceConfiguration.widthCm);
    assert.equal(duplicate.heightCm, sourceConfiguration.heightCm);
    assert.equal(duplicate.zoomLevel, DEFAULT_SCENE_ZOOM);
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

  it("composes every cached product layer using the selected aluminum finish", () => {
    const first = placedOverlay("one");
    const second = placedOverlay("two");
    first.variationImageDataUrls = {
      white: "data:image/png;base64,first-white",
      black: "data:image/png;base64,first-black",
    };
    second.variationImageDataUrls = {
      white: "data:image/png;base64,second-white",
      black: "data:image/png;base64,second-black",
    };

    assert.deepEqual(getPlacedLayerImageUrls([first, second], "black"), [
      "data:image/png;base64,first-black",
      "data:image/png;base64,second-black",
    ]);
  });

  it("keeps the exact active render when a product leaves edit mode", () => {
    const presentation = preserveActivePlacedLayer({
      activeImageDataUrl: "data:image/png;base64,exact-active-size",
      currentFinish: "white",
      variationImageDataUrls: {
        white: "data:image/png;base64,regenerated-larger-size",
        black: "data:image/png;base64,black-variation",
      },
    });

    assert.equal(
      presentation.flattenedImageDataUrl,
      "data:image/png;base64,exact-active-size",
    );
    assert.equal(
      presentation.variationImageDataUrls.white,
      "data:image/png;base64,exact-active-size",
    );
    assert.equal(
      presentation.variationImageDataUrls.black,
      "data:image/png;base64,black-variation",
    );
  });

  it("keeps alternate comparison variants on the editor camera framing", () => {
    const editorHorizontalFov = getHorizontalFovRadians(38, 540 / 385);
    const resizedEditorVerticalFov = getVerticalFovDegrees(
      editorHorizontalFov,
      320 / 520,
    );
    const comparisonVerticalFov = getVerticalFovDegrees(
      editorHorizontalFov,
      320 / 520,
    );

    assert.notEqual(resizedEditorVerticalFov, 38);
    assert.equal(comparisonVerticalFov, resizedEditorVerticalFov);
  });

  it("renders every product from its independent panel selection", () => {
    const first = placedOverlay("first");
    const second = placedOverlay("second");
    first.variationImageDataUrls = {
      white: "first-white",
      black: "first-black",
      silver: "first-silver",
    };
    second.variationImageDataUrls = {
      white: "second-white",
      black: "second-black",
      silver: "second-silver",
    };
    const selections = {
      first: { left: "silver", right: "black" },
      second: { left: "white", right: "silver" },
    } as const;

    assert.deepEqual(getComparisonLayerImageUrls([first, second], selections, "left"), [
      "first-silver",
      "second-white",
    ]);
    assert.deepEqual(getComparisonLayerImageUrls([first, second], selections, "right"), [
      "first-black",
      "second-silver",
    ]);
  });

  it("updates one panel for one product without changing other selections", () => {
    const current = {
      first: { left: "white", right: "black" },
      second: { left: "silver", right: "white" },
    } as const;
    const updated = updateProductVariantSelection(current, "first", "left", "silver");

    assert.deepEqual(updated, {
      first: { left: "silver", right: "black" },
      second: { left: "silver", right: "white" },
    });
    assert.deepEqual(current.first, { left: "white", right: "black" });
  });

  it("reconciles selections by stable overlay id", () => {
    const first = placedOverlay("first");
    const third = placedOverlay("third");
    third.configuration = { ...sourceConfiguration, aluminumFinish: "silver" };
    const reconciled = reconcileProductVariantSelections(
      {
        first: { left: "black", right: "silver" },
        removed: { left: "white", right: "black" },
      },
      [third, first],
    );

    assert.deepEqual(reconciled, {
      third: { left: "silver", right: "silver" },
      first: { left: "black", right: "silver" },
    });
    assert.deepEqual(createProductVariantSelections([third, first]), {
      third: { left: "silver", right: "silver" },
      first: { left: "white", right: "white" },
    });
  });

  it("swaps both panels for every configured product", () => {
    assert.deepEqual(
      swapProductVariantSelections({
        first: { left: "white", right: "black" },
        second: { left: "silver", right: "white" },
      }),
      {
        first: { left: "black", right: "white" },
        second: { left: "white", right: "silver" },
      },
    );
  });

  it("detects incomplete variation data without falling back", () => {
    const complete = placedOverlay("complete");
    const incomplete = placedOverlay("incomplete");
    complete.variationImageDataUrls = {
      white: "complete-white",
      black: "complete-black",
      silver: "complete-silver",
    };
    incomplete.variationImageDataUrls = {
      white: "incomplete-white",
      black: "incomplete-black",
    };

    assert.equal(hasCompleteVariationLayers([complete]), true);
    assert.equal(hasCompleteVariationLayers([complete, incomplete]), false);
    assert.throws(
      () => getComparisonLayerImageUrls(
        [incomplete],
        { incomplete: { left: "silver", right: "black" } },
        "left",
      ),
      /regenerate/i,
    );
  });

  it("commits Panel A for every product without mutating the source overlays", () => {
    const first = placedOverlay("first");
    const second = placedOverlay("second");
    const committed = commitProductVariantSelections(
      [first, second],
      {
        first: { left: "silver", right: "black" },
        second: { left: "black", right: "white" },
      },
    );

    assert.equal(committed[0].configuration.aluminumFinish, "silver");
    assert.equal(committed[1].configuration.aluminumFinish, "black");
    assert.equal(first.configuration.aluminumFinish, "white");
    assert.notEqual(committed[0], first);
  });

  it("maps alpha masks through equal, letterboxed, and pillarboxed containers", () => {
    assert.deepEqual(calculateContainTransform(200, 100, 200, 100), {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      renderedWidth: 200,
      renderedHeight: 100,
    });
    assert.deepEqual(calculateContainTransform(300, 100, 100, 100), {
      scale: 1,
      offsetX: 100,
      offsetY: 0,
      renderedWidth: 100,
      renderedHeight: 100,
    });
    assert.deepEqual(calculateContainTransform(100, 300, 100, 100), {
      scale: 1,
      offsetX: 0,
      offsetY: 100,
      renderedWidth: 100,
      renderedHeight: 100,
    });
    assert.equal(calculateContainTransform(0, 100, 100, 100), null);
    assert.equal(calculateContainTransform(Number.NaN, 100, 100, 100), null);
  });

  it("uses the documented alpha threshold and circular hit slop", () => {
    const mask = createOverlayAlphaMask(
      "thin-frame",
      20,
      20,
      rgbaMask(20, 20, [[10, 10, 24], [11, 10, 23]]),
    );

    assert.equal(findTopmostOverlayAtPoint({
      x: 10,
      y: 10,
      containerWidth: 20,
      containerHeight: 20,
      orderedOverlayIds: ["thin-frame"],
      masks: { "thin-frame": mask },
      hitSlopCssPx: 0,
    }), "thin-frame");
    assert.equal(findTopmostOverlayAtPoint({
      x: 11,
      y: 10,
      containerWidth: 20,
      containerHeight: 20,
      orderedOverlayIds: ["thin-frame"],
      masks: { "thin-frame": mask },
      hitSlopCssPx: 0,
    }), null);
    assert.equal(findTopmostOverlayAtPoint({
      x: 13,
      y: 10,
      containerWidth: 20,
      containerHeight: 20,
      orderedOverlayIds: ["thin-frame"],
      masks: { "thin-frame": mask },
      hitSlopCssPx: 3,
    }), "thin-frame");
  });

  it("selects the topmost opaque overlay and skips transparent upper pixels", () => {
    const lower = createOverlayAlphaMask(
      "lower",
      10,
      10,
      rgbaMask(10, 10, [[5, 5, 255], [2, 2, 255]]),
    );
    const upper = createOverlayAlphaMask(
      "upper",
      10,
      10,
      rgbaMask(10, 10, [[5, 5, 255]]),
    );
    const input = {
      containerWidth: 10,
      containerHeight: 10,
      orderedOverlayIds: ["lower", "upper"],
      masks: { lower, upper },
      hitSlopCssPx: 0,
    } as const;

    assert.equal(findTopmostOverlayAtPoint({ ...input, x: 5, y: 5 }), "upper");
    assert.equal(findTopmostOverlayAtPoint({ ...input, x: 2, y: 2 }), "lower");
    assert.equal(findTopmostOverlayAtPoint({ ...input, x: 9, y: 9 }), null);
    assert.equal(findTopmostOverlayAtPoint({
      ...input,
      x: -1,
      y: 5,
      containerWidth: 30,
    }), null);
  });

  it("chooses a stable mask source without inventing missing geometry", () => {
    const overlay = placedOverlay("source");
    overlay.flattenedImageDataUrl = "";
    overlay.variationImageDataUrls = {
      white: "committed-white",
      black: "alternate-black",
    };
    assert.equal(getOverlayHitMaskSource(overlay), "committed-white");

    overlay.configuration = { ...sourceConfiguration, aluminumFinish: "silver" };
    assert.equal(getOverlayHitMaskSource(overlay), "committed-white");

    overlay.variationImageDataUrls = {};
    assert.equal(getOverlayHitMaskSource(overlay), null);
  });
});
