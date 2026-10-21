import { skipPaperReference } from "../../src/lib/visualization/paperReference.js";
import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { analyzeImage, normalizeNonPaperSession } from "../../src/lib/imageApi.js";
import { initialState, readStoredVisualizationSession, transitionSessionState, SESSION_STORAGE_KEY } from "../../src/lib/visualization/visualizationSession.js";
import type { CalibrationMode } from "../../src/lib/visualization/types.js";
const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
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

for (const mode of ["auto_detect", "standard", "paper_fiducial"] as const) {
  it(`QAD-TC77: request ${mode} overrides contradictory response and serializes paper fields only for paper`, async () => {
    globalThis.fetch = async (_url, init) => {
      const form = init?.body as FormData;
      assert.equal(form.get("paper_standard"), mode === "paper_fiducial" ? "a4" : null);
      assert.equal(form.get("seed_x"), mode === "paper_fiducial" ? "0.5" : null);
      return Response.json({ ...createSuccessAnalysisPayload(), calibration_meta: {
        mode: mode === "paper_fiducial" ? "standard" : "paper_fiducial",
        status: "verified_calibrated", user_verified: true, paper_standard: "a4",
        suggested_paper_standard: "long", aspect_ratio_match_confidence: 0.99,
      }, paper_calibration: { status: "detected", detected_corners: [[0,0]], candidates: [{ id: "stale" }] }});
    };
    const session = await analyzeImage(new File(["image"], "room.jpg"), { mode, paperStandard: "a4", seedPoint: { x: 0.5, y: 0.5 } });
    assert.equal(session.calibrationMeta?.mode, mode);
    assert.equal(session.calibrationMeta?.user_verified, false);
    if (mode === "paper_fiducial") assert.equal(session.calibrationMeta?.status, "manual_pin_required");
    else {
      assert.equal(session.paperCalibration, undefined);
      assert.equal(session.paper_calibration, undefined);
      assert.equal(session.calibrationMeta?.status, "heuristic_fallback");
      assert.equal(session.scaleEstimation?.method, "none");
      assert.deepEqual(normalizeNonPaperSession(session, mode), session);
    }
  });
}
it("QAD-TC77: restoration matrix preserves reviewed work and normalizes unreviewed legacy modes idempotently", async () => {
  globalThis.fetch = async () => Response.json(createSuccessAnalysisPayload());
  const base = await analyzeImage(new File(["image"], "room.jpg"));
  for (const mode of ["auto_detect", "standard", "paper_fiducial", undefined, "unknown"]) {
    for (const review of ["none", "verified", "status"] as const) {
      const reviewed = review !== "none";
      const session = { ...base, calibrationMeta: { ...base.calibrationMeta!, mode: mode as CalibrationMode, user_verified: review === "verified", status: review === "status" ? "verified_calibrated" as const : "manual_pin_required" as const } };
      let stored = JSON.stringify({ ...initialState, selectedProductId: "kept", spaceImageSession: session });
      Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: { getItem: (key: string) => key === SESSION_STORAGE_KEY ? stored : null } } });
      const restored = readStoredVisualizationSession();
      const expected = mode === "standard" ? "standard" : mode === "paper_fiducial" || reviewed ? "paper_fiducial" : "auto_detect";
      assert.equal(restored.spaceImageSession?.calibrationMeta?.mode, expected);
      assert.equal(restored.selectedProductId, "kept");
      for (const transition of ["add", "change", "edit"] as const) {
        const changed = transitionSessionState(restored, { nextProductId: "changed", mode: transition });
        assert.deepEqual(changed.spaceImageSession, restored.spaceImageSession);
      }
      stored = JSON.stringify(restored);
      assert.deepEqual(readStoredVisualizationSession(), restored);
    }
  }
});
it("QAD-TC77: legitimate signals survive; stale scale drops incidental evidence while retaining EXIF", async () => {
  globalThis.fetch = async () => Response.json(createSuccessAnalysisPayload());
  const base = await analyzeImage(new File(["image"], "room.jpg"));
  const signal = { ...base.scaleEstimation!, method: "object_anchor", best_scale_cm_per_px: 0.3, exif_device_model: "camera" };
  const normalized = normalizeNonPaperSession({ ...base, scaleEstimation: signal }, "auto_detect");
  assert.equal(normalized.scaleEstimation, signal);
  assert.equal(normalized.scale_estimation, signal);
  const stale = normalizeNonPaperSession({ ...base, scaleEstimation: { ...signal, method: "paper", reference_confirmed: true } }, "auto_detect");
  assert.equal(stale.scaleEstimation?.reference_confirmed, undefined);
  assert.equal(stale.scaleEstimation?.exif_device_model, "camera");
});

it("QAD-TC77: omitted metadata never turns automatic into paper review; paper retains manual recovery", async () => {
  globalThis.fetch = async () => Response.json(createSuccessAnalysisPayload());
  for (const mode of ["auto_detect", "paper_fiducial"] as const) {
    const session = await analyzeImage(new File(["image"], "room.jpg"), { mode });
    assert.equal(session.calibrationMeta?.mode, mode);
    assert.equal(session.calibrationMeta?.status, mode === "paper_fiducial" ? "manual_pin_required" : "heuristic_fallback");
    assert.equal(session.calibrationMeta?.user_verified, false);
  }
});
it("QAD-TC77: snake-only scales restore and camelCase takes precedence", async () => {
  globalThis.fetch = async () => Response.json(createSuccessAnalysisPayload());
  const base = await analyzeImage(new File(["image"], "room.jpg"));
  const snake = { ...base.scaleEstimation!, method: "object_anchor", best_scale_cm_per_px: 0.4 };
  const camel = { ...snake, best_scale_cm_per_px: 0.2 };
  for (const preferred of [undefined, camel]) {
    const stored = JSON.stringify({ ...initialState, spaceImageSession: { ...base, scaleEstimation: preferred, scale_estimation: snake } });
    Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: { getItem: () => stored } } });
    const session = readStoredVisualizationSession().spaceImageSession;
    assert.deepEqual(session?.scaleEstimation, preferred ?? snake);
    assert.deepEqual(session?.scaleEstimation, session?.scale_estimation);
  }
});

it("QAD-TC77: skipping paper review preserves voluntary paper recovery across reload", async () => {
  globalThis.fetch = async () => Response.json(createSuccessAnalysisPayload());
  const session = await analyzeImage(new File(["image"], "room.jpg"), { mode: "paper_fiducial" });
  const skipped = skipPaperReference(session);
  assert.equal(skipped.calibrationMeta?.mode, "paper_fiducial");
  assert.equal(skipped.calibrationMeta?.status, "heuristic_fallback");
  assert.equal(skipped.calibrationMeta?.user_verified, false);
  const stored = JSON.stringify({ ...initialState, spaceImageSession: skipped });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: { getItem: () => stored } } });
  assert.equal(readStoredVisualizationSession().spaceImageSession?.calibrationMeta?.mode, "paper_fiducial");
});
