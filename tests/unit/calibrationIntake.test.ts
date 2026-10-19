import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { analyzeImage } from "../../src/lib/imageApi.js";
import {
  PAPER_STANDARD_METRICS,
  type CalibrationIntakeOptions,
} from "../../src/lib/visualization/types.js";
import { getNextPaperStandard } from "../../src/features/visualization/components/CalibrationModeSelector.js";

const originalFetch = globalThis.fetch;

function makeMockFile(name: string, type: string, content = "dummy-image-content"): File {
  return new File([content], name, { type });
}

function createSuccessAnalysisPayload() {
  return {
    session_id: "test-session-123",
    workspace_image: {
      url: "/generated/sessions/test-session-123/workspace.webp",
      width: 1280,
      height: 720,
    },
    brightness: {
      mean_pixel_intensity: 140,
      category: "normal",
    },
    lighting: {
      mean_rgb: [140, 140, 140],
      ambient_rgb: [120, 120, 120],
      ambient_hex: "#787878",
      contrast: 1.2,
      saturation: 1.0,
      warmth: 0.5,
      tint: 0.0,
      temperature: "neutral",
      sharpness: 1.0,
      noise: 0.1,
      light_direction: { x: 0, y: 1 },
      suggested: {
        brightness: 1.0,
        contrast: 1.0,
        saturation: 1.0,
        color_mix: 0.0,
        blur_px: 0,
        grain: 0,
        shadow_opacity: 0.5,
      },
    },
    objects: [],
    segmentation: {
      mode: "yolo",
      model: "yolov8s-seg",
    },
    scale_estimation: {
      anchors: [],
      best_scale_cm_per_px: 0.25,
      confidence: 0.85,
      method: "fiducial_paper",
      exif_focal_length_mm: null,
      exif_focal_length_35mm: null,
      exif_device_model: null,
    },
    warnings: [],
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("IMP-MS45: Dual-Mode Space Ingestion and Fiducial Paper Calibration Intake", () => {
  describe("1. Philippine Paper Standards & Metric Specifications", () => {
    it("preserves exact millimeter dimensions for Short Bond / Letter", () => {
      const short = PAPER_STANDARD_METRICS.short;
      assert.equal(short.widthMm, 215.9);
      assert.equal(short.heightMm, 279.4);
      assert.ok(short.label.includes("Short Bond"));
      assert.ok(short.label.includes("8.5"));
      assert.ok(short.label.includes("11"));
    });

    it("preserves exact millimeter dimensions for A4 Standard", () => {
      const a4 = PAPER_STANDARD_METRICS.a4;
      assert.equal(a4.widthMm, 210.0);
      assert.equal(a4.heightMm, 297.0);
      assert.ok(a4.label.includes("A4"));
      assert.ok(a4.label.includes("8.27"));
      assert.ok(a4.label.includes("11.69"));
    });

    it("preserves exact millimeter dimensions for Long Bond / Folio", () => {
      const long = PAPER_STANDARD_METRICS.long;
      assert.equal(long.widthMm, 215.9);
      assert.equal(long.heightMm, 330.2);
      assert.ok(long.label.includes("Long Bond"));
      assert.ok(long.label.includes("8.5"));
      assert.ok(long.label.includes("13"));
    });
  });

  describe("2. API Client Payload Serialization (analyzeImage)", () => {
    it("dispatches calibration_mode: 'standard' and omits paper_standard when options are omitted", async () => {
      let interceptedFormData: FormData | null = null;

      globalThis.fetch = async (_input, init) => {
        interceptedFormData = init?.body as FormData;
        return new Response(JSON.stringify(createSuccessAnalysisPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const file = makeMockFile("room.jpg", "image/jpeg");
      const session = await analyzeImage(file);

      assert.ok(interceptedFormData, "fetch must receive FormData body");
      const fd1 = interceptedFormData as unknown as FormData;
      assert.equal(fd1.get("calibration_mode"), "standard");
      assert.equal(fd1.get("paper_standard"), null);
      assert.equal(session.sessionId, "test-session-123");
    });

    it("dispatches calibration_mode: 'paper_fiducial' and paper_standard: 'a4' when specified", async () => {
      let interceptedFormData: FormData | null = null;

      globalThis.fetch = async (_input, init) => {
        interceptedFormData = init?.body as FormData;
        return new Response(JSON.stringify(createSuccessAnalysisPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const file = makeMockFile("wall.png", "image/png");
      const options: CalibrationIntakeOptions = {
        mode: "paper_fiducial",
        paperStandard: "a4",
      };
      const session = await analyzeImage(file, options);

      assert.ok(interceptedFormData);
      const fd2 = interceptedFormData as unknown as FormData;
      assert.equal(fd2.get("calibration_mode"), "paper_fiducial");
      assert.equal(fd2.get("paper_standard"), "a4");
      assert.equal(session.calibrationMeta?.mode, "paper_fiducial");
      assert.equal(session.calibrationMeta?.paperStandard, "a4");
    });

    it("dispatches calibration_mode: 'paper_fiducial' and paper_standard: 'long' when specified", async () => {
      let interceptedFormData: FormData | null = null;

      globalThis.fetch = async (_input, init) => {
        interceptedFormData = init?.body as FormData;
        return new Response(JSON.stringify(createSuccessAnalysisPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const file = makeMockFile("wall.png", "image/png");
      const options: CalibrationIntakeOptions = {
        mode: "paper_fiducial",
        paperStandard: "long",
      };
      await analyzeImage(file, options);

      assert.ok(interceptedFormData);
      const fd3 = interceptedFormData as unknown as FormData;
      assert.equal(fd3.get("calibration_mode"), "paper_fiducial");
      assert.equal(fd3.get("paper_standard"), "long");
    });

    it("never dispatches paper_standard when mode is 'standard', even if paperStandard is present", async () => {
      let interceptedFormData: FormData | null = null;

      globalThis.fetch = async (_input, init) => {
        interceptedFormData = init?.body as FormData;
        return new Response(JSON.stringify(createSuccessAnalysisPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const file = makeMockFile("standard_room.jpg", "image/jpeg");
      const options: CalibrationIntakeOptions = {
        mode: "standard",
        paperStandard: "short",
      };
      await analyzeImage(file, options);

      assert.ok(interceptedFormData);
      const fd4 = interceptedFormData as unknown as FormData;
      assert.equal(fd4.get("calibration_mode"), "standard");
      assert.equal(fd4.get("paper_standard"), null);
    });

    it("parses backend-returned calibration_meta cleanly", async () => {
      const payloadWithMeta = {
        ...createSuccessAnalysisPayload(),
        calibration_meta: {
          mode: "paper_fiducial",
          paper_standard: "short",
          status: "calibrated",
          confidence: 0.98,
        },
        paper_calibration: {
          status: "detected",
          paper_standard: "short",
          detected_corners: [
            [100, 100],
            [200, 100],
            [200, 230],
            [100, 230],
          ],
          scale_cm_per_px: 0.125,
          confidence: 0.98,
          homography_matrix: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        },
      };

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(payloadWithMeta), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const file = makeMockFile("room.jpg", "image/jpeg");
      const session = await analyzeImage(file, { mode: "paper_fiducial", paperStandard: "short" });

      assert.equal(session.calibrationMeta?.mode, "paper_fiducial");
      assert.equal(session.calibrationMeta?.paperStandard, "short");
      assert.equal(session.calibrationMeta?.status, "calibrated");
      assert.equal(session.calibrationMeta?.confidence, 0.98);
      assert.equal(session.paperCalibration?.status, "detected");
      assert.equal(session.paperCalibration?.scale_cm_per_px, 0.125);
      assert.equal(session.paperCalibration?.homography_matrix?.length, 3);
    });
  });

  describe("3. Paper Standard Stepper & Keyboard Navigation Helper", () => {
    it("cycles forward: short -> a4 -> long -> short", () => {
      assert.equal(getNextPaperStandard("short", "next"), "a4");
      assert.equal(getNextPaperStandard("a4", "next"), "long");
      assert.equal(getNextPaperStandard("long", "next"), "short");
    });

    it("cycles backward: short -> long -> a4 -> short", () => {
      assert.equal(getNextPaperStandard("short", "prev"), "long");
      assert.equal(getNextPaperStandard("long", "prev"), "a4");
      assert.equal(getNextPaperStandard("a4", "prev"), "short");
    });

    it("defaults to short on unknown input", () => {
      // @ts-expect-error Testing fallback for unknown value
      assert.equal(getNextPaperStandard("unknown", "next"), "short");
    });
  });

  describe("4. Component Structure and Accessibility Contracts", () => {
    it("verifies CalibrationModeSelector template accessibility and tokens", () => {
      const src = readFileSync(
        "src/features/visualization/components/CalibrationModeSelector.tsx",
        "utf8",
      );

      assert.ok(src.includes('role="radiogroup"'));
      assert.ok(src.includes('role="radio"'));
      assert.ok(src.includes("aria-checked="));
      assert.ok(src.includes("Standard (Fast)"));
      assert.ok(src.includes("Recommended for Quotation"));
      assert.ok(src.includes("Ballpark Sizing (~75% - 85%)"));
      assert.ok(src.includes("High Precision (±2% - 5%)"));
      assert.ok(src.includes("Short Bond / Letter"));
      assert.ok(src.includes("A4 Standard"));
      assert.ok(src.includes("Long Bond / Folio"));
      assert.ok(src.includes("min-h-[148px]"));
      assert.ok(src.includes("min-h-[56px]"));
      assert.ok(src.includes("rounded-[20px]"));
      assert.ok(src.includes("rounded-[16px]"));
      assert.ok(src.includes("border-cyan-500"));
    });

    it("verifies GuideLine dynamic swapping for fiducial paper guidance", () => {
      const src = readFileSync(
        "src/features/visualization/components/GuideLine.tsx",
        "utf8",
      );

      assert.ok(src.includes("fiducialGuidelines"));
      assert.ok(src.includes("Tape Flat on Target Wall"));
      assert.ok(src.includes("All 4 Corners Clear"));
      assert.ok(src.includes("Do Not Place on Side Walls or Floor"));
      assert.ok(src.includes("Ensure Paper Lies Completely Flat"));
      assert.ok(src.includes("/guideline_assets/paper_same_wall.png"));
      assert.ok(src.includes("/guideline_assets/paper_corners_visible.png"));
      assert.ok(src.includes("/guideline_assets/paper_wrong_wall.png"));
      assert.ok(src.includes("/guideline_assets/paper_flat.png"));
      assert.ok(src.includes("Precision Calibration Guidelines"));
    });

    it("verifies ProductAwareUploadPage integrates CalibrationModeSelector cleanly", () => {
      const src = readFileSync(
        "src/features/visualization/components/ProductAwareUploadPage.tsx",
        "utf8",
      );

      assert.ok(src.includes("CalibrationModeSelector"));
      assert.ok(src.includes("calibrationMode"));
      assert.ok(src.includes("paperStandard"));
      assert.ok(src.includes("analyzeImage(file, {"));
      assert.ok(src.includes("mode: calibrationMode"));
      assert.ok(src.includes("mode={calibrationMode}"));
    });

    it("verifies DirectVisualizationPage integrates CalibrationModeSelector cleanly", () => {
      const src = readFileSync(
        "src/features/visualization/components/DirectVisualizationPage.tsx",
        "utf8",
      );

      assert.ok(src.includes("CalibrationModeSelector"));
      assert.ok(src.includes("calibrationMode"));
      assert.ok(src.includes("paperStandard"));
      assert.ok(src.includes("analyzeImage(file, {"));
      assert.ok(src.includes("mode: calibrationMode"));
      assert.ok(src.includes("mode={calibrationMode}"));
    });
  });
});
