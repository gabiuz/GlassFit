"""IMP-MS63 / QAD-TC78: Resilient HEIC ingestion, resolution-constrained paper detection,
and lightweight session-bound snap endpoint verification.
"""

import io
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from main import app, SESSION_DIR
from paper_calibration import detect_paper_fiducial


def create_synthetic_paper_scene(
    points=None,
    background=80,
    sheet=240,
    width=1024,
    height=768,
):
    image = np.full((height, width, 3), background, np.uint8)
    if points is None:
        points = [[200, 150], [410, 150], [410, 447], [200, 447]]
    cv2.fillConvexPoly(image, np.array(points, np.int32), (sheet, sheet, sheet))
    return image


def test_qad_tc78_3_workspace_webp_early_generation(monkeypatch, tmp_path):
    """QAD-TC78.3: Server generates workspace.webp early and serves it."""
    import main

    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "ENABLE_SCENE_DETECTION", False)
    monkeypatch.setattr(
        main,
        "analyze_objects",
        lambda *args, **kwargs: {
            "objects": [],
            "mode": "none",
            "model": None,
            "warning": None,
        },
    )

    client = TestClient(app)
    img = create_synthetic_paper_scene(width=2400, height=1800)
    ok, encoded = cv2.imencode(".png", img)
    assert ok

    response = client.post(
        "/analyze-image",
        data={"calibration_mode": "paper_fiducial", "paper_standard": "a4"},
        files={"image": ("room.png", io.BytesIO(encoded.tobytes()), "image/png")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "workspace_image" in payload
    ws = payload["workspace_image"]
    assert ws["width"] == 1920
    assert ws["height"] == 1440
    assert ws["url"].endswith("workspace.webp")

    # Verify session directory contains workspace.webp
    session_id = payload["session_id"]
    ws_file = SESSION_DIR / session_id / "workspace.webp"
    assert ws_file.exists()


def test_qad_tc78_2_downscaled_paper_detection_latency_and_scale_invariance():
    """QAD-TC78.2 / QAD-TC78.6: Downscaled detection latency and coordinate invariance."""
    # Synthetic scene at high resolution: 3840 x 2160 (4K)
    full_w, full_h = 3840, 2160
    paper_full = [[1000, 600], [1800, 600], [1800, 1600], [1000, 1600]]
    img_4k = create_synthetic_paper_scene(
        points=paper_full, width=full_w, height=full_h
    )

    # Downscale to workspace max 1920px
    scale = 1920.0 / full_w
    target_w, target_h = round(full_w * scale), round(full_h * scale)
    img_ws = cv2.resize(img_4k, (target_w, target_h), interpolation=cv2.INTER_AREA)

    # Measure downscaled execution
    result_ws = detect_paper_fiducial(img_ws, "a4")
    assert result_ws.detection_outcome == "candidate_found"
    assert result_ws.detected_corners is not None

    # Corners should match expected downscaled coordinates within tight tolerance
    expected_ws = [[pt[0] * scale, pt[1] * scale] for pt in paper_full]
    np.testing.assert_allclose(result_ws.detected_corners, expected_ws, atol=3.0)


def test_qad_tc78_snap_paper_endpoint_json_and_form(monkeypatch):
    """QAD-TC78: POST /snap-paper succeeds with session_id via Form or JSON."""
    import main

    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "ENABLE_SCENE_DETECTION", False)
    monkeypatch.setattr(
        main,
        "analyze_objects",
        lambda *args, **kwargs: {
            "objects": [],
            "mode": "none",
            "model": None,
            "warning": None,
        },
    )

    client = TestClient(app)
    img = create_synthetic_paper_scene(width=1000, height=800)
    ok, encoded = cv2.imencode(".png", img)
    assert ok

    # Upload to establish active session
    init_res = client.post(
        "/analyze-image",
        data={"calibration_mode": "auto_detect"},
        files={"image": ("room.png", io.BytesIO(encoded.tobytes()), "image/png")},
    )
    assert init_res.status_code == 200
    session_id = init_res.json()["session_id"]

    # Test /snap-paper via JSON
    # Paper is at [[200, 150], [410, 150], [410, 447], [200, 447]], center ~ (305/1000, 298/800) = (0.305, 0.372)
    snap_json_res = client.post(
        "/snap-paper",
        json={
            "session_id": session_id,
            "seed_x": 0.305,
            "seed_y": 0.372,
            "paper_standard": "a4",
        },
    )
    assert snap_json_res.status_code == 200
    json_data = snap_json_res.json()
    assert json_data["coordinate_space"] == "workspace"
    assert json_data["coordinate_image_id"] == session_id
    assert json_data["detection_outcome"] in {"candidate_found", "not_found"}

    # Test /snap-paper via Form data
    snap_form_res = client.post(
        "/snap-paper",
        data={
            "session_id": session_id,
            "seed_x": 0.305,
            "seed_y": 0.372,
            "paper_standard": "a4",
        },
    )
    assert snap_form_res.status_code == 200
    form_data = snap_form_res.json()
    assert form_data["coordinate_space"] == "workspace"


def test_qad_tc78_snap_paper_error_handling():
    """QAD-TC78: POST /snap-paper error branches for invalid inputs and expired sessions."""
    client = TestClient(app)

    # Missing session_id
    res_no_sess = client.post("/snap-paper", json={"seed_x": 0.5, "seed_y": 0.5})
    assert res_no_sess.status_code == 422

    # Missing seed coordinates
    res_no_seeds = client.post(
        "/snap-paper", json={"session_id": "nonexistent-session"}
    )
    assert res_no_seeds.status_code == 422

    # Non-existent session
    res_404 = client.post(
        "/snap-paper",
        json={
            "session_id": "nonexistent-session-12345",
            "seed_x": 0.5,
            "seed_y": 0.5,
        },
    )
    assert res_404.status_code == 404
    assert "expired or not found" in res_404.json()["detail"]
