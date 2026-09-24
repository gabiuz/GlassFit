/** PRD-F6, SDD-C5, QAD-TC6 coverage for drag-selection geometry. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rectangleToQuadrilateral } from "../../src/lib/visualization/perspectiveSelection";
import {
  denormalizeCorners,
  isValidQuadrilateral,
  normalizeCorners,
} from "../../src/lib/visualization/perspectiveTransform";

const expected = [
  { x: 10, y: 20 },
  { x: 110, y: 20 },
  { x: 110, y: 80 },
  { x: 10, y: 80 },
] as const;

describe("MS-02 drag selection geometry", () => {
  it("orders top-left to bottom-right drags as TL, TR, BR, BL", () => {
    assert.deepEqual(rectangleToQuadrilateral({ x: 10, y: 20 }, { x: 110, y: 80 }), expected);
  });

  it("normalizes bottom-right to top-left drags", () => {
    assert.deepEqual(rectangleToQuadrilateral({ x: 110, y: 80 }, { x: 10, y: 20 }), expected);
  });

  it("normalizes top-right to bottom-left drags", () => {
    assert.deepEqual(rectangleToQuadrilateral({ x: 110, y: 20 }, { x: 10, y: 80 }), expected);
  });

  it("normalizes bottom-left to top-right drags", () => {
    assert.deepEqual(rectangleToQuadrilateral({ x: 10, y: 80 }, { x: 110, y: 20 }), expected);
  });

  it("preserves freeform proportions without an aspect-ratio constraint", () => {
    const corners = rectangleToQuadrilateral({ x: 5, y: 10 }, { x: 305, y: 60 });
    assert.equal(corners[1].x - corners[0].x, 300);
    assert.equal(corners[3].y - corners[0].y, 50);
  });

  it("preserves boundary coordinates", () => {
    assert.deepEqual(
      rectangleToQuadrilateral({ x: 800, y: 600 }, { x: 0, y: 0 }),
      [
        { x: 0, y: 0 },
        { x: 800, y: 0 },
        { x: 800, y: 600 },
        { x: 0, y: 600 },
      ],
    );
  });

  it("produces valid geometry that round-trips through normalized storage", () => {
    const corners = rectangleToQuadrilateral({ x: 50, y: 25 }, { x: 750, y: 575 });
    assert.equal(isValidQuadrilateral(corners), true);
    assert.deepEqual(
      denormalizeCorners(normalizeCorners(corners, 800, 600), 800, 600),
      corners,
    );
  });
});
