/**
 * IMP-MS61 / QAD-TC76: Comparative Fiducial Accuracy Benchmark Runner and Reporter.
 * Compares Full-Automatic (MOD-AUTO), Click-Guided Snap (MOD-CLICK), and Manual Pinning (MOD-MANUAL).
 *
 * Traceability: PRD-F3, PRD-F4, PRD-F5, PRD-F6, PRD-F10, SDD-C2, SDD-C3, SDD-C4, SDD-C5, SDD-C7, BRD-M1, BRD-M5, BRD-M6, QAD-TC76.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import {
  computeCentroid,
  generatePerturbedSeeds,
  evaluateComparativeCapture,
  summarizeComparative,
  comparativeReleaseGates,
  generateComparativeMarkdownReport,
  parseManifest,
  type Capture,
  type Detection,
  type ComparativeEvaluation,
} from "./benchmark";
import type { QuadrilateralCorners } from "../../src/lib/visualization/types";

const root = resolve(import.meta.dirname, "../..");

function privatePath(path: string) {
  const full = resolve(path);
  const publicRelative = relative(resolve(root, "public"), full);
  if (publicRelative === "" || (!publicRelative.startsWith(`..${sep}`) && publicRelative !== ".." && !isAbsolute(publicRelative))) {
    throw new Error("Private benchmark resources and output cannot be placed in public/");
  }
  return full;
}

function saveFile(path: string, content: string) {
  const full = privatePath(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, { flag: "w" });
}

interface CliArgs {
  mode: "auto" | "click_guided" | "manual" | "compare_all";
  manifestPath: string;
  outputPath: string;
  reportPath: string | null;
  simulatePerturbations: boolean;
}

function parseCliArgs(args: string[]): CliArgs {
  let mode: CliArgs["mode"] = "compare_all";
  let manifestPath = "tests/private/ms57/manifest.json";
  let outputPath = "tests/private/ms61/comparative_results.json";
  let reportPath: string | null = "tests/private/ms61/comparative_report.md";
  let simulatePerturbations = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--mode" && i + 1 < args.length) {
      const m = args[++i];
      if (["auto", "click_guided", "manual", "compare_all"].includes(m)) {
        mode = m as CliArgs["mode"];
      }
    } else if (arg === "--manifest" && i + 1 < args.length) {
      manifestPath = args[++i];
    } else if (arg === "--output" && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (arg === "--report" && i + 1 < args.length) {
      reportPath = args[++i];
    } else if (arg === "--simulate-perturbations") {
      simulatePerturbations = true;
    } else if (!arg.startsWith("--")) {
      // Positional args fallback: <mode> <manifest> <output> [report]
      if (i === 0 && ["auto", "click_guided", "manual", "compare_all"].includes(arg)) {
        mode = arg as CliArgs["mode"];
      } else if (i === 1) {
        manifestPath = arg;
      } else if (i === 2) {
        outputPath = arg;
      } else if (i === 3) {
        reportPath = arg;
      }
    }
  }

  return { mode, manifestPath, outputPath, reportPath, simulatePerturbations };
}

function runProbe(python: string, imagePath: string, seed: { x: number; y: number } | null): Detection | null {
  try {
    const probeArgs = [resolve(root, "scripts/ms57/detect.py"), imagePath];
    if (seed !== null) {
      probeArgs.push(String(seed.x), String(seed.y));
    }
    const output = execFileSync(python, probeArgs, {
      cwd: root,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const probe = JSON.parse(output);
    const corners = (points: [number, number][] | null): QuadrilateralCorners | null =>
      points ? (points.map(([x, y]) => ({ x, y })) as QuadrilateralCorners) : null;
    return {
      corners: corners(probe.result.detected_corners),
      detectionMs: probe.detectionMs,
      candidates: (probe.result.candidates ?? []).map((c: { id: string; corners: [number, number][] }) => ({
        id: c.id,
        corners: corners(c.corners)!,
      })),
    };
  } catch {
    return null;
  }
}

export function runComparativeBenchmark(cli: CliArgs) {
  const fullManifestPath = privatePath(cli.manifestPath);
  if (!existsSync(fullManifestPath)) {
    console.error(`Manifest file not found: ${fullManifestPath}`);
    return { status: "missing_manifest", passed: false };
  }

  const manifest = parseManifest(JSON.parse(readFileSync(fullManifestPath, "utf8")));
  const python = process.env.MS57_PYTHON ?? "python";
  const rows: ComparativeEvaluation[] = [];

  for (const capture of manifest.captures) {
    const imagePath = privatePath(resolve(dirname(fullManifestPath), capture.path));
    const imageExists = existsSync(imagePath);

    if (!imageExists) {
      rows.push(evaluateComparativeCapture(capture, null, null, null));
      continue;
    }

    // 1. Auto detection (MOD-AUTO)
    let autoDetection: Detection | null = null;
    if (cli.mode === "auto" || cli.mode === "compare_all") {
      autoDetection = runProbe(python, imagePath, null);
    }

    // 2. Click-guided snap (MOD-CLICK)
    let clickDetection: Detection | null = null;
    if (cli.mode === "click_guided" || cli.mode === "compare_all") {
      const seed = computeCentroid(capture.paper);
      clickDetection = runProbe(python, imagePath, seed);

      // Optional seed perturbation validation
      if (cli.simulatePerturbations && capture.paper) {
        const perturbed = generatePerturbedSeeds(capture.paper);
        for (const pSeed of perturbed) {
          runProbe(python, imagePath, { x: pSeed.x, y: pSeed.y });
        }
      }
    }

    // 3. Manual 4-corner placement (MOD-MANUAL)
    const manualCorners = capture.noPaper ? null : capture.paper;

    rows.push(evaluateComparativeCapture(capture, autoDetection, clickDetection, manualCorners));
  }

  const summary = summarizeComparative(rows);
  const gates = comparativeReleaseGates(summary);
  const markdownReport = generateComparativeMarkdownReport(manifest, rows, gates);

  // Save output JSON and Markdown report
  saveFile(cli.outputPath, JSON.stringify({ version: "ms61-comparative-v1", manifest, summary, gates, rows }, null, 2));
  if (cli.reportPath) {
    saveFile(cli.reportPath, markdownReport);
  }

  console.log(`Comparative Benchmark Completed: ${gates.allPassed ? "PASS" : "RELEASE_BLOCKED"}`);
  console.log(`Results saved to: ${cli.outputPath}`);
  if (cli.reportPath) {
    console.log(`Markdown report saved to: ${cli.reportPath}`);
  }

  return { status: gates.allPassed ? "pass" : "release_blocked", passed: gates.allPassed, summary, gates };
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const res = runComparativeBenchmark(cli);
  process.exitCode = res.passed ? 0 : 2;
}

if (process.argv[1] && process.argv[1].endsWith("comparator.ts")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
