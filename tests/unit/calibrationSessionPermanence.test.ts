import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  initialState,
  transitionSessionState,
  serializeVisualizationSession,
  readStoredVisualizationSession,
  SESSION_STORAGE_KEY,
  type CalibrationMetadata,
} from "../../src/lib/visualization/visualizationSession.js";
import type {
  PlacedOverlay,
  ScaleEstimationSignal,
  VisualizationSessionState,
} from "../../src/lib/visualization/types.js";
import type { SpaceImageSession } from "../../src/lib/imageApi.js";

const mockSpaceImageSession: SpaceImageSession = {
  sessionId: "test-sess-ms49",
  originalFileName: "sample_wall.jpg",
  workspaceImage: {
    url: "https://example.com/photos/sample_wall.jpg",
    width: 1920,
    height: 1080,
  },
  brightness: {
    mean_pixel_intensity: 135,
    category: "normal",
  },
  lighting: {
    mean_rgb: [140, 138, 135],
    ambient_rgb: [120, 118, 115],
    ambient_hex: "#787673",
    contrast: 0.65,
    saturation: 0.4,
    warmth: 0.1,
    tint: 0.0,
    temperature: "neutral",
    sharpness: 0.8,
    noise: 0.05,
    light_direction: { x: 0.2, y: -0.5 },
    suggested: {
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      color_mix: 0,
      blur_px: 0,
      grain: 0,
      shadow_opacity: 0.3,
    },
  },
  objects: [],
  segmentation: { mode: "yolo", model: "yolov8s-seg" },
  warnings: [],
  scaleEstimation: {
    best_scale_cm_per_px: null,
    confidence: 0.0,
    method: "uncalibrated",
    anchors: [],
    exif_focal_length_mm: null,
    exif_focal_length_35mm: null,
    exif_device_model: null,
  },
  calibrationMeta: {
    mode: "paper_fiducial",
    paperStandard: "a4",
    status: "manual_pin_required",
    confidence: 0.0,
    detectedCorners: null,
    homographyMatrix: null,
  },
};

const calibratedScaleSignal: ScaleEstimationSignal = {
  best_scale_cm_per_px: 0.0524,
  confidence: 0.95,
  method: "paper_fiducial_a4",
  anchors: [
    {
      label: "paper_a4",
      bbox_height_px: 566,
      reference_height_cm: 29.7,
      scale_cm_per_px: 0.0524,
      confidence: 0.95,
      depth_correction: 1.0,
    },
  ],
  exif_focal_length_mm: 26,
  exif_focal_length_35mm: 26,
  exif_device_model: "iPhone 15 Pro",
};

const calibratedMeta: CalibrationMetadata = {
  mode: "paper_fiducial",
  paperStandard: "a4",
  status: "calibrated",
  confidence: 0.95,
  detectedCorners: [
    [100, 100],
    [520, 100],
    [520, 666],
    [100, 666],
  ],
  homographyMatrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

const sampleOverlay: PlacedOverlay = {
  overlayId: "ov-test-1",
  productId: "sliding-window-standard",
  productName: "Sliding Window",
  templateId: "tpl-sliding-window",
  layerNumber: 1,
  configuration: {
    widthCm: 120,
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
  },
  flattenedImageDataUrl: "",
};

describe("IMP-MS49: Session-Permanent Calibration State and Fallback Pinning Lifecycle", () => {
  describe("1. Calibration State Mutation & Session Permanence", () => {
    it("preserves calibrationMeta and scaleEstimation across transitionSessionState mode 'add'", () => {
      const stateWithCalibratedPaper: VisualizationSessionState = {
        ...initialState,
        assetSessionId: "asset-session-49",
        selectedProductId: "sliding-window-standard",
        spaceImageSession: {
          ...mockSpaceImageSession,
          calibrationMeta: calibratedMeta,
          scaleEstimation: calibratedScaleSignal,
        },
        placedOverlays: [sampleOverlay],
      };

      const nextOverlay: PlacedOverlay = {
        ...sampleOverlay,
        overlayId: "ov-test-2",
        productId: "casement-window-standard",
        layerNumber: 2,
      };

      const transitioned = transitionSessionState(stateWithCalibratedPaper, {
        nextProductId: "casement-window-standard",
        mode: "add",
        newPlacedOverlay: nextOverlay,
      });

      assert.equal(transitioned.selectedProductId, "casement-window-standard");
      assert.equal(transitioned.placedOverlays.length, 2);
      assert.ok(transitioned.spaceImageSession, "spaceImageSession must not be null");
      assert.equal(
        transitioned.spaceImageSession.calibrationMeta?.status,
        "calibrated",
        "Calibrated status must be retained upon adding a product",
      );
      assert.equal(
        transitioned.spaceImageSession.calibrationMeta?.paperStandard,
        "a4",
      );
      assert.deepEqual(
        transitioned.spaceImageSession.calibrationMeta?.detectedCorners,
        calibratedMeta.detectedCorners,
        "Pin corner coordinates must survive product additions",
      );
      assert.equal(
        transitioned.spaceImageSession.scaleEstimation?.best_scale_cm_per_px,
        0.0524,
        "Metric scale factor must survive product additions",
      );
    });

    it("preserves calibrationMeta and scaleEstimation across transitionSessionState mode 'change'", () => {
      const stateWithCalibratedPaper: VisualizationSessionState = {
        ...initialState,
        assetSessionId: "asset-session-49",
        selectedProductId: "sliding-window-standard",
        spaceImageSession: {
          ...mockSpaceImageSession,
          calibrationMeta: calibratedMeta,
          scaleEstimation: calibratedScaleSignal,
        },
        placedOverlays: [sampleOverlay],
      };

      const transitioned = transitionSessionState(stateWithCalibratedPaper, {
        nextProductId: "folding-door-deluxe",
        mode: "change",
      });

      assert.equal(transitioned.selectedProductId, "folding-door-deluxe");
      assert.ok(transitioned.spaceImageSession);
      assert.equal(
        transitioned.spaceImageSession.calibrationMeta?.status,
        "calibrated",
      );
      assert.equal(
        transitioned.spaceImageSession.scaleEstimation?.best_scale_cm_per_px,
        0.0524,
      );
    });

    it("preserves calibrationMeta across transitionSessionState mode 'edit'", () => {
      const stateWithCalibratedPaper: VisualizationSessionState = {
        ...initialState,
        assetSessionId: "asset-session-49",
        selectedProductId: "sliding-window-standard",
        spaceImageSession: {
          ...mockSpaceImageSession,
          calibrationMeta: calibratedMeta,
          scaleEstimation: calibratedScaleSignal,
        },
        placedOverlays: [sampleOverlay],
      };

      const transitioned = transitionSessionState(stateWithCalibratedPaper, {
        nextProductId: "sliding-window-standard",
        mode: "edit",
        targetOverlayId: sampleOverlay.overlayId,
        newPlacedOverlay: {
          ...sampleOverlay,
          configuration: { ...sampleOverlay.configuration, widthCm: 150 },
        },
      });

      assert.ok(transitioned.spaceImageSession);
      assert.equal(
        transitioned.spaceImageSession.calibrationMeta?.status,
        "calibrated",
      );
      assert.equal(
        transitioned.spaceImageSession.scaleEstimation?.best_scale_cm_per_px,
        0.0524,
      );
    });
  });

  describe("2. Serialization & Storage Quota Resilience", () => {
    it("serializes calibrationMeta and scaleEstimation intact across JSON parse cycles", () => {
      const state: VisualizationSessionState = {
        ...initialState,
        assetSessionId: "session-serialize-test",
        selectedProductId: "sliding-window-standard",
        spaceImageSession: {
          ...mockSpaceImageSession,
          calibrationMeta: calibratedMeta,
          scaleEstimation: calibratedScaleSignal,
        },
        placedOverlays: [sampleOverlay],
      };

      const serialized = serializeVisualizationSession(state);
      const jsonString = JSON.stringify(serialized);
      const restored = JSON.parse(jsonString) as typeof serialized;

      assert.ok(restored.spaceImageSession);
      assert.equal(restored.spaceImageSession.calibrationMeta?.status, "calibrated");
      assert.equal(restored.spaceImageSession.calibrationMeta?.paperStandard, "a4");
      assert.equal(
        restored.spaceImageSession.scaleEstimation?.best_scale_cm_per_px,
        0.0524,
      );
      assert.deepEqual(
        restored.spaceImageSession.calibrationMeta?.detectedCorners,
        calibratedMeta.detectedCorners,
      );
    });

    it("ensures lightweight and minimal storage tiers retain calibrationMeta and scaleEstimation", () => {
      const sessionWithHugeUrl: SpaceImageSession = {
        ...mockSpaceImageSession,
        workspaceImage: {
          url: "data:image/jpeg;base64," + "A".repeat(600_000), // Exceeds 500KB threshold
          width: 1920,
          height: 1080,
        },
        calibrationMeta: calibratedMeta,
        scaleEstimation: calibratedScaleSignal,
      };

      // Lightweight fallback simulates stripping the 600KB URL while retaining calibration
      const lightweight: VisualizationSessionState = {
        ...initialState,
        spaceImageSession: {
          ...sessionWithHugeUrl,
          workspaceImage: {
            ...sessionWithHugeUrl.workspaceImage,
            url: "",
          },
          calibrationMeta: sessionWithHugeUrl.calibrationMeta,
          scaleEstimation: sessionWithHugeUrl.scaleEstimation,
        },
      };

      const serializedLightweight = serializeVisualizationSession(lightweight);
      assert.equal(serializedLightweight.spaceImageSession?.workspaceImage.url, "");
      assert.equal(
        serializedLightweight.spaceImageSession?.calibrationMeta?.status,
        "calibrated",
      );
      assert.equal(
        serializedLightweight.spaceImageSession?.scaleEstimation?.best_scale_cm_per_px,
        0.0524,
      );
    });
  });

  describe("3. Hydration & Quotation Navigation Round-Trip Lifecycle", () => {
    it("hydrates a calibrated session from sessionStorage and normalizes scaleEstimation", () => {
      const mockStorage: Record<string, string> = {};
      const fakeSessionStorage = {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => { mockStorage[key] = val; },
        removeItem: (key: string) => { delete mockStorage[key]; },
        clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
      };

      const originalWindow = globalThis.window;
      // Setup window mock
      // @ts-expect-error test mock
      globalThis.window = { sessionStorage: fakeSessionStorage };

      try {
        const calibratedState: VisualizationSessionState = {
          ...initialState,
          assetSessionId: "session-quote-roundtrip",
          selectedProductId: "sliding-window-standard",
          spaceImageSession: {
            ...mockSpaceImageSession,
            calibrationMeta: calibratedMeta,
            scaleEstimation: calibratedScaleSignal,
          },
          placedOverlays: [sampleOverlay],
        };

        fakeSessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(serializeVisualizationSession(calibratedState)),
        );

        const hydrated = readStoredVisualizationSession();
        assert.ok(hydrated.spaceImageSession);
        assert.equal(hydrated.spaceImageSession.calibrationMeta?.status, "calibrated");
        assert.equal(
          hydrated.spaceImageSession.scaleEstimation?.best_scale_cm_per_px,
          0.0524,
        );

        // Verification of invariant: initial entry modal does NOT prompt if status !== 'manual_pin_required'
        const currentStatus: string | undefined =
          hydrated.spaceImageSession.calibrationMeta?.status;
        const shouldShowPinPickerOnMount =
          currentStatus === "manual_pin_required";
        assert.equal(
          shouldShowPinPickerOnMount,
          false,
          "Modal must never auto-open for an already-calibrated session on workspace mount",
        );
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it("hydrates a heuristic_fallback session and suppresses the modal on mount", () => {
      const mockStorage: Record<string, string> = {};
      const fakeSessionStorage = {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => { mockStorage[key] = val; },
        removeItem: (key: string) => { delete mockStorage[key]; },
        clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
      };

      const originalWindow = globalThis.window;
      // @ts-expect-error test mock
      globalThis.window = { sessionStorage: fakeSessionStorage };

      try {
        const fallbackMeta: CalibrationMetadata = {
          mode: "paper_fiducial",
          paperStandard: "a4",
          status: "heuristic_fallback",
          confidence: 0.75,
          detectedCorners: null,
          homographyMatrix: null,
        };

        const fallbackState: VisualizationSessionState = {
          ...initialState,
          spaceImageSession: {
            ...mockSpaceImageSession,
            calibrationMeta: fallbackMeta,
          },
        };

        fakeSessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(serializeVisualizationSession(fallbackState)),
        );

        const hydrated = readStoredVisualizationSession();
        assert.ok(hydrated.spaceImageSession);
        assert.equal(
          hydrated.spaceImageSession.calibrationMeta?.status,
          "heuristic_fallback",
        );

        const currentStatus: string | undefined =
          hydrated.spaceImageSession.calibrationMeta?.status;
        const shouldShowPinPickerOnMount =
          currentStatus === "manual_pin_required";
        assert.equal(
          shouldShowPinPickerOnMount,
          false,
          "Modal must never auto-open when user previously skipped to quick preview",
        );
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe("4. Source Code Architectural Contracts", () => {
    const workspaceSource = readFileSync(
      "src/features/visualization/components/ProductModelWorkspace.tsx",
      "utf8",
    );
    const sessionSource = readFileSync(
      "src/lib/visualization/visualizationSession.tsx",
      "utf8",
    );
    const awarePageSource = readFileSync(
      "src/features/visualization/components/ProductAwareWorkspacePage.tsx",
      "utf8",
    );

    it("verifies ProductModelWorkspace connects to session context calibration", () => {
      assert.match(
        workspaceSource,
        /useOptionalVisualizationSession/,
        "Workspace must connect to session context for calibration",
      );
      assert.ok(
        workspaceSource.includes("commitSessionCalibration?.(updatedMeta, updatedSignal)"),
        "Workspace must commit calibration changes to session context upon confirm",
      );
      assert.ok(
        workspaceSource.includes("commitSessionCalibration?.(updatedMeta, signalToCommit)"),
        "Workspace must commit fallback status to session context upon skip",
      );
    });

    it("verifies workspace HUD displays Calibrated Scale badge and Adjust Marker link", () => {
      assert.match(
        workspaceSource,
        /Calibrated Scale: ±2-5% Precision/,
        "Workspace HUD must show Calibrated Scale indicator",
      );
      assert.match(
        workspaceSource,
        /Adjust Marker/,
        "Workspace HUD must provide an Adjust Marker action link",
      );
      assert.match(
        workspaceSource,
        /Pin Paper/,
        "Workspace HUD must provide a Pin Paper fallback link",
      );
    });

    it("verifies ProductAwareWorkspacePage passes updateSessionCalibration", () => {
      assert.match(
        awarePageSource,
        /updateSessionCalibration/,
        "ProductAwareWorkspacePage must destructure updateSessionCalibration",
      );
      assert.match(
        awarePageSource,
        /onCalibrationChange=\{updateSessionCalibration\}/,
        "ProductAwareWorkspacePage must pass onCalibrationChange to ProductModelWorkspace",
      );
    });

    it("verifies visualizationSession exports updateSessionCalibration and CalibrationMetadata", () => {
      assert.match(
        sessionSource,
        /export interface CalibrationMetadata/,
        "visualizationSession must export CalibrationMetadata",
      );
      assert.match(
        sessionSource,
        /updateSessionCalibration:\s*\([\s\S]*?calibrationMeta:\s*CalibrationMetadata[\s\S]*?scaleSignal:\s*ScaleEstimationSignal[\s\S]*?\)\s*=>\s*void/,
        "Context interface must include updateSessionCalibration action",
      );
      assert.match(
        sessionSource,
        /export function useOptionalVisualizationSession/,
        "visualizationSession must export useOptionalVisualizationSession",
      );
    });

    it("strictly verifies zero em-dashes (BAN-PUNCT-01) in implementation files and documentation", () => {
      const emDashRegex = /\u2014/;
      assert.doesNotMatch(
        sessionSource,
        emDashRegex,
        "visualizationSession.tsx must contain zero em-dashes",
      );
      assert.doesNotMatch(
        workspaceSource,
        emDashRegex,
        "ProductModelWorkspace.tsx must contain zero em-dashes",
      );

      const ms49Spec = readFileSync("docs/implementation/ms49.md", "utf8");
      assert.doesNotMatch(
        ms49Spec,
        emDashRegex,
        "docs/implementation/ms49.md must contain zero em-dashes",
      );
    });
  });
});
