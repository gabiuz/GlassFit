import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const visualizationPageSource = readFileSync(
  "src/app/visualization/page.tsx",
  "utf8",
);
const workspaceSource = readFileSync(
  "src/features/visualization/components/ProductModelWorkspace.tsx",
  "utf8",
);
const productPickerSource = readFileSync(
  "src/features/visualization/components/AddProductModal.tsx",
  "utf8",
);

describe("PRD-F3/PRD-F6: direct visualization workspace entry", () => {
  it("loads the active database catalog for Add or Change Product", () => {
    assert.match(visualizationPageSource, /getActiveProducts/);
    assert.match(visualizationPageSource, /mapDatabaseProductToCatalog/);
    assert.match(visualizationPageSource, /catalogProducts=\{catalogProducts\}/);
  });

  it("starts without an active product when no product was selected", () => {
    assert.match(
      workspaceSource,
      /useState\(\s*Boolean\(currentProductId \|\| structuralDefinition\),?\s*\)/,
    );
  });

  it("preserves the measured model outline while dimensions rebuild", () => {
    const modelReloadStart = workspaceSource.indexOf(
      "mvpRendererRef.current.loadModel(",
    );
    const modelReloadEnd = workspaceSource.indexOf(
      "}, [structuralDefinition, widthCm, heightCm",
      modelReloadStart,
    );
    const modelReloadSource = workspaceSource.slice(
      modelReloadStart,
      modelReloadEnd,
    );

    assert.ok(modelReloadStart >= 0 && modelReloadEnd > modelReloadStart);
    assert.doesNotMatch(
      modelReloadSource,
      /setProjectedModelBounds\(\{ left: 0, top: 0, width: 1, height: 1 \}\)/,
    );
  });

  it("keeps complete product cards in a responsive scrollable picker", () => {
    assert.match(productPickerSource, /role="dialog"/);
    assert.match(productPickerSource, /sm:absolute/);
    assert.match(productPickerSource, /sm:top-full/);
    assert.match(productPickerSource, /auto-rows-max/);
    assert.match(productPickerSource, /grid-cols-1/);
    assert.match(productPickerSource, /min-\[420px\]:grid-cols-2/);
    assert.match(productPickerSource, /min-h-0 flex-1/);
  });

  it("anchors the picker to the Add Product or Change Product trigger", () => {
    assert.match(workspaceSource, /modalTitle === "Add Product"/);
    assert.match(workspaceSource, /modalTitle === "Change Product"/);
    assert.equal((workspaceSource.match(/<div className="relative">/g) ?? []).length >= 2, true);
  });
});
