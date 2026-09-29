/** fix-11 coverage. Traceability: PRD-F3, PRD-F4, SDD-C2, SDD-C3, QAD-TC3, QAD-TC4. */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getImageApiBaseUrl, resolveImageApiUrl } from "../../src/lib/imageApi.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalImageApiUrl = process.env.NEXT_PUBLIC_IMAGE_API_URL;
const mutableEnvironment = process.env as Record<string, string | undefined>;

afterEach(() => {
  mutableEnvironment.NODE_ENV = originalNodeEnv;
  if (originalImageApiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_IMAGE_API_URL;
  } else {
    process.env.NEXT_PUBLIC_IMAGE_API_URL = originalImageApiUrl;
  }
});

describe("fix-11 image API origin", () => {
  it("uses localhost when development has no configured origin", () => {
    mutableEnvironment.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_IMAGE_API_URL;
    assert.equal(getImageApiBaseUrl(), "http://localhost:8000");
  });

  it("normalizes trailing slashes from the configured origin", () => {
    mutableEnvironment.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_IMAGE_API_URL = "https://glassfit-cv.onrender.com///";
    assert.equal(getImageApiBaseUrl(), "https://glassfit-cv.onrender.com");
  });

  it("rejects missing and insecure production origins", () => {
    mutableEnvironment.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_IMAGE_API_URL;
    assert.throws(() => getImageApiBaseUrl(), /must be configured/);

    process.env.NEXT_PUBLIC_IMAGE_API_URL = "http://glassfit-cv.onrender.com";
    assert.throws(() => getImageApiBaseUrl(), /must use HTTPS/);
  });

  it("resolves relative artifacts and preserves absolute artifact URLs", () => {
    const origin = "https://glassfit-cv.onrender.com/";
    assert.equal(
      resolveImageApiUrl("/generated/sessions/abc/workspace.webp", origin),
      "https://glassfit-cv.onrender.com/generated/sessions/abc/workspace.webp",
    );
    assert.equal(
      resolveImageApiUrl("https://cdn.example.com/mask.png", origin),
      "https://cdn.example.com/mask.png",
    );
  });
});
