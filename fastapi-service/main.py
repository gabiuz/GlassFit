import asyncio
import logging
import os
import shutil
import time
from collections import deque
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import cv2

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from brightness import analyze_brightness, analyze_lighting
from depth import estimate_depth
from exif_extraction import extract_exif_camera_info
from image_preparation import ImagePreparationError, prepare_workspace_image, save_oriented_upload
from scale_estimation import estimate_scale_from_objects
from scene_detection import detect_scene_regions
from segmentation import SegmentationError, analyze_objects

LOGGER = logging.getLogger("glassfit.image_analysis")

BASE_DIR = Path(__file__).resolve().parent
GENERATED_DIR = Path(os.getenv("GENERATED_DIR", str(BASE_DIR / "generated")))
MASK_DIR = GENERATED_DIR / "masks"
UPLOAD_DIR = GENERATED_DIR / "uploads"
SESSION_DIR = GENERATED_DIR / "sessions"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
TEMP_SESSION_TTL_MINUTES = int(os.getenv("TEMP_SESSION_TTL_MINUTES", "120"))
CLEANUP_INTERVAL_SECONDS = max(60, int(os.getenv("CLEANUP_INTERVAL_SECONDS", "900")))
RENDER_FREE_MODE = os.getenv("RENDER_FREE_MODE", "false").lower() == "true"
ENABLE_DEPTH_ANALYSIS = os.getenv("ENABLE_DEPTH_ANALYSIS", "true").lower() == "true"
ENABLE_SCENE_ANALYSIS = os.getenv("ENABLE_SCENE_ANALYSIS", "true").lower() == "true"
MAX_CONCURRENT_ANALYSES = max(1, int(os.getenv("MAX_CONCURRENT_ANALYSES", "1")))
ANALYSIS_QUEUE_TIMEOUT_SECONDS = max(0.1, float(os.getenv("ANALYSIS_QUEUE_TIMEOUT_SECONDS", "5")))
RATE_LIMIT_REQUESTS = max(1, int(os.getenv("RATE_LIMIT_REQUESTS", "5")))
RATE_LIMIT_WINDOW_SECONDS = max(1, int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "600")))
MAX_RATE_LIMIT_ENTRIES = 10_000

ANALYSIS_SEMAPHORE = asyncio.Semaphore(MAX_CONCURRENT_ANALYSES)


def _ensure_generated_directories() -> None:
    MASK_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_DIR.mkdir(parents=True, exist_ok=True)


class InMemoryRateLimiter:
    def __init__(self, request_limit: int, window_seconds: int, max_entries: int) -> None:
        self.request_limit = request_limit
        self.window_seconds = window_seconds
        self.max_entries = max_entries
        self._requests: dict[str, deque[float]] = {}
        self._lock = asyncio.Lock()

    async def admit(self, client_key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds

        async with self._lock:
            self._evict_expired(cutoff)
            timestamps = self._requests.get(client_key)
            if timestamps is None:
                if len(self._requests) >= self.max_entries:
                    oldest_key = min(self._requests, key=lambda key: self._requests[key][0])
                    del self._requests[oldest_key]
                timestamps = deque()
                self._requests[client_key] = timestamps

            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()
            if len(timestamps) >= self.request_limit:
                return False

            timestamps.append(now)
            return True

    def _evict_expired(self, cutoff: float) -> None:
        expired_keys: list[str] = []
        for client_key, timestamps in self._requests.items():
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()
            if not timestamps:
                expired_keys.append(client_key)
        for client_key in expired_keys:
            del self._requests[client_key]


RATE_LIMITER = InMemoryRateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS, MAX_RATE_LIMIT_ENTRIES)


def _parse_allowed_origins(raw_value: str) -> list[str]:
    origins: list[str] = []
    for raw_origin in raw_value.split(","):
        origin = raw_origin.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlparse(origin)
        if (
            "*" in origin
            or parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.path not in {"", "/"}
            or parsed.params
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(f"Invalid origin in ALLOWED_ORIGINS: {origin}")
        if origin not in origins:
            origins.append(origin)
    return origins


ALLOWED_ORIGINS = _parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", ""))


async def _periodic_cleanup() -> None:
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            await asyncio.to_thread(cleanup_expired_sessions)
        except Exception:
            LOGGER.exception("Periodic generated-session cleanup failed.")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _ensure_generated_directories()
    await asyncio.to_thread(cleanup_expired_sessions)
    cleanup_task = asyncio.create_task(_periodic_cleanup())
    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task


_ensure_generated_directories()
app = FastAPI(title="GlassFit Image Analysis Service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> JSONResponse:
    generated_directory_writable = await asyncio.to_thread(_generated_directory_is_writable)
    yolo_available = await asyncio.to_thread(_yolo_is_available)
    ready_state = generated_directory_writable and yolo_available
    return JSONResponse(
        status_code=200 if ready_state else 503,
        content={
            "status": "ready" if ready_state else "not_ready",
            "profile": "render_free" if RENDER_FREE_MODE else "standard",
            "generated_directory_writable": generated_directory_writable,
            "analysis_capacity": {
                "configured_slots": MAX_CONCURRENT_ANALYSES,
                "slot_available": not ANALYSIS_SEMAPHORE.locked(),
            },
            "models": {
                "yolo": "available" if yolo_available else "failed",
                "depth": "enabled" if ENABLE_DEPTH_ANALYSIS else "disabled",
                "scene": "enabled" if ENABLE_SCENE_ANALYSIS else "disabled",
            },
        },
    )


@app.get("/masks/{artifact_path:path}")
def get_legacy_mask(artifact_path: str) -> FileResponse:
    return _serve_generated_artifact(MASK_DIR, artifact_path)


@app.get("/generated/{artifact_path:path}")
def get_generated_artifact(artifact_path: str) -> FileResponse:
    return _serve_generated_artifact(GENERATED_DIR, artifact_path)


@app.post("/analyze-image", response_model=None)
async def analyze_image(request: Request, image: UploadFile = File(...)) -> dict[str, Any] | JSONResponse:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Upload a JPG, JPEG, or PNG image.")

    if not await RATE_LIMITER.admit(_get_client_key(request)):
        return _error_response(429, "Too many image analysis requests.", "RATE_LIMITED")

    contents = await image.read(MAX_UPLOAD_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Upload an image smaller than 12 MB.")

    try:
        await asyncio.wait_for(ANALYSIS_SEMAPHORE.acquire(), timeout=ANALYSIS_QUEUE_TIMEOUT_SECONDS)
    except TimeoutError:
        return _error_response(503, "Image analysis capacity is busy.", "ANALYSIS_BUSY")

    try:
        return await asyncio.to_thread(_process_image, contents, image.content_type)
    except RequiredModelUnavailableError:
        return _error_response(503, "Image analysis service is not ready.", "MODEL_UNAVAILABLE")
    finally:
        ANALYSIS_SEMAPHORE.release()


class RequiredModelUnavailableError(RuntimeError):
    pass


def _process_image(contents: bytes, content_type: str) -> dict[str, Any]:
    cleanup_expired_sessions()
    suffix = ".png" if content_type == "image/png" else ".jpg"
    session_id = str(uuid4())
    upload_id = session_id.replace("-", "")[:12]
    session_dir = SESSION_DIR / session_id
    session_mask_dir = session_dir / "masks"
    session_mask_url_prefix = f"/generated/sessions/{session_id}/masks"
    raw_upload_path = UPLOAD_DIR / f"{upload_id}_raw{suffix}"
    upload_path = UPLOAD_DIR / f"{upload_id}{suffix}"
    workspace_path = session_dir / "workspace.webp"

    try:
        session_mask_dir.mkdir(parents=True, exist_ok=True)
        raw_upload_path.write_bytes(contents)
        exif_info = extract_exif_camera_info(raw_upload_path)
        try:
            original_metadata = save_oriented_upload(raw_upload_path, upload_path)
        except ImagePreparationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        brightness = analyze_brightness(upload_path)
        lighting = analyze_lighting(upload_path)
        warnings: list[str] = []
        try:
            segmentation_result = analyze_objects(upload_path, session_mask_dir)
            objects = segmentation_result["objects"]
            _rewrite_object_mask_urls(objects, session_mask_url_prefix)
            segmentation = {"mode": segmentation_result["mode"], "model": segmentation_result["model"]}
            if segmentation_result["warning"]:
                warnings.append(segmentation_result["warning"])
        except SegmentationError as exc:
            LOGGER.warning("Required segmentation failed: %s", exc)
            if RENDER_FREE_MODE:
                raise RequiredModelUnavailableError from exc
            objects = []
            segmentation = {"mode": "none", "model": None}
            warnings.append("Object segmentation is temporarily unavailable.")
        except Exception as exc:
            LOGGER.exception("Unexpected object segmentation failure: %s", exc)
            if RENDER_FREE_MODE:
                raise RequiredModelUnavailableError from exc
            objects = []
            segmentation = {"mode": "none", "model": None}
            warnings.append("Object segmentation is temporarily unavailable.")

        image_bgr = cv2.imread(str(upload_path))
        if ENABLE_DEPTH_ANALYSIS and image_bgr is not None:
            depth_result = estimate_depth(image_bgr, upload_id, output_dir=session_mask_dir, url_prefix=session_mask_url_prefix)
            depth_array_for_scene = depth_result.pop("_depth_array_normalized", None)
        elif ENABLE_DEPTH_ANALYSIS:
            depth_result = _depth_unavailable("Uploaded image could not be read for depth analysis.")
            depth_array_for_scene = None
        else:
            depth_result = _depth_unavailable("Depth analysis is disabled for the Render Free profile.")
            depth_array_for_scene = None

        if ENABLE_SCENE_ANALYSIS and image_bgr is not None:
            scene_result = detect_scene_regions(
                image_bgr,
                upload_id,
                depth_array_normalized=depth_array_for_scene,
                output_dir=session_mask_dir,
                url_prefix=session_mask_url_prefix,
            )
        elif ENABLE_SCENE_ANALYSIS:
            scene_result = _scene_unavailable("Uploaded image could not be read for scene analysis.")
        else:
            scene_result = _scene_unavailable("Scene analysis is disabled for the Render Free profile.")

        try:
            workspace_metadata = prepare_workspace_image(upload_path, workspace_path)
        except ImagePreparationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        _map_artifacts_to_workspace(
            session_mask_dir,
            objects,
            depth_result,
            scene_result,
            original_metadata["width"],
            original_metadata["height"],
            workspace_metadata["width"],
            workspace_metadata["height"],
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
            LOGGER.exception("Scale estimation failed: %s", exc)
            warnings.append("Scale estimation is temporarily unavailable.")
            scale_estimation_dict = {
                "anchors": [],
                "best_scale_cm_per_px": None,
                "confidence": 0.0,
                "method": "none",
                "exif_focal_length_mm": exif_info.focal_length_mm,
                "exif_focal_length_35mm": exif_info.focal_length_35mm_equiv,
                "exif_device_model": exif_info.device_model,
            }

        _append_optional_warning(warnings, depth_result.get("error") if not depth_result.get("available") else None)
        _append_optional_warning(warnings, scene_result.get("error") if not scene_result.get("available") else None)
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
    except Exception:
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)
        raise
    finally:
        raw_upload_path.unlink(missing_ok=True)
        upload_path.unlink(missing_ok=True)


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
            LOGGER.exception("Could not remove expired session directory.")


def _get_client_key(request: Request) -> str:
    forwarded_client = request.headers.get("x-forwarded-for", "").split(",", maxsplit=1)[0].strip()
    if forwarded_client:
        return forwarded_client
    if request.client:
        return request.client.host
    return "unknown"


def _error_response(status_code: int, detail: str, code: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail, "code": code, "retryable": True})


def _generated_directory_is_writable() -> bool:
    try:
        _ensure_generated_directories()
        probe = GENERATED_DIR / f".write-probe-{uuid4().hex}"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        LOGGER.exception("Generated directory is not writable.")
        return False


def _yolo_is_available() -> bool:
    try:
        from segmentation import _get_yolo_model
        _get_yolo_model()
        return True
    except Exception as exc:
        LOGGER.warning("YOLO readiness check failed: %s", exc)
        return False


def _depth_unavailable(reason: str) -> dict[str, Any]:
    return {"depth_map_url": None, "available": False, "mode": "unavailable", "error": reason}


def _scene_unavailable(reason: str) -> dict[str, Any]:
    return {
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
        "error": reason,
    }


def _serve_generated_artifact(root: Path, artifact_path: str) -> FileResponse:
    resolved_root = root.resolve()
    resolved_artifact = (resolved_root / artifact_path).resolve()
    if resolved_root not in resolved_artifact.parents or not resolved_artifact.is_file():
        raise HTTPException(status_code=404, detail="Generated artifact not found.")
    return FileResponse(resolved_artifact)


def _rewrite_object_mask_urls(objects: list[dict[str, Any]], url_prefix: str) -> None:
    for item in objects:
        mask_url = item.get("mask_url")
        if isinstance(mask_url, str) and mask_url:
            item["mask_url"] = f"{url_prefix.rstrip('/')}/{Path(mask_url).name}"


def _map_artifacts_to_workspace(
    session_mask_dir: Path,
    objects: list[dict[str, Any]],
    depth_result: dict[str, Any],
    scene_result: dict[str, Any],
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
            item["bbox"] = [round(bbox[0] * scale_x), round(bbox[1] * scale_y), round(bbox[2] * scale_x), round(bbox[3] * scale_y)]
        _resize_artifact_from_url(item.get("mask_url"), session_mask_dir, workspace_width, workspace_height, cv2.INTER_NEAREST)
    _resize_artifact_from_url(depth_result.get("depth_map_url"), session_mask_dir, workspace_width, workspace_height, cv2.INTER_LINEAR)
    _resize_artifact_from_url(scene_result.get("floor_mask_url"), session_mask_dir, workspace_width, workspace_height, cv2.INTER_NEAREST)
    _resize_artifact_from_url(scene_result.get("wall_mask_url"), session_mask_dir, workspace_width, workspace_height, cv2.INTER_NEAREST)


def _resize_artifact_from_url(url: object, artifact_dir: Path, width: int, height: int, interpolation: int) -> None:
    if not isinstance(url, str) or not url:
        return
    artifact_path = artifact_dir / Path(url).name
    if not artifact_path.exists():
        return
    image = cv2.imread(str(artifact_path), cv2.IMREAD_UNCHANGED)
    if image is None or (image.shape[1] == width and image.shape[0] == height):
        return
    resized = cv2.resize(image, (width, height), interpolation=interpolation)
    cv2.imwrite(str(artifact_path), resized)


def _append_optional_warning(warnings: list[str], warning: object) -> None:
    if isinstance(warning, str) and warning:
        warnings.append(warning)
