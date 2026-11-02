"""FIX14, FIX16 / QAD-TC4: evaluate consented local photos without retaining images.

Usage: venv/bin/python evaluate_photo_suitability.py /tmp/private-manifest.json
Manifest: [{"name": "room-1", "path": "/local/photo.heic", "expected": "accepted"}]
The manifest and source photos stay outside the repository. This runs the
installed YOLO and SegFormer models and prints only compact feature summaries.
"""

import argparse
import json
import time
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2

from brightness import analyze_brightness
from image_preparation import prepare_workspace_image, save_oriented_upload
from photo_suitability import assess_photo_suitability
from scene_detection import detect_scene_segformer, independent_scene_evidence
from segmentation import analyze_objects


def evaluate(path: Path) -> dict:
    started = time.perf_counter()
    with TemporaryDirectory(prefix="glassfit-suitability-") as temporary:
        directory = Path(temporary)
        normalized = directory / ("normalized.jpg" if path.suffix.lower() in {".heic", ".heif"} else "normalized" + path.suffix.lower())
        metadata = save_oriented_upload(path, normalized)
        workspace = directory / "workspace.webp"
        prepare_workspace_image(normalized, workspace)
        image = cv2.imread(str(workspace))
        if image is None:
            raise ValueError("Normalized workspace image could not be read")
        segmentation = analyze_objects(normalized, directory)
        scene = detect_scene_segformer(image, "local", output_dir=directory)
        semantic_map = scene.pop("_semantic_map", None)
        geometric_opening = scene.pop("_geometric_opening", False)
        evidence_started = time.perf_counter()
        independent_scene = independent_scene_evidence(
            semantic_map, segmentation["objects"], metadata["width"], metadata["height"],
        )
        evidence_ms = round((time.perf_counter() - evidence_started) * 1000, 2)
        brightness = analyze_brightness(normalized)
        decision = assess_photo_suitability(
            segmentation["objects"], segmentation, scene,
            metadata["width"], metadata["height"], brightness["mean_pixel_intensity"],
            independent_scene=independent_scene,
            geometric_opening=geometric_opening,
        )
        return {
            "decision": decision,
            "segmentation_mode": segmentation["mode"],
            "scene_method": scene["method"],
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
            "spatial_evidence_ms": evidence_ms,
            "geometric_opening": geometric_opening,
            "objects": [
                {"label": item["label"], "confidence": item["confidence"], "bbox": item["bbox"]}
                for item in segmentation["objects"]
            ],
            "features": {
                key: scene.get(key)
                for key in (
                    "wall_coverage", "floor_coverage", "ceiling_coverage",
                    "opening_coverage", "opening_vertical_span", "building_coverage",
                    "exterior_context_coverage",
                )
            } | {"mean_pixel_intensity": brightness["mean_pixel_intensity"]},
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Private JSON manifest outside the repository")
    arguments = parser.parse_args()
    cases = json.loads(arguments.manifest.read_text())
    failures = 0
    false_acceptances = 0
    false_rejections = 0
    elapsed = []
    for case in cases:
        result = evaluate(Path(case["path"]))
        elapsed.append(result["elapsed_ms"])
        observed = result["decision"]["status"]
        expected = case.get("expected")
        if expected is not None and observed != expected:
            failures += 1
            if observed == "accepted":
                false_acceptances += 1
            elif expected == "accepted":
                false_rejections += 1
        print(json.dumps({"name": case["name"], "expected": expected, **result}))
    print(json.dumps({"summary": {"cases": len(cases), "mismatches": failures,
                                  "false_acceptances": false_acceptances,
                                  "false_rejections": false_rejections,
                                  "mean_elapsed_ms": round(sum(elapsed) / len(elapsed), 2) if elapsed else None}}))
    if failures:
        raise SystemExit(f"{failures} expected decisions did not match")


if __name__ == "__main__":
    main()
