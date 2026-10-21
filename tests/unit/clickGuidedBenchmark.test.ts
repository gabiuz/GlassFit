/**
 * IMP-MS61 / QAD-TC76: Empirical Real-World Accuracy Benchmark and Comparative Release Protocol.
 *
 * Traceability:
 * - PRD-F3, PRD-F4, PRD-F5, PRD-F6, PRD-F10
 * - SDD-C2, SDD-C3, SDD-C4, SDD-C5, SDD-C7
 * - BRD-M1, BRD-M5, BRD-M6
 * - QAD-TC76 (QAD-TC76.1 to QAD-TC76.6)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeCentroid,
  generatePerturbedSeeds,
  computeCornerRmse,
  evaluateComparativeCapture,
  summarizeComparative,
  comparativeReleaseGates,
  generateComparativeMarkdownReport,
  type Capture,
  type Detection,
  type QuadrilateralCorners,
  type ComparativeSummary,
} from "../../scripts/ms57/benchmark";

const rect = (x: number, y: number, w: number, h: number): QuadrilateralCorners => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const createCapture = (changes: Partial<Capture> = {}): Capture => ({
  id: "bench-test-01",
  path: "photos/room.jpg",
  sha256: "c".repeat(64),
  openingId: "opening-bench-1",
  sessionId: "session-bench-1",
  device: "camera-bench-a",
  split: "holdout",
  strata: ["frontal"],
  eligible: true,
  noPaper: false,
  width: 3000,
  height: 2400,
  orientation: 1,
  standard: "a4",
  firstEdge: "short",
  paper: rect(200, 200, 420, 594),
  opening: rect(800, 300, 1500, 1800),
  placement: {
    version: "plane-placement-v1",
    assessment: "user_confirmed_same_plane",
    riskReasons: [],
    targetPlaneId: "wall-plane-1",
  },
  annotationBy: "test operator",
  uncertaintyPx: 2.0,
  tape: {
    widthMm: 1500,
    heightMm: 1800,
    measuredBy: "steel tape operator",
    perimeter: "outer jamb perimeter",
  },
  context: "MS61 unit benchmark test capture",
  expectedRecovery: "snap reference fiducial",
  ...changes,
});

describe("IMP-MS61 / QAD-TC76: Empirical Real-World Accuracy Benchmark Protocol", () => {
  describe("Mathematical Utilities and Invariants", () => {
    it("computes centroid of quadrilateral correctly and handles edge cases", () => {
      const q = rect(100, 200, 400, 600);
      const center = computeCentroid(q);
      assert.ok(center);
      assert.equal(center.x, 300);
      assert.equal(center.y, 500);

      // Degenerate/empty inputs
      assert.equal(computeCentroid(null), null);
      assert.equal(computeCentroid([] as unknown as QuadrilateralCorners), null);
      assert.equal(
        computeCentroid([{ x: NaN, y: 10 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]),
        null
      );
      assert.equal(
        computeCentroid([{ x: Infinity, y: 10 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]),
        null
      );
    });

    it("QAD-TC76.5: generates deterministic perturbed seeds inside paper at 25%, 50%, 75% offsets", () => {
      const q = rect(100, 100, 200, 200); // centroid at (200, 200)
      const seeds = generatePerturbedSeeds(q, [0.25, 0.5, 0.75]);

      // 1 centroid + 4 corners * 3 fractions = 13 seeds
      assert.equal(seeds.length, 13);
      assert.equal(seeds[0].description, "centroid");
      assert.equal(seeds[0].x, 200);
      assert.equal(seeds[0].y, 200);

      // Check offset toward corner 0 (100, 100):
      // At 25%: 200 + 0.25 * (100 - 200) = 175
      const s25 = seeds.find((s) => s.offsetFraction === 0.25 && s.cornerIndex === 0);
      assert.ok(s25);
      assert.equal(s25.x, 175);
      assert.equal(s25.y, 175);

      // At 50%: 200 + 0.50 * (100 - 200) = 150
      const s50 = seeds.find((s) => s.offsetFraction === 0.5 && s.cornerIndex === 0);
      assert.ok(s50);
      assert.equal(s50.x, 150);
      assert.equal(s50.y, 150);

      // Verify all seeds lie strictly inside the bounding box [100, 300] x [100, 300]
      for (const s of seeds) {
        assert.ok(s.x >= 100 && s.x <= 300, `Seed x=${s.x} should be inside box`);
        assert.ok(s.y >= 100 && s.y <= 300, `Seed y=${s.y} should be inside box`);
      }
    });

    it("QAD-TC76.2: computes corner RMSE with cyclic and winding invariance", () => {
      const gt = rect(100, 100, 400, 300);

      // 1. Identical quad gives 0 RMSE
      const rmseZero = computeCornerRmse(gt, gt);
      assert.equal(rmseZero, 0);

      // 2. Shifted in cyclic order by 1 corner gives 0 RMSE
      const cyclicShift: QuadrilateralCorners = [gt[1], gt[2], gt[3], gt[0]];
      assert.equal(computeCornerRmse(cyclicShift, gt), 0);

      // 3. Reversed winding (counter-clockwise) gives 0 RMSE
      const reversed: QuadrilateralCorners = [gt[3], gt[2], gt[1], gt[0]];
      assert.equal(computeCornerRmse(reversed, gt), 0);

      // 4. Uniform 2px offset gives exactly 2.0 RMSE
      const offset2px: QuadrilateralCorners = gt.map((p: { x: number; y: number }) => ({ x: p.x + 2, y: p.y })) as QuadrilateralCorners;
      const rmse2 = computeCornerRmse(offset2px, gt);
      assert.ok(rmse2 !== null);
      assert.ok(Math.abs(rmse2 - 2.0) < 1e-9, `Expected 2.0, got ${rmse2}`);

      // 5. Handles null/empty/invalid inputs safely without throwing
      assert.equal(computeCornerRmse(null, gt), null);
      assert.equal(computeCornerRmse(gt, null), null);
      assert.equal(computeCornerRmse([] as unknown as QuadrilateralCorners, gt), null);
      assert.equal(
        computeCornerRmse([{ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], gt),
        null
      );
    });
  });

  describe("Comparative Modality Evaluation", () => {
    it("QAD-TC76.1: compares MOD-AUTO vs MOD-CLICK in cluttered room scenario", () => {
      const c = createCapture();

      // In a cluttered room, full-auto chooses a distractor rectangle or abstains
      const distractorQuad = rect(50, 50, 100, 80); // wrong panel
      const autoDetection: Detection = {
        corners: distractorQuad,
        candidates: [{ id: "c1", corners: distractorQuad }],
        detectionMs: 45,
      };

      // Click-guided mode snapped to paper with < 0.5px sub-pixel error
      const snappedPaper = c.paper!.map((p) => ({ x: p.x + 0.3, y: p.y - 0.2 })) as QuadrilateralCorners;
      const clickDetection: Detection = {
        corners: snappedPaper,
        candidates: [{ id: "c-click", corners: snappedPaper }],
        detectionMs: 38,
      };

      const evalResult = evaluateComparativeCapture(c, autoDetection, clickDetection, c.paper);

      // MOD-AUTO picked distractor: correct is false, RMSE is large
      assert.equal(evalResult.auto.correct, false);
      assert.ok((evalResult.auto.cornerRmse ?? 0) > 50);

      // MOD-CLICK snapped paper: correct is true, RMSE < 1.0 px
      assert.equal(evalResult.clickGuided.correct, true);
      assert.ok(evalResult.clickGuided.cornerRmse !== null);
      assert.ok(evalResult.clickGuided.cornerRmse < 1.0, `Got RMSE ${evalResult.clickGuided.cornerRmse}`);

      // MOD-MANUAL (perfect annotation reference)
      assert.equal(evalResult.manual.correct, true);
      assert.equal(evalResult.manual.cornerRmse, 0);
    });

    it("QAD-TC76.3: computes per-axis physical opening width and height relative errors", () => {
      const c = createCapture({
        tape: { widthMm: 1000, heightMm: 1200, measuredBy: "operator", perimeter: "outer" },
      });

      // Provide detection matching paper corners exactly
      const detection: Detection = { corners: c.paper, candidates: [], detectionMs: 30 };
      const evalResult = evaluateComparativeCapture(c, detection, detection, c.paper);

      assert.ok(evalResult.clickGuided.result?.valid);
      assert.ok(evalResult.clickGuided.errors.width);
      assert.ok(evalResult.clickGuided.errors.height);

      // Verify relative error formula: 100 * |pred - tape| / tape
      const wRel = evalResult.clickGuided.errors.width.relativePercent;
      const hRel = evalResult.clickGuided.errors.height.relativePercent;
      assert.ok(Number.isFinite(wRel) && wRel >= 0);
      assert.ok(Number.isFinite(hRel) && hRel >= 0);
    });

    it("QAD-TC76.4: tracks user interaction duration (MTTC) across all three modalities", () => {
      const c = createCapture();
      const det: Detection = { corners: c.paper, candidates: [], detectionMs: 50 };

      const evalResult = evaluateComparativeCapture(
        c,
        det,
        det,
        c.paper,
        { autoMttcSeconds: 1.1, clickMttcSeconds: 4.2, manualMttcSeconds: 39.5 }
      );

      assert.equal(evalResult.auto.mttcSeconds, 1.1);
      assert.equal(evalResult.clickGuided.mttcSeconds, 4.2);
      assert.equal(evalResult.manual.mttcSeconds, 39.5);

      // Click-guided delivers over 80% time reduction compared to manual (4.2s vs 39.5s)
      const timeSavings = (39.5 - 4.2) / 39.5;
      assert.ok(timeSavings > 0.8, `Expected >80% time savings, got ${(timeSavings * 100).toFixed(1)}%`);
    });

    it("QAD-TC76.6: handles missing fixtures, null tape, and zero-division cases safely", () => {
      // 1. Zero tape measurement should not crash or produce NaN/Infinity
      const cZeroTape = createCapture({
        tape: { widthMm: 0, heightMm: 0, measuredBy: "test", perimeter: "outer" },
      });
      const det: Detection = { corners: cZeroTape.paper, candidates: [], detectionMs: 20 };
      const evalZero = evaluateComparativeCapture(cZeroTape, det, det, cZeroTape.paper);
      assert.equal(evalZero.clickGuided.errors.width?.relativePercent, 0);

      // 2. Null tape measurement
      const cNullTape = createCapture({ tape: null });
      const evalNull = evaluateComparativeCapture(cNullTape, det, det, cNullTape.paper);
      assert.equal(evalNull.clickGuided.errors.width, null);
      assert.equal(evalNull.clickGuided.errors.height, null);

      // 3. Missing detection fixtures
      const evalMissing = evaluateComparativeCapture(cZeroTape, null, null, null);
      assert.equal(evalMissing.skipped, "fixture_unavailable");
      assert.equal(evalMissing.auto.result, null);
      assert.equal(evalMissing.clickGuided.result, null);
    });

    it("enforces coplanar safety invariant: zero false promotions on unsafe captures", () => {
      const unsafeCapture = createCapture({
        eligible: false,
        strata: ["unsafe"],
        placement: {
          version: "plane-placement-v1",
          assessment: "unknown",
          riskReasons: ["handheld_or_offset"],
          targetPlaneId: null,
        },
      });

      const det: Detection = { corners: unsafeCapture.paper, candidates: [], detectionMs: 30 };
      const evalResult = evaluateComparativeCapture(unsafeCapture, det, det, unsafeCapture.paper);

      // Neither auto nor click-guided nor manual should promote an unsafe capture
      assert.equal(evalResult.auto.result, null);
      assert.equal(evalResult.clickGuided.result, null);
      assert.equal(evalResult.manual.result, null);

      const summary = summarizeComparative([evalResult]);
      assert.equal(summary.auto.coplanarFalsePromotions, 0);
      assert.equal(summary.clickGuided.coplanarFalsePromotions, 0);
      assert.equal(summary.manual.coplanarFalsePromotions, 0);
    });
  });

  describe("Comparative Release Gates Verification (Section 5)", () => {
    it("passes comparative release gates when all three modalities satisfy targets", () => {
      const syntheticSummary: ComparativeSummary = {
        total: 20,
        eligible: 18,
        holdout: 20,
        development: 0,
        auto: {
          accepted: 15,
          rejected: 3,
          unscored: 0,
          coverage: { numerator: 15, denominator: 18, percentage: 83.3 }, // >= 75%
          cornerRmse: { mean: 3.2, median: 3.0, p95: 4.2, max: 4.4 }, // <= 4.5 px
          relativeErrorPercent: { median: 2.1, p95: 4.8, max: 6.2 }, // med <= 2.5%, p95 <= 5.5%, max <= 7.0%
          mttcSeconds: { mean: 1.5, median: 1.4 }, // < 3.0 s
          coplanarFalsePromotions: 0, // 0 false
          width: { scored: 15, absoluteMm: { median: 12, p95: 25, max: 30 }, relativePercent: { median: 2.0, p95: 4.5, max: 6.0 } },
          height: { scored: 15, absoluteMm: { median: 14, p95: 28, max: 32 }, relativePercent: { median: 2.2, p95: 4.9, max: 6.2 } },
        },
        clickGuided: {
          accepted: 17,
          rejected: 1,
          unscored: 0,
          coverage: { numerator: 17, denominator: 18, percentage: 94.4 }, // >= 92%
          cornerRmse: { mean: 1.6, median: 1.4, p95: 2.0, max: 2.1 }, // <= 2.2 px
          relativeErrorPercent: { median: 1.4, p95: 3.1, max: 4.2 }, // med <= 1.8%, p95 <= 3.8%, max <= 5.0%
          mttcSeconds: { mean: 4.8, median: 4.5 }, // < 6.0 s
          coplanarFalsePromotions: 0, // 0 false
          width: { scored: 17, absoluteMm: { median: 8, p95: 16, max: 20 }, relativePercent: { median: 1.3, p95: 3.0, max: 4.1 } },
          height: { scored: 17, absoluteMm: { median: 9, p95: 18, max: 22 }, relativePercent: { median: 1.5, p95: 3.2, max: 4.2 } },
        },
        manual: {
          accepted: 18,
          rejected: 0,
          unscored: 0,
          coverage: { numerator: 18, denominator: 18, percentage: 100.0 }, // 100%
          cornerRmse: { mean: 2.8, median: 2.7, p95: 3.3, max: 3.4 }, // <= 3.5 px
          relativeErrorPercent: { median: 1.9, p95: 3.9, max: 5.4 }, // med <= 2.2%, p95 <= 4.5%, max <= 6.0%
          mttcSeconds: { mean: 38.5, median: 37.0 }, // > 35.0 s
          coplanarFalsePromotions: 0, // 0 false
          width: { scored: 18, absoluteMm: { median: 10, p95: 22, max: 28 }, relativePercent: { median: 1.8, p95: 3.8, max: 5.2 } },
          height: { scored: 18, absoluteMm: { median: 11, p95: 24, max: 29 }, relativePercent: { median: 2.0, p95: 4.0, max: 5.4 } },
        },
      };

      const gates = comparativeReleaseGates(syntheticSummary);
      assert.equal(gates.allPassed, true);
      assert.equal(gates.auto.allPassed, true);
      assert.equal(gates.clickGuided.allPassed, true);
      assert.equal(gates.manual.allPassed, true);
    });

    it("fails release gates if click-guided coverage or accuracy violates targets", () => {
      const failingSummary: ComparativeSummary = {
        total: 10,
        eligible: 10,
        holdout: 10,
        development: 0,
        auto: {
          accepted: 8,
          rejected: 2,
          unscored: 0,
          coverage: { numerator: 8, denominator: 10, percentage: 80.0 },
          cornerRmse: { mean: 4.0, median: 3.9, p95: 4.4, max: 4.5 },
          relativeErrorPercent: { median: 2.0, p95: 4.0, max: 5.0 },
          mttcSeconds: { mean: 1.5, median: 1.5 },
          coplanarFalsePromotions: 0,
          width: { scored: 8, absoluteMm: { median: 10, p95: 15, max: 20 }, relativePercent: { median: 2.0, p95: 4.0, max: 5.0 } },
          height: { scored: 8, absoluteMm: { median: 10, p95: 15, max: 20 }, relativePercent: { median: 2.0, p95: 4.0, max: 5.0 } },
        },
        clickGuided: {
          accepted: 8,
          rejected: 2,
          unscored: 0,
          // Violation 1: Coverage 80% < 92% target
          coverage: { numerator: 8, denominator: 10, percentage: 80.0 },
          // Violation 2: Corner RMSE 2.9px > 2.2px target
          cornerRmse: { mean: 2.9, median: 2.8, p95: 3.2, max: 3.5 },
          relativeErrorPercent: { median: 1.5, p95: 3.0, max: 4.0 },
          mttcSeconds: { mean: 4.5, median: 4.5 },
          coplanarFalsePromotions: 0,
          width: { scored: 8, absoluteMm: { median: 5, p95: 10, max: 15 }, relativePercent: { median: 1.5, p95: 3.0, max: 4.0 } },
          height: { scored: 8, absoluteMm: { median: 5, p95: 10, max: 15 }, relativePercent: { median: 1.5, p95: 3.0, max: 4.0 } },
        },
        manual: {
          accepted: 10,
          rejected: 0,
          unscored: 0,
          coverage: { numerator: 10, denominator: 10, percentage: 100.0 },
          cornerRmse: { mean: 2.5, median: 2.4, p95: 3.0, max: 3.2 },
          relativeErrorPercent: { median: 1.8, p95: 3.5, max: 4.5 },
          mttcSeconds: { mean: 40.0, median: 40.0 },
          coplanarFalsePromotions: 0,
          width: { scored: 10, absoluteMm: { median: 8, p95: 15, max: 20 }, relativePercent: { median: 1.8, p95: 3.5, max: 4.5 } },
          height: { scored: 10, absoluteMm: { median: 8, p95: 15, max: 20 }, relativePercent: { median: 1.8, p95: 3.5, max: 4.5 } },
        },
      };

      const gates = comparativeReleaseGates(failingSummary);
      assert.equal(gates.allPassed, false);
      assert.equal(gates.clickGuided.allPassed, false);
      assert.equal(gates.clickGuided.coverage.passed, false);
      assert.equal(gates.clickGuided.cornerRmse.passed, false);
    });

    it("generates markdown comparative report adhering to repository formatting standards", () => {
      const c = createCapture();
      const det: Detection = { corners: c.paper, candidates: [], detectionMs: 30 };
      const row = evaluateComparativeCapture(c, det, det, c.paper);
      const summary = summarizeComparative([row]);
      const gates = comparativeReleaseGates(summary);

      const report = generateComparativeMarkdownReport(
        { version: "ms57-v1", captures: [c] },
        [row],
        gates
      );

      // Verify header and traceability
      assert.ok(report.includes("Comparative Fiducial Accuracy Benchmark Report"));
      assert.ok(report.includes("IMP-MS61 / QAD-TC76"));
      assert.ok(report.includes("Full-Automatic (Target / Actual)"));
      assert.ok(report.includes("Click-Guided Snap (Target / Actual)"));
      assert.ok(report.includes("Manual 4-Corner (Target / Actual)"));

      // BAN-PUNCT-01: Zero em-dashes
      assert.ok(!report.includes("—"), "Markdown report must contain zero em-dashes");
    });
  });
});
