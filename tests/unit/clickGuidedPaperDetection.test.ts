import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPointInsideOrNearPolygon,
  findSeedEnclosingCandidate,
  validatePaperDetection,
  confirmPaperReference,
  requestClickGuidedPaperDetection,
} from "../../src/lib/visualization/paperReference";
import type { PaperCandidateRecord } from "../../src/lib/visualization/paperReference";
import type { SpaceImageSession } from "../../src/lib/imageApi";
import type { Point2D } from "../../src/lib/visualization/types";

describe("IMP-MS58 / QAD-TC73 click-guided paper localization", () => {
  const polyRect: Point2D[] = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 400 },
    { x: 100, y: 400 },
  ];

  it("identifies points strictly inside polygon or within proximity tolerance", () => {
    // Strictly inside
    assert.equal(isPointInsideOrNearPolygon({ x: 200, y: 250 }, polyRect, 1000), true);

    // Strictly outside without tolerance
    assert.equal(isPointInsideOrNearPolygon({ x: 50, y: 50 }, polyRect, 0), false);

    // Near boundary within 1.5% diagonal tolerance (e.g. 15px for diagonal 1000)
    assert.equal(isPointInsideOrNearPolygon({ x: 95, y: 250 }, polyRect, 15), true);

    // Far beyond 1.5% tolerance (distance is 50px > 15px)
    assert.equal(isPointInsideOrNearPolygon({ x: 50, y: 250 }, polyRect, 15), false);
  });

  it("finds the enclosing candidate matching the clicked seed coordinate", () => {
    const candidateA: PaperCandidateRecord = {
      id: "candidate-a",
      corners: [
        [50, 50],
        [150, 50],
        [150, 150],
        [50, 150],
      ],
      score: 0.85,
      score_components: { boundary_support: 0.8 },
      rejection_reasons: [],
    };

    const candidateB: PaperCandidateRecord = {
      id: "candidate-b",
      corners: [
        [400, 400],
        [600, 400],
        [600, 700],
        [400, 700],
      ],
      score: 0.92,
      score_components: { boundary_support: 0.95 },
      rejection_reasons: [],
    };

    const candidates = [candidateA, candidateB];
    const diagonal = 1000;

    // Tap inside candidate A
    const matchedA = findSeedEnclosingCandidate(candidates, { x: 100, y: 100 }, diagonal);
    assert.equal(matchedA?.id, "candidate-a");

    // Tap inside candidate B
    const matchedB = findSeedEnclosingCandidate(candidates, { x: 500, y: 550 }, diagonal);
    assert.equal(matchedB?.id, "candidate-b");

    // Tap outside both candidates
    const matchedNone = findSeedEnclosingCandidate(candidates, { x: 900, y: 900 }, diagonal);
    assert.equal(matchedNone, null);
  });

  it("preserves click_guided reference source across confirmation", () => {
    const corners: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 100, y: 100 },
      { x: 310, y: 100 },
      { x: 310, y: 397 },
      { x: 100, y: 397 },
    ];
    const candidate: PaperCandidateRecord = {
      id: "candidate-cg-1",
      corners: corners.map((p) => [p.x, p.y]),
      score: 0.91,
      score_components: { boundary_support: 0.92 },
      rejection_reasons: [],
    };
    const detection = {
      coordinate_space: "workspace",
      image_width: 1024,
      image_height: 768,
      detection_outcome: "candidate_found",
      candidates: [candidate],
      selected_candidate_id: candidate.id,
      reference_source: "click_guided",
      paper_standard: null,
      paper_standard_confirmed: false,
    };

    const validated = validatePaperDetection(detection, 1024, 768);
    assert.equal(validated.status, "detected");
    assert.equal(validated.reference_source, "click_guided");

    const session = {
      sessionId: "ms58-test-session",
      workspaceImage: { url: "room.webp", width: 1024, height: 768 },
      paperCalibration: validated,
    } as SpaceImageSession;

    const review = {
      scaleCmPerPx: 0.08,
      confidence: 0.95,
      referenceSource: "click_guided" as const,
      selectedCandidateId: candidate.id,
      paperStandardConfirmed: true,
      samePlaneConfirmed: true,
      firstEdge: "short" as const,
      orientationConfirmed: true,
    };

    const confirmed = confirmPaperReference(session, corners, review, "a4");
    assert.equal(confirmed.calibrationMeta?.referenceSource, "click_guided");
    assert.equal(confirmed.paperCalibration?.reference_source, "click_guided");
    assert.equal(confirmed.paperCalibration?.selected_candidate_id, candidate.id);
  });

  it("constructs matching MIME and extension for WebP workspace image in requestClickGuidedPaperDetection", async () => {
    const originalFetch = globalThis.fetch;
    let interceptedFile: File | null = null;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes("analyze-image")) {
        const formData = init?.body as FormData;
        interceptedFile = formData.get("image") as File;
        return {
          ok: true,
          json: async () => ({
            session_id: "test-cg-session",
            workspace_image: { url: "/workspace.webp", width: 1000, height: 1000 },
            brightness: { mean_pixel_intensity: 128, category: "normal" },
            lighting: { mean_rgb: [128, 128, 128], ambient_rgb: [128, 128, 128], ambient_hex: "#808080" },
            objects: [],
            segmentation: { mode: "none", model: null },
            paper_calibration: {
              status: "detected",
              coordinate_space: "workspace",
              image_width: 1000,
              image_height: 1000,
              detection_outcome: "candidate_found",
              candidates: [{ id: "c1", corners: [[10, 10], [100, 10], [100, 100], [10, 100]], score: 0.9, score_components: {}, rejection_reasons: [] }],
              selected_candidate_id: "c1",
              reference_source: "click_guided",
            },
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        blob: async () => new Blob(["test"], { type: "image/webp" }),
      } as unknown as Response;
    };

    try {
      const result = await requestClickGuidedPaperDetection(
        "http://localhost:8000/generated/sessions/123/workspace.webp",
        { x: 0.5, y: 0.5 },
      );

      assert.equal(result.outcome, "candidate_found");
      assert.notEqual(interceptedFile, null);
      const uploadedFile = interceptedFile as unknown as File;
      assert.equal(uploadedFile.name, "workspace.webp");
      assert.equal(uploadedFile.type, "image/webp");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

