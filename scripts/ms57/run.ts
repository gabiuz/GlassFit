/** IMP-MS57 / QAD-TC72: reproducible offline evidence capture, no public photo writes. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { PROVISIONAL_GEOMETRY_POLICY } from "../../src/lib/visualization/metricGeometry";
import { evaluateCapture, parseManifest, releaseGates, STRATA, summarize, type Detection, type Evaluation } from "./benchmark";
import type { QuadrilateralCorners } from "../../src/lib/visualization/types";

const root = resolve(import.meta.dirname, "../..");
const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sourcePaths = ["fastapi-service/paper_calibration.py", "fastapi-service/image_preparation.py", "scripts/ms57/detect.py", "scripts/ms57/benchmark.ts", "scripts/ms57/run.ts",
  "src/lib/visualization/metricGeometry.ts", "src/lib/visualization/perspectiveTransform.ts", "src/lib/visualization/planeEligibility.ts", "src/lib/visualization/types.ts"];
function snapshot() {
  return { revision: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain"),
    sources: Object.fromEntries(sourcePaths.map(p => [p, hash(readFileSync(resolve(root, p)))])),
    geometryPolicy: PROVISIONAL_GEOMETRY_POLICY };
}
function privatePath(path: string) {
  const full = resolve(path);
  const publicRelative = relative(resolve(root, "public"), full);
  if (publicRelative === "" || (!publicRelative.startsWith(`..${sep}`) && publicRelative !== ".." && !isAbsolute(publicRelative)))
    throw new Error("Private benchmark resources and output cannot be placed in public/");
  return full;
}
function save(path: string, value: unknown) {
  const full = privatePath(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}
const usage = "Usage: npm run benchmark:ms57 -- <baseline|development|freeze|holdout> <private-manifest.json> <new-output.json> [development-report.json|freeze.json]";

function main() {
  const [mode, input, output, evidence] = process.argv.slice(2);
  if (!["baseline", "development", "freeze", "holdout"].includes(mode) || !input || !output) throw new Error(usage);
  const inputPath = privatePath(input), manifest = parseManifest(JSON.parse(readFileSync(inputPath, "utf8")));
  const state = snapshot();
  const datasetHash = hash(JSON.stringify(manifest));
  if (mode === "freeze") {
    if (!evidence) throw new Error("Freeze requires the development report and documented annotation uncertainty, capture envelope and latency budget");
    const dev = JSON.parse(readFileSync(privatePath(evidence), "utf8"));
    // Development report is completed by the evaluator with a documented rationale before freezing.
    if (dev.mode !== "development" || dev.datasetHash !== datasetHash || JSON.stringify(dev.state.sources) !== JSON.stringify(state.sources) ||
      !dev.rows?.length || dev.rows.some((r: Evaluation) => r.skipped) ||
      typeof dev.freezeRationale !== "string" || !dev.freezeRationale.trim() ||
      typeof dev.supportedEnvelope !== "string" || !dev.supportedEnvelope.trim() ||
      !Number.isFinite(dev.latencyBudgetMs) || dev.latencyBudgetMs <= 0)
      throw new Error("Development evidence must match this dataset/source and contain rationale, supportedEnvelope and positive latencyBudgetMs");
    save(output, { version: "ms57-freeze-v1", frozenAt: new Date().toISOString(), datasetHash, state,
      developmentReportHash: hash(readFileSync(privatePath(evidence))),
      freezeRationale: dev.freezeRationale, supportedEnvelope: dev.supportedEnvelope, latencyBudgetMs: dev.latencyBudgetMs });
    console.log("Threshold/source snapshot frozen. Physical holdout evidence remains required.");
    return;
  }
  let freeze = null;
  if (mode === "holdout") {
    if (!evidence) throw new Error("Holdout evaluation requires a development freeze file");
    freeze = JSON.parse(readFileSync(privatePath(evidence), "utf8"));
    if (freeze.version !== "ms57-freeze-v1" || freeze.datasetHash !== datasetHash ||
      JSON.stringify(freeze.state.sources) !== JSON.stringify(state.sources) ||
      !Number.isFinite(Date.parse(freeze.frozenAt)) || Date.parse(freeze.frozenAt) >= Date.now())
      throw new Error("Freeze missing/stale: changed sources or dataset require a new declared development cycle");
    // A failed/aborted evaluation consumes the cycle too. Retuning needs a fresh freeze.
    save(`${privatePath(evidence)}.holdout-started.json`, { startedAt: new Date().toISOString(), datasetHash, state });
  }
  const rows: Evaluation[] = [], probes: unknown[] = [];
  const captures = manifest.captures.filter(c => mode === "baseline" || c.split === (mode === "holdout" ? "holdout" : "development"));
  const python = process.env.MS57_PYTHON ?? "python";
  for (const capture of captures) {
    try {
      const path = privatePath(resolve(dirname(inputPath), capture.path));
      if (!existsSync(path)) { rows.push(evaluateCapture(capture, null, "private_fixture_missing")); continue; }
      if (hash(readFileSync(path)) !== capture.sha256) throw new Error("Original image checksum mismatch");
      const probe = JSON.parse(execFileSync(python, [resolve(root, "scripts/ms57/detect.py"), path],
        { cwd: root, encoding: "utf8", timeout: 120000, maxBuffer: 2 * 1024 * 1024 }));
      if (probe.sha256 !== capture.sha256 || probe.width !== capture.width || probe.height !== capture.height ||
        probe.originalOrientation !== capture.orientation) throw new Error("Image orientation, identity or dimensions mismatch");
      const corners = (points: [number, number][] | null): QuadrilateralCorners | null => points
        ? points.map(([x, y]) => ({ x, y })) as QuadrilateralCorners : null;
      const detection: Detection = { corners: corners(probe.result.detected_corners), detectionMs: probe.detectionMs,
        candidates: probe.result.candidates.map((c: { id: string; corners: [number, number][] }) => ({ id: c.id, corners: corners(c.corners)! })) };
      rows.push(evaluateCapture(capture, detection, null, { width: probe.workspaceWidth, height: probe.workspaceHeight }));
      probes.push({ id: capture.id, ...probe });
    } catch (error) {
      rows.push(evaluateCapture(capture, null, error instanceof Error ? error.message : String(error)));
    }
  }
  const gates = releaseGates(manifest, rows);
  const summary = summarize(rows);
  const report = { version: "ms57-report-v1", createdAt: new Date().toISOString(), mode, datasetHash, manifest, state,
    freezeHash: evidence ? hash(readFileSync(privatePath(evidence))) : null,
    status: "release_blocked", benchmarkGatesPassed: mode === "holdout" && Object.values(gates).every(Boolean) &&
      summary.latencyMs.p95 !== null && summary.latencyMs.p95 <= freeze.latencyBudgetMs,
    gates, summary, strata: Object.fromEntries(STRATA.map(s => [s, summarize(rows.filter(r => r.strata.includes(s)))])),
    suppliedSamples: [1, 2, 3].map(sample => ({ sample, captures: manifest.captures.filter(c => c.sample === sample).map(c => ({
      id: c.id, status: rows.find(r => r.id === c.id)?.skipped ?? (rows.some(r => r.id === c.id) ? "probed_browser_review_pending" : "not_evaluated") })) })),
    latencyGate: freeze && summary.latencyMs.p95 !== null ? summary.latencyMs.p95 <= freeze.latencyBudgetMs : null,
    pendingEvidence: ["Pre-MS53 physical baseline unavailable unless separately captured on the original revision",
      "QAD-TC72.1 supplied sample browser outcomes", "QAD-TC72.5 mobile/desktop, mesh, snapshot, quotation/PDF parity",
      "QAD-TC72.7 lint/types/build, numeric/regression tests, /health and /analyze-image logs"],
    freezeRationale: null, supportedEnvelope: null, latencyBudgetMs: null,
    rows: rows.map(row => ({ ...row, errors: Object.fromEntries((["automatic", "candidateSelected", "corrected"] as const).map(mode =>
      [mode, Object.fromEntries((["width", "height"] as const).map(axis => {
        const result = row[mode], tape = row.tape?.[`${axis}Mm`];
        const signedMm = result?.valid && tape ? result[`${axis}Mm`] - tape : null;
        return [axis, signedMm === null ? null : { signedMm, absoluteMm: Math.abs(signedMm), relativePercent: 100 * Math.abs(signedMm) / tape! }];
      }))])) })), probes };
  save(output, report);
  console.log(JSON.stringify({ mode, status: report.status, captures: rows.length, skipped: summary.skipped, output }));
  // This tool cannot attest to browser/device or physical checks on its own.
  process.exitCode = mode === "baseline" || mode === "development" ? (rows.length && !summary.skipped ? 0 : 2) : 2;
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
