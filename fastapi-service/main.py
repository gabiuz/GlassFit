import os
import shutil
import time
from pathlib import Path
from uuid import uuid4

import cv2

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from brightness import analyze_brightness, analyze_lighting
from depth import estimate_depth, get_depth_pipeline
from image_preparation import ImagePreparationError, prepare_workspace_image, save_oriented_upload
from scene_detection import detect_scene_regions, get_scene_model
from segmentation import SegmentationError, analyze_objects

BASE_DIR = Path(__file__).resolve().parent
GENERATED_DIR = BASE_DIR / "generated"
MASK_DIR = GENERATED_DIR / "masks"
UPLOAD_DIR = GENERATED_DIR / "uploads"
SESSION_DIR = GENERATED_DIR / "sessions"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
TEMP_SESSION_TTL_MINUTES = int(os.getenv("TEMP_SESSION_TTL_MINUTES", "120"))

MASK_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="GlassFit Image Analysis Service")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/masks", StaticFiles(directory=MASK_DIR), name="masks")
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")


@app.on_event("startup")
async def warmup_models():
    """
    Pre-loads YOLO, Depth Anything V2, and SegFormer at startup so the first
    user request does not pay the model load penalty.
    """
    cleanup_expired_sessions()

    try:
        from segmentation import _get_yolo_model

        _get_yolo_model()
    except Exception:
        pass

    try:
        get_depth_pipeline()
    except Exception:
        pass

    try:
        get_scene_model()
    except Exception:
        pass


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-image")
async def analyze_image(image: UploadFile = File(...)) -> dict:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Upload a JPG, JPEG, or PNG image.")

    cleanup_expired_sessions()

    suffix = ".png" if image.content_type == "image/png" else ".jpg"
    session_id = str(uuid4())
    upload_id = session_id.replace("-", "")[:12]
    session_dir = SESSION_DIR / session_id
    session_mask_dir = session_dir / "masks"
    session_mask_url_prefix = f"/generated/sessions/{session_id}/masks"
    raw_upload_path = UPLOAD_DIR / f"{upload_id}_raw{suffix}"
    upload_path = UPLOAD_DIR / f"{upload_id}{suffix}"
    workspace_path = session_dir / "workspace.webp"

    try:
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")

        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Upload an image smaller than 12 MB.")

        session_mask_dir.mkdir(parents=True, exist_ok=True)
        raw_upload_path.write_bytes(contents)

        try:
            original_metadata = save_oriented_upload(raw_upload_path, upload_path)
        except ImagePreparationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        brightness = analyze_brightness(upload_path)
        lighting = analyze_lighting(upload_path)
        warnings: list[str] = []
        segmentation = {
            "mode": "none",
            "model": None,
        }

        try:
            segmentation_result = analyze_objects(upload_path, session_mask_dir)
            objects = segmentation_result["objects"]
            _rewrite_object_mask_urls(objects, session_mask_url_prefix)
            segmentation = {
                "mode": segmentation_result["mode"],
                "model": segmentation_result["model"],
            }
            if segmentation_result["warning"]:
                warnings.append(segmentation_result["warning"])
        except SegmentationError as exc:
            objects = []
            warnings.append(str(exc))
        except Exception as exc:
            objects = []
            warnings.append(f"Segmentation failed: {exc}")

        image_bgr = cv2.imread(str(upload_path))
        if image_bgr is not None:
            depth_result = estimate_depth(
                image_bgr,
                upload_id,
                output_dir=session_mask_dir,
                url_prefix=session_mask_url_prefix,
            )
        else:
            depth_result = {
                "depth_map_url": None,
                "available": False,
                "mode": "unavailable",
                "error": "Could not read uploaded image for depth estimation.",
            }

        depth_array_for_scene = depth_result.pop("_depth_array_normalized", None)

        if image_bgr is not None:
            scene_result = detect_scene_regions(
                image_bgr,
                upload_id,
                depth_array_normalized=depth_array_for_scene,
                output_dir=session_mask_dir,
                url_prefix=session_mask_url_prefix,
            )
        else:
            scene_result = {
                "floor_top_y_normalized": None,
                "floor_coverage": None,
                "wall_coverage": None,
                "wall_left_x_normalized": None,
                "wall_right_x_normalized": None,
                "wall_top_y_normalized": None,
                "floor_mask_url": None,
                "wall_mask_url": None,
                "available": False,
                "method": "unavailable",
                "error": "Could not read uploaded image for scene detection.",
            }

        try:
            workspace_metadata = prepare_workspace_image(upload_path, workspace_path)
        except ImagePreparationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        _map_artifacts_to_workspace(
            session_mask_dir=session_mask_dir,
            objects=objects,
            depth_result=depth_result,
            scene_result=scene_result,
            original_width=original_metadata["width"],
            original_height=original_metadata["height"],
            workspace_width=workspace_metadata["width"],
            workspace_height=workspace_metadata["height"],
        )

        _append_optional_warning(
            warnings,
            depth_result.get("error") if not depth_result.get("available") else None,
        )
        _append_optional_warning(
            warnings,
            scene_result.get("error") if not scene_result.get("available") else None,
        )

        return {
            "session_id": session_id,
            "workspace_image": {
                "url": f"/generated/sessions/{session_id}/workspace.webp",
                "width": workspace_metadata["width"],
                "height": workspace_metadata["height"],
            },
            "brightness": brightness,
            "lighting": lighting,
            "objects": objects,
            "segmentation": segmentation,
            "depth": depth_result,
            "scene": scene_result,
            "warning": warnings[0] if warnings else None,
            "warnings": warnings,
        }
    finally:
        if raw_upload_path.exists():
            raw_upload_path.unlink()
        if upload_path.exists():
            upload_path.unlink()


def cleanup_expired_sessions() -> None:
    if TEMP_SESSION_TTL_MINUTES <= 0 or not SESSION_DIR.exists():
        return

    cutoff = time.time() - TEMP_SESSION_TTL_MINUTES * 60
    for child in SESSION_DIR.iterdir():
        if not child.is_dir():
            continue
        try:
            if child.stat().st_mtime < cutoff:
                shutil.rmtree(child)
        except OSError:
            pass


def _rewrite_object_mask_urls(objects: list[dict], url_prefix: str) -> None:
    for item in objects:
        mask_url = item.get("mask_url")
        if isinstance(mask_url, str) and mask_url:
            item["mask_url"] = f"{url_prefix.rstrip('/')}/{Path(mask_url).name}"


def _map_artifacts_to_workspace(
    session_mask_dir: Path,
    objects: list[dict],
    depth_result: dict,
    scene_result: dict,
    original_width: int,
    original_height: int,
    workspace_width: int,
    workspace_height: int,
) -> None:
    scale_x = workspace_width / original_width
    scale_y = workspace_height / original_height

    for item in objects:
        bbox = item.get("bbox")
        if isinstance(bbox, list) and len(bbox) == 4:
            item["bbox"] = [
                round(bbox[0] * scale_x),
                round(bbox[1] * scale_y),
                round(bbox[2] * scale_x),
                round(bbox[3] * scale_y),
            ]
        _resize_artifact_from_url(item.get("mask_url"), session_mask_dir, workspace_width, workspace_height, cv2.INTER_NEAREST)

    _resize_artifact_from_url(
        depth_result.get("depth_map_url"),
        session_mask_dir,
        workspace_width,
        workspace_height,
        cv2.INTER_LINEAR,
    )
    _resize_artifact_from_url(
        scene_result.get("floor_mask_url"),
        session_mask_dir,
        workspace_width,
        workspace_height,
        cv2.INTER_NEAREST,
    )
    _resize_artifact_from_url(
        scene_result.get("wall_mask_url"),
        session_mask_dir,
        workspace_width,
        workspace_height,
        cv2.INTER_NEAREST,
    )


def _resize_artifact_from_url(
    url: object,
    artifact_dir: Path,
    width: int,
    height: int,
    interpolation: int,
) -> None:
    if not isinstance(url, str) or not url:
        return

    artifact_path = artifact_dir / Path(url).name
    if not artifact_path.exists():
        return

    image = cv2.imread(str(artifact_path), cv2.IMREAD_UNCHANGED)
    if image is None:
        return

    if image.shape[1] == width and image.shape[0] == height:
        return

    resized = cv2.resize(image, (width, height), interpolation=interpolation)
    cv2.imwrite(str(artifact_path), resized)


def _append_optional_warning(warnings: list[str], warning: object) -> None:
    if isinstance(warning, str) and warning:
        warnings.append(warning)
