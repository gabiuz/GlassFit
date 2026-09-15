import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeHomographyMatrix,
  homographyToCssMatrix3d,
  isValidQuadrilateral,
  estimateDimensionsFromCorners,
  normalizeCorners,
  denormalizeCorners,
} from "../../src/lib/visualization/perspectiveTransform";
import type { QuadrilateralCorners } from "../../src/lib/visualization/types";

describe("MS-02: 4-Point Perspective Plane Fitting for Window Products", () => {
  const unitSquare: QuadrilateralCorners = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  const trapezoidCorners: QuadrilateralCorners = [
    { x: 50, y: 20 },
    { x: 250, y: 40 },
    { x: 230, y: 280 },
    { x: 70, y: 260 },
  ];

  describe("Direct Linear Transform (DLT) Homography Computation", () => {
    it("computes identity homography when source and target match", () => {
      const H = computeHomographyMatrix(unitSquare, unitSquare);
      assert.ok(H !== null, "Homography should not be null");
      assert.equal(H.length, 9);

      // Identity matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]
      assert.ok(Math.abs(H[0] - 1) < 1e-4, "H[0] should be 1");
      assert.ok(Math.abs(H[1]) < 1e-4, "H[1] should be 0");
      assert.ok(Math.abs(H[2]) < 1e-4, "H[2] should be 0");
      assert.ok(Math.abs(H[3]) < 1e-4, "H[3] should be 0");
      assert.ok(Math.abs(H[4] - 1) < 1e-4, "H[4] should be 1");
      assert.ok(Math.abs(H[5]) < 1e-4, "H[5] should be 0");
      assert.ok(Math.abs(H[6]) < 1e-4, "H[6] should be 0");
      assert.ok(Math.abs(H[7]) < 1e-4, "H[7] should be 0");
      assert.equal(H[8], 1);
    });

    it("projects source corners exactly to destination trapezoid corners", () => {
      const H = computeHomographyMatrix(unitSquare, trapezoidCorners);
      assert.ok(H !== null, "Homography should not be null");

      // Verify projection of each corner
      for (let i = 0; i < 4; i++) {
        const src = unitSquare[i];
        const dst = trapezoidCorners[i];

        const w = H[6] * src.x + H[7] * src.y + H[8];
        const projX = (H[0] * src.x + H[1] * src.y + H[2]) / w;
        const projY = (H[3] * src.x + H[4] * src.y + H[5]) / w;

        assert.ok(
          Math.abs(projX - dst.x) < 1e-3,
          `Corner ${i} X projection mismatch: expected ${dst.x}, got ${projX}`,
        );
        assert.ok(
          Math.abs(projY - dst.y) < 1e-3,
          `Corner ${i} Y projection mismatch: expected ${dst.y}, got ${projY}`,
        );
      }
    });

    it("returns null for degenerate or collinear points", () => {
      const collinear: QuadrilateralCorners = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 100 },
        { x: 150, y: 150 },
      ];
      const H = computeHomographyMatrix(unitSquare, collinear);
      assert.equal(H, null, "Should return null for collinear destination points");
    });
  });

  describe("CSS matrix3d Conversion", () => {
    it("generates a valid CSS matrix3d transform string", () => {
      const css = homographyToCssMatrix3d(trapezoidCorners, 100, 100);
      assert.ok(css.startsWith("matrix3d("), "Must start with matrix3d(");
      assert.ok(css.endsWith(")"), "Must end with )");

      const params = css.slice(9, -1).split(",").map((s) => Number(s.trim()));
      assert.equal(params.length, 16, "matrix3d must have exactly 16 values");

      // Check column 3 (Z axis) identity values: m31=0, m32=0, m33=1, m34=0
      assert.equal(params[8], 0);
      assert.equal(params[9], 0);
      assert.equal(params[10], 1);
      assert.equal(params[11], 0);

      // Check m43=0, m44=1
      assert.equal(params[14], 0);
      assert.equal(params[15], 1);
    });

    it("returns 'none' when element dimensions are zero or negative", () => {
      assert.equal(homographyToCssMatrix3d(trapezoidCorners, 0, 100), "none");
      assert.equal(homographyToCssMatrix3d(trapezoidCorners, 100, -5), "none");
    });

    it("maps tight sub-rectangle model bounds to destination corners when srcBounds is provided", () => {
      const srcBounds = { left: 0.25, top: 0.25, width: 0.5, height: 0.5 };
      const css = homographyToCssMatrix3d(trapezoidCorners, 200, 200, srcBounds);
      assert.ok(css.startsWith("matrix3d("), "Must generate matrix3d string");

      const params = css.slice(9, -1).split(",").map((s) => Number(s.trim()));
      assert.equal(params.length, 16);
    });
  });

  describe("Quadrilateral Convexity Validation", () => {
    it("accepts valid convex clockwise and counter-clockwise quadrilaterals", () => {
      assert.ok(isValidQuadrilateral(unitSquare), "Unit square should be valid");
      assert.ok(isValidQuadrilateral(trapezoidCorners), "Trapezoid should be valid");

      // Reversed order (counter-clockwise)
      const ccw: QuadrilateralCorners = [
        trapezoidCorners[0],
        trapezoidCorners[3],
        trapezoidCorners[2],
        trapezoidCorners[1],
      ];
      assert.ok(isValidQuadrilateral(ccw), "Counter-clockwise trapezoid should be valid");
    });

    it("rejects self-intersecting bowtie quadrilaterals", () => {
      // Swapping two opposite points creates a crossed/bowtie shape
      const bowtie: QuadrilateralCorners = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ];
      assert.equal(isValidQuadrilateral(bowtie), false, "Bowtie quadrilateral should be invalid");
    });

    it("rejects concave dart or arrowhead quadrilaterals", () => {
      // One vertex indented inward
      const concave: QuadrilateralCorners = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 30 }, // Inward reflex vertex
        { x: 0, y: 100 },
      ];
      assert.equal(isValidQuadrilateral(concave), false, "Concave quadrilateral should be invalid");
    });

    it("rejects collinear or degenerate points", () => {
      const collinear: QuadrilateralCorners = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 150, y: 0 },
      ];
      assert.equal(isValidQuadrilateral(collinear), false, "Collinear points should be invalid");
    });
  });

  describe("Corner Normalization and Denormalization", () => {
    it("normalizes and denormalizes coordinates across canvas dimensions accurately", () => {
      const canvasWidth = 800;
      const canvasHeight = 600;

      const normalized = normalizeCorners(trapezoidCorners, canvasWidth, canvasHeight);

      // Check range 0..1
      for (const pt of normalized) {
        assert.ok(pt.x >= 0 && pt.x <= 1, `Normalized x out of range: ${pt.x}`);
        assert.ok(pt.y >= 0 && pt.y <= 1, `Normalized y out of range: ${pt.y}`);
      }

      const denormalized = denormalizeCorners(normalized, canvasWidth, canvasHeight);

      // Verify round-trip matches original pixel coordinates
      for (let i = 0; i < 4; i++) {
        assert.ok(
          Math.abs(denormalized[i].x - trapezoidCorners[i].x) < 1e-4,
          `Round-trip X mismatch at index ${i}`,
        );
        assert.ok(
          Math.abs(denormalized[i].y - trapezoidCorners[i].y) < 1e-4,
          `Round-trip Y mismatch at index ${i}`,
        );
      }
    });

    it("handles zero or negative dimensions safely during normalization", () => {
      const normalized = normalizeCorners(trapezoidCorners, 0, 0);
      assert.ok(Number.isFinite(normalized[0].x));
      assert.ok(Number.isFinite(normalized[0].y));
    });
  });

  describe("Edge Dimension Proportional Estimation", () => {
    it("estimates correct average width and height for rectangular geometry", () => {
      const rect: QuadrilateralCorners = [
        { x: 10, y: 20 },
        { x: 210, y: 20 },
        { x: 210, y: 170 },
        { x: 10, y: 170 },
      ];
      const dimensions = estimateDimensionsFromCorners(rect);
      assert.equal(dimensions.widthRatio, 200, "Width ratio should equal rectangle width");
      assert.equal(dimensions.heightRatio, 150, "Height ratio should equal rectangle height");
    });
  });
});
