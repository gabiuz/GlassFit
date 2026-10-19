"""
Tests for OpenCV planar homography, metric scale estimation, and autonomous
multi-standard fiducial detection engine (IMP-MS46 & IMP-MS48).

Traces to:
- PRD-F4: CV Image Analysis Pipeline
- PRD-F3: Space Image Upload
- PRD-F10: Quotation Measurement Modal
- SDD-C2: Image Pre-Flight
- SDD-C3: CV Scene Analyzer
- QAD-TC61: Metric Scale & Planar Homography Fiducial Detection
- QAD-TC63: Autonomous Multi-Standard Paper Fiducial Detection and Resilient Scale Engine
"""

from __future__ import annotations

import io
import time
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app
from paper_calibration import (
    PAPER_DIMENSIONS_MM,
    PaperCalibrationResult,
    _evaluate_paper_candidate,
    _match_best_paper_standard,
    _order_corners,
    _refine_subpixel_corners,
    _validate_interior_angles,
    detect_paper_fiducial,
)

client = TestClient(app)


def _create_synthetic_paper_image(
    image_size: tuple[int, int] = (1024, 1024),
    paper_rect: tuple[int, int, int, int] = (300, 250, 210, 297),
    bg_color: int = 80,
    paper_color: int = 240,
) -> np.ndarray:
    """
    Creates a synthetic interior wall photo with a solid rectangle simulating
    a taped sheet of paper.
    """
    img = np.full((image_size[1], image_size[0], 3), bg_color, dtype=np.uint8)
    x, y, w, h = paper_rect
    cv2.rectangle(img, (x, y), (x + w, y + h), (paper_color, paper_color, paper_color), -1)
    return img


def _create_encoded_test_image(image_bgr: np.ndarray, ext: str = ".jpg") -> bytes:
    """Encodes an image numpy array into binary bytes."""
    success, buffer = cv2.imencode(ext, image_bgr)
    assert success, "Failed to encode synthetic test image"
    return buffer.tobytes()


class TestCornerOrderingAndAngles:
    """Validates deterministic corner re-ordering and angular constraints."""

    def test_order_corners_canonical_orientation(self) -> None:
        """Verifies scrambled coordinates are correctly ordered as [TL, TR, BR, BL]."""
        tl = [100.0, 100.0]
        tr = [310.0, 100.0]
        br = [310.0, 397.0]
        bl = [100.0, 397.0]

        # Pass in scrambled order: [BR, TL, BL, TR]
        scrambled = np.array([br, tl, bl, tr], dtype=np.float32)
        ordered = _order_corners(scrambled)

        np.testing.assert_allclose(ordered[0], tl, atol=1e-2)
        np.testing.assert_allclose(ordered[1], tr, atol=1e-2)
        np.testing.assert_allclose(ordered[2], br, atol=1e-2)
        np.testing.assert_allclose(ordered[3], bl, atol=1e-2)

    def test_order_corners_perspective_skew(self) -> None:
        """Verifies trapezoidal perspective coordinates order correctly."""
        tl = [150.0, 120.0]
        tr = [350.0, 140.0]
        br = [340.0, 420.0]
        bl = [160.0, 410.0]

        scrambled = np.array([bl, tr, tl, br], dtype=np.float32)
        ordered = _order_corners(scrambled)

        np.testing.assert_allclose(ordered[0], tl, atol=1e-2)
        np.testing.assert_allclose(ordered[1], tr, atol=1e-2)
        np.testing.assert_allclose(ordered[2], br, atol=1e-2)
        np.testing.assert_allclose(ordered[3], bl, atol=1e-2)

    def test_validate_interior_angles_rectangular(self) -> None:
        """Verifies that a standard rectangle passes near-perpendicular check (90 deg)."""
        pts = np.array(
            [[100.0, 100.0], [300.0, 100.0], [300.0, 400.0], [100.0, 400.0]],
            dtype=np.float32,
        )
        assert _validate_interior_angles(pts, min_deg=60.0, max_deg=120.0) is True

    def test_validate_interior_angles_extreme_shear_rejected(self) -> None:
        """Verifies that an acute rhombus with angles under 60 deg is rejected."""
        # Sharp diamond shape with acute angles under 60 degrees (~53 degrees)
        pts_acute = np.array(
            [[200.0, 100.0], [300.0, 300.0], [200.0, 500.0], [100.0, 300.0]],
            dtype=np.float32,
        )
        assert _validate_interior_angles(pts_acute, min_deg=60.0, max_deg=120.0) is False


class TestCandidateFiltering:
    """Validates geometric constraint cascade in _evaluate_paper_candidate."""

    def test_rejects_non_four_vertex_contour(self) -> None:
        """Verifies triangles and pentagons are immediately rejected."""
        triangle = np.array([[[100, 100]], [[200, 100]], [[150, 200]]], dtype=np.int32)
        is_valid, conf, _ = _evaluate_paper_candidate(triangle, 1.414, 1024 * 1024)
        assert is_valid is False
        assert conf == 0.0

        pentagon = np.array(
            [[[100, 100]], [[200, 100]], [[220, 180]], [[150, 250]], [[80, 180]]],
            dtype=np.int32,
        )
        is_valid, conf, _ = _evaluate_paper_candidate(pentagon, 1.414, 1024 * 1024)
        assert is_valid is False
        assert conf == 0.0

    def test_rejects_non_convex_contour(self) -> None:
        """Verifies non-convex (concave) quadrilaterals are rejected."""
        concave_quad = np.array(
            [[[100, 100]], [[300, 100]], [[200, 150]], [[100, 300]]],
            dtype=np.int32,
        )
        is_valid, conf, _ = _evaluate_paper_candidate(concave_quad, 1.414, 1024 * 1024)
        assert is_valid is False
        assert conf == 0.0

    def test_rejects_out_of_bounds_area(self) -> None:
        """Verifies contours that are too tiny (<0.05%) or too massive (>15%) are rejected."""
        image_area = 1000 * 1000  # 1,000,000 px

        # Tiny quad: 10 x 10 = 100 px = 0.01% (below 0.05%)
        tiny_quad = np.array(
            [[[100, 100]], [[110, 100]], [[110, 110]], [[100, 110]]],
            dtype=np.int32,
        )
        is_valid, _, _ = _evaluate_paper_candidate(tiny_quad, 1.414, image_area)
        assert is_valid is False

        # Huge quad: 600 x 600 = 360,000 px = 36% (above 15%)
        huge_quad = np.array(
            [[[50, 50]], [[650, 50]], [[650, 650]], [[50, 650]]],
            dtype=np.int32,
        )
        is_valid, _, _ = _evaluate_paper_candidate(huge_quad, 1.414, image_area)
        assert is_valid is False

    def test_rejects_mismatched_aspect_ratio(self) -> None:
        """Verifies a square or extreme rectangle is rejected for A4 standard."""
        # Square: aspect ratio 1.0 (target A4 is 1.414 -> error ~29% > 18%)
        square = np.array(
            [[[100, 100]], [[300, 100]], [[300, 300]], [[100, 300]]],
            dtype=np.int32,
        )
        is_valid, _, _ = _evaluate_paper_candidate(square, 1.414, 1024 * 1024)
        assert is_valid is False


class TestPaperFiducialDetection:
    """Core detection engine tests covering QAD-TC61 and QAD-TC63 acceptance criteria."""

    def test_clean_a4_upright_accuracy(self) -> None:
        """
        QAD-TC61.2 & QAD-TC63.1: Synthetic clean rectangle image with known A4 dimensions
        recovers scale_cm_per_px within 1% error.
        """
        # A4: 210 mm W x 297 mm H. Let pixel rectangle be 210 x 297 px.
        # Expected scale: 21.0 cm / 210 px = 0.10 cm/px.
        image = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(350, 250, 210, 297),
        )

        result = detect_paper_fiducial(image, paper_standard="a4")

        assert result.status == "detected"
        assert result.paper_standard == "a4"
        assert result.confidence >= 0.70
        assert result.detected_corners is not None
        assert len(result.detected_corners) == 4
        assert result.scale_cm_per_px is not None

        # Verify scale within 1% of 0.10 cm/px
        expected_scale = 0.10
        relative_error = abs(result.scale_cm_per_px - expected_scale) / expected_scale
        assert relative_error <= 0.01, f"Scale error {relative_error:.4f} exceeded 1%"

        # Verify 3x3 homography matrix is present
        assert result.homography_matrix is not None
        assert len(result.homography_matrix) == 3
        assert len(result.homography_matrix[0]) == 3

    def test_clean_a4_landscape_accuracy(self) -> None:
        """
        QAD-TC63.4: Verifies landscape mounted A4 paper (297 x 210 px) is detected accurately.
        """
        # Landscape: 297 px wide x 210 px tall.
        # Physical width: 29.7 cm, height: 21.0 cm.
        # Expected scale: 0.10 cm/px.
        image = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(300, 300, 297, 210),
        )

        result = detect_paper_fiducial(image, paper_standard="a4")

        assert result.status == "detected"
        assert result.confidence >= 0.70
        assert result.scale_cm_per_px is not None
        relative_error = abs(result.scale_cm_per_px - 0.10) / 0.10
        assert relative_error <= 0.01

    def test_short_bond_standard_discrimination(self) -> None:
        """
        QAD-TC61.4 & QAD-TC63.2: Short Bond paper (aspect ~1.294) uploaded with paper_standard='short'
        matches aspect ratio accurately.
        """
        # Short bond: 215.9 x 279.4 mm. Aspect ratio = 1.2941.
        # Let pixel size be 216 x 279 px.
        image = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(300, 200, 216, 279),
        )

        result = detect_paper_fiducial(image, paper_standard="short")
        assert result.status == "detected"
        assert result.paper_standard == "short"
        assert result.confidence >= 0.70
        assert result.scale_cm_per_px is not None
        # Physical width: 21.59 cm / 216 px = ~0.09995 cm/px
        assert 0.095 <= result.scale_cm_per_px <= 0.105

    def test_long_bond_standard_discrimination(self) -> None:
        """
        Long Bond paper (aspect ~1.5294) is correctly discriminated from Short and A4 standards.
        """
        # Long bond: 215.9 x 330.2 mm. Aspect ratio = 1.5294.
        # Let pixel size be 216 x 330 px.
        image = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(300, 200, 216, 330),
        )

        result = detect_paper_fiducial(image, paper_standard=None)
        assert result.status == "detected"
        assert result.paper_standard == "long"
        assert result.confidence >= 0.70
        assert result.scale_cm_per_px is not None

    def test_autonomous_multi_standard_matching(self) -> None:
        """
        QAD-TC63.1: Autonomous detection resolves standard correctly when paper_standard is None or 'auto'.
        """
        # A4 paper
        image_a4 = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(350, 250, 210, 297),
        )
        res_none = detect_paper_fiducial(image_a4, paper_standard=None)
        assert res_none.status == "detected"
        assert res_none.paper_standard == "a4"
        assert res_none.confidence >= 0.70

        res_auto = detect_paper_fiducial(image_a4, paper_standard="auto")
        assert res_auto.status == "detected"
        assert res_auto.paper_standard == "a4"
        assert res_auto.confidence >= 0.70

        # Short bond paper
        image_short = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(300, 200, 216, 279),
        )
        res_short_auto = detect_paper_fiducial(image_short, paper_standard="auto")
        assert res_short_auto.status == "detected"
        assert res_short_auto.paper_standard == "short"

    def test_subpixel_corner_refinement(self) -> None:
        """
        Verifies sub-pixel corner refinement executes and produces high-precision float coordinates.
        """
        img = np.full((200, 200), 50, dtype=np.uint8)
        img[50:150, 50:150] = 230
        blurred = cv2.GaussianBlur(img, (3, 3), 0.8)

        initial_corners = np.array(
            [[50.0, 50.0], [150.0, 50.0], [150.0, 150.0], [50.0, 150.0]],
            dtype=np.float32,
        )
        perturbed = initial_corners + np.array(
            [[0.3, 0.4], [-0.2, 0.3], [-0.4, -0.2], [0.2, -0.3]],
            dtype=np.float32,
        )

        refined = _refine_subpixel_corners(blurred, perturbed)
        assert refined.dtype == np.float32
        assert refined.shape == (4, 2)
        assert not np.allclose(refined, perturbed, atol=1e-5)

    def test_solid_black_and_white_fallback(self) -> None:
        """
        QAD-TC61.3 & QAD-TC63.3: Solid black and white images return status='manual_pin_required'
        with confidence=0.0 without crashing.
        """
        black_img = np.zeros((600, 800, 3), dtype=np.uint8)
        res_black = detect_paper_fiducial(black_img, paper_standard="a4")
        assert res_black.status == "manual_pin_required"
        assert res_black.confidence == 0.0
        assert res_black.scale_cm_per_px is None
        assert res_black.homography_matrix is None

        white_img = np.full((600, 800, 3), 255, dtype=np.uint8)
        res_white = detect_paper_fiducial(white_img, paper_standard="a4")
        assert res_white.status == "manual_pin_required"
        assert res_white.confidence == 0.0
        assert res_white.scale_cm_per_px is None

    def test_low_contrast_fallback(self) -> None:
        """
        QAD-TC63.3: Low contrast photo (white paper on near-identical cream wall) returns
        status='manual_pin_required' with confidence=0.0 without raising an exception.
        """
        # Paper color 241 on wall color 240 (contrast delta 1)
        image_low = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(300, 250, 210, 297),
            bg_color=240,
            paper_color=241,
        )
        res = detect_paper_fiducial(image_low, paper_standard="a4")
        assert res.status == "manual_pin_required"
        assert res.confidence == 0.0

    def test_invalid_paper_standard_fallback(self) -> None:
        """Verifies unknown paper standards fall back cleanly."""
        img = _create_synthetic_paper_image()
        res_invalid = detect_paper_fiducial(img, paper_standard="legal_pad")
        assert res_invalid.status == "manual_pin_required"
        assert res_invalid.confidence == 0.0

    def test_execution_latency_under_45ms(self) -> None:
        """
        QAD-TC61.5 & QAD-TC63.6: Total execution latency on 1024x1024 input remains under 45ms.
        """
        image = _create_synthetic_paper_image(image_size=(1024, 1024))

        # Warm up
        detect_paper_fiducial(image, paper_standard="a4")

        # Benchmark 5 runs
        durations: list[float] = []
        for _ in range(5):
            t0 = time.perf_counter()
            detect_paper_fiducial(image, paper_standard="a4")
            durations.append((time.perf_counter() - t0) * 1000.0)

        avg_ms = sum(durations) / len(durations)
        assert avg_ms < 45.0, f"Average execution time {avg_ms:.2f}ms exceeded 45ms limit"


class TestFastApiAnalyzeImageEndpoint:
    """Validates /analyze-image route integration under standard, auto_detect, and fiducial modes."""

    def test_standard_calibration_mode_skips_paper_detection(self) -> None:
        """
        QAD-TC61.1 & QAD-TC63.5: Image uploaded with calibration_mode='standard' returns
        paper_calibration.status='not_requested'.
        """
        img_bytes = _create_encoded_test_image(_create_synthetic_paper_image())

        response = client.post(
            "/analyze-image",
            files={"image": ("room.jpg", io.BytesIO(img_bytes), "image/jpeg")},
            data={"calibration_mode": "standard"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert "paper_calibration" in payload
        assert payload["paper_calibration"]["status"] == "not_requested"
        assert payload["calibration_meta"]["mode"] == "standard"
        assert payload["calibration_meta"]["status"] == "heuristic_fallback"

    def test_auto_detect_calibration_mode_detected_success(self) -> None:
        """
        QAD-TC63.1: Image uploaded with calibration_mode='auto_detect' (or default)
        autonomously detects A4 paper without explicit paper_standard.
        """
        img = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(350, 250, 210, 297),
        )
        img_bytes = _create_encoded_test_image(img)

        response = client.post(
            "/analyze-image",
            files={"image": ("room.jpg", io.BytesIO(img_bytes), "image/jpeg")},
            data={"calibration_mode": "auto_detect"},
        )

        assert response.status_code == 200
        payload = response.json()
        calib = payload["paper_calibration"]
        assert calib["status"] == "detected"
        assert calib["paper_standard"] == "a4"
        assert calib["confidence"] >= 0.70
        assert len(calib["detected_corners"]) == 4
        assert calib["scale_cm_per_px"] is not None

        # Verify scale_estimation override
        scale = payload["scale_estimation"]
        assert scale["method"] == "paper_fiducial_a4"
        assert scale["best_scale_cm_per_px"] == calib["scale_cm_per_px"]
        assert scale["confidence"] == calib["confidence"]

        # Verify calibration_meta status
        meta = payload["calibration_meta"]
        assert meta["mode"] == "auto_detect"
        assert meta["paper_standard"] == "a4"
        assert meta["status"] == "calibrated"

    def test_fiducial_calibration_mode_detected_success(self) -> None:
        """
        QAD-TC61.2: Visible A4 paper returns status='detected', confidence >= 0.70,
        and overrides scale_estimation method and best scale.
        """
        img = _create_synthetic_paper_image(
            image_size=(1024, 1024),
            paper_rect=(350, 250, 210, 297),
        )
        img_bytes = _create_encoded_test_image(img)

        response = client.post(
            "/analyze-image",
            files={"image": ("room.jpg", io.BytesIO(img_bytes), "image/jpeg")},
            data={"calibration_mode": "paper_fiducial", "paper_standard": "a4"},
        )

        assert response.status_code == 200
        payload = response.json()
        calib = payload["paper_calibration"]
        assert calib["status"] == "detected"
        assert calib["paper_standard"] == "a4"
        assert calib["confidence"] >= 0.70
        assert len(calib["detected_corners"]) == 4
        assert calib["scale_cm_per_px"] is not None

        # Verify scale_estimation override
        scale = payload["scale_estimation"]
        assert scale["method"] == "paper_fiducial_a4"
        assert scale["best_scale_cm_per_px"] == calib["scale_cm_per_px"]
        assert scale["confidence"] == calib["confidence"]

        # Verify calibration_meta status
        meta = payload["calibration_meta"]
        assert meta["mode"] == "paper_fiducial"
        assert meta["paper_standard"] == "a4"
        assert meta["status"] == "calibrated"

    def test_fiducial_calibration_mode_blank_image_graceful_fallback(self) -> None:
        """
        QAD-TC61.3 & QAD-TC63.3: Blank image returns status='manual_pin_required', confidence=0.0,
        with no 500 error thrown.
        """
        blank_img = np.full((600, 800, 3), 200, dtype=np.uint8)
        img_bytes = _create_encoded_test_image(blank_img)

        response = client.post(
            "/analyze-image",
            files={"image": ("room.jpg", io.BytesIO(img_bytes), "image/jpeg")},
            data={"calibration_mode": "paper_fiducial", "paper_standard": "a4"},
        )

        assert response.status_code == 200
        payload = response.json()
        calib = payload["paper_calibration"]
        assert calib["status"] == "manual_pin_required"
        assert calib["confidence"] == 0.0
        assert calib["scale_cm_per_px"] is None
        assert payload["calibration_meta"]["status"] == "manual_pin_required"
