import assert from "node:assert";
import { describe, it } from "node:test";
import {
  denormalizeOcclusionPolygon,
  getPolygonSignedArea,
  hasSelfIntersections,
  normalizeOcclusionPolygon,
  rasterizeOcclusionPolygons,
  validateOcclusionPolygon,
} from "../../src/lib/visualization/occlusionPolygon.js";

describe("MS-03: point-based manual occlusion geometry", () => {
  it("normalizes and restores polygon points across canvas dimensions", () => {
    const points = [
      { x: 100, y: 50 },
      { x: 900, y: 50 },
      { x: 900, y: 450 },
      { x: 100, y: 450 },
    ];

    const normalized = normalizeOcclusionPolygon(points, 1000, 500);
    assert.deepStrictEqual(normalized, [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ]);
    assert.deepStrictEqual(
      denormalizeOcclusionPolygon(normalized, 2000, 1000),
      [
        { x: 200, y: 100 },
        { x: 1800, y: 100 },
        { x: 1800, y: 900 },
        { x: 200, y: 900 },
      ],
    );
  });

  it("clamps points to the image boundary", () => {
    assert.deepStrictEqual(
      normalizeOcclusionPolygon(
        [
          { x: -20, y: 250 },
          { x: 1200, y: 600 },
        ],
        1000,
        500,
      ),
      [
        { x: 0, y: 0.5 },
        { x: 1, y: 1 },
      ],
    );
  });

  it("calculates signed polygon area", () => {
    assert.strictEqual(
      getPolygonSignedArea([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
      100,
    );
  });

  it("accepts valid polygons with three or more points", () => {
    assert.deepStrictEqual(
      validateOcclusionPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ]),
      { valid: true },
    );
  });

  it("rejects incomplete, duplicate, zero-area, and non-finite polygons", () => {
    assert.strictEqual(
      validateOcclusionPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]).valid,
      false,
    );
    assert.strictEqual(
      validateOcclusionPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
      ]).valid,
      false,
    );
    assert.strictEqual(
      validateOcclusionPolygon([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ]).valid,
      false,
    );
    assert.strictEqual(
      validateOcclusionPolygon([
        { x: 0, y: 0 },
        { x: Number.NaN, y: 5 },
        { x: 10, y: 10 },
      ]).valid,
      false,
    );
  });

  it("detects a self-intersecting polygon while allowing a concave polygon", () => {
    assert.strictEqual(
      hasSelfIntersections([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ]),
      true,
    );
    assert.deepStrictEqual(
      validateOcclusionPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
      { valid: true },
    );
  });

  it("rasterizes multiple valid regions into one PNG mask", () => {
    const drawnPaths: Array<Array<{ x: number; y: number }>> = [];
    let activePath: Array<{ x: number; y: number }> = [];
    const context = {
      fillStyle: "",
      globalCompositeOperation: "source-over",
      clearRect: () => undefined,
      beginPath: () => {
        activePath = [];
      },
      moveTo: (x: number, y: number) => {
        activePath.push({ x, y });
      },
      lineTo: (x: number, y: number) => {
        activePath.push({ x, y });
      },
      closePath: () => undefined,
      fill: () => {
        drawnPaths.push(activePath);
      },
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context as unknown as CanvasRenderingContext2D,
      toDataURL: () => "data:image/png;base64,mask",
    };
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => canvas,
      } as unknown as Document,
    });

    try {
      const result = rasterizeOcclusionPolygons(
        [
          [
            { x: 0.1, y: 0.1 },
            { x: 0.4, y: 0.1 },
            { x: 0.4, y: 0.5 },
            { x: 0.1, y: 0.5 },
          ],
          [
            { x: 0.6, y: 0.2 },
            { x: 0.9, y: 0.2 },
            { x: 0.75, y: 0.8 },
          ],
        ],
        1000,
        500,
      );

      assert.strictEqual(result, "data:image/png;base64,mask");
      assert.strictEqual(canvas.width, 1000);
      assert.strictEqual(canvas.height, 500);
      assert.strictEqual(drawnPaths.length, 2);
      assert.deepStrictEqual(drawnPaths[0][0], { x: 100, y: 50 });
      assert.deepStrictEqual(drawnPaths[1][2], { x: 750, y: 400 });
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
    }
  });
});
