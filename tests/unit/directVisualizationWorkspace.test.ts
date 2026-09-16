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
});
