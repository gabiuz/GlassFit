import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  ACCEPTED_IMAGE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  isHeicFile,
  validateImageDecode,
  validateImageFile,
} from "../../src/lib/imageApi.js";

function makeFile(name: string, type: string, size = 100): File {
  return { name, type, size } as File;
}

const originalUrl = globalThis.URL;
const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "URL", { configurable: true, value: originalUrl });
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
});

describe("IMP-MS35 image format validation", () => {
  it("accepts every approved MIME and extension pair", () => {
    const approved = [
      ["room.jpg", "image/jpeg"],
      ["room.jpeg", "image/jpeg"],
      ["room.png", "image/png"],
      ["room.webp", "image/webp"],
      ["room.heic", "image/heic"],
      ["room.heif", "image/heif"],
    ] as const;

    for (const [name, type] of approved) {
      assert.equal(validateImageFile(makeFile(name, type)), null);
    }
    assert.deepEqual(ACCEPTED_IMAGE_EXTENSIONS, [
      ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
    ]);
  });

  it("allows generic MIME values only with an approved extension", () => {
    assert.equal(validateImageFile(makeFile("room.heic", "")), null);
    assert.equal(validateImageFile(makeFile("room.webp", "application/octet-stream")), null);
    assert.equal(
      validateImageFile(makeFile("room.pdf", "application/octet-stream")),
      "Upload a JPG, PNG, WebP, or HEIC/HEIF image.",
    );
  });

  it("rejects MIME conflicts, unsupported formats, and oversized files", () => {
    assert.equal(
      validateImageFile(makeFile("room.webp", "image/png")),
      "The file type and filename extension do not match.",
    );
    assert.equal(
      validateImageFile(makeFile("room.gif", "image/gif")),
      "The file type and filename extension do not match.",
    );
    assert.equal(
      validateImageFile(makeFile("room.png", "image/png", MAX_UPLOAD_BYTES + 1)),
      "Upload an image smaller than 12 MB.",
    );
  });

  it("identifies HEIC and HEIF by MIME or extension", () => {
    assert.equal(isHeicFile(makeFile("room.bin", "image/heic")), true);
    assert.equal(isHeicFile(makeFile("ROOM.HEIF", "")), true);
    assert.equal(isHeicFile(makeFile("room.webp", "image/webp")), false);
  });

  it("returns image mode after a successful browser decode", async () => {
    installImageDecodeMock(true, 1200, 800);
    assert.equal(await validateImageDecode(makeFile("room.webp", "image/webp")), "image");
  });

  it("returns file-card mode when the browser cannot decode HEIC", async () => {
    installImageDecodeMock(false);
    assert.equal(await validateImageDecode(makeFile("room.heic", "image/heic")), "file-card");
  });

  it("rejects corrupt browser-decodable images", async () => {
    installImageDecodeMock(false);
    await assert.rejects(
      validateImageDecode(makeFile("room.webp", "image/webp")),
      /could not be decoded/,
    );
  });
});

function installImageDecodeMock(succeeds: boolean, width = 0, height = 0): void {
  class MockImage {
    naturalWidth = width;
    naturalHeight = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => succeeds ? this.onload?.() : this.onerror?.());
    }
  }

  Object.defineProperty(globalThis, "URL", {
    configurable: true,
    value: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => undefined,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { Image: MockImage },
  });
}
