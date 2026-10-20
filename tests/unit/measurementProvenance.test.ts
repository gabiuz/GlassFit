/** IMP-MS56 / QAD-TC71: behavioral measurement and quotation lifecycle coverage. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMetricReference } from "../../src/lib/visualization/metricGeometry";
import { createMeasurementRecord, currentPhotoMeasurement, MeasurementRecordSchema, quotationMeasurement, readMeasurementRecord } from "../../src/lib/visualization/measurementRecord";
import { recalculateMetricConfiguration, recalculateMetricOverlay } from "../../src/lib/visualization/scaleEstimation";
import { calculateOverlayPricing } from "../../src/lib/pricing/pricingEngine";
import { normalizeCorners } from "../../src/lib/visualization/perspectiveTransform";
import { applyMeasurementOverridesToOverlays, buildMeasurementEntries } from "../../src/lib/visualization/measurementConfirmation";
import { QuotationDocumentDraftV1Schema, QuotationDocumentSnapshotV1Schema } from "../../src/lib/pricing/quotationDocument";
import { initialState, validateSessionPlaneEligibility } from "../../src/lib/visualization/visualizationSession";
import type { SpaceImageSession } from "../../src/lib/imageApi";
import type { CalibrationMetadata, ProductConfigurationSnapshot, QuadrilateralCorners, PlacedOverlay } from "../../src/lib/visualization/types";

const frame = { imageId: "room-ms56", width: 3000, height: 3000 };
const rect = (x: number, y: number, w: number, h: number): QuadrilateralCorners => [{ x, y }, { x: x+w, y }, { x: x+w, y: y+h }, { x, y: y+h }];
function meta(revision = 1, planeId = "front-wall", paperWidth = 210): CalibrationMetadata {
  const geometry = createMetricReference(frame, rect(100,100,paperWidth,paperWidth*297/210), "a4", "short", revision, planeId);
  assert.ok(geometry.valid);
  return { mode: "paper_fiducial", paperStandard: "a4", status: "verified_calibrated", confidence: 1,
    paperStandardConfirmed: true, samePlaneConfirmed: true, referenceSource: "manual_corners", metricReference: geometry.reference,
    placementReview: { version: "plane-placement-v1", assessment: "user_confirmed_same_plane", riskReasons: [], targetPlaneId: planeId } };
}
function config(planeId = "front-wall"): ProductConfigurationSnapshot {
  return { widthCm: 120, heightCm: 150, quantity: 1, thicknessMm: 6, aluminumFinish: "white", glassAppearance: "clear",
    includeSill: true, yaw: 0, pitch: 0, rotateAngle: 0, isFlipped: false, targetPlaneId: planeId,
    perspectiveFitCorners: normalizeCorners(rect(500,500,2400.1234,1000.5678), frame.width, frame.height),
    visualParameterValues: { custom_finish: "preserved" } };
}
const measured = (m = meta(), c = config()) => recalculateMetricConfiguration(c, m.metricReference, frame, m);
const near = (a: number, b: number) => assert.ok(Math.abs(a-b) < 1e-6, `${a} vs ${b}`);

function draft(configuration = measured()) {
  return { schemaVersion: 1, customer: { name: "Customer", phone: null, email: null, siteLocation: null },
    projectName: "Room", hasSill: true, structuralWaiver: false,
    items: [{ itemId: "fixture-1", productId: "product-1", productName: "Window", productType: "Window", variantName: "Standard",
      specificationSummary: "Aluminum", dimensionsFormatted: "240.012cm x 100.057cm", widthMm: configuration.widthCm*10,
      heightMm: configuration.heightCm*10, panelCount: 3, hasSill: true, structuralWaiver: false, finishLabel: "White", glassLabel: "Clear",
      quantity: 1, unitPrice: 100, calculatedSubtotal: 100, imageSource: null,
      groups: [{ groupName: "Framing", description: "Frame", quantity: 1, unit: "pc", unitPrice: 100, subtotal: 100 }],
      ...quotationMeasurement(configuration) }],
    pricing: { directMaterialsSubtotal: 80, laborSubtotal: 10, contractorMargin: 10, calculatedFinalPrice: 100 } };
}

describe("IMP-MS56 / QAD-TC71", () => {
  it("keeps unrounded evaluator, model, structural inputs, confirmation, and quotation dimensions equal", () => {
    const c = measured();
    near(c.widthCm*10, 2400.1234); near(c.heightCm*10, 1000.5678);
    assert.ok(c.widthCm*10 > 2400); // Structural threshold sees actual dimensions.
    near(Number(c.visualParameterValues.width), c.widthCm*10);
    const entries = buildMeasurementEntries([{ overlayId: "one", productId: "one", productName: "Window", configuration: c, isActive: false } as PlacedOverlay], null, 0,0,0);
    near(entries[0].systemWidthCm, c.widthCm);
    const accepted = QuotationDocumentDraftV1Schema.parse(draft(c));
    near(accepted.items[0].widthMm, 2400.1234);
    assert.equal(accepted.items[0].dimensionSource, "planar_paper_estimate");
  });
  it("requires MS55 placement, matching plane, known format, image, and complete opening", () => {
    const c = config(), m = meta();
    const create = (review: CalibrationMetadata, id = "front-wall") => createMeasurementRecord(review, c.perspectiveFitCorners!, frame, id);
    assert.ok(create(m));
    assert.equal(create({ ...m, placementReview: undefined }), null);
    assert.equal(create({ ...m, placementReview: { ...m.placementReview!, assessment: "mismatch_reported" } }), null);
    assert.equal(create({ ...m, paperStandardConfirmed: false }), null);
    assert.equal(create(m, "back-wall"), null);
    assert.equal(createMeasurementRecord(m,c.perspectiveFitCorners!,{ ...frame,imageId: "other" }, "front-wall"), null);
    const preview = measured(m,{ ...c,perspectiveFitCorners: null });
    assert.equal(preview.widthCm,120); assert.equal(quotationMeasurement(preview).dimensionSource,"heuristic");
  });
  it("updates matching drafts together and preserves manual tape dimensions, finishes, and unrelated planes", () => {
    const first = measured();
    const tape = { ...first, widthCm: 123.45, visualParameterValues: { ...first.visualParameterValues, dimension_source: "manual_tape" } };
    const other = measured(meta(1,"back-wall"), config("back-wall"));
    const nextMeta = meta(2,"front-wall",220);
    const update = (c: ProductConfigurationSnapshot) => measured(nextMeta,c);
    const changed = [first,first].map(update);
    assert.equal(changed[0].widthCm,changed[1].widthCm);
    assert.notEqual(changed[0].widthCm,first.widthCm);
    assert.equal(changed[0].visualParameterValues.custom_finish,"preserved");
    assert.equal(update(tape).widthCm,123.45);
    assert.ok(update(tape).visualParameterValues.photo_disagreement_mm);
    assert.equal(quotationMeasurement(update(tape)).dimensionSource,"manual_tape");
    assert.deepEqual(update(other),other);
  });
  it("invalidates stale acceptance and rejects corrupt, legacy, truncated, or dimension-tampered provenance", () => {
    const c = measured();
    const record = readMeasurementRecord(c.visualParameterValues.calibration_provenance)!;
    assert.ok(record);
    assert.equal(readMeasurementRecord({ ...record, width_mm: 10 }),null);
    assert.equal(readMeasurementRecord({ ...record, reference: { ...record.reference, matrix: [1,0,0,0,1,0,0,0,1] } }),null);
    assert.equal(readMeasurementRecord({ ...record, coordinate_space: "oriented_source" }),null);
    assert.equal(readMeasurementRecord({ ...record, reference: undefined }),null);
    const stale = recalculateMetricConfiguration(c,null,frame,null);
    assert.equal(stale.visualParameterValues.dimension_source,"heuristic");
    assert.equal(stale.visualParameterValues.calibration_provenance,null);
    assert.ok(currentPhotoMeasurement(c,meta()));
    assert.equal(currentPhotoMeasurement(c,meta(2)),null);
    assert.equal(currentPhotoMeasurement(c,null),null);
    assert.equal(quotationMeasurement({ ...c,visualParameterValues: { ...c.visualParameterValues,dimension_source: "heuristic" } }).dimensionSource,"heuristic");
    assert.equal(quotationMeasurement({ ...c, targetPlaneId: "other" }).dimensionSource,"heuristic");
    assert.equal(quotationMeasurement({ ...c, widthCm: 1 }).dimensionSource,"heuristic");
    assert.equal(quotationMeasurement({ ...c, visualParameterValues: { dimension_source: "verified_calibrated_visual" } }).dimensionSource,"heuristic");
    const brokenDraft = draft(c); brokenDraft.items[0].widthMm = 10;
    assert.equal(QuotationDocumentDraftV1Schema.safeParse(brokenDraft).success,false);
  });
  it("changes the measurement revision with corners, reference revision, or format correspondence", () => {
    const c = measured();
    const r = readMeasurementRecord(c.visualParameterValues.calibration_provenance)!;
    const next = measured(meta(2),c);
    const r2 = readMeasurementRecord(next.visualParameterValues.calibration_provenance)!;
    assert.notEqual(r.measurement_revision,r2.measurement_revision);
    const shifted = { ...config(), perspectiveFitCorners: normalizeCorners(rect(500,500,2401.5,1000.5678),frame.width,frame.height) };
    assert.notEqual(readMeasurementRecord(measured(meta(),shifted).visualParameterValues.calibration_provenance)!.measurement_revision,r.measurement_revision);
    assert.ok(MeasurementRecordSchema.safeParse(JSON.parse(JSON.stringify(r))).success);
  });
  it("restores evidence on refresh and downgrades quota-truncated or scalar-only sessions", () => {
    const c = measured();
    const session = { sessionId: frame.imageId, workspaceImage: { url: "room.webp",width: frame.width,height: frame.height },
      calibrationMeta: meta() } as SpaceImageSession;
    const state = { ...initialState,spaceImageSession: session,productConfiguration: c };
    const restored = validateSessionPlaneEligibility(JSON.parse(JSON.stringify(state)));
    assert.equal(quotationMeasurement(restored.productConfiguration).dimensionSource,"planar_paper_estimate");
    assert.equal(restored.productConfiguration?.targetPlaneId,c.targetPlaneId);
    const lostPhoto = validateSessionPlaneEligibility({ ...state,spaceImageSession: { ...session, workspaceImage: { ...session.workspaceImage,url: "" } } });
    assert.equal(quotationMeasurement(lostPhoto.productConfiguration).dimensionSource,"heuristic");
    const legacy = validateSessionPlaneEligibility({ ...state,spaceImageSession: { ...session,calibrationMeta: { ...meta(),metricReference: null } } });
    assert.equal(quotationMeasurement(legacy.productConfiguration).dimensionSource,"heuristic");
    const corrupt = meta(); corrupt.metricReference = { ...corrupt.metricReference!,matrix: [1,0,0,0,1,0,0,0,1] };
    assert.equal(quotationMeasurement(validateSessionPlaneEligibility({ ...state,spaceImageSession: { ...session,calibrationMeta: corrupt } }).productConfiguration).dimensionSource,"heuristic");
  });
  it("manual confirmation clears photo acceptance even with valid retained photo corners", () => {
    const c = measured();
    const overlay = { overlayId: "fixture", productId: "fixture", productName: "Window", configuration: c, isActive: false } as PlacedOverlay;
    const entry = buildMeasurementEntries([overlay],null,0,0,0)[0];
    const [updated] = applyMeasurementOverridesToOverlays([{ ...entry, dimensionSource: "manual_tape",
      override: { widthIn: 40,heightIn: 50,widthOverridden: true,heightOverridden: true,acknowledged: true } }],[overlay]);
    assert.equal(updated.configuration.visualParameterValues.dimension_source,"manual_tape");
    assert.equal(updated.configuration.visualParameterValues.calibration_provenance,null);
    assert.equal(measured(meta(2),updated.configuration).widthCm,updated.configuration.widthCm);
    const sibling = { ...overlay,overlayId: "another-instance" };
    const entries = [{ ...entry,dimensionSource: "manual_tape",override: { widthIn: 40,heightIn: 50,widthOverridden: true,heightOverridden: true,acknowledged: true } }];
    assert.equal(applyMeasurementOverridesToOverlays(entries,[sibling])[0],sibling);
  });
  it("invalidates stale draft pricing and render assets when metric dimensions change", () => {
    const c = measured();
    const base = { overlayId: "priced",productId: "window",productName: "Window",configuration: c } as PlacedOverlay;
    const pricing = calculateOverlayPricing(base);
    const cached = { ...base,...pricing,variationAssetRefs: {},variationImageDataUrls: {} };
    const review = meta(2,"front-wall",220);
    const updated = recalculateMetricOverlay(cached,review.metricReference,frame,review);
    near(updated.bomResult!.widthM*1000,updated.configuration.widthCm*10);
    near(updated.bomResult!.heightM*1000,updated.configuration.heightCm*10);
    assert.notEqual(updated.bomResult!.widthM,pricing.bomResult.widthM);
    assert.equal(updated.variationAssetRefs,undefined);
    assert.equal(updated.variationImageDataUrls,undefined);
    const staleCache = { ...cached,configuration: updated.configuration };
    near(calculateOverlayPricing(staleCache).bomResult.widthM*1000,updated.configuration.widthCm*10);
  });
  it("recalibration leaves accepted historical snapshots and negotiated values immutable", () => {
    const frozen = QuotationDocumentSnapshotV1Schema.parse({ ...draft(), quotationNumber: "Q-56", referenceCode: "CF-56",
      shareablePath: "/q/CF-56", createdAt: "2026-10-19T00:00:00.000Z",snapshotObjectKey: null });
    const negotiated = { itemId: "fixture-1", negotiatedSubtotal: 90 };
    const before = JSON.stringify({ frozen,negotiated });
    measured(meta(2));
    assert.equal(JSON.stringify({ frozen,negotiated }),before);
    const legacy = { ...frozen,items: frozen.items.map(i => ({ ...i,dimensionSource: "verified_calibrated_visual",calibrationProvenance: undefined })) };
    assert.ok(QuotationDocumentSnapshotV1Schema.safeParse(legacy).success);
    assert.equal(QuotationDocumentDraftV1Schema.safeParse(legacy).success,false);
  });
});
