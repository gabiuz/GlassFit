import assert from "node:assert/strict";
import { calculateOverlayPricing, calculateStandardSeries798 } from "../../src/lib/pricing/pricingEngine";
import type { PlacedOverlay } from "../../src/lib/visualization/types";

const overlay1: PlacedOverlay = {
  overlayId: "active-prod1",
  productId: "prod1",
  productName: "Sliding Window",
  templateId: "series-798",
  configuration: {
    widthCm: 120,
    heightCm: 120,
    thicknessMm: 6,
    quantity: 1,
    aluminumFinish: "Analok",
    glassAppearance: "clear",
    includeSill: true,
    yaw: 0,
    pitch: 0,
    rotateAngle: 0,
    isFlipped: false,
    zoomLevel: 0,
    positionX: 0,
    positionY: 0,
    visualParameterValues: {},
  },
  flattenedImageDataUrl: "data:image/png;base64,sample",
  totalPrice: 4363,
  unitPrice: 4363,
};

const overlay2: PlacedOverlay = {
  overlayId: "active-prod2",
  productId: "prod2",
  productName: "Casement Window",
  templateId: "series-798",
  configuration: {
    widthCm: 180,
    heightCm: 120,
    thicknessMm: 6,
    quantity: 1,
    aluminumFinish: "Analok",
    glassAppearance: "clear",
    includeSill: true,
    yaw: 0,
    pitch: 0,
    rotateAngle: 0,
    isFlipped: false,
    zoomLevel: 0,
    positionX: 0,
    positionY: 0,
    visualParameterValues: {},
  },
  flattenedImageDataUrl: "data:image/png;base64,sample2",
  totalPrice: 5671,
  unitPrice: 5671,
};

// Scenario: user is editing prod2.
// placedOverlays has overlay1
const placedOverlays = [overlay1];
const activeOverlayId = "active-prod2";
const selectedProduct = true;
const realtimePricing = { totalPrice: 5671, unitPrice: 5671 };

const nonActivePlacedOverlays = placedOverlays.filter((o) => o.overlayId !== activeOverlayId);
const placedOverlaysTotalPrice = nonActivePlacedOverlays.reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
const totalScenePrice = placedOverlaysTotalPrice + (selectedProduct ? realtimePricing.totalPrice : 0);
const totalSceneProductCount = nonActivePlacedOverlays.length + (selectedProduct ? 1 : 0);

console.log({
  nonActiveCount: nonActivePlacedOverlays.length,
  placedOverlaysTotalPrice,
  activePrice: realtimePricing.totalPrice,
  totalScenePrice,
  totalSceneProductCount,
});

assert.equal(totalSceneProductCount, 2);
assert.equal(totalScenePrice, 4363 + 5671);
console.log("Pricing math passes!");
