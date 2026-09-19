import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  convertCmToIn,
  convertInToCm,
  buildMeasurementEntries,
  applyMeasurementOverridesToOverlays,
} from "../../src/lib/visualization/measurementConfirmation";
import type {
  PlacedOverlay,
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
  MeasurementConfirmationEntry,
} from "../../src/lib/visualization/types";
import type { CatalogProduct } from "../../src/lib/products/types";
import { hasCompleteVariationLayers } from "../../src/lib/visualization/multiProductPresentation";

const mockBaseConfig: ProductConfigurationSnapshot = {
  widthCm: 120,
  heightCm: 150,
  thicknessMm: 6,
  quantity: 2,
  aluminumFinish: "white",
  glassAppearance: "clear",
  includeSill: true,
  yaw: 0,
  pitch: 0,
  rotateAngle: 0,
  isFlipped: false,
  visualParameterValues: {
    width: 1200,
    height: 1500,
  },
};

const mockStructuralDefinition: ProductStructuralDefinition = {
  product: {
    productId: "product-sliding-door",
    productName: "Sliding Glass Door",
    productType: "Door",
    description: "2-Panel Sliding Glass Door",
    basePrice: 15000,
    catalogImageUrl: "https://r2.glassfit.test/door.jpg",
    preview_glb_url: "https://r2.glassfit.test/door.glb",
  },
  template: {
    templateId: "template-sliding-door",
    templateName: "Sliding Door Template",
    modelStrategy: "Parametric",
    measurementUnit: "mm",
    baseConfiguration: {},
  },
  parameters: [],
  components: [],
  rules: [],
  assets: [
    {
      assetId: "asset-1",
      assetType: "Catalog 3D Preview",
      r2ObjectKey: "door_preview.glb",
      url: "https://r2.glassfit.test/door.glb",
      fileName: "door_preview.glb",
      isPrimary: true,
      status: "Active",
    },
  ],
};

const mockCatalogProducts: CatalogProduct[] = [
  {
    id: "product-sliding-door",
    name: "Sliding Glass Door",
    type: "Door",
    description: "2-Panel Sliding Door",
    basePrice: 15000,
    rendererKey: null,
    imageUrl: "https://r2.glassfit.test/door.jpg",
    previewGlbUrl: "https://r2.glassfit.test/door.glb",
  },
  {
    id: "product-awning-window",
    name: "Awning Window",
    type: "Window",
    description: "Standard Awning Window",
    basePrice: 8500,
    rendererKey: "window",
    imageUrl: "https://r2.glassfit.test/awning.jpg",
    previewGlbUrl: "https://r2.glassfit.test/awning.glb",
  },
];

describe("MS-08 / PRD-F10 / QAD-TC22: Measurement Confirmation Pre-Comparison Workflow", () => {
  describe("Measurement Unit Conversions", () => {
    it("converts cm to inches accurately rounded to 1 decimal place", () => {
      assert.equal(convertCmToIn(100), 39.4);
      assert.equal(convertCmToIn(120), 47.2);
      assert.equal(convertCmToIn(150), 59.1);
      assert.equal(convertCmToIn(240), 94.5);
    });

    it("converts inches to cm accurately rounded to nearest integer", () => {
      assert.equal(convertInToCm(39.4), 100);
      assert.equal(convertInToCm(47.2), 120);
      assert.equal(convertInToCm(59.1), 150);
      assert.equal(convertInToCm(94.5), 240);
    });
  });

  describe("Measurement Entries Assembly (buildMeasurementEntries)", () => {
    it("builds entry for a single active product workspace session", () => {
      const entries = buildMeasurementEntries(
        [],
        mockStructuralDefinition,
        "120",
        "150",
        30000,
        mockCatalogProducts,
        mockBaseConfig,
      );

      assert.equal(entries.length, 1);
      const entry = entries[0];
      assert.equal(entry.isActiveProduct, true);
      assert.equal(entry.productId, "product-sliding-door");
      assert.equal(entry.productName, "Sliding Glass Door");
      assert.equal(entry.systemWidthCm, 120);
      assert.equal(entry.systemHeightCm, 150);
      assert.equal(entry.override.widthIn, 47.2);
      assert.equal(entry.override.heightIn, 59.1);
      assert.equal(entry.override.widthOverridden, false);
      assert.equal(entry.override.heightOverridden, false);
      assert.equal(entry.override.acknowledged, false);
      assert.equal(entry.previewGlbUrl, "https://r2.glassfit.test/door.glb");
      assert.equal(entry.systemTotalPrice, 30000);
    });

    it("orders placed overlays first and active product last in multi-product sessions with 3D previews resolved", () => {
      const placedOverlay1: PlacedOverlay = {
        overlayId: "overlay-1",
        productId: "product-awning-window",
        productName: "Awning Window",
        templateId: "awning-template",
        configuration: {
          ...mockBaseConfig,
          widthCm: 80,
          heightCm: 100,
        },
        flattenedImageDataUrl: "data:image/png;base64,awning",
        totalPrice: 8500,
        unitPrice: 8500,
        previewGlbUrl: "https://r2.glassfit.test/awning.glb",
      };

      const activeOverlay: PlacedOverlay = {
        overlayId: "overlay-active",
        productId: "product-sliding-door",
        productName: "Sliding Glass Door",
        templateId: "door-template",
        configuration: mockBaseConfig,
        flattenedImageDataUrl: "data:image/png;base64,door",
        totalPrice: 30000,
        unitPrice: 15000,
        isActive: true,
      };

      const comparisonOverlays = [placedOverlay1, activeOverlay];

      const entries = buildMeasurementEntries(
        comparisonOverlays,
        mockStructuralDefinition,
        "120",
        "150",
        30000,
        mockCatalogProducts,
        mockBaseConfig,
      );

      assert.equal(entries.length, 2);
      // Placed overlay first (window)
      assert.equal(entries[0].overlayId, "overlay-1");
      assert.equal(entries[0].isActiveProduct, false);
      assert.equal(entries[0].systemWidthCm, 80);
      assert.equal(entries[0].systemHeightCm, 100);
      assert.equal(entries[0].override.widthIn, 31.5);
      assert.equal(entries[0].override.heightIn, 39.4);
      assert.equal(entries[0].previewGlbUrl, "https://r2.glassfit.test/awning.glb");

      // Active product last (door)
      assert.equal(entries[1].overlayId, "overlay-active");
      assert.equal(entries[1].isActiveProduct, true);
      assert.equal(entries[1].systemWidthCm, 120);
      assert.equal(entries[1].systemHeightCm, 150);
      assert.equal(entries[1].previewGlbUrl, "https://r2.glassfit.test/door.glb");
    });
  });

  describe("Applying Overrides to Overlays (applyMeasurementOverridesToOverlays)", () => {
    it("patches overlay configuration and visual dimensions when user overrides measurements", () => {
      const originalOverlay: PlacedOverlay = {
        overlayId: "overlay-1",
        productId: "product-awning-window",
        productName: "Awning Window",
        templateId: "awning-template",
        configuration: {
          ...mockBaseConfig,
          widthCm: 80,
          heightCm: 100,
          quantity: 2,
          visualParameterValues: { width: 800, height: 1000 },
        },
        flattenedImageDataUrl: "data:image/png;base64,awning",
        totalPrice: 17000,
        unitPrice: 8500,
      };

      const confirmedEntry: MeasurementConfirmationEntry = {
        overlayId: "overlay-1",
        productId: "product-awning-window",
        productName: "Awning Window",
        aluminumFinish: "white",
        previewGlbUrl: null,
        systemWidthCm: 80,
        systemHeightCm: 100,
        systemTotalPrice: 17000,
        structuralDefinition: null,
        overlayConfiguration: originalOverlay.configuration,
        isActiveProduct: false,
        override: {
          widthIn: 35.4, // ~90 cm
          heightIn: 43.3, // ~110 cm
          widthOverridden: true,
          heightOverridden: true,
          acknowledged: true,
        },
        recalculatedTotalPrice: 20000,
      };

      const patched = applyMeasurementOverridesToOverlays(
        [confirmedEntry],
        [originalOverlay],
      );

      assert.equal(patched.length, 1);
      const result = patched[0];
      assert.equal(result.configuration.widthCm, 90);
      assert.equal(result.configuration.heightCm, 110);
      assert.equal(result.configuration.visualParameterValues?.width, 900);
      assert.equal(result.configuration.visualParameterValues?.height, 1100);
      assert.equal(result.totalPrice, 20000);
      assert.equal(result.unitPrice, 10000);
    });

    it("does not mutate overlays that have no user override", () => {
      const originalOverlay: PlacedOverlay = {
        overlayId: "overlay-1",
        productId: "product-awning-window",
        productName: "Awning Window",
        templateId: "awning-template",
        configuration: {
          ...mockBaseConfig,
          widthCm: 80,
          heightCm: 100,
          visualParameterValues: { width: 800, height: 1000 },
        },
        flattenedImageDataUrl: "data:image/png;base64,awning",
        totalPrice: 8500,
        unitPrice: 8500,
      };

      const uneditedEntry: MeasurementConfirmationEntry = {
        overlayId: "overlay-1",
        productId: "product-awning-window",
        productName: "Awning Window",
        aluminumFinish: "white",
        previewGlbUrl: null,
        systemWidthCm: 80,
        systemHeightCm: 100,
        systemTotalPrice: 8500,
        structuralDefinition: null,
        overlayConfiguration: originalOverlay.configuration,
        isActiveProduct: false,
        override: {
          widthIn: 31.5,
          heightIn: 39.4,
          widthOverridden: false,
          heightOverridden: false,
          acknowledged: false,
        },
        recalculatedTotalPrice: null,
      };

      const patched = applyMeasurementOverridesToOverlays(
        [uneditedEntry],
        [originalOverlay],
      );

      assert.equal(patched[0], originalOverlay);
      assert.equal(patched[0].configuration.widthCm, 80);
      assert.equal(patched[0].configuration.heightCm, 100);
    });

    it("preserves variationImageDataUrls and flattenedImageDataUrl when overrides are applied", () => {
      const mockOverlay: PlacedOverlay = {
        overlayId: "overlay-1",
        productId: "prod-1",
        productName: "Sliding Window",
        templateId: "sliding-window",
        configuration: {
          ...mockBaseConfig,
          widthCm: 200,
          heightCm: 150,
          aluminumFinish: "white",
        },
        flattenedImageDataUrl: "data:image/png;base64,mockFlattened",
        variationImageDataUrls: {
          white: "data:image/png;base64,mockWhite",
          black: "data:image/png;base64,mockBlack",
          silver: "data:image/png;base64,mockSilver",
        },
        isActive: true,
        totalPrice: 15000,
      };

      const mockEntry: MeasurementConfirmationEntry = {
        overlayId: "overlay-1",
        productId: "prod-1",
        productName: "Sliding Window",
        aluminumFinish: "white",
        previewGlbUrl: null,
        systemWidthCm: 200,
        systemHeightCm: 150,
        systemTotalPrice: 15000,
        structuralDefinition: null,
        overlayConfiguration: mockOverlay.configuration,
        isActiveProduct: true,
        override: {
          widthIn: 85,
          heightIn: 60,
          widthOverridden: true,
          heightOverridden: false,
          acknowledged: true,
        },
        recalculatedTotalPrice: 16500,
      };

      const result = applyMeasurementOverridesToOverlays([mockEntry], [mockOverlay]);
      assert.equal(result.length, 1);
      assert.equal(result[0].flattenedImageDataUrl, "data:image/png;base64,mockFlattened");
      assert.equal(result[0].variationImageDataUrls?.white, "data:image/png;base64,mockWhite");
      assert.equal(result[0].variationImageDataUrls?.black, "data:image/png;base64,mockBlack");
      assert.equal(result[0].variationImageDataUrls?.silver, "data:image/png;base64,mockSilver");
      assert.equal(hasCompleteVariationLayers(result), true);
    });
  });
});
