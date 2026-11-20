import assert from "node:assert/strict";
import { afterEach, it } from "node:test";

import { analyzeImage } from "../../src/lib/imageApi.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const file = { name: "photo.png", type: "image/png", size: 1024 } as File;
const successBody = {
  session_id: "accepted-image",
  workspace_image: { url: "/generated/sessions/accepted-image/workspace.webp", width: 800, height: 600 },
  brightness: { mean_pixel_intensity: 120, category: "normal" },
  lighting: { mean_rgb: [120, 120, 120], ambient_rgb: [120, 120, 120], ambient_hex: "#787878" },
  objects: [],
  segmentation: { mode: "none", model: null },
  scene: { mode: "unavailable" },
  scale_estimation: { method: "none", anchors: [], confidence: 0 },
  paper_calibration: { status: "not_requested", detected_corners: null, candidates: [] },
};

it("surfaces a technical 422 without retrying", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ detail: "Uploaded image could not be decoded." }, { status: 422 });
  };

  await assert.rejects(analyzeImage(file, { mode: "auto_detect", maxRetries: 3, initialDelayMs: 1 }), /could not be decoded/);
  assert.equal(requests, 1);
});

it("retries a transient 503 and accepts a session without scene detections", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return requests === 1
      ? Response.json({ detail: "Service unavailable." }, { status: 503 })
      : Response.json(successBody);
  };

  const session = await analyzeImage(file, { mode: "auto_detect", maxRetries: 2, initialDelayMs: 1 });
  assert.equal(requests, 2);
  assert.equal(session.sessionId, "accepted-image");
  assert.ok(session.workspaceImage.url.endsWith("/workspace.webp"));
  assert.deepEqual(session.objects, []);
});

it("stops retrying after a persistent 503", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ detail: "Service unavailable." }, { status: 503 });
  };

  await assert.rejects(analyzeImage(file, { mode: "auto_detect", maxRetries: 2, initialDelayMs: 1 }), /Network connection unstable/);
  assert.equal(requests, 2);
});

it("cancels before sending an aborted request", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json(successBody);
  };
  const controller = new AbortController();
  controller.abort(new Error("Canceled"));
  await assert.rejects(analyzeImage(file, { mode: "auto_detect", maxRetries: 2 }, controller.signal), /Canceled/);
  assert.equal(requests, 0);
});
