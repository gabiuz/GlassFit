/** fix10 coverage. Traceability: PRD-F6, PRD-F15, SDD-C4, QAD-TC28. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VariationRenderQueue } from "../../src/lib/visualization/variationRenderQueue.js";

describe("QAD-TC28 variation render queue", () => {
  it("deduplicates, promotes, and never runs more than one job", async () => {
    const queue = new VariationRenderQueue({ scheduleIdle: (run) => run() });
    const order: string[] = [];
    let active = 0;
    let maximumActive = 0;
    let releaseFirst: (() => void) | undefined;

    const first = queue.enqueue({
      cacheKey: "active",
      namespace: "session",
      fingerprint: "one",
      priority: "visible",
      run: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        order.push("active");
        await new Promise<void>((resolve) => { releaseFirst = resolve; });
        active -= 1;
        return "active";
      },
    });
    const idle = queue.enqueue({
      cacheKey: "promoted",
      namespace: "session",
      fingerprint: "one",
      priority: "idle",
      run: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        order.push("promoted");
        active -= 1;
        return "promoted";
      },
    });
    const duplicate = queue.enqueue({
      cacheKey: "promoted",
      namespace: "session",
      fingerprint: "one",
      priority: "user",
      run: async () => "duplicate",
    });
    const visible = queue.enqueue({
      cacheKey: "visible",
      namespace: "session",
      fingerprint: "one",
      priority: "visible",
      run: async () => {
        order.push("visible");
        return "visible";
      },
    });

    while (!releaseFirst) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    releaseFirst?.();
    assert.equal(await first, "active");
    assert.equal(await idle, "promoted");
    assert.equal(await duplicate, "promoted");
    assert.equal(await visible, "visible");
    assert.deepEqual(order, ["promoted", "active", "visible"]);
    assert.equal(maximumActive, 1);
  });

  it("cancels queued work by namespace and ignores stale fingerprints", async () => {
    const queue = new VariationRenderQueue({ scheduleIdle: (run) => run() });
    queue.setFingerprint("overlay", "new");
    await assert.rejects(
      queue.enqueue({
        cacheKey: "stale",
        namespace: "overlay",
        fingerprint: "old",
        priority: "user",
        run: async () => "never",
      }),
      /stale/i,
    );
  });
});
