/** FIX21-V1/V2/V3 / QAD-TC71: visual pose cannot replace accepted opening geometry. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMetricReference } from "../../src/lib/visualization/metricGeometry";
import { recalculateMetricConfiguration } from "../../src/lib/visualization/scaleEstimation";
import { readMeasurementRecord, quotationMeasurement } from "../../src/lib/visualization/measurementRecord";
import { calculateOverlayPricing } from "../../src/lib/pricing/pricingEngine";
import { normalizeCorners, rotatePerspectiveCorners, scaleCornersAlongAxis } from "../../src/lib/visualization/perspectiveTransform";
import type { CalibrationMetadata, PlacedOverlay, ProductConfigurationSnapshot, QuadrilateralCorners } from "../../src/lib/visualization/types";

const frame = { imageId: "fix21-oblique-room", width: 3000, height: 3000 };
const paper: QuadrilateralCorners = [
  { x: 100, y: 100 }, { x: 310, y: 100 }, { x: 310, y: 397 }, { x: 100, y: 397 },
];
const opening: QuadrilateralCorners = [
  { x: 500, y: 500 }, { x: 2900, y: 475 }, { x: 2900, y: 1500 }, { x: 500, y: 1525 },
];
const reference = createMetricReference(frame, paper, "a4", "short", 1, "front-wall");
assert.ok(reference.valid);
const calibration: CalibrationMetadata = {
  mode: "paper_fiducial", paperStandard: "a4", status: "verified_calibrated", confidence: 1,
  paperStandardConfirmed: true, samePlaneConfirmed: true, referenceSource: "manual_corners",
  metricReference: reference.reference,
  placementReview: { version: "plane-placement-v1", assessment: "user_confirmed_same_plane", riskReasons: [], targetPlaneId: "front-wall" },
};
const initial: ProductConfigurationSnapshot = {
  widthCm: 120, heightCm: 150, quantity: 1, thicknessMm: 6, aluminumFinish: "white", glassAppearance: "clear",
  includeSill: true, yaw: 0, pitch: 0, rotateAngle: 0, isFlipped: false, targetPlaneId: "front-wall",
  perspectiveFitCorners: normalizeCorners(opening, frame.width, frame.height), visualParameterValues: {},
};
const measure = (configuration: ProductConfigurationSnapshot) =>
  recalculateMetricConfiguration(configuration, reference.reference, frame, calibration);
const price = (configuration: ProductConfigurationSnapshot) =>
  calculateOverlayPricing({ overlayId: "fixture", productId: "fixture", productName: "Window", configuration } as PlacedOverlay);

describe("FIX21 calibrated visual pose", () => {
  it("routes the rotation handle through visual pose without invoking metric evaluation", () => {
    const workspace = readFileSync(fileURLToPath(new URL("../../src/features/visualization/components/ProductModelWorkspace.tsx", import.meta.url)), "utf8");
    const handler = workspace.split("const startPerspectiveRotation = useCallback(")[1]?.split("const startPerspectiveMove = useCallback(")[0];
    assert.ok(handler, "rotation handler must exist");
    assert.match(handler, /setPerspectiveCorners\(rotatePerspectiveCorners\(/);
    assert.doesNotMatch(handler, /updateMetricPerspectiveCorners\(/);
    assert.match(workspace, /perspectiveFitCorners: measurementCorners/);
    assert.match(workspace, /visualPoseCorners: perspectiveCorners/);
    const resize = workspace.split("const startPerspectiveResize = useCallback(")[1]?.split("const startPerspectiveRotation = useCallback(")[0];
    const move = workspace.split("const startPerspectiveMove = useCallback(")[1]?.split("const priceCard =")[0];
    assert.ok(resize && move);
    for (const handler of [resize, move]) {
      assert.match(handler, /startCorners: \[\.\.\.\(measurementCorners \?\? perspectiveCorners\)\]/);
      assert.match(handler, /startPoseCorners: \[\.\.\.perspectiveCorners\]/);
      assert.match(handler, /updateMetricPerspectiveCorners\(nextCorners, nextPoseCorners\)/);
    }
  });

  it("keeps opening, provenance, structural dimensions and price during rotation and JSON restoration", () => {
    const accepted = measure(initial);
    const before = readMeasurementRecord(accepted.visualParameterValues.calibration_provenance);
    assert.ok(before);
    const rotated = {
      ...accepted,
      visualPoseCorners: rotatePerspectiveCorners(accepted.perspectiveFitCorners!, frame.width, frame.height, 27),
    };
    assert.notDeepEqual(rotated.visualPoseCorners, accepted.perspectiveFitCorners);
    const restored = JSON.parse(JSON.stringify(rotated)) as ProductConfigurationSnapshot;
    const revalidated = measure(restored);
    const after = readMeasurementRecord(revalidated.visualParameterValues.calibration_provenance);
    assert.ok(after);
    assert.deepEqual(revalidated.perspectiveFitCorners, accepted.perspectiveFitCorners);
    assert.deepEqual(revalidated.visualPoseCorners, rotated.visualPoseCorners);
    assert.equal(after.measurement_revision, before.measurement_revision);
    assert.equal(revalidated.widthCm, accepted.widthCm);
    assert.equal(revalidated.heightCm, accepted.heightCm);
    assert.equal(revalidated.visualParameterValues.width, accepted.visualParameterValues.width);
    assert.equal(revalidated.visualParameterValues.height, accepted.visualParameterValues.height);
    assert.deepEqual(quotationMeasurement(revalidated), quotationMeasurement(accepted));
    assert.deepEqual(price(revalidated), price(accepted));
  });

  it("remeasures an intentional opening edit without promoting a pose change", () => {
    const accepted = measure(initial);
    const revisedOpening = opening.map((point, index) => ({ x: point.x + (index === 1 || index === 2 ? 35 : 0), y: point.y + (index >= 2 ? 30 : 0) })) as QuadrilateralCorners;
    const changed = measure({ ...accepted, perspectiveFitCorners: normalizeCorners(revisedOpening, frame.width, frame.height) });
    assert.notEqual(changed.widthCm, accepted.widthCm);
    assert.notEqual(changed.heightCm, accepted.heightCm);
    assert.notEqual(readMeasurementRecord(changed.visualParameterValues.calibration_provenance)?.measurement_revision,
      readMeasurementRecord(accepted.visualParameterValues.calibration_provenance)?.measurement_revision);
    assert.notDeepEqual(price(changed), price(accepted));
    const manual = measure({ ...accepted, widthCm: 123, visualParameterValues: { ...accepted.visualParameterValues, dimension_source: "manual_tape" }, visualPoseCorners: rotatedPose(accepted) });
    assert.equal(manual.widthCm, 123);
    assert.equal(quotationMeasurement(manual).dimensionSource, "manual_tape");
    const approximate = measure({ ...initial, perspectiveFitCorners: null, visualPoseCorners: rotatedPose(accepted) });
    assert.equal(quotationMeasurement(approximate).dimensionSource, "heuristic");
  });

  it("uses the measured opening for a tiny resize after rotation, without a metric jump", () => {
    const accepted = measure(initial);
    const rotated = { ...accepted, visualPoseCorners: rotatedPose(accepted) };
    const widthRatio = 1.002;
    const measuredEdit = scaleCornersAlongAxis(rotated.perspectiveFitCorners!, widthRatio, "width");
    const visualEdit = scaleCornersAlongAxis(rotated.visualPoseCorners!, widthRatio, "width");
    const edited = measure({ ...rotated, perspectiveFitCorners: measuredEdit, visualPoseCorners: visualEdit });
    assert.deepEqual(edited.perspectiveFitCorners, measuredEdit);
    assert.deepEqual(edited.visualPoseCorners, visualEdit);
    assert.ok(Math.abs(edited.widthCm - accepted.widthCm) < accepted.widthCm * 0.01);
    assert.ok(Math.abs(edited.heightCm - accepted.heightCm) < accepted.heightCm * 0.01);
    assert.notEqual(edited.widthCm, accepted.widthCm);
    assert.notEqual(readMeasurementRecord(edited.visualParameterValues.calibration_provenance)?.measurement_revision,
      readMeasurementRecord(accepted.visualParameterValues.calibration_provenance)?.measurement_revision);
    assert.equal(quotationMeasurement(edited).dimensionSource, "planar_paper_estimate");
  });
});

function rotatedPose(configuration: ProductConfigurationSnapshot): QuadrilateralCorners {
  return rotatePerspectiveCorners(configuration.perspectiveFitCorners!, frame.width, frame.height, 15);
}
