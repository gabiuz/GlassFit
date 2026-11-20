"""fix-MS-35 / QAD-TC3, QAD-TC4, QAD-TC77: usable image sessions."""

from io import BytesIO

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import main
from scene_detection import ADE20K_WINDOW


@pytest.mark.parametrize("mode", ["auto_detect", "paper_fiducial"])
@pytest.mark.parametrize("semantic_available", [True, False])
def test_dominant_screen_creates_retrievable_session(
    tmp_path, monkeypatch, mode, semantic_available,
):
    generated = tmp_path / "generated"
    uploads = generated / "uploads"
    sessions = generated / "sessions"
    uploads.mkdir(parents=True)
    sessions.mkdir(parents=True)
    monkeypatch.setattr(main, "GENERATED_DIR", generated)
    monkeypatch.setattr(main, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(main, "SESSION_DIR", sessions)
    monkeypatch.setattr(main, "cleanup_expired_sessions", lambda: None)
    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "analyze_objects", lambda *_args: {
        "objects": [{"label": "television", "confidence": 0.95,
                     "bbox": [5, 5, 95, 95], "mask_url": None}],
        "mode": "yolo", "model": "synthetic", "warning": None,
    })
    semantic = np.full((100, 100), 99, dtype=np.int32)
    semantic[20:70, 20:70] = ADE20K_WINDOW
    monkeypatch.setattr(main, "detect_scene_regions", lambda *_args, **_kwargs: {
        "available": True, "method": "segformer_ade20k",
        "opening_coverage": 0.25,
        "_semantic_map": semantic if semantic_available else None,
    })
    image = BytesIO()
    Image.new("RGB", (100, 100), "white").save(image, "JPEG")
    with TestClient(main.app) as client:
        response = client.post(
            "/analyze-image", data={"calibration_mode": mode},
            files={"image": ("room.jpg", image.getvalue(), "image/jpeg")},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["session_id"]
        workspace_url = payload["workspace_image"]["url"]
        workspace_response = client.get(workspace_url)
        assert workspace_response.status_code == 200
        assert workspace_response.headers["content-type"] == "image/webp"
        assert "_semantic_map" not in payload["scene"]
    assert len(list(sessions.iterdir())) == 1
    assert list(uploads.iterdir()) == []


@pytest.mark.parametrize("mode", ["auto_detect", "paper_fiducial"])
def test_geometric_building_opening_creates_session_without_private_evidence(
    tmp_path, monkeypatch, mode,
):
    generated = tmp_path / "generated"
    uploads = generated / "uploads"
    sessions = generated / "sessions"
    uploads.mkdir(parents=True)
    sessions.mkdir(parents=True)
    monkeypatch.setattr(main, "GENERATED_DIR", generated)
    monkeypatch.setattr(main, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(main, "SESSION_DIR", sessions)
    monkeypatch.setattr(main, "cleanup_expired_sessions", lambda: None)
    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "analyze_objects", lambda *_args: {
        "objects": [], "mode": "yolo", "model": "synthetic", "warning": None,
    })
    monkeypatch.setattr(main, "detect_scene_regions", lambda *_args, **_kwargs: {
        "available": True, "method": "segformer_ade20k",
        "building_coverage": 1.0, "_geometric_opening": True,
        "_semantic_map": np.ones((100, 100), dtype=np.int32),
    })
    image = BytesIO()
    Image.new("RGB", (100, 100), "white").save(image, "JPEG")
    with TestClient(main.app) as client:
        response = client.post(
            "/analyze-image", data={"calibration_mode": mode},
            files={"image": ("room.jpg", image.getvalue(), "image/jpeg")},
        )
    assert response.status_code == 200
    assert "_geometric_opening" not in response.json()["scene"]
    assert "_semantic_map" not in response.json()["scene"]
    assert len(list(sessions.iterdir())) == 1


@pytest.mark.parametrize("mode", ["auto_detect", "paper_fiducial"])
def test_missing_optional_cv_still_returns_workspace(tmp_path, monkeypatch, mode):
    generated = tmp_path / "generated"
    uploads = generated / "uploads"
    sessions = generated / "sessions"
    uploads.mkdir(parents=True)
    sessions.mkdir(parents=True)
    monkeypatch.setattr(main, "GENERATED_DIR", generated)
    monkeypatch.setattr(main, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(main, "SESSION_DIR", sessions)
    monkeypatch.setattr(main, "cleanup_expired_sessions", lambda: None)
    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "ENABLE_SCENE_DETECTION", False)
    monkeypatch.setattr(main, "analyze_objects", lambda *_args: {
        "objects": [], "mode": "none", "model": None, "warning": None,
    })
    image = BytesIO()
    Image.new("RGB", (100, 100), "white").save(image, "JPEG")
    with TestClient(main.app) as client:
        response = client.post(
            "/analyze-image", data={"calibration_mode": mode},
            files={"image": ("plain.jpg", image.getvalue(), "image/jpeg")},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["objects"] == []
        assert payload["scene"]["available"] is False
        assert payload["scene"]["method"] == "disabled"
        assert client.get(payload["workspace_image"]["url"]).status_code == 200
    assert list(uploads.iterdir()) == []
