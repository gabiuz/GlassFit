from pathlib import Path
from uuid import uuid4

import cv2

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from brightness import analyze_brightness, analyze_lighting
from depth import estimate_depth, get_depth_pipeline
from scene_detection import detect_scene_regions, get_scene_model
from segmentation import SegmentationError, analyze_objects

BASE_DIR = Path(__file__).resolve().parent
GENERATED_DIR = BASE_DIR / "generated"
MASK_DIR = GENERATED_DIR / "masks"
UPLOAD_DIR = GENERATED_DIR / "uploads"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}

MASK_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="GlassFit Image Analysis Service")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/masks", StaticFiles(directory=MASK_DIR), name="masks")


@app.on_event("startup")
async def warmup_models():
    """
    Pre-loads YOLO, Depth Anything V2, and SegFormer at startup so the first
    user request does not pay the model load penalty.
    """
    try:
        from segmentation import _get_yolo_model
        _get_yolo_model()
    except Exception:
        pass  # YOLO warmup failure is non-fatal

    try:
        get_depth_pipeline()
    except Exception:
        pass  # Depth warmup failure is non-fatal

    try:
        get_scene_model()
    except Exception:
        pass  # Scene warmup failure is non-fatal — scene field returns unavailable


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-image")
async def analyze_image(image: UploadFile = File(...)) -> dict:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Upload a JPG, JPEG, or PNG image.")

    suffix = ".png" if image.content_type == "image/png" else ".jpg"
    # Shared upload_id for consistent depth map and mask file naming.
    upload_id = uuid4().hex[:12]
    upload_path = UPLOAD_DIR / f"{upload_id}{suffix}"

    try:
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")

        upload_path.write_bytes(contents)
        brightness = analyze_brightness(upload_path)
        lighting = analyze_lighting(upload_path)
        warning = None
        segmentation = {
            "mode": "none",
            "model": None,
        }

        try:
            segmentation_result = analyze_objects(upload_path, MASK_DIR)
            objects = segmentation_result["objects"]
            segmentation = {
                "mode": segmentation_result["mode"],
                "model": segmentation_result["model"],
            }
            warning = segmentation_result["warning"]
        except SegmentationError as exc:
            objects = []
            warning = str(exc)
        except Exception as exc:
            objects = []
            warning = f"Segmentation failed: {exc}"

        # Depth Anything V2 — non-fatal if it fails.
        image_bgr = cv2.imread(str(upload_path))
        if image_bgr is not None:
            depth_result = estimate_depth(image_bgr, upload_id)
        else:
            depth_result = {
                "depth_map_url": None,
                "available": False,
                "mode": "unavailable",
                "error": "Could not read uploaded image for depth estimation.",
            }

        # Extract raw depth array for scene fallback before stripping internal key.
        depth_array_for_scene = depth_result.pop("_depth_array_normalized", None)

        # Scene detection — SegFormer with depth-plane fallback.
        if image_bgr is not None:
            scene_result = detect_scene_regions(
                image_bgr,
                upload_id,
                depth_array_normalized=depth_array_for_scene,
            )
        else:
            scene_result = {
                "floor_top_y_normalized":  None,
                "floor_coverage":          None,
                "wall_coverage":           None,
                "wall_left_x_normalized":  None,
                "wall_right_x_normalized": None,
                "wall_top_y_normalized":   None,
                "floor_mask_url": None,
                "wall_mask_url":  None,
                "available": False,
                "method":    "unavailable",
                "error":     "Could not read uploaded image for scene detection.",
            }

        return {
            "brightness":   brightness,
            "lighting":     lighting,
            "objects":      objects,
            "segmentation": segmentation,
            "depth":        depth_result,
            "scene":        scene_result,
            "warning":      warning,
        }
    finally:
        if upload_path.exists():
            upload_path.unlink()
