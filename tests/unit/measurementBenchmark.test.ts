import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCapture, outlineMatches, parseManifest, percentile, releaseGates, summarize,
  type Capture, type Detection } from "../../scripts/ms57/benchmark";
import type { QuadrilateralCorners } from "../../src/lib/visualization/types";

const rect = (x: number, y: number, w: number, h: number): QuadrilateralCorners =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const capture = (changes: Partial<Capture> = {}): Capture => ({
  id: "measured-1", path: "room.png", sha256: "a".repeat(64), openingId: "opening-1", sessionId: "session-1", device: "camera-1",
  split: "holdout", strata: ["frontal"], eligible: true, noPaper: false, width: 3000, height: 2400, orientation: 1,
  standard: "a4", firstEdge: "short", paper: rect(100, 100, 420, 594), opening: rect(600, 200, 1800, 2000),
  placement: { version: "plane-placement-v1", assessment: "user_confirmed_same_plane", riskReasons: [], targetPlaneId: "wall-1" },
  annotationBy: "independent annotator", uncertaintyPx: 2,
  tape: { widthMm: 900, heightMm: 1000, measuredBy: "tape operator", perimeter: "outer installation perimeter" },
  context: "Synthetic test only", expectedRecovery: "review reference", ...changes,
});
const detection = (c: Capture): Detection => ({ corners: c.paper, candidates: [], detectionMs: 10 });

describe("IMP-MS57 / QAD-TC72 benchmark evidence", () => {
  it("rejects unknown units, negative tape, malformed geometry and missing labels", () => {
    for (const c of [capture({ tape: { widthMm: -1, heightMm: 100, measuredBy: "x", perimeter: "x" } }),
      { ...capture(), standard: "letter" }, { ...capture(), width: Infinity }, { ...capture(), opening: [] },
      { ...capture(), eligible: undefined }, capture({ noPaper: true }), capture({ annotationBy: "" })]) {
      assert.throws(() => parseManifest({ version: "ms57-v1", captures: [c] }));
    }
  });
  it("rejects duplicate photos and opening or session leakage across splits", () => {
    for (const second of [capture({ id: "two" }), capture({ id: "two", sha256: "b".repeat(64), split: "development" }),
      capture({ id: "two", sha256: "b".repeat(64), openingId: "other", split: "development" })]) {
      assert.throws(() => parseManifest({ version: "ms57-v1", captures: [capture(), second] }));
    }
  });
  it("scores width and height independently with mm bias, relative errors and latency", () => {
    const c = capture({ tape: { widthMm: 900, heightMm: 900, measuredBy: "operator", perimeter: "outer" } });
    const row = evaluateCapture(c, detection(c));
    assert.equal(row.automatic?.valid, true);
    const summary = summarize([row]);
    assert.ok(Math.abs(summary.automatic.width.relativePercent.max!) < 1e-6);
    assert.ok(summary.automatic.height.relativePercent.max! > 11);
    assert.equal(releaseGates({ version: "ms57-v1", captures: [c] }, [row]).perAxisAccuracy, false);
    assert.equal(summary.latencyMs.p95, 10);
  });
  it("marks unknown tape as unscored rather than an accuracy pass", () => {
    const c = capture({ tape: null });
    const row = evaluateCapture(c, detection(c)), summary = summarize([row]);
    assert.equal(summary.automatic.accepted, 1);
    assert.equal(summary.automatic.unscored, 1);
    assert.equal(summary.automatic.width.relativePercent.max, null);
    assert.equal(releaseGates({ version: "ms57-v1", captures: [c] }, [row]).tapeEvidence, false);
  });
  it("keeps missing fixtures in coverage denominators and blocks empty/abstaining datasets", () => {
    const c = capture(), row = evaluateCapture(c, null, "private_fixture_missing");
    assert.equal(row.skipped, "private_fixture_missing");
    assert.deepEqual(summarize([row]).metricCoverage, { numerator: 0, denominator: 1 });
    assert.equal(releaseGates({ version: "ms57-v1", captures: [c] }, [row]).fixturesAvailable, false);
    assert.ok(Object.values(releaseGates({ version: "ms57-v1", captures: [] }, [])).every(x => !x));
  });
  it("never promotes handheld, unknown or adjacent-plane annotations, including corrected corners", () => {
    for (const placement of [
      { version: "plane-placement-v1" as const, assessment: "unknown" as const, riskReasons: [], targetPlaneId: null },
      { ...capture().placement, riskReasons: ["handheld_or_offset" as const] },
      { ...capture().placement, riskReasons: ["adjacent_surface" as const] },
    ]) {
      const c = capture({ placement, eligible: false, strata: ["unsafe"] });
      const row = evaluateCapture(c, detection(c));
      assert.equal(row.automatic, null); assert.equal(row.corrected, null);
    }
  });
  it("keeps candidate/manual results separate so corrections cannot inflate automatic coverage", () => {
    const c = capture({ candidateId: "candidate-2" });
    const row = evaluateCapture(c, { corners: null, candidates: [{ id: "candidate-2", corners: c.paper! }], detectionMs: 20 });
    assert.equal(row.automatic, null); assert.equal(row.candidateSelected?.valid, true); assert.equal(row.corrected?.valid, true);
    assert.deepEqual(summarize([row]).localizationCoverage, { numerator: 0, denominator: 1 });
  });
  it("blocks release if a reviewed or corrected unsafe result is ever promoted", () => {
    const safe = capture();
    const result = evaluateCapture(safe, detection(safe)).corrected;
    assert.ok(result?.valid);
    const unsafe = capture({ eligible: false, strata: ["unsafe"] });
    const row = { ...evaluateCapture(unsafe, null), skipped: null, corrected: result };
    assert.equal(summarize([row]).unsafePromotions, 1);
    assert.equal(releaseGates({ version: "ms57-v1", captures: [unsafe] }, [row]).unsafePlacement, false);
  });
  it("matches outlines without relying on cyclic start or winding, and rejects distractors", () => {
    const q = capture().paper!;
    assert.equal(outlineMatches(q, [q[2], q[1], q[0], q[3]], 2), true);
    assert.equal(outlineMatches(q, rect(140, 140, 420, 594), 2), false);
  });
  it("uses documented linear percentiles without rounding away failures", () => {
    assert.equal(percentile([], .95), null); assert.equal(percentile([0, 10], .5), 5);
    assert.equal(percentile([0, 10], .95), 9.5);
  });
  it("preserves dimensions but evaluates uncertainty in production workspace pixels after resize", () => {
    const c = capture();
    const full = evaluateCapture(c, detection(c)).automatic;
    const reduced = evaluateCapture(c, detection(c), null, { width: 1500, height: 1200 }).automatic;
    assert.ok(full?.valid && reduced?.valid);
    assert.ok(Math.abs(full.widthMm - reduced.widthMm) < 1e-6);
    assert.ok(Math.abs(full.heightMm - reduced.heightMm) < 1e-6);
    assert.ok(reduced.sensitivity.widthRelative > full.sensitivity.widthRelative);
  });
  it("can pass quantitative gates together while reporting overlapping strata", () => {
    // Synthetic evaluator test only. This does not establish physical release evidence.
    const captures = Array.from({ length: 60 }, (_, i) => capture({ id: `case-${i}`, sha256: i.toString(16).padStart(64, "0"),
      openingId: `opening-${Math.floor(i / 5)}`, sessionId: `session-${Math.floor(i / 5)}`, device: `camera-${i % 3}`,
      split: i < 30 ? "development" : "holdout",
      strata: i % 4 === 0 ? ["unsafe"] : ["frontal", "oblique", "low_contrast"],
      eligible: i % 4 !== 0, noPaper: i % 4 === 0, paper: i % 4 === 0 ? null : capture().paper,
      standard: i % 3 === 0 ? "short" : i % 3 === 1 ? "a4" : "long",
    }));
    // Use an A4 reference for scoring; standard diversity is exercised by actual paper metadata below.
    for (const c of captures) {
      const sizes = { short: [215.9, 279.4], a4: [210, 297], long: [215.9, 330.2] };
      const size = sizes[c.standard];
      if (c.paper) c.paper = rect(100, 100, size[0] * 2, size[1] * 2);
    }
    const manifest = parseManifest({ version: "ms57-v1", captures });
    const rows = captures.filter(c => c.split === "holdout").map(c => evaluateCapture(c, detection(c)));
    const gates = releaseGates(manifest, rows);
    assert.ok(Object.values(gates).every(Boolean), JSON.stringify(gates));
    assert.equal(summarize(rows.filter(r => r.strata.includes("oblique"))).total, 23);
  });
});
