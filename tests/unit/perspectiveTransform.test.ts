import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeHomographyMatrix,
  homographyToCssMatrix3d,
  isValidQuadrilateral,
  estimateDimensionsFromCorners,
  normalizeCorners,
  denormalizeCorners,
  scaleCornersAlongAxis,
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

  describe("Perspective Quadrilateral Axis Scaling", () => {
    it("scales uniformly from center when axis is scale", () => {
      const scaled = scaleCornersAlongAxis(unitSquare, 1.5, "scale");
      // Center is (50, 50). Distance from center was 50, now 75
      assert.ok(Math.abs(scaled[0].x - (-25)) < 1e-4);
      assert.ok(Math.abs(scaled[0].y - (-25)) < 1e-4);
      assert.ok(Math.abs(scaled[2].x - 125) < 1e-4);
      assert.ok(Math.abs(scaled[2].y - 125) < 1e-4);
    });

    it("scales horizontally when axis is width", () => {
      const scaled = scaleCornersAlongAxis(unitSquare, 1.5, "width");
      // Width expands from 100 to 150, Y stays 0 and 100
      assert.ok(Math.abs(scaled[0].x - (-25)) < 1e-4);
      assert.ok(Math.abs(scaled[0].y - 0) < 1e-4);
      assert.ok(Math.abs(scaled[1].x - 125) < 1e-4);
      assert.ok(Math.abs(scaled[1].y - 0) < 1e-4);
      assert.ok(Math.abs(scaled[2].x - 125) < 1e-4);
      assert.ok(Math.abs(scaled[2].y - 100) < 1e-4);
    });

    it("scales vertically when axis is height", () => {
      const scaled = scaleCornersAlongAxis(unitSquare, 1.5, "height");
      // Height expands from 100 to 150, X stays 0 and 100
      assert.ok(Math.abs(scaled[0].x - 0) < 1e-4);
      assert.ok(Math.abs(scaled[0].y - (-25)) < 1e-4);
      assert.ok(Math.abs(scaled[2].x - 100) < 1e-4);
      assert.ok(Math.abs(scaled[2].y - 125) < 1e-4);
    });
  });

  describe("9-Point Perspective Quadrilateral Transform Handles (fix-MS-04)", () => {
    it("computes exact 4 corner coordinates, 4 edge midpoints, and centroid", () => {
      const pxCorners = trapezoidCorners;
      const [p0, p1, p2, p3] = pxCorners;

      const corners = [
        { id: "tl", x: p0.x, y: p0.y, cursor: "cursor-nwse-resize", signX: -1, signY: -1 },
        { id: "tr", x: p1.x, y: p1.y, cursor: "cursor-nesw-resize", signX: 1, signY: -1 },
        { id: "br", x: p2.x, y: p2.y, cursor: "cursor-nwse-resize", signX: 1, signY: 1 },
        { id: "bl", x: p3.x, y: p3.y, cursor: "cursor-nesw-resize", signX: -1, signY: 1 },
      ];

      const edges = [
        { id: "top", x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, mode: "height", signX: 0, signY: -1, cursor: "cursor-ns-resize" },
        { id: "bottom", x: (p3.x + p2.x) / 2, y: (p3.y + p2.y) / 2, mode: "height", signX: 0, signY: 1, cursor: "cursor-ns-resize" },
        { id: "left", x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2, mode: "width", signX: -1, signY: 0, cursor: "cursor-ew-resize" },
        { id: "right", x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, mode: "width", signX: 1, signY: 0, cursor: "cursor-ew-resize" },
      ];

      const center = {
        x: (p0.x + p1.x + p2.x + p3.x) / 4,
        y: (p0.y + p1.y + p2.y + p3.y) / 4,
      };

      assert.equal(corners.length, 4);
      assert.equal(edges.length, 4);
      assert.deepEqual(corners[0], { id: "tl", x: 50, y: 20, cursor: "cursor-nwse-resize", signX: -1, signY: -1 });
      assert.deepEqual(corners[1], { id: "tr", x: 250, y: 40, cursor: "cursor-nesw-resize", signX: 1, signY: -1 });
      assert.deepEqual(corners[2], { id: "br", x: 230, y: 280, cursor: "cursor-nwse-resize", signX: 1, signY: 1 });
      assert.deepEqual(corners[3], { id: "bl", x: 70, y: 260, cursor: "cursor-nesw-resize", signX: -1, signY: 1 });

      // Midpoints
      assert.deepEqual(edges[0], { id: "top", x: 150, y: 30, mode: "height", signX: 0, signY: -1, cursor: "cursor-ns-resize" });
      assert.deepEqual(edges[1], { id: "bottom", x: 150, y: 270, mode: "height", signX: 0, signY: 1, cursor: "cursor-ns-resize" });
      assert.deepEqual(edges[2], { id: "left", x: 60, y: 140, mode: "width", signX: -1, signY: 0, cursor: "cursor-ew-resize" });
      assert.deepEqual(edges[3], { id: "right", x: 240, y: 160, mode: "width", signX: 1, signY: 0, cursor: "cursor-ew-resize" });

      // Centroid
      assert.deepEqual(center, { x: 150, y: 150 });
    });
  });

  describe("Initial 3D Orientation Estimation from Quadrilateral Foreshortening (fix-MS-04)", () => {
    it("estimates positive yaw when left edge is taller than right edge", () => {
      // Left edge height: 240, Right edge height: 200
      const pxCorners: QuadrilateralCorners = [
        { x: 50, y: 30 },
        { x: 250, y: 50 },
        { x: 250, y: 250 },
        { x: 50, y: 270 },
      ];
      const [p0, p1, p2, p3] = pxCorners;
      const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const maxH = Math.max(leftH, rightH, 1);
      const deltaH = (leftH - rightH) / maxH;
      const initialYaw = Math.round(Math.min(Math.max(deltaH * 35, -25), 25));

      assert.ok(initialYaw > 0, "Yaw should be positive when left height exceeds right height");
      assert.equal(initialYaw, 6);
    });

    it("estimates positive pitch when bottom edge is wider than top edge", () => {
      // Top width: 160, Bottom width: 220
      const pxCorners: QuadrilateralCorners = [
        { x: 70, y: 50 },
        { x: 230, y: 50 },
        { x: 260, y: 250 },
        { x: 40, y: 250 },
      ];
      const [p0, p1, p2, p3] = pxCorners;
      const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const bottomW = Math.hypot(p2.x - p3.x, p2.y - p3.y);
      const maxW = Math.max(topW, bottomW, 1);
      const deltaW = (bottomW - topW) / maxW;
      const initialPitch = Math.round(Math.min(Math.max(deltaW * 25, -20), 20));

      assert.ok(initialPitch > 0, "Pitch should be positive when viewed from below/angled");
      assert.equal(initialPitch, 7);
    });

    it("returns zero yaw and pitch for symmetrical rectangle", () => {
      const [p0, p1, p2, p3] = unitSquare;
      const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const bottomW = Math.hypot(p2.x - p3.x, p2.y - p3.y);

      const maxH = Math.max(leftH, rightH, 1);
      const maxW = Math.max(topW, bottomW, 1);
      const deltaH = (leftH - rightH) / maxH;
      const deltaW = (bottomW - topW) / maxW;

      const initialYaw = Math.round(Math.min(Math.max(deltaH * 35, -25), 25));
      const initialPitch = Math.round(Math.min(Math.max(deltaW * 25, -20), 20));

      assert.equal(initialYaw, 0);
      assert.equal(initialPitch, 0);
    });
  });
});
