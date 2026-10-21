import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  analyzeImage,
  type UploadProgressStage,
} from "../../src/lib/imageApi";
import { requestClickGuidedPaperDetection } from "../../src/lib/visualization/paperReference";

function makeDummyFile(name: string, type: string, size = 1024): File {
  return {
    name,
    type,
    size,
    slice: () => new Blob(),
  } as unknown as File;
}

const originalFetch = globalThis.fetch;
const originalUrl = globalThis.URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "URL", { configurable: true, value: originalUrl });
});

describe("IMP-MS63 / QAD-TC78: Resilient HEIC ingestion and session-bound paper snapping", () => {
  it("QAD-TC78.1: auto-retries transient network failures with exponential backoff and succeeds on attempt 3", async () => {
    let callCount = 0;
    const progressLog: Array<{ stage: UploadProgressStage; attempt?: number }> = [];

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("analyze-image")) {
        callCount++;
        if (callCount < 3) {
          throw new TypeError("Failed to fetch");
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            session_id: "resilient-session-123",
            workspace_image: { url: "/generated/sessions/123/workspace.webp", width: 1920, height: 1080 },
            brightness: { mean_pixel_intensity: 130, category: "normal" },
            lighting: { mean_rgb: [120, 120, 120], ambient_rgb: [120, 120, 120], ambient_hex: "#787878" },
            objects: [],
            segmentation: { mode: "none", model: null },
            scale_estimation: { method: "none", anchors: [], confidence: 0 },
            paper_calibration: { status: "not_requested", detected_corners: null, candidates: [] },
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        blob: async () => new Blob(["webp-data"], { type: "image/webp" }),
      } as unknown as Response;
    };

    const dummyFile = makeDummyFile("photo.heic", "image/heic");
    const session = await analyzeImage(dummyFile, {
      mode: "auto_detect",
      maxRetries: 3,
      initialDelayMs: 5,
      onProgress: (stage, attempt) => {
        progressLog.push({ stage, attempt });
      },
    });

    assert.equal(callCount, 3);
    assert.equal(session.sessionId, "resilient-session-123");
    assert.equal(session.workspaceImage.width, 1920);

    const stages = progressLog.map((p) => p.stage);
    assert.ok(stages.includes("uploading"));
    assert.ok(stages.includes("retrying"));
    assert.ok(stages.includes("processing"));
    assert.ok(stages.includes("completed"));

    const retryEntries = progressLog.filter((p) => p.stage === "retrying");
    assert.equal(retryEntries.length, 2);
    assert.equal(retryEntries[0].attempt, 1);
    assert.equal(retryEntries[1].attempt, 2);
  });

  it("QAD-TC78.1: throws user-friendly network error when max retries are exhausted", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      throw new TypeError("Failed to fetch");
    };

    const dummyFile = makeDummyFile("room.heic", "image/heic");
    await assert.rejects(
      analyzeImage(dummyFile, { mode: "auto_detect", maxRetries: 3, initialDelayMs: 2 }),
      /Network connection unstable/,
    );
    assert.equal(callCount, 3);
  });

  it("QAD-TC78.1: fails immediately without retrying on 4xx client errors (HTTP 400)", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 400,
        json: async () => ({ detail: "Upload an image smaller than 12 MB." }),
      } as unknown as Response;
    };

    const dummyFile = makeDummyFile("oversized.heic", "image/heic");
    await assert.rejects(
      analyzeImage(dummyFile, { mode: "auto_detect", maxRetries: 3, initialDelayMs: 2 }),
      /Upload an image smaller than 12 MB/,
    );
    assert.equal(callCount, 1);
  });

  it("QAD-TC78.4: dispatches lightweight session-bound /snap-paper call with zero file re-upload", async () => {
    let snapCalled = false;
    let analyzeCalled = false;
    let interceptedSessionId = "";
    let interceptedSeedX = "";
    let interceptedSeedY = "";

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes("snap-paper")) {
        snapCalled = true;
        const body = init?.body as FormData;
        interceptedSessionId = String(body.get("session_id"));
        interceptedSeedX = String(body.get("seed_x"));
        interceptedSeedY = String(body.get("seed_y"));

        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "detected",
            paper_standard: "a4",
            detected_corners: [[10, 10], [100, 10], [100, 120], [10, 120]],
            detection_outcome: "candidate_found",
            candidates: [
              {
                id: "candidate-1",
                corners: [[10, 10], [100, 10], [100, 120], [10, 120]],
                score: 0.95,
                score_components: {},
                rejection_reasons: [],
              },
            ],
            selected_candidate_id: "candidate-1",
            reference_source: "click_guided",
          }),
        } as unknown as Response;
      }

      if (urlStr.includes("analyze-image")) {
        analyzeCalled = true;
      }

      return {
        ok: false,
        status: 500,
      } as unknown as Response;
    };

    const result = await requestClickGuidedPaperDetection(
      "session-abc-456",
      { x: 0.35, y: 0.42 },
      "a4",
    );

    assert.equal(snapCalled, true);
    assert.equal(analyzeCalled, false);
    assert.equal(interceptedSessionId, "session-abc-456");
    assert.equal(interceptedSeedX, "0.35");
    assert.equal(interceptedSeedY, "0.42");
    assert.equal(result.outcome, "candidate_found");
    assert.notEqual(result.candidate, null);
    assert.equal(result.candidate?.id, "candidate-1");
  });

  it("QAD-TC78.5: buffers localBlobUrl when createObjectURL is supported", async () => {
    let mockBlobUrl = "";
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: {
        ...originalUrl,
        createObjectURL: (blob: unknown) => {
          mockBlobUrl = `blob:http://localhost:3000/mock-${blob instanceof Blob ? "blob" : "file"}`;
          return mockBlobUrl;
        },
        revokeObjectURL: () => {},
      },
    });

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("analyze-image")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            session_id: "session-blob-test",
            workspace_image: { url: "http://localhost:8000/generated/sessions/1/workspace.webp", width: 1920, height: 1080 },
            brightness: { mean_pixel_intensity: 120, category: "normal" },
            lighting: { mean_rgb: [100, 100, 100], ambient_rgb: [100, 100, 100], ambient_hex: "#646464" },
            objects: [],
            segmentation: { mode: "none", model: null },
            paper_calibration: { status: "not_requested", detected_corners: null, candidates: [] },
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        blob: async () => new Blob(["webp-bytes"], { type: "image/webp" }),
      } as unknown as Response;
    };

    const dummyFile = makeDummyFile("photo.jpg", "image/jpeg");
    const session = await analyzeImage(dummyFile);
    assert.ok(session.localBlobUrl);
    assert.match(session.localBlobUrl, /^blob:/);
  });
});
