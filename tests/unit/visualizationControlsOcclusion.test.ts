import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("QAD-TC8: visualization controls remain above foreground occlusion", () => {
  const workspaceSource = readFileSync(
    resolve(
      process.cwd(),
      "src/features/visualization/components/ProductModelWorkspace.tsx",
    ),
    "utf8",
  );

  it("renders product, occlusion, and interactive controls in separate ordered canvas layers", () => {
    const productLayer = workspaceSource.indexOf(
      'data-visualization-layer="active-product"',
    );
    const occlusionLayer = workspaceSource.indexOf(
      'data-visualization-layer="foreground-occlusion"',
    );
    const controlsLayer = workspaceSource.indexOf(
      'data-visualization-layer="product-controls"',
    );

    assert.notStrictEqual(productLayer, -1, "Active product layer is missing");
    assert.notStrictEqual(occlusionLayer, -1, "Foreground occlusion layer is missing");
    assert.notStrictEqual(controlsLayer, -1, "Product controls layer is missing");
    assert.ok(productLayer < occlusionLayer, "Occlusion must paint above the product");
    assert.ok(occlusionLayer < controlsLayer, "Controls must paint above occlusion");
  });

  it("uses explicit z-index bands for product, occlusion, and controls", () => {
    assert.match(
      workspaceSource,
      /data-visualization-layer="active-product"[\s\S]{0,160}className="[^"]*z-20[^"]*"/,
    );
    assert.match(
      workspaceSource,
      /data-visualization-layer="foreground-occlusion"[\s\S]{0,160}className="[^"]*z-30[^"]*"/,
    );
    assert.match(
      workspaceSource,
      /data-visualization-layer="product-controls"[\s\S]{0,160}className="[^"]*z-40[^"]*"/,
    );
  });
});
