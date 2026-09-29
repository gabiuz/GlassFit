/** fix10 coverage. Traceability: SDD-C6, QAD-TC28. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VariationAssetRegistry } from "../../src/lib/visualization/variationAssetRegistry.js";

describe("QAD-TC28 object URL ownership", () => {
  it("reuses a URL and revokes it when the final owner releases it", () => {
    const revoked: string[] = [];
    let creations = 0;
    const registry = new VariationAssetRegistry({
      createObjectURL: () => `blob:test-${++creations}`,
      revokeObjectURL: (url) => revoked.push(url),
    });
    const blob = new Blob(["asset"], { type: "image/png" });

    const first = registry.acquire("key", blob);
    const second = registry.acquire("key", blob);
    assert.equal(first, second);
    registry.release("key");
    assert.deepEqual(revoked, []);
    registry.release("key");
    assert.deepEqual(revoked, [first]);
  });
});
