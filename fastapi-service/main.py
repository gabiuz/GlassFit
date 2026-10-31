import gc
import os
import shutil
import time
from pathlib import Path
from uuid import uuid4

import cv2

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from brightness import analyze_brightness, analyze_lighting
from depth import estimate_depth, get_depth_pipeline
from exif_extraction import extract_exif_camera_info
from image_preparation import ImagePreparationError, prepare_workspace_image, save_oriented_upload
from scale_estimation import estimate_scale_from_objects
from scene_detection import detect_scene_regions, get_scene_model
from segmentation import SegmentationError, analyze_objects
from photo_suitability import assess_photo_suitability

BASE_DIR = Path(__file__).resolve().parent
GENERATED_DIR = (
    Path("/tmp/glassfit/generated")
    if os.getenv("USE_TMP_STORAGE")
    else BASE_DIR / "generated"
)
MASK_DIR = GENERATED_DIR / "masks"
UPLOAD_DIR = GENERATED_DIR / "uploads"
SESSION_DIR = GENERATED_DIR / "sessions"
MIME_FORMATS: dict[str, tuple[str, set[str]]] = {
    "image/jpeg": ("jpeg", {".jpg", ".jpeg"}),
    "image/jpg": ("jpeg", {".jpg", ".jpeg"}),
    "image/png": ("png", {".png"}),
    "image/webp": ("webp", {".webp"}),
    "image/heic": ("heif", {".heic", ".heif"}),
    "image/heif": ("heif", {".heic", ".heif"}),
}
EXTENSION_FORMATS = {
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".png": "png",
    ".webp": "webp",
    ".heic": "heif",
    ".heif": "heif",
}
GENERIC_CONTENT_TYPES = {"", "application/octet-stream"}
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
TEMP_SESSION_TTL_MINUTES = int(os.getenv("TEMP_SESSION_TTL_MINUTES", "120"))


def _resolve_image_format(
    content_type: str | None,
    filename: str | None,
) -> tuple[str, str]:
    """Resolve the approved source suffix and declared image format family."""
    raw_content_type = (content_type or "").split(";")[0]
    normalized_content_type = raw_content_type.lower().strip()
    extension = Path(filename or "").suffix.lower()
    extension_format = EXTENSION_FORMATS.get(extension)
    if extension_format is None:
        raise HTTPException(400, "Upload a JPG, PNG, WebP, or HEIC/HEIF image.")

    if normalized_content_type in GENERIC_CONTENT_TYPES:
        return extension, extension_format

    mime_contract = MIME_FORMATS.get(normalized_content_type)
    if mime_contract is None:
        raise HTTPException(400, "Upload a JPG, PNG, WebP, or HEIC/HEIF image.")

    declared_format, allowed_extensions = mime_contract
    if extension not in allowed_extensions:
        raise HTTPException(400, "The file type and filename extension do not match.")

    return extension, declared_format


def _assert_decoded_format(declared_format: str, decoded_format: str) -> None:
    normalized_decoded = decoded_format.lower()
    compatible = normalized_decoded == declared_format or (
        declared_format == "heif" and normalized_decoded in {"heic", "heif"}
    )
    if not compatible:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image contents do not match its declared format.",
        )


def _env_flag(name: str, default: bool = True) -> bool:
    """Read a boolean flag from an environment variable."""
    val = os.getenv(name, "")
    if not val:
        return default
    return val.lower() in ("1", "true", "yes")


ENABLE_DEPTH_ESTIMATION = _env_flag("ENABLE_DEPTH_ESTIMATION", default=True)
ENABLE_SCENE_DETECTION = _env_flag("ENABLE_SCENE_DETECTION", default=True)
CONSERVE_MEMORY = _env_flag("CONSERVE_MEMORY", default=False)

MASK_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="GlassFit Image Analysis Service")

_ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
_EXTRA_ORIGINS: list[str] = [
    origin.strip()
    for origin in _ALLOWED_ORIGINS_ENV.split(",")
    if origin.strip()
]
_LOCALHOST_REGEX = r"http://(localhost|127\.0\.0\.1):\d+"

if _EXTRA_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_EXTRA_ORIGINS,
        allow_origin_regex=_LOCALHOST_REGEX,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=_LOCALHOST_REGEX,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.on_event("startup")
async def warmup_models():
    """
    Pre-loads YOLO, Depth Anything V2, and SegFormer at startup so the first
    user request does not pay the model load penalty.

    When CONSERVE_MEMORY is enabled, skip pre-loading transformer models
    because they will be freed after each request anyway.
    """
    cleanup_expired_sessions()
    # FIX14: process replacement can interrupt a request before finally runs.
    for marker in SESSION_DIR.glob("*/.incomplete"):
        upload_prefix = marker.parent.name.replace("-", "")[:12]
        for upload_file in UPLOAD_DIR.glob(f"{upload_prefix}*"):
            upload_file.unlink(missing_ok=True)
        shutil.rmtree(marker.parent, ignore_errors=True)

    try:
        from segmentation import _get_yolo_model

        _get_yolo_model()
    except Exception:
        pass

    if ENABLE_DEPTH_ESTIMATION and not CONSERVE_MEMORY:
        try:
            get_depth_pipeline()
        except Exception:
            pass

    if ENABLE_SCENE_DETECTION and not CONSERVE_MEMORY:
        try:
            get_scene_model()
        except Exception:
            pass


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/masks/{artifact_path:path}")
def get_legacy_mask(artifact_path: str) -> FileResponse:
    return _serve_generated_artifact(MASK_DIR, artifact_path)


@app.get("/generated/{artifact_path:path}")
def get_generated_artifact(artifact_path: str) -> FileResponse:
    return _serve_generated_artifact(GENERATED_DIR, artifact_path)


@app.post("/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    calibration_mode: str = Form("auto_detect"),
    paper_standard: str | None = Form(None),
    seed_x: float | None = Form(None),
    seed_y: float | None = Form(None),
) -> dict:
    suffix, declared_format = _resolve_image_format(image.content_type, image.filename)
    is_heif = declared_format == "heif"

    cleanup_expired_sessions()

    session_id = str(uuid4())
    upload_id = session_id.replace("-", "")[:12]
    session_dir = SESSION_DIR / session_id
    session_mask_dir = session_dir / "masks"
    incomplete_marker = session_dir / ".incomplete"
    session_mask_url_prefix = f"/generated/sessions/{session_id}/masks"
    raw_upload_path = UPLOAD_DIR / f"{upload_id}_raw{suffix}"
    intermediate_suffix = ".jpg" if is_heif else suffix
    upload_path = UPLOAD_DIR / f"{upload_id}{intermediate_suffix}"
    workspace_path = session_dir / "workspace.webp"

    accepted_session = False
    try:
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")

        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Upload an image smaller than 12 MB.")

        session_mask_dir.mkdir(parents=True, exist_ok=True)
        incomplete_marker.touch()
        raw_upload_path.write_bytes(contents)
        exif_info = extract_exif_camera_info(raw_upload_path)

        try:
            original_metadata = save_oriented_upload(raw_upload_path, upload_path)
        except ImagePreparationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        _assert_decoded_format(declared_format, original_metadata["source_format"])

        # IMP-MS63: Early workspace WebP generation and normalized BGR loading
        try:
            workspace_metadata = prepare_workspace_image(upload_path, workspace_path)
        except ImagePreparationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        workspace_bgr = cv2.imread(str(workspace_path))
        if workspace_bgr is None:
            raise HTTPException(status_code=500, detail="Failed to load workspace image.")

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

        # IMP-MS34: Free YOLO model memory before loading transformer models
        if CONSERVE_MEMORY:
            from segmentation import _YOLO_MODEL_CACHE
            _YOLO_MODEL_CACHE.clear()
            gc.collect()

        # IMP-MS63: Depth estimation operates on downscaled workspace array to conserve memory and latency
        if ENABLE_DEPTH_ESTIMATION and workspace_bgr is not None:
            depth_result = estimate_depth(
                workspace_bgr,
                upload_id,
                output_dir=session_mask_dir,
                url_prefix=session_mask_url_prefix,
            )
        else:
            depth_result = {
                "depth_map_url": None,
                "available": False,
                "mode": "disabled" if not ENABLE_DEPTH_ESTIMATION else "unavailable",
                "error": None if not ENABLE_DEPTH_ESTIMATION else "Could not read uploaded image for depth estimation.",
            }

        depth_array_for_scene = depth_result.pop("_depth_array_normalized", None)

        # IMP-MS34: Free depth model memory before loading scene model
        if CONSERVE_MEMORY:
            import depth as depth_module
            depth_module._depth_pipe = None
            gc.collect()

        # IMP-MS63: Scene detection stage on workspace array
        if ENABLE_SCENE_DETECTION and workspace_bgr is not None:
            scene_result = detect_scene_regions(
                workspace_bgr,
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
                "method": "disabled" if not ENABLE_SCENE_DETECTION else "unavailable",
                "error": None if not ENABLE_SCENE_DETECTION else "Could not read uploaded image for scene detection.",
            }

        # IMP-MS34: Free scene model memory after inference
        if CONSERVE_MEMORY:
            import scene_detection as scene_module
            scene_module._scene_processor = None
            scene_module._scene_model = None
            gc.collect()

        suitability = assess_photo_suitability(
            objects, segmentation, scene_result,
            original_metadata["width"], original_metadata["height"],
            brightness.get("mean_pixel_intensity"),
        )
        if suitability["status"] != "accepted":
            rejected = suitability["status"] == "rejected"
            too_close = suitability["status"] == "too_close"
            raise HTTPException(
                status_code=422 if rejected or too_close else 503,
                detail={
                    "code": (
                        "SPACE_PHOTO_REJECTED" if rejected else
                        "SPACE_PHOTO_TOO_CLOSE" if too_close else
                        "SPACE_PHOTO_UNVERIFIABLE"
                    ),
                    "message": (
                        "This does not appear to be a space photo. Upload the room or opening where the product will be installed."
                        if rejected else
                        "Move farther back and include more of the room or opening where the product will be installed."
                        if too_close else
                        "We could not verify this space photo. Retake the photo or try again."
                    ),
                    "reason": suitability["reason"],
                },
            )

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

        try:
            scale_result = estimate_scale_from_objects(
                detected_objects=objects,
                depth_array_normalized=depth_array_for_scene,
                image_height=workspace_metadata["height"],
                image_width=workspace_metadata["width"],
            )
            scale_result.exif_focal_length_mm = exif_info.focal_length_mm
            scale_result.exif_focal_length_35mm = exif_info.focal_length_35mm_equiv
            scale_result.exif_device_model = exif_info.device_model
            scale_estimation_dict = scale_result.to_dict()
        except Exception as exc:
            warnings.append(f"Scale estimation failed: {exc}")
            scale_estimation_dict = {
                "anchors": [],
                "best_scale_cm_per_px": None,
                "confidence": 0.0,
                "method": "none",
                "exif_focal_length_mm": exif_info.focal_length_mm,
                "exif_focal_length_35mm": exif_info.focal_length_35mm_equiv,
                "exif_device_model": exif_info.device_model,
            }

        # IMP-MS53 / IMP-MS58: localization does not establish a physical scale.
        from paper_calibration import PaperCalibrationResult, detect_paper_fiducial
        paper_result = PaperCalibrationResult(
            status="not_requested", paper_standard=None, detected_corners=None,
            scale_cm_per_px=None, confidence=0, homography_matrix=None,
        )

        seed_point = None
        if seed_x is not None or seed_y is not None:
            if seed_x is None or seed_y is None:
                raise HTTPException(status_code=422, detail="Both seed_x and seed_y must be provided.")
            import math
            if not (math.isfinite(seed_x) and math.isfinite(seed_y)):
                raise HTTPException(status_code=422, detail="Seed coordinates must be finite real numbers.")
            clamped_x = max(0.0, min(1.0, float(seed_x)))
            clamped_y = max(0.0, min(1.0, float(seed_y)))
            seed_point = (clamped_x, clamped_y)

        if calibration_mode == "paper_fiducial":
            try:
                # IMP-MS63: Run paper detection directly on downscaled workspace BGR
                paper_result = detect_paper_fiducial(workspace_bgr, paper_standard, seed_point=seed_point)
            except Exception as exc:
                warnings.append(f"Paper fiducial detection error: {exc}")
                paper_result.status = "manual_pin_required"

        orig_w = max(original_metadata["width"], 1)
        orig_h = max(original_metadata["height"], 1)
        work_w = workspace_metadata["width"]
        work_h = workspace_metadata["height"]
        scale_x, scale_y = work_w / orig_w, work_h / orig_h

        # Corners are already in workspace pixel space because detection executed on workspace_bgr
        paper_result.coordinate_space = "workspace"
        paper_result.coordinate_image_id = session_id
        paper_result.oriented_source_to_workspace = (
            (scale_x, 0.0, 0.0), (0.0, scale_y, 0.0), (0.0, 0.0, 1.0),
        )
        paper_result.image_width, paper_result.image_height = work_w, work_h
        paper_calibration_dict = paper_result.to_dict()
        calibration_meta = {
            "mode": calibration_mode,
            "paper_standard": paper_result.paper_standard,
            "status": (paper_result.status if calibration_mode == "paper_fiducial" else "heuristic_fallback"),
            "confidence": paper_result.confidence,
            "reference_source": paper_result.reference_source,
            "selected_candidate_id": paper_result.selected_candidate_id,
            "suggested_paper_standard": paper_result.suggested_paper_standard,
            "aspect_ratio_match_confidence": paper_result.aspect_ratio_match_confidence,
            "unwarped_aspect_ratio": paper_result.unwarped_aspect_ratio,
            "homography_matrix": None,
            "detected_corners": paper_result.detected_corners,
            "user_verified": False,
            "paper_standard_confirmed": False,
        }

        _append_optional_warning(
            warnings,
            depth_result.get("error") if not depth_result.get("available") else None,
        )
        _append_optional_warning(
            warnings,
            scene_result.get("error") if not scene_result.get("available") else None,
        )

        incomplete_marker.unlink(missing_ok=True)
        accepted_session = True
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
            "scale_estimation": scale_estimation_dict,
            "paper_calibration": paper_calibration_dict,
            "calibration_meta": calibration_meta,
            "warning": warnings[0] if warnings else None,
            "warnings": warnings,
        }
    finally:
        if not accepted_session:
            shutil.rmtree(session_dir, ignore_errors=True)
        if raw_upload_path.exists():
            raw_upload_path.unlink()
        if upload_path.exists():
            upload_path.unlink()


@app.post("/snap-paper")
async def snap_paper(request: Request) -> dict:
    """IMP-MS63: Lightweight paper fiducial snapping using cached session workspace WebP."""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON body.") from exc
        session_id = body.get("session_id")
        seed_x = body.get("seed_x")
        seed_y = body.get("seed_y")
        paper_standard = body.get("paper_standard")
    else:
        form = await request.form()
        session_id = form.get("session_id")
        seed_x = form.get("seed_x")
        seed_y = form.get("seed_y")
        paper_standard = form.get("paper_standard")

    if not session_id or not isinstance(session_id, str):
        raise HTTPException(status_code=422, detail="session_id is required.")

    if seed_x is None or seed_y is None:
        raise HTTPException(status_code=422, detail="Both seed_x and seed_y must be provided.")

    try:
        sx = float(seed_x)
        sy = float(seed_y)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Seed coordinates must be valid numbers.")

    import math
    if not (math.isfinite(sx) and math.isfinite(sy)):
        raise HTTPException(status_code=422, detail="Seed coordinates must be finite real numbers.")

    clamped_x = max(0.0, min(1.0, sx))
    clamped_y = max(0.0, min(1.0, sy))

    session_dir = SESSION_DIR / session_id
    workspace_path = session_dir / "workspace.webp"
    if not workspace_path.exists():
        raise HTTPException(status_code=404, detail="Visualization session expired or not found.")

    image_bgr = cv2.imread(str(workspace_path))
    if image_bgr is None:
        raise HTTPException(status_code=500, detail="Could not read workspace image.")

    h, w = image_bgr.shape[:2]
    from paper_calibration import detect_paper_fiducial
    result = detect_paper_fiducial(
        image_bgr,
        str(paper_standard) if paper_standard else None,
        seed_point=(clamped_x, clamped_y),
    )
    result.coordinate_space = "workspace"
    result.coordinate_image_id = session_id
    result.image_width = w
    result.image_height = h
    return result.to_dict()


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


def _serve_generated_artifact(root: Path, artifact_path: str) -> FileResponse:
    resolved_root = root.resolve()
    resolved_artifact = (resolved_root / artifact_path).resolve()

    if resolved_root not in resolved_artifact.parents or not resolved_artifact.is_file():
        raise HTTPException(status_code=404, detail="Generated artifact not found.")

    return FileResponse(
        resolved_artifact,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Vary": "Origin",
        },
    )


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
