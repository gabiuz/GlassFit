import gc
import os
import shutil
import time
from pathlib import Path
from uuid import uuid4

import cv2

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from brightness import analyze_brightness, analyze_lighting
from depth import estimate_depth, get_depth_pipeline
from exif_extraction import extract_exif_camera_info
from image_preparation import ImagePreparationError, prepare_workspace_image, save_oriented_upload
from scale_estimation import estimate_scale_from_objects
from scene_detection import detect_scene_regions, get_scene_model
from segmentation import SegmentationError, analyze_objects

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
    normalized_content_type = (content_type or "").lower().strip()
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
async def analyze_image(image: UploadFile = File(...)) -> dict:
    suffix, declared_format = _resolve_image_format(image.content_type, image.filename)
    is_heif = declared_format == "heif"

    cleanup_expired_sessions()

    session_id = str(uuid4())
    upload_id = session_id.replace("-", "")[:12]
    session_dir = SESSION_DIR / session_id
    session_mask_dir = session_dir / "masks"
    session_mask_url_prefix = f"/generated/sessions/{session_id}/masks"
    raw_upload_path = UPLOAD_DIR / f"{upload_id}_raw{suffix}"
    intermediate_suffix = ".jpg" if is_heif else suffix
    upload_path = UPLOAD_DIR / f"{upload_id}{intermediate_suffix}"
    workspace_path = session_dir / "workspace.webp"

    try:
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")

        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Upload an image smaller than 12 MB.")

        session_mask_dir.mkdir(parents=True, exist_ok=True)
        raw_upload_path.write_bytes(contents)
        exif_info = extract_exif_camera_info(raw_upload_path)

        try:
            original_metadata = save_oriented_upload(raw_upload_path, upload_path)
        except ImagePreparationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        _assert_decoded_format(declared_format, original_metadata["source_format"])

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

        image_bgr = cv2.imread(str(upload_path))

        # IMP-MS34: Depth estimation stage (skippable via ENABLE_DEPTH_ESTIMATION)
        if ENABLE_DEPTH_ESTIMATION and image_bgr is not None:
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
                "mode": "disabled" if not ENABLE_DEPTH_ESTIMATION else "unavailable",
                "error": None if not ENABLE_DEPTH_ESTIMATION else "Could not read uploaded image for depth estimation.",
            }

        depth_array_for_scene = depth_result.pop("_depth_array_normalized", None)

        # IMP-MS34: Free depth model memory before loading scene model
        if CONSERVE_MEMORY:
            import depth as depth_module
            depth_module._depth_pipe = None
            gc.collect()

        # IMP-MS34: Scene detection stage (skippable via ENABLE_SCENE_DETECTION)
        if ENABLE_SCENE_DETECTION and image_bgr is not None:
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
                "method": "disabled" if not ENABLE_SCENE_DETECTION else "unavailable",
                "error": None if not ENABLE_SCENE_DETECTION else "Could not read uploaded image for scene detection.",
            }

        # IMP-MS34: Free scene model memory after inference
        if CONSERVE_MEMORY:
            import scene_detection as scene_module
            scene_module._scene_processor = None
            scene_module._scene_model = None
            gc.collect()

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
            "scale_estimation": scale_estimation_dict,
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


def _serve_generated_artifact(root: Path, artifact_path: str) -> FileResponse:
    resolved_root = root.resolve()
    resolved_artifact = (resolved_root / artifact_path).resolve()

    if resolved_root not in resolved_artifact.parents or not resolved_artifact.is_file():
        raise HTTPException(status_code=404, detail="Generated artifact not found.")

    return FileResponse(resolved_artifact)


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
