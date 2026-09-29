import asyncio
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main


def test_cors_origin_parser_normalizes_and_rejects_wildcards():
    assert main._parse_allowed_origins("https://glassfit.vercel.app/, https://preview.vercel.app") == [
        "https://glassfit.vercel.app",
        "https://preview.vercel.app",
    ]
    with pytest.raises(ValueError):
        main._parse_allowed_origins("https://*.vercel.app")
    with pytest.raises(ValueError):
        main._parse_allowed_origins("https://glassfit.vercel.app/path")


def test_upload_larger_than_twelve_megabytes_is_rejected():
    with TestClient(main.app) as client:
        response = client.post(
            "/analyze-image",
            headers={"x-forwarded-for": "198.51.100.10"},
            files={"image": ("room.jpg", b"x" * (main.MAX_UPLOAD_BYTES + 1), "image/jpeg")},
        )
    assert response.status_code == 400
    assert response.json() == {"detail": "Upload an image smaller than 12 MB."}


def test_rate_limiter_returns_false_after_the_configured_limit():
    limiter = main.InMemoryRateLimiter(request_limit=2, window_seconds=60, max_entries=10)

    async def exercise_limiter():
        return [await limiter.admit("client") for _ in range(3)]

    assert asyncio.run(exercise_limiter()) == [True, True, False]


def test_busy_analysis_returns_retryable_503(monkeypatch):
    class NeverAvailableSemaphore:
        async def acquire(self):
            await asyncio.sleep(1)

        def release(self):
            raise AssertionError("A timed-out semaphore must not be released.")

        def locked(self):
            return True

    monkeypatch.setattr(main, "ANALYSIS_SEMAPHORE", NeverAvailableSemaphore())
    monkeypatch.setattr(main, "ANALYSIS_QUEUE_TIMEOUT_SECONDS", 0.01)

    with TestClient(main.app) as client:
        response = client.post(
            "/analyze-image",
            headers={"x-forwarded-for": "198.51.100.11"},
            files={"image": ("room.jpg", b"valid-enough-for-admission", "image/jpeg")},
        )

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Image analysis capacity is busy.",
        "code": "ANALYSIS_BUSY",
        "retryable": True,
    }


def test_free_profile_disables_optional_models_deterministically(tmp_path, monkeypatch):
    generated_dir = tmp_path / "generated"
    monkeypatch.setattr(main, "GENERATED_DIR", generated_dir)
    monkeypatch.setattr(main, "MASK_DIR", generated_dir / "masks")
    monkeypatch.setattr(main, "UPLOAD_DIR", generated_dir / "uploads")
    monkeypatch.setattr(main, "SESSION_DIR", generated_dir / "sessions")
    monkeypatch.setattr(main, "RENDER_FREE_MODE", True)
    monkeypatch.setattr(main, "ENABLE_DEPTH_ANALYSIS", False)
    monkeypatch.setattr(main, "ENABLE_SCENE_ANALYSIS", False)
    monkeypatch.setattr(
        main,
        "analyze_objects",
        lambda _path, _mask_dir: {"objects": [], "mode": "yolo", "model": "yolov8s-seg.pt", "warning": None},
    )
    main._ensure_generated_directories()

    image = np.full((40, 60, 3), 127, dtype=np.uint8)
    encoded, buffer = cv2.imencode(".png", image)
    assert encoded

    result = main._process_image(buffer.tobytes(), "image/png")
    assert result["segmentation"] == {"mode": "yolo", "model": "yolov8s-seg.pt"}
    assert result["depth"] == {
        "depth_map_url": None,
        "available": False,
        "mode": "unavailable",
        "error": "Depth analysis is disabled for the Render Free profile.",
    }
    assert result["scene"]["available"] is False
    assert result["scene"]["method"] == "unavailable"
    assert result["scene"]["error"] == "Scene analysis is disabled for the Render Free profile."


def test_ready_reports_required_model_success_and_failure(monkeypatch):
    monkeypatch.setattr(main, "_generated_directory_is_writable", lambda: True)
    monkeypatch.setattr(main, "_yolo_is_available", lambda: True)
    with TestClient(main.app) as client:
        response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["models"]["yolo"] == "available"

    monkeypatch.setattr(main, "_yolo_is_available", lambda: False)
    with TestClient(main.app) as client:
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["models"]["yolo"] == "failed"


def test_cleanup_removes_expired_session_directories(tmp_path, monkeypatch):
    session_root = tmp_path / "sessions"
    expired = session_root / "expired"
    current = session_root / "current"
    expired.mkdir(parents=True)
    current.mkdir()
    old_timestamp = time.time() - 180
    os.utime(expired, (old_timestamp, old_timestamp))

    monkeypatch.setattr(main, "SESSION_DIR", session_root)
    monkeypatch.setattr(main, "TEMP_SESSION_TTL_MINUTES", 1)
    main.cleanup_expired_sessions()

    assert not expired.exists()
    assert current.exists()


def test_generated_artifact_rejects_path_traversal(tmp_path):
    artifact_root = tmp_path / "generated"
    artifact_root.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("secret", encoding="utf-8")

    with pytest.raises(HTTPException) as exc_info:
        main._serve_generated_artifact(artifact_root, "../secret.txt")
    assert exc_info.value.status_code == 404
