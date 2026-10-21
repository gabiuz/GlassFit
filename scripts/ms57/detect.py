"""IMP-MS57 / SDD-C3 / QAD-TC72: private, orientation-normalized detector probe.

Only detection is timed. Decode, hashing, process startup and CV inference are excluded.
"""
import hashlib
import json
import platform
import sys
import tempfile
import time
from pathlib import Path

import cv2
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "fastapi-service"))
from paper_calibration import detect_paper_fiducial, MAX_CANDIDATES, MIN_BOUNDARY_SCORE, MIN_SELECTION_MARGIN
from image_preparation import save_oriented_upload, prepare_workspace_image


def probe(path, seed_x=None, seed_y=None):
    raw = Path(path).read_bytes()
    with Image.open(path) as original:
        orientation = original.getexif().get(274, 1)
    # Match /analyze-image normalization, including JPEG/WebP re-encoding and HEIF conversion.
    with tempfile.TemporaryDirectory() as folder:
        suffix = Path(path).suffix.lower()
        normalized = Path(folder) / ("source.jpg" if suffix in {".heic", ".heif"} else f"source{suffix}")
        save_oriented_upload(Path(path), normalized)
        workspace = prepare_workspace_image(normalized, Path(folder) / "workspace.webp")
        bgr = cv2.imread(str(normalized))
    start = time.perf_counter()
    seed_point = (float(seed_x), float(seed_y)) if seed_x is not None and seed_y is not None else None
    result = detect_paper_fiducial(bgr, seed_point=seed_point)
    elapsed = (time.perf_counter() - start) * 1000
    return {
        "sha256": hashlib.sha256(raw).hexdigest(),
        "width": bgr.shape[1], "height": bgr.shape[0], "originalOrientation": orientation,
        "workspaceWidth": workspace["width"], "workspaceHeight": workspace["height"],
        "orientedSourceToWorkspace": [[workspace["width"] / bgr.shape[1], 0, 0],
                                      [0, workspace["height"] / bgr.shape[0], 0], [0, 0, 1]],
        "detectionMs": elapsed, "result": result.to_dict(),
        "seedPoint": {"x": float(seed_x), "y": float(seed_y)} if seed_point is not None else None,
        "environment": {"cpu": platform.processor(), "platform": platform.platform(),
                        "python": platform.python_version(), "opencv": cv2.__version__,
                        "detectorMaxSide": 1024, "maxCandidates": MAX_CANDIDATES,
                        "minBoundaryScore": MIN_BOUNDARY_SCORE, "minSelectionMargin": MIN_SELECTION_MARGIN},
    }


if __name__ == "__main__":
    path_arg = sys.argv[1]
    seed_x_arg = None
    seed_y_arg = None
    if len(sys.argv) > 3 and sys.argv[2] not in ("None", "null", "") and sys.argv[3] not in ("None", "null", ""):
        try:
            seed_x_arg = float(sys.argv[2])
            seed_y_arg = float(sys.argv[3])
        except ValueError:
            pass
    print(json.dumps(probe(path_arg, seed_x_arg, seed_y_arg), allow_nan=False))
