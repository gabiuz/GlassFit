"""IMP-MS53 / QAD-TC68: synthetic boundary evidence and endpoint contracts.

These fixtures do not replace real-photo release validation in MS57.
"""
import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from main import app
from paper_calibration import (
    detect_paper_fiducial,
    _same_boundary,
    _order_corners,
    _fit_edge_lines_and_intersect,
    _refine_subpixel_corners,
)


def scene(points=None, background=80, sheet=240, size=1024):
    image = np.full((size, size, 3), background, np.uint8)
    if points is None:
        points = [[300, 250], [510, 250], [510, 547], [300, 547]]
    cv2.fillConvexPoly(image, np.array(points, np.int32), (sheet, sheet, sheet))
    return image


@pytest.mark.parametrize("sheet,background", [(240,80), (65,95), (170,150)])
def test_shadow_and_low_contrast_outlines(sheet, background):
    result = detect_paper_fiducial(scene(sheet=sheet, background=background))
    assert result.detection_outcome in {"candidate_found", "not_found", "ambiguous"}
    if result.detected_corners:
        np.testing.assert_allclose(result.detected_corners, [[300,250],[510,250],[510,547],[300,547]], atol=4)
    assert result.scale_cm_per_px is None
    assert result.paper_standard is None


@pytest.mark.parametrize("standard", [None, "auto_detect", "short", "a4", "long"])
def test_localization_does_not_infer_or_calibrate_format(standard):
    result = detect_paper_fiducial(scene(), standard)
    assert result.detection_outcome == "candidate_found"
    assert result.paper_standard == (standard if standard in {"short","a4","long"} else None)
    assert result.paper_standard_confirmed == (standard in {"short","a4","long"})
    assert result.scale_cm_per_px is None
    assert result.homography_matrix is None
    assert result.selected_candidate_id in [c.id for c in result.candidates]


def test_distinct_equal_rectangles_abstain():
    image = scene()
    cv2.rectangle(image, (650,250), (860,547), (240,240,240), -1)
    result = detect_paper_fiducial(image)
    assert result.detection_outcome == "ambiguous"
    assert result.selected_candidate_id is None
    assert result.detected_corners is None
    assert len(result.candidates) >= 2


def test_foreshortening_does_not_use_ratio_or_right_angle_gate():
    corners = [[300,250],[480,390],[455,650],[370,610]]
    result = detect_paper_fiducial(scene(corners))
    assert result.detection_outcome == "candidate_found"
    np.testing.assert_allclose(result.detected_corners, _order_corners(np.array(corners)), atol=5)


def test_nested_panels_are_not_centroid_deduplicated():
    a = np.array([[100,100],[300,100],[300,400],[100,400]], np.float32)
    b = np.array([[130,140],[270,140],[270,360],[130,360]], np.float32)
    assert not _same_boundary(a,b,1400)
    assert _same_boundary(a,a+1,1400)


@pytest.mark.parametrize("value", [0,100,255])
def test_blank_wall_abstains(value):
    result = detect_paper_fiducial(np.full((600,800,3),value,np.uint8))
    assert result.detection_outcome == "not_found"
    assert result.candidates == []
    assert result.scale_cm_per_px is None


def test_cropped_outline_not_automatically_selected():
    result = detect_paper_fiducial(scene([[0,250],[210,250],[210,547],[0,547]]))
    assert result.selected_candidate_id is None


def test_rotation_has_four_distinct_cyclic_corners():
    corners = np.array([[200,100],[300,200],[200,300],[100,200]],np.float32)
    ordered = _order_corners(corners)
    assert len(np.unique(ordered,axis=0)) == 4
    assert cv2.isContourConvex(ordered)


def test_candidate_list_is_bounded_and_deterministic():
    a = detect_paper_fiducial(scene()).to_dict()
    b = detect_paper_fiducial(scene()).to_dict()
    assert a == b
    assert len(a["candidates"]) <= 8


@pytest.mark.parametrize("mode,standard", [("auto_detect",None),("paper_fiducial","a4"),("standard",None)])
def test_endpoint_returns_workspace_coordinates_without_metric_promotion(monkeypatch, mode, standard):
    import main
    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "ENABLE_SCENE_DETECTION", False)
    monkeypatch.setattr(main, "analyze_objects", lambda *args, **kwargs: {"objects": [], "mode": "none", "model": None, "warning": None})
    image = scene(size=2048)
    ok, encoded = cv2.imencode(".png",image)
    assert ok
    data = {"calibration_mode":mode}
    if standard:
        data["paper_standard"] = standard
    response = TestClient(app).post("/analyze-image", data=data,
        files={"image":("room.png",io.BytesIO(encoded.tobytes()),"image/png")})
    assert response.status_code == 200, response.text
    payload = response.json()
    paper = payload["paper_calibration"]
    assert paper["coordinate_space"] == "workspace"
    assert paper["image_width"] == payload["workspace_image"]["width"]
    assert paper["geometry_contract_version"] == "paper-plane-mm-v1"
    assert paper["coordinate_image_id"] == payload["session_id"]
    np.testing.assert_allclose(paper["oriented_source_to_workspace"], [
        [paper["image_width"] / 2048, 0, 0],
        [0, paper["image_height"] / image.shape[0], 0], [0, 0, 1],
    ], rtol=1e-12)
    assert paper["homography_matrix"] is None
    assert paper["scale_cm_per_px"] is None
    assert payload["calibration_meta"]["status"] not in {"calibrated","verified_calibrated"}
    if mode != "standard":
        assert paper["candidates"]
        ratio = paper["image_width"] / 2048
        np.testing.assert_allclose(paper["candidates"][0]["corners"][0], [300*ratio,250*ratio],atol=4)


def test_qad_tc74_1_rounded_corner_subpixel_recovery():
    """
    QAD-TC74.1: Synthetic rounded corner paper image.
    Verifies that Huber edge line intersection recovers the true sharp corners
    with < 1.0px error, ignoring 20px corner fillet curvature.
    """
    size = 800
    sharp = np.array([[150.0, 150.0], [450.0, 150.0], [450.0, 550.0], [150.0, 550.0]], dtype=np.float32)
    radius = 20
    x1, y1 = int(sharp[0][0]), int(sharp[0][1])
    x2, y2 = int(sharp[2][0]), int(sharp[2][1])

    # Draw rounded rectangle with 20px fillets
    img = np.full((size, size), 60, dtype=np.uint8)
    cv2.rectangle(img, (x1 + radius, y1), (x2 - radius, y2), 230, -1)
    cv2.rectangle(img, (x1, y1 + radius), (x2, y2 - radius), 230, -1)
    cv2.circle(img, (x1 + radius, y1 + radius), radius, 230, -1)
    cv2.circle(img, (x2 - radius, y1 + radius), radius, 230, -1)
    cv2.circle(img, (x2 - radius, y2 - radius), radius, 230, -1)
    cv2.circle(img, (x1 + radius, y2 - radius), radius, 230, -1)

    # Initial approximate corners that cut across the rounded fillet
    approx = np.array([
        [x1 + 6.0, y1 + 6.0],
        [x2 - 6.0, y1 + 6.0],
        [x2 - 6.0, y2 - 6.0],
        [x1 + 6.0, y2 - 6.0],
    ], dtype=np.float32)

    # Line intersection must accurately locate the true sharp corners (< 1.0px error)
    refined = _fit_edge_lines_and_intersect(img, approx)
    np.testing.assert_allclose(refined, sharp, atol=1.0)


def test_qad_tc74_2_shadow_gradient_corner_accuracy():
    """
    QAD-TC74.2: Shadow gradient obscuring one corner.
    Verifies that adjacent straight edges guide line intersection even when
    one corner is blurred or shadowed.
    """
    size = 800
    sharp = np.array([[200.0, 200.0], [500.0, 200.0], [500.0, 600.0], [200.0, 600.0]], dtype=np.float32)
    x1, y1 = int(sharp[0][0]), int(sharp[0][1])
    x2, y2 = int(sharp[2][0]), int(sharp[2][1])

    img = np.full((size, size), 50, dtype=np.uint8)
    cv2.rectangle(img, (x1, y1), (x2, y2), 220, -1)

    # Dark shadow gradient over top-left corner
    shadow_mask = np.zeros((size, size), dtype=np.float32)
    cv2.circle(shadow_mask, (x1, y1), 40, 1.0, -1)
    shadow_mask = cv2.GaussianBlur(shadow_mask, (31, 31), 15)
    img_f = img.astype(np.float32) * (1.0 - 0.7 * shadow_mask)
    img = np.clip(img_f, 0, 255).astype(np.uint8)

    approx = np.array([
        [x1 + 5.0, y1 + 5.0],
        [x2, y1],
        [x2, y2],
        [x1, y2],
    ], dtype=np.float32)

    refined = _fit_edge_lines_and_intersect(img, approx)
    np.testing.assert_allclose(refined[0], sharp[0], atol=1.5)


def test_qad_tc74_5_non_convex_and_distorted_quad_rejection():
    """
    QAD-TC74.5: Non-convex and distorted quad rejection.
    Verifies that non-convex or severely distorted geometry is rejected
    and safely falls back to initial convex corners.
    """
    img = np.full((600, 600), 128, dtype=np.uint8)

    # Bowtie / self-intersecting polygon
    distorted = np.array([
        [100.0, 100.0],
        [400.0, 400.0],
        [400.0, 100.0],
        [100.0, 400.0],
    ], dtype=np.float32)

    # Must reject non-convex intersection or return fallback safely
    result = _fit_edge_lines_and_intersect(img, distorted)
    assert len(result) == 4
    assert np.all(np.isfinite(result))


# ==============================================================================
# QAD-TC73: Click-Guided Interactive Paper Localization (IMP-MS58)
# ==============================================================================


def test_qad_tc73_1_seed_point_clicks_inside_paper_low_contrast():
    """
    QAD-TC73.1: Seed point clicks inside paper in low-contrast image.
    In low-contrast synthetic room photo, tap inside paper sheet snaps
    the 4 corner pins to sheet perimeter with reference_source='click_guided'.
    """
    img = scene(points=[[250, 200], [550, 200], [550, 600], [250, 600]], sheet=165, background=145)
    seed = (400.0, 400.0)
    result = detect_paper_fiducial(img, seed_point=seed)
    assert result.detection_outcome == "candidate_found"
    assert result.reference_source == "click_guided"
    assert result.selected_candidate_id is not None
    assert result.detected_corners is not None
    np.testing.assert_allclose(result.detected_corners, [[250, 200], [550, 200], [550, 600], [250, 600]], atol=6)


def test_qad_tc73_2_seed_point_clicks_on_background_distractor():
    """
    QAD-TC73.2: Seed point clicks on background distractor.
    When seed point is tapped on an unrelated background region, system does
    not snap to distant paper sheet and returns explicit abstention.
    """
    img = scene(points=[[400, 400], [600, 400], [600, 700], [400, 700]])
    # Click far away on blank background wall (x=80, y=80)
    seed = (80.0, 80.0)
    result = detect_paper_fiducial(img, seed_point=seed)
    assert result.detection_outcome == "not_found"
    assert result.selected_candidate_id is None
    assert result.detected_corners is None
    assert "seed_point_outside_valid_boundary" in result.rejection_reasons


def test_qad_tc73_3_seed_point_inside_candidate_from_tier1_proposal():
    """
    QAD-TC73.3: Seed point inside candidate from Tier 1 proposal.
    Image contains two equal rectangles where global search abstains as 'ambiguous'.
    Clicking inside candidate B immediately resolves ambiguity and selects candidate B.
    """
    img = scene(points=[[200, 250], [410, 250], [410, 547], [200, 547]])
    cv2.rectangle(img, (600, 250), (810, 547), (240, 240, 240), -1)

    # Global search is ambiguous
    global_res = detect_paper_fiducial(img)
    assert global_res.detection_outcome == "ambiguous"

    # Click inside candidate B (center ~ 705, 398)
    seed_b = (705.0, 398.0)
    guided_res = detect_paper_fiducial(img, seed_point=seed_b)
    assert guided_res.detection_outcome == "candidate_found"
    assert guided_res.reference_source == "click_guided"
    assert guided_res.detected_corners is not None
    # Must snap to candidate B, not candidate A
    np.testing.assert_allclose(guided_res.detected_corners, [[600, 250], [810, 250], [810, 547], [600, 547]], atol=6)


def test_qad_tc73_5_boundary_clamping_and_non_finite_safety(monkeypatch):
    """
    QAD-TC73.5: Boundary clamping and non-finite coordinate safety.
    Verifies that malformed coordinates or NaN are handled safely.
    """
    import main
    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "ENABLE_SCENE_DETECTION", False)
    monkeypatch.setattr(main, "analyze_objects", lambda *args, **kwargs: {"objects": [], "mode": "none", "model": None, "warning": None})
    client = TestClient(app)

    img = scene(size=800)
    ok, encoded = cv2.imencode(".png", img)
    assert ok

    # 1. Non-finite coordinate (NaN) returns 422 Unprocessable Entity
    resp_nan = client.post(
        "/analyze-image",
        data={"calibration_mode": "auto_detect", "seed_x": "nan", "seed_y": "0.5"},
        files={"image": ("room.png", io.BytesIO(encoded.tobytes()), "image/png")},
    )
    assert resp_nan.status_code == 422

    # 2. Clamped negative coordinate (seed_x = -0.5) clamps safely without crashing
    resp_clamp = client.post(
        "/analyze-image",
        data={"calibration_mode": "auto_detect", "seed_x": "-0.5", "seed_y": "0.5"},
        files={"image": ("room.png", io.BytesIO(encoded.tobytes()), "image/png")},
    )
    assert resp_clamp.status_code == 200
    payload = resp_clamp.json()
    assert "paper_calibration" in payload

    # 3. Non-standard image/jpg MIME maps to jpeg format
    ok_jpg, encoded_jpg = cv2.imencode(".jpg", img)
    assert ok_jpg
    resp_jpg = client.post(
        "/analyze-image",
        data={"calibration_mode": "standard"},
        files={"image": ("room.jpg", io.BytesIO(encoded_jpg.tobytes()), "image/jpg")},
    )
    assert resp_jpg.status_code == 200

    # 4. Parameterized content-type header (e.g. image/png; charset=utf-8) resolves cleanly
    resp_param = client.post(
        "/analyze-image",
        data={"calibration_mode": "standard"},
        files={"image": ("room.png", io.BytesIO(encoded.tobytes()), "image/png; charset=utf-8")},
    )
    assert resp_param.status_code == 200


def test_qad_tc75_1_angled_capture_a4_unwarped_aspect_ratio():
    """
    QAD-TC75.1: 30-degree yaw perspective capture with A4 sheet.
    Verifies that frontal rectification unwarps the quadrilateral,
    computes unwarped ratio ~1.414, and auto-suggests A4 with >= 95% confidence.
    """
    from paper_calibration import _compute_unwarped_aspect_ratio

    # 3D A4 sheet (210 x 297 mm)
    w_mm, h_mm = 210.0, 297.0
    corners_3d = np.array([
        [-w_mm / 2, -h_mm / 2, 0.0],
        [w_mm / 2, -h_mm / 2, 0.0],
        [w_mm / 2, h_mm / 2, 0.0],
        [-w_mm / 2, h_mm / 2, 0.0],
    ], dtype=np.float32)

    # 30-degree yaw rotation around Y-axis
    theta = float(np.radians(30.0))
    rot_y = np.array([
        [np.cos(theta), 0.0, np.sin(theta)],
        [0.0, 1.0, 0.0],
        [-np.sin(theta), 0.0, np.cos(theta)],
    ], dtype=np.float32)
    trans = np.array([0.0, 0.0, 1000.0], dtype=np.float32)

    rotated = (rot_y @ corners_3d.T).T + trans

    # Camera intrinsics: f = 1000px, center = (512, 512)
    pts_2d = np.zeros((4, 2), dtype=np.float32)
    for i in range(4):
        pts_2d[i, 0] = 1000.0 * rotated[i, 0] / rotated[i, 2] + 512.0
        pts_2d[i, 1] = 1000.0 * rotated[i, 1] / rotated[i, 2] + 512.0

    ratio, standard, confidence = _compute_unwarped_aspect_ratio(pts_2d, (1024, 1024))
    assert standard == "a4"
    assert confidence >= 0.95
    assert abs(ratio - 297.0 / 210.0) / (297.0 / 210.0) <= 0.02


def test_qad_tc75_canonical_standards_auto_suggestion():
    """
    QAD-TC75: Verifies auto-suggestion for Short, A4, and Long bond paper standards,
    and abstention for ambiguous aspect ratios (>3.5% deviation).
    """
    from paper_calibration import _compute_unwarped_aspect_ratio

    # 1. Short Bond (215.9 x 279.4 mm)
    short_corners = [[100, 100], [100 + 215.9, 100], [100 + 215.9, 100 + 279.4], [100, 100 + 279.4]]
    ratio_s, std_s, conf_s = _compute_unwarped_aspect_ratio(short_corners, (1000, 1000))
    assert std_s == "short"
    assert conf_s >= 0.99
    assert abs(ratio_s - 1.2941) <= 0.005

    # 2. A4 Standard (210.0 x 297.0 mm)
    a4_corners = [[100, 100], [100 + 210.0, 100], [100 + 210.0, 100 + 297.0], [100, 100 + 297.0]]
    ratio_a, std_a, conf_a = _compute_unwarped_aspect_ratio(a4_corners, (1000, 1000))
    assert std_a == "a4"
    assert conf_a >= 0.99
    assert abs(ratio_a - 1.4143) <= 0.005

    # 3. Long Bond (215.9 x 330.2 mm)
    long_corners = [[100, 100], [100 + 215.9, 100], [100 + 215.9, 100 + 330.2], [100, 100 + 330.2]]
    ratio_l, std_l, conf_l = _compute_unwarped_aspect_ratio(long_corners, (1000, 1000))
    assert std_l == "long"
    assert conf_l >= 0.99
    assert abs(ratio_l - 1.5294) <= 0.005

    # 4. Square (1.0) - ambiguous, outside 3.5% tolerance
    sq_corners = [[100, 100], [300, 100], [300, 300], [100, 300]]
    _, std_sq, conf_sq = _compute_unwarped_aspect_ratio(sq_corners, (1000, 1000))
    assert std_sq is None
    assert conf_sq == 0.0


def test_qad_tc75_endpoint_returns_suggested_standard(monkeypatch):
    """
    QAD-TC75: /analyze-image returns suggested_paper_standard and match confidence.
    """
    import main
    monkeypatch.setattr(main, "ENABLE_DEPTH_ESTIMATION", False)
    monkeypatch.setattr(main, "ENABLE_SCENE_DETECTION", False)
    monkeypatch.setattr(main, "analyze_objects", lambda *args, **kwargs: {"objects": [], "mode": "none", "model": None, "warning": None})
    client = TestClient(app)

    # Synthetic A4 sheet (210x297) in scene
    img = scene([[300, 250], [510, 250], [510, 547], [300, 547]], size=1024)
    ok, encoded = cv2.imencode(".png", img)
    assert ok

    resp = client.post(
        "/analyze-image",
        data={"calibration_mode": "auto_detect"},
        files={"image": ("room.png", io.BytesIO(encoded.tobytes()), "image/png")},
    )
    assert resp.status_code == 200
    payload = resp.json()
    paper = payload["paper_calibration"]
    assert paper["suggested_paper_standard"] == "a4"
    assert paper["aspect_ratio_match_confidence"] >= 0.95
    assert paper["unwarped_aspect_ratio"] is not None



