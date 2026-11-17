/**
 * IMP-MS89 Work Package 1 & QAD-TC104.4:
 * Shared Fit capability policy, bounded Cabinet correction, and sizing characterization.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CABINET_FREE_PLACEMENT_NOTICE,
  isCanonicalCabinetDefinition,
  isLegacyDoorProduct,
  isLegacyWindowProduct,
  resolveWorkspaceProductCapabilities,
} from "../../src/lib/visualization/workspaceCapabilities";
import { computeEstimatedDimensions } from "../../src/lib/visualization/scaleEstimation";
import {
  initialState,
  serializeVisualizationSession,
  validateSessionPlaneEligibility,
} from "../../src/lib/visualization/visualizationSession";
import type {
  PlacedOverlay,
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
} from "../../src/lib/visualization/types";

function makeDefinition(options: {
  productId?: string;
  productName: string;
  productType: ProductStructuralDefinition["product"]["productType"];
  componentKeys?: string[];
}): ProductStructuralDefinition {
  return {
    product: {
      productId: options.productId ?? "prod-test-1",
      productName: options.productName,
      productType: options.productType,
    },
    template: {
      templateId: "tpl-1",
      templateName: "Test Template",
      modelStrategy: "Parametric",
      measurementUnit: "mm",
      baseConfiguration: { includeSill: true },
    },
    parameters: [],
    components: (options.componentKeys ?? ["outer_frame"]).map((key, idx) => ({
      componentId: `comp-${idx}`,
      componentKey: key,
      componentName: key,
      componentType: "Frame",
      baseQuantity: 1,
      componentData: {},
      model: {
        assetId: `asset-${idx}`,
        r2ObjectKey: `models/${key}.glb`,
        url: `https://example.com/${key}.glb`,
        fileName: `${key}.glb`,
        sourceDimensionsMm: { width: 1000, height: 1000, depth: 50 },
      },
    })),
    rules: [],
  };
}

describe("QAD-TC104.4 shared Fit capability and bounded Cabinet correction", () => {
  it("excludes canonical Cabinet from Fit/Edit Corners even with door or window-sill matches", () => {
    const cabinetWithDoorName = makeDefinition({
      productName: "Glass Door Kitchen Cabinet",
      productType: "Cabinet",
      componentKeys: ["cabinet_box", "door_leaf", "window-sill"],
    });
    const capabilities = resolveWorkspaceProductCapabilities({
      structuralDefinition: cabinetWithDoorName,
      selectedProductName: "Glass Door Kitchen Cabinet",
    });

    assert.equal(isCanonicalCabinetDefinition(cabinetWithDoorName), true);
    assert.equal(capabilities.isDefinitionReady, true);
    assert.equal(capabilities.isCanonicalCabinet, true);
    assert.equal(capabilities.supportsPerspectivePlane, false);
    assert.equal(capabilities.canFitOpening, false);
    assert.equal(capabilities.canEditCorners, false);
    assert.equal(capabilities.placementMode, "free_place");
    assert.equal(capabilities.reason, "cabinet_free_placement");
  });

  it("blocks Fit capability while definition is loading or unavailable", () => {
    const missing = resolveWorkspaceProductCapabilities({
      structuralDefinition: null,
    });
    assert.equal(missing.isDefinitionReady, false);
    assert.equal(missing.canFitOpening, false);
    assert.equal(missing.canEditCorners, false);
    assert.equal(missing.placementMode, "unavailable");
    assert.equal(missing.reason, "definition_unavailable");

    const windowDef = makeDefinition({
      productName: "Sliding Window",
      productType: "Window",
    });
    const loading = resolveWorkspaceProductCapabilities({
      structuralDefinition: windowDef,
      isDefinitionLoading: true,
    });
    assert.equal(loading.isDefinitionReady, false);
    assert.equal(loading.canFitOpening, false);
    assert.equal(loading.reason, "definition_unavailable");

    const errored = resolveWorkspaceProductCapabilities({
      structuralDefinition: windowDef,
      hasDefinitionError: true,
    });
    assert.equal(errored.isDefinitionReady, false);
    assert.equal(errored.canFitOpening, false);
    assert.equal(errored.reason, "definition_unavailable");
  });

  it("preserves Fit eligibility for Window, Door, and non-cabinet categories exactly", () => {
    const cases: Array<{
      label: string;
      def: ProductStructuralDefinition;
      expectedFit: boolean;
    }> = [
      {
        label: "Canonical Window",
        def: makeDefinition({ productName: "Awning Window", productType: "Window" }),
        expectedFit: true,
      },
      {
        label: "Canonical Door",
        def: makeDefinition({ productName: "Swing Entry", productType: "Door" }),
        expectedFit: true,
      },
      {
        label: "Plain Partition",
        def: makeDefinition({ productName: "Glass Office Partition", productType: "Partition" }),
        expectedFit: false,
      },
      {
        label: "Partition with door component",
        def: makeDefinition({
          productName: "Partition System",
          productType: "Partition",
          componentKeys: ["frame", "door_leaf"],
        }),
        expectedFit: true,
      },
      {
        label: "Plain Shower Enclosure",
        def: makeDefinition({ productName: "Frameless Shower Enclosure", productType: "Enclosure" }),
        expectedFit: false,
      },
      {
        label: "Enclosure with sliding door",
        def: makeDefinition({
          productName: "Shower Door Enclosure",
          productType: "Enclosure",
          componentKeys: ["door_panel"],
        }),
        expectedFit: true,
      },
      {
        label: "Plain Railing",
        def: makeDefinition({ productName: "Balcony Glass Railing", productType: "Railing" }),
        expectedFit: false,
      },
      {
        label: "Other with window-sill component",
        def: makeDefinition({
          productName: "Custom Frame",
          productType: "Other",
          componentKeys: ["window_sill"],
        }),
        expectedFit: true,
      },
    ];

    for (const testCase of cases) {
      const cap = resolveWorkspaceProductCapabilities({
        structuralDefinition: testCase.def,
        selectedProductName: testCase.def.product.productName,
      });
      const legacyResult =
        isLegacyWindowProduct(testCase.def) ||
        isLegacyDoorProduct(testCase.def, testCase.def.product.productName);
      assert.equal(
        cap.canFitOpening,
        testCase.expectedFit,
        `${testCase.label} Fit mismatch`,
      );
      assert.equal(cap.supportsPerspectivePlane, legacyResult);
      assert.equal(cap.canEditCorners, testCase.expectedFit);
    }
  });

  it("preserves legacy sizing predicates and computeEstimatedDimensions outputs", () => {
    const cabinetWithDoor = makeDefinition({
      productName: "Glass Door Cabinet",
      productType: "Cabinet",
      componentKeys: ["door_leaf", "window_sill"],
    });
    // Legacy predicates remain unchanged for sizing, sill toggle, and fallback dimensions.
    assert.equal(isLegacyDoorProduct(cabinetWithDoor), true);
    assert.equal(isLegacyWindowProduct(cabinetWithDoor), true);

    const baselineDoor = computeEstimatedDimensions(400, 700, null, true, 2100, null);
    const baselineWindow = computeEstimatedDimensions(400, 700, null, false, 1500, null);
    const fromPredicate = computeEstimatedDimensions(
      400,
      700,
      null,
      isLegacyDoorProduct(cabinetWithDoor),
      2100,
      null,
    );
    assert.deepEqual(fromPredicate, baselineDoor);
    assert.equal(baselineDoor.widthCm, 120);
    assert.equal(baselineDoor.heightCm, 210);
    assert.equal(baselineWindow.widthCm, 86);
    assert.equal(baselineWindow.heightCm, 150);
  });

  it("preserves previously fitted Cabinet placement geometry on session validation and serialization", () => {
    const fittedCorners = [
      { x: 0.2, y: 0.2 },
      { x: 0.7, y: 0.2 },
      { x: 0.7, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ] as ProductConfigurationSnapshot["perspectiveFitCorners"];

    const fittedCabinetConfig: ProductConfigurationSnapshot = {
      widthCm: 120,
      heightCm: 200,
      thicknessMm: 6,
      quantity: 1,
      aluminumFinish: "white",
      glassAppearance: "clear",
      includeSill: false,
      yaw: 0,
      pitch: 0,
      rotateAngle: 0,
      isFlipped: false,
      productFacing: "back",
      targetPlaneId: "plane-1",
      perspectiveFitCorners: fittedCorners,
      visualPoseCorners: fittedCorners,
      visualParameterValues: {
        productFacing: "back",
        dimension_source: "manual_tape",
      },
    };

    const placedCabinet: PlacedOverlay = {
      overlayId: "cab-overlay-1",
      productId: "cab-1",
      productName: "Door Cabinet",
      templateId: "tpl-cab",
      configuration: fittedCabinetConfig,
      flattenedImageDataUrl: "",
    };

    const cabinetDef = makeDefinition({
      productId: "cab-1",
      productName: "Door Cabinet",
      productType: "Cabinet",
      componentKeys: ["door_leaf"],
    });

    const validated = validateSessionPlaneEligibility({
      ...initialState,
      selectedProductId: "cab-1",
      structuralDefinition: cabinetDef,
      productConfiguration: fittedCabinetConfig,
      placedOverlays: [placedCabinet],
    });

    assert.deepEqual(validated.productConfiguration?.perspectiveFitCorners, fittedCorners);
    assert.deepEqual(validated.productConfiguration?.visualPoseCorners, fittedCorners);
    assert.equal(validated.productConfiguration?.widthCm, 120);
    assert.equal(validated.productConfiguration?.heightCm, 200);
    assert.equal(validated.productConfiguration?.productFacing, "back");

    const serialized = serializeVisualizationSession(validated);
    assert.deepEqual(
      serialized.placedOverlays[0]?.configuration.perspectiveFitCorners,
      fittedCorners,
    );
  });

  it("wires capability guards and Free Place recovery on both desktop and mobile toolbars", () => {
    const workspaceSrc = readFileSync(
      "src/features/visualization/components/ProductModelWorkspace.tsx",
      "utf8",
    );
    assert.match(workspaceSrc, /resolveWorkspaceProductCapabilities/);
    assert.match(workspaceSrc, /CABINET_FREE_PLACEMENT_NOTICE/);
    assert.match(workspaceSrc, /handleOpenPerspectivePicker/);
    assert.match(workspaceSrc, /handleSwitchToFreePlace/);
    assert.match(workspaceSrc, /showPerspectivePicker && supportsPerspectivePlane/);
    assert.equal(
      CABINET_FREE_PLACEMENT_NOTICE,
      "This cabinet uses free placement. Your existing placement is kept.",
    );
  });
});
