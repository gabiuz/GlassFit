import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("MS-03: manual occlusion workspace integration", () => {
  const workspaceSource = readFileSync(
    resolve(
      process.cwd(),
      "src/features/visualization/components/ProductModelWorkspace.tsx",
    ),
    "utf8",
  );
  const pickerSource = readFileSync(
    resolve(
      process.cwd(),
      "src/features/visualization/components/ManualOcclusionPointPicker.tsx",
    ),
    "utf8",
  );
  const typesSource = readFileSync(
    resolve(process.cwd(), "src/lib/visualization/types.ts"),
    "utf8",
  );

  it("persists editable polygons alongside the raster mask", () => {
    assert.match(typesSource, /manualOcclusionPolygons\?: ManualOcclusionPolygon\[\]/);
    assert.match(
      workspaceSource,
      /initialConfiguration\?\.manualOcclusionPolygons \?\? \[\]/,
    );
    assert.match(workspaceSource, /manualOcclusionPolygons,/);
    assert.match(
      workspaceSource,
      /setManualOcclusionPolygons\(configuration\.manualOcclusionPolygons \?\? \[\]\)/,
    );
  });

  it("clears polygon geometry and its raster artifact together", () => {
    assert.match(
      workspaceSource,
      /setManualMaskDataUrl\(null\);\s+setManualOcclusionPolygons\(\[\]\);/,
    );
  });

  it("uses the point editor instead of the brush painter", () => {
    assert.match(workspaceSource, /<ManualOcclusionPointPicker/);
    assert.doesNotMatch(workspaceSource, /ManualMaskPainter/);
    assert.match(pickerSource, /Finish Region/);
    assert.match(pickerSource, /Add Region/);
    assert.match(pickerSource, /setPointerCapture/);
    assert.match(pickerSource, /Replace Legacy Mask/);
  });
});
