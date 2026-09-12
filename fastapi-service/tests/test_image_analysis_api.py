"""Feature-level API coverage for QAD-TC3 and QAD-TC4."""

from __future__ import annotations

import io
import os
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import image_preparation
import main as service


def _image_bytes(
    image_format: str = "JPEG",
    size: tuple[int, int] = (8, 6),
    orientation: int | None = None,
) -> bytes:
    image = Image.new("RGB", size, color=(96, 128, 160))
    output = io.BytesIO()
    if orientation is None:
        image.save(output, format=image_format)
    else:
        exif = Image.Exif()
        exif[274] = orientation
        image.save(output, format=image_format, exif=exif)
    return output.getvalue()


def _unavailable_scene(error: str | None = None) -> dict[str, Any]:
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
        "error": error,
    }


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    upload_dir = tmp_path / "uploads"
    session_dir = tmp_path / "sessions"
    mask_dir = tmp_path / "masks"
    upload_dir.mkdir()
    session_dir.mkdir()
    mask_dir.mkdir()

    monkeypatch.setattr(service, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(service, "SESSION_DIR", session_dir)
    monkeypatch.setattr(service, "MASK_DIR", mask_dir)
    monkeypatch.setattr(
        service,
        "analyze_brightness",
        lambda _path: {"mean_pixel_intensity": 128.0, "category": "normal"},
    )
    monkeypatch.setattr(
        service,
        "analyze_lighting",
        lambda _path: {
            "mean_rgb": [96, 128, 160],
            "ambient_rgb": [105, 128, 151],
            "ambient_hex": "#698097",
            "contrast": 0.5,
            "saturation": 0.25,
            "warmth": -0.1,
            "tint": 0.0,
            "temperature": "neutral",
            "sharpness": 0.75,
            "noise": 0.05,
            "light_direction": {"x": 0.0, "y": 0.0},
            "suggested": {
                "brightness": 1.0,
                "contrast": 0.9,
                "saturation": 0.95,
                "color_mix": 0.15,
                "blur_px": 0.1,
                "grain": 0.03,
                "shadow_opacity": 0.26,
            },
        },
    )
    monkeypatch.setattr(
        service,
        "analyze_objects",
        lambda _path, _mask_dir: {
            "objects": [],
            "mode": "mock",
            "model": None,
            "warning": None,
        },
    )
    monkeypatch.setattr(
        service,
        "estimate_depth",
        lambda *_args, **_kwargs: {
            "depth_map_url": None,
            "available": False,
            "mode": "unavailable",
            "error": None,
        },
    )
    monkeypatch.setattr(
        service,
        "detect_scene_regions",
        lambda *_args, **_kwargs: _unavailable_scene(),
    )

    return TestClient(service.app)


def test_health_reports_service_is_available(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize(
    ("content_type", "detail"),
    [
        ("application/pdf", "Upload a JPG, JPEG, or PNG image."),
        ("image/webp", "Upload a JPG, JPEG, or PNG image."),
    ],
)
def test_analyze_image_rejects_unsupported_content_types(
    client: TestClient,
    content_type: str,
    detail: str,
) -> None:
    response = client.post(
        "/analyze-image",
        files={"image": ("room.bin", b"not-an-image", content_type)},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": detail}


def test_analyze_image_rejects_empty_upload(client: TestClient) -> None:
    response = client.post(
        "/analyze-image",
        files={"image": ("room.jpg", b"", "image/jpeg")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Uploaded image is empty."}


def test_analyze_image_rejects_upload_over_byte_limit(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(service, "MAX_UPLOAD_BYTES", 32)

    response = client.post(
        "/analyze-image",
        files={"image": ("room.jpg", _image_bytes(), "image/jpeg")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Upload an image smaller than 12 MB."}


def test_analyze_image_rejects_corrupted_image_and_removes_upload(
    client: TestClient,
) -> None:
    response = client.post(
        "/analyze-image",
        files={"image": ("room.jpg", b"corrupted-jpeg", "image/jpeg")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Uploaded image could not be decoded."}
    assert list(service.UPLOAD_DIR.iterdir()) == []


def test_analyze_image_rejects_unsafe_decoded_dimensions(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(image_preparation, "MAX_DECODED_PIXELS", 47)

    response = client.post(
        "/analyze-image",
        files={"image": ("room.jpg", _image_bytes(), "image/jpeg")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Uploaded image is too large to process safely."}


def test_analyze_image_applies_exif_orientation(client: TestClient) -> None:
    response = client.post(
        "/analyze-image",
        files={
            "image": (
                "portrait.jpg",
                _image_bytes(size=(3, 2), orientation=6),
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["workspace_image"]["width"] == 2
    assert response.json()["workspace_image"]["height"] == 3


def test_analyze_image_resizes_large_workspace_image(client: TestClient) -> None:
    response = client.post(
        "/analyze-image",
        files={
            "image": (
                "large-room.jpg",
                _image_bytes(size=(2000, 1000)),
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["workspace_image"]["width"] == 1920
    assert response.json()["workspace_image"]["height"] == 960


def test_analyze_image_returns_complete_workspace_contract_and_cleans_uploads(
    client: TestClient,
) -> None:
    response = client.post(
        "/analyze-image",
        files={"image": ("room.png", _image_bytes("PNG"), "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {
        "session_id",
        "workspace_image",
        "brightness",
        "lighting",
        "objects",
        "segmentation",
        "depth",
        "scene",
        "warning",
        "warnings",
    }
    assert payload["workspace_image"] == {
        "url": f"/generated/sessions/{payload['session_id']}/workspace.webp",
        "width": 8,
        "height": 6,
    }
    assert payload["brightness"]["category"] == "normal"
    assert payload["lighting"]["ambient_hex"] == "#698097"
    assert payload["segmentation"] == {"mode": "mock", "model": None}
    assert "_depth_array_normalized" not in payload["depth"]
    assert payload["warning"] is None
    assert payload["warnings"] == []
    assert list(service.UPLOAD_DIR.iterdir()) == []
    assert (service.SESSION_DIR / payload["session_id"] / "workspace.webp").is_file()


def test_analyze_image_returns_warnings_when_optional_models_fail(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_segmentation(_path: Path, _mask_dir: Path) -> dict[str, Any]:
        raise service.SegmentationError("Segmentation unavailable.")

    monkeypatch.setattr(service, "analyze_objects", fail_segmentation)
    monkeypatch.setattr(
        service,
        "estimate_depth",
        lambda *_args, **_kwargs: {
            "depth_map_url": None,
            "available": False,
            "mode": "unavailable",
            "error": "Depth unavailable.",
        },
    )
    monkeypatch.setattr(
        service,
        "detect_scene_regions",
        lambda *_args, **_kwargs: _unavailable_scene("Scene unavailable."),
    )

    response = client.post(
        "/analyze-image",
        files={"image": ("room.jpg", _image_bytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["objects"] == []
    assert response.json()["warning"] == "Segmentation unavailable."
    assert response.json()["warnings"] == [
        "Segmentation unavailable.",
        "Depth unavailable.",
        "Scene unavailable.",
    ]


def test_cleanup_expired_sessions_only_removes_expired_directories(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    session_dir = tmp_path / "sessions"
    expired = session_dir / "expired"
    active = session_dir / "active"
    ignored_file = session_dir / "not-a-session.txt"
    expired.mkdir(parents=True)
    active.mkdir()
    ignored_file.write_text("keep", encoding="utf-8")
    three_hours_ago = time.time() - (3 * 60 * 60)
    os.utime(expired, (three_hours_ago, three_hours_ago))

    monkeypatch.setattr(service, "SESSION_DIR", session_dir)
    monkeypatch.setattr(service, "TEMP_SESSION_TTL_MINUTES", 120)

    service.cleanup_expired_sessions()

    assert not expired.exists()
    assert active.is_dir()
    assert ignored_file.is_file()
