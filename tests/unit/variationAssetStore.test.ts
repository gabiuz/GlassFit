/** fix10 coverage. Traceability: PRD-F9, SDD-C6, QAD-TC28. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createVariationAssetStore,
  type VariationAssetRecord,
} from "../../src/lib/visualization/variationAssetStore.js";

describe("QAD-TC28 variation binary asset store", () => {
  it("round-trips blobs through the deterministic memory fallback", async () => {
    const store = createVariationAssetStore({ indexedDB: null, maxMemoryBytes: 1024 });
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const record: VariationAssetRecord = {
      cacheKey: "session:overlay:white:fingerprint",
      assetSessionId: "session",
      overlayId: "overlay",
      finish: "white",
      fingerprint: "fingerprint",
      width: 10,
      height: 20,
      mimeType: "image/png",
      blob,
      createdAt: 10,
      lastAccessedAt: 10,
      priority: "visible",
    };

    const ref = await store.put(record);
    const restored = await store.get(ref);
    assert.equal(ref.byteLength, 4);
    assert.equal(restored?.type, "image/png");
    assert.deepEqual(new Uint8Array(await restored!.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));

    await store.removeSession("session");
    assert.equal(await store.get(ref), null);
  });

  it("evicts idle memory assets before protected visible assets", async () => {
    const store = createVariationAssetStore({ indexedDB: null, maxMemoryBytes: 6 });
    const make = (cacheKey: string, priority: "idle" | "visible"): VariationAssetRecord => ({
      cacheKey,
      assetSessionId: "session",
      overlayId: "overlay",
      finish: "white",
      fingerprint: cacheKey,
      width: 1,
      height: 1,
      mimeType: "image/png",
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
      createdAt: cacheKey === "idle" ? 1 : 2,
      lastAccessedAt: cacheKey === "idle" ? 1 : 2,
      priority,
    });
    const idleRef = await store.put(make("idle", "idle"));
    const visibleRef = await store.put(make("visible", "visible"));

    assert.equal(await store.get(idleRef), null);
    assert.ok(await store.get(visibleRef));
  });
});
