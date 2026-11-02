import assert from "node:assert/strict";
import { afterEach, it } from "node:test";

import { analyzeImage, SpacePhotoError } from "../../src/lib/imageApi.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

for (const [status, code] of [
  [422, "SPACE_PHOTO_REJECTED"],
  [422, "SPACE_PHOTO_TOO_CLOSE"],
  [503, "SPACE_PHOTO_UNVERIFIABLE"],
] as const) {
  it(`surfaces ${code} without retrying`, async () => {
    let requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      return new Response(JSON.stringify({ detail: { code, message: "Choose a suitable room photo." } }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    };

    await assert.rejects(
      analyzeImage({ name: "photo.png", type: "image/png" } as File, { mode: "auto_detect", maxRetries: 3, initialDelayMs: 1 }),
      (error: unknown) => error instanceof SpacePhotoError && error.code === code && error.message === "Choose a suitable room photo.",
    );
    assert.equal(requests, 1);
  });
}
