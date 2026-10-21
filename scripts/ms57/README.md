# MS57 private measurement benchmark

Traceability: IMP-MS57, PRD-F3/F4/F5/F6/F10, SDD-C3/C4/C5/C7, QAD-TC72. This tool produces evidence. Physical accuracy and release acceptance remain unvalidated until the required captures and manual checks exist.

Use the existing Node/tsx runner and FastAPI Python environment. No new dependencies are needed. The Python probe reads original bytes, hashes them, uses production orientation/encoding and workspace preparation, and calls the production detector. It records oriented and workspace dimensions, coordinate mapping, original orientation, CPU/platform, Python/OpenCV versions, bounded candidate count, detector thresholds and input size. The detector internally bounds its analysis to 1024 pixels on the longest side. Detection timing excludes decoding, process startup and total CV inference; `/analyze-image` needs a separate timing log. Metric evaluation maps source annotations and detector corners into the actual production workspace, so the production one-workspace-pixel sensitivity policy remains meaningful after image reduction.

## Private data and annotation contract

Keep original photos, manifests and reports in `tests/private/ms57/` (ignored by Git), or an approved private location outside the repository. Never copy private images into `public/` or commit them. Output files are exclusive-create and cannot overwrite existing evidence. Paths in a manifest resolve relative to that manifest. The CLI rejects resources/output under `public/`.

Start with `tests/fixtures/ms57/manifest.example.json`. Its empty captures list is intentional and yields unavailable evidence, never a pass. Each capture follows this example (illustrative coordinates/checksum only, not a physical fixture):

```json
{
  "id": "opening-01-front",
  "path": "photos/opening-01-front.jpg",
  "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "openingId": "opening-01",
  "sessionId": "capture-session-01",
  "device": "camera-A-main-lens",
  "split": "development",
  "strata": ["frontal", "low_contrast"],
  "eligible": true,
  "noPaper": false,
  "width": 3000,
  "height": 2400,
  "orientation": 1,
  "standard": "a4",
  "firstEdge": "short",
  "paper": [{"x":100,"y":100},{"x":520,"y":100},{"x":520,"y":694},{"x":100,"y":694}],
  "opening": [{"x":600,"y":200},{"x":2400,"y":200},{"x":2400,"y":2200},{"x":600,"y":2200}],
  "placement": {
    "version": "plane-placement-v1",
    "assessment": "user_confirmed_same_plane",
    "riskReasons": [],
    "targetPlaneId": "opening-01-wall"
  },
  "annotationBy": "independent annotator name",
  "uncertaintyPx": 2,
  "tape": null,
  "context": "Document angle, lighting, visibility, flatness, actual reference dimensions and lens mode",
  "expectedRecovery": "Review outline, format, placement and opening fit"
}
```

Replace `tape: null` only with actual measurements: `{ "widthMm": 900, "heightMm": 1000, "measuredBy": "operator", "perimeter": "defined installation perimeter" }`. Record differing opposing edge measurements in the private collection notes. Trimmed/nonstandard sheets are outside the supported standard-only evaluator and must abstain or use manual dimensions. Do not enter nominal dimensions as tape evidence.

Annotate paper and opening corners independently of detector predictions, in cyclic order starting from the same physical corner used for the reviewed short/long first edge. Coordinates are oriented original image pixels with boundary range `[0,width] x [0,height]`. `uncertaintyPx` is the independently annotated outline-matching tolerance; document how annotator disagreement determined it. It does not silently override production geometry uncertainty. Freeze the production policy after development calibration, with the rationale relating both values.

Use `sample: 1`, `2`, or `3` for supplied photographs; leave unknown tape dimensions null. Use `candidateId` only to record a separately reviewed candidate selection. `noPaper: true` requires `paper: null`, `eligible: false`, and `strata: ["unsafe"]`. Unsafe captures retain actual placement declarations (unknown, handheld, adjacent surface, etc.), rather than relabeling them as eligible. Corrected corners never bypass the production plane-safety evaluator.

Collect at least 60 photos, 10 distinct openings, 3 devices, 15 unsafe captures, all three standards, and 20 held-out images. Each principal stratum needs 5 held-out cases. Record the complete MS57 lighting/visibility/angle matrix in collection notes. Counts can overlap; per-stratum reports make that explicit. Split by both opening and session; duplicate checksums or cross-split groups are rejected. Near-duplicate detection and annotation independence still require human collection review.

## Evaluation cycle

```powershell
npm run test:ms57
npm run benchmark:ms57 -- baseline tests/private/ms57/manifest.json tests/private/ms57/baseline.json
npm run benchmark:ms57 -- development tests/private/ms57/manifest.json tests/private/ms57/dev.json
npm run benchmark:ms57 -- freeze tests/private/ms57/manifest.json tests/private/ms57/freeze.json tests/private/ms57/dev.json
npm run benchmark:ms57 -- holdout tests/private/ms57/manifest.json tests/private/ms57/holdout.json tests/private/ms57/freeze.json
```

Set `MS57_PYTHON` if the FastAPI environment is elsewhere. Before freezing, complete the development report's `freezeRationale`, `supportedEnvelope`, and positive `latencyBudgetMs` fields using measured development evidence. Do not tune using holdout outcomes. The freeze stores dataset and source hashes, geometry policy, development report hash, timestamp, Git revision and dirty state. Source or manifest changes require another declared development cycle. A freeze can start only one holdout run, including a failed run; a sidecar records its consumption.

The baseline command captures the current revision's full detector candidates, selected corners, source metadata and predicted automatic/corrected dimensions. It cannot reconstruct pre-MS53 behavior or historical quotation values. Recover that original revision and record its detector/format/scalar/fit/model/quotation outputs separately if available. A baseline captured now must be labeled post-implementation, never presented as an earlier measurement.

Reports include accepted/rejected/skipped counts, missing ground truth, per-result signed/absolute/relative axis errors, bias, median, interpolated p95, maximum, sensitivity/revision, precision and coverage numerators/denominators, and latency by stratum. Automatic, selected-candidate and annotated-corner results stay separate. Missing fixtures stay in eligible coverage denominators. Missing tape never scores accuracy. A missing candidate may be rejected while the corrected geometry remains diagnosable.

Exit 0 means a baseline/development capture completed, or a freeze was written. Exit 1 is invalid invocation/evidence. Exit 2 means missing fixtures or blocked release. Holdout always remains `release_blocked` until a human reconciles the report with physical collection review, baseline, supplied-sample browser outcomes, mobile/desktop/zoom/refresh/multiple-product checks, model/snapshot/quotation/PDF rounding and revision parity, numeric/regression tests, and `/health` plus `/analyze-image` logs. `benchmarkGatesPassed` covers only measured benchmark gates and latency; it cannot approve these external checks.

The sample photographs, physical measurements and pre-change baseline were unavailable during implementation. No physical accuracy, percentage success, latency budget or complete MS57 release pass is claimed.

## Comparative accuracy evaluation (IMP-MS61 / QAD-TC76)

Benchmark and contrast Full-Automatic (MOD-AUTO), Click-Guided Snap (MOD-CLICK), and Manual Pinning (MOD-MANUAL):

```powershell
npm run test:ms61
npm run benchmark:ms61 -- --mode compare_all --manifest tests/private/ms57/manifest.json --output tests/private/ms61/comparative_results.json --report tests/private/ms61/comparative_report.md
```

Or via the Python runner:

```powershell
python scripts/ms57/run_benchmark.py --mode compare_all --manifest tests/private/ms57/manifest.json --output tests/private/ms61/comparative_results.json --report tests/private/ms61/comparative_report.md
```
