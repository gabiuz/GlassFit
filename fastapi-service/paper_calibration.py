"""
OpenCV planar homography and metric scale estimation engine for standard
Philippine paper fiducials (Short, A4, Long) with autonomous multi-standard
classification, illumination-invariant color segmentation, and sub-pixel corner refinement.

Detects paper sheets placed on interior walls and computes a coplanar metric
scale factor (centimeters per pixel) along with a 3x3 planar homography matrix.

Traceability:
- PRD-F4: CV Image Analysis Pipeline
- PRD-F3: Space Image Upload
- PRD-F10: Quotation Measurement Modal
- SDD-C2: Image Pre-Flight
- SDD-C3: CV Scene Analyzer
- BRD-M1: Intake Duration
- BRD-M5: Estimator Overhead
- BRD-M6: Suppress Scrappage
- QAD-TC61: Metric Scale & Planar Homography Fiducial Detection
- QAD-TC63: Autonomous Multi-Standard Paper Fiducial Detection and Resilient Scale Engine
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

# Canonical paper dimensions in millimeters (width, height) upright.
# Short Bond (US Letter): 215.9 mm x 279.4 mm (ratio ~1.2941)
# A4 Standard (ISO 216): 210.0 mm x 297.0 mm (ratio ~1.4143)
# Long Bond (Philippine Folio): 215.9 mm x 330.2 mm (ratio ~1.5294)
PAPER_DIMENSIONS_MM: dict[str, tuple[float, float]] = {
    "short": (215.9, 279.4),
    "a4": (210.0, 297.0),
    "long": (215.9, 330.2),
}

# Supported paper standards set for fast lookup
VALID_PAPER_STANDARDS: set[str] = set(PAPER_DIMENSIONS_MM.keys())

AUTO_STANDARDS: set[str] = {"auto", "auto_detect", "none", ""}


@dataclass
class PaperCalibrationResult:
    """Detection output and planar homography calibration result."""

    status: str  # "detected" | "manual_pin_required" | "not_requested"
    paper_standard: str | None
    detected_corners: list[list[float]] | None
    scale_cm_per_px: float | None
    confidence: float
    homography_matrix: list[list[float]] | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "paper_standard": self.paper_standard,
            "detected_corners": self.detected_corners,
            "scale_cm_per_px": self.scale_cm_per_px,
            "confidence": self.confidence,
            "homography_matrix": self.homography_matrix,
        }


def _get_target_aspect(standard: str) -> float:
    """Returns canonical aspect ratio (max / min) for the given paper standard."""
    w_mm, h_mm = PAPER_DIMENSIONS_MM[standard]
    return max(w_mm, h_mm) / min(w_mm, h_mm)


def _match_best_paper_standard(
    measured_aspect: float,
    preferred_standard: str | None = None,
) -> tuple[str, float]:
    """
    Finds the closest Philippine paper standard matching the measured aspect ratio.
    Returns (matched_standard, aspect_error).
    """
    standards = ["short", "a4", "long"]
    clean_pref = (preferred_standard or "").lower().strip()
    if clean_pref in standards:
        target_aspect = _get_target_aspect(clean_pref)
        error = abs(measured_aspect - target_aspect) / target_aspect
        return clean_pref, error

    best_standard = "short"
    min_error = float("inf")

    for std in standards:
        target_aspect = _get_target_aspect(std)
        error = abs(measured_aspect - target_aspect) / target_aspect
        if error < min_error:
            min_error = error
            best_standard = std

    return best_standard, min_error


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 coordinates deterministically as:
    [top_left, top_right, bottom_right, bottom_left]

    Algorithm:
    - Top-left corner has the smallest sum (x + y).
    - Bottom-right corner has the largest sum (x + y).
    - Top-right corner has the smallest difference (y - x).
    - Bottom-left corner has the largest difference (y - x).
    """
    pts = pts.reshape(4, 2).astype(np.float32)
    rect = np.zeros((4, 2), dtype=np.float32)

    # Sum of coordinates: x + y
    s = pts.sum(axis=1)
    tl_idx = int(np.argmin(s))
    br_idx = int(np.argmax(s))
    rect[0] = pts[tl_idx]
    rect[2] = pts[br_idx]

    # Difference of coordinates: y - x
    diff = pts[:, 1] - pts[:, 0]
    remaining = [i for i in range(4) if i not in (tl_idx, br_idx)]
    if len(remaining) == 2:
        idx_a, idx_b = remaining[0], remaining[1]
        if diff[idx_a] < diff[idx_b]:
            rect[1] = pts[idx_a]
            rect[3] = pts[idx_b]
        else:
            rect[1] = pts[idx_b]
            rect[3] = pts[idx_a]
    else:
        # Fallback if indices overlapped
        rect[1] = pts[int(np.argmin(diff))]
        rect[3] = pts[int(np.argmax(diff))]

    return rect


def _refine_subpixel_corners(
    gray: np.ndarray,
    ordered_corners: np.ndarray,
) -> np.ndarray:
    """
    Refines corner coordinates using gradient zero-crossing within a 5x5 window.
    """
    corners = ordered_corners.copy().astype(np.float32)
    h, w = gray.shape[:2]
    for pt in corners:
        pt[0] = max(5.0, min(float(w - 6), float(pt[0])))
        pt[1] = max(5.0, min(float(h - 6), float(pt[1])))

    criteria = (
        cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
        30,
        0.01,
    )
    try:
        refined = cv2.cornerSubPix(
            gray,
            corners,
            winSize=(5, 5),
            zeroZone=(-1, -1),
            criteria=criteria,
        )
        return refined
    except Exception:
        return corners


def _validate_interior_angles(
    ordered_pts: np.ndarray,
    min_deg: float = 60.0,
    max_deg: float = 120.0,
) -> bool:
    """
    Verifies that all 4 interior corner angles of a quadrilateral are near-rectangular,
    within [min_deg, max_deg].
    """
    for i in range(4):
        prev_pt = ordered_pts[(i - 1) % 4]
        curr_pt = ordered_pts[i]
        next_pt = ordered_pts[(i + 1) % 4]

        v1 = prev_pt - curr_pt
        v2 = next_pt - curr_pt

        norm1 = float(np.linalg.norm(v1))
        norm2 = float(np.linalg.norm(v2))

        if norm1 < 1e-5 or norm2 < 1e-5:
            return False

        cos_angle = float(np.dot(v1, v2) / (norm1 * norm2))
        cos_angle = max(-1.0, min(1.0, cos_angle))
        angle_deg = float(np.degrees(np.arccos(cos_angle)))

        if angle_deg < min_deg or angle_deg > max_deg:
            return False

    return True


def _evaluate_paper_candidate(
    contour: np.ndarray,
    target_aspect: float,
    image_area: int,
) -> tuple[bool, float, list[list[float]]]:
    """
    Evaluates a contour against physical paper criteria.
    Returns (is_valid, confidence, ordered_corners).

    Filtering constraints:
    1. Vertex count check (must be exactly 4)
    2. Convexity check (must be strictly convex)
    3. Area threshold check (0.05% to 15% of total photo area)
    4. Corner interior angle check (60 to 120 degrees)
    5. Aspect ratio check (within 18% of target standard in upright or landscape)
    """
    # 1. Vertex count check
    if len(contour) != 4:
        return False, 0.0, []

    # 2. Convexity check
    if not cv2.isContourConvex(contour):
        return False, 0.0, []

    # 3. Area threshold check (0.05% to 15% of photo area)
    area = cv2.contourArea(contour)
    area_ratio = area / max(image_area, 1)
    if not (0.0005 <= area_ratio <= 0.15):
        return False, 0.0, []

    pts = contour.reshape(4, 2).astype(np.float32)
    ordered_pts = _order_corners(pts)

    # 4. Interior angle validation (60 to 120 degrees)
    if not _validate_interior_angles(ordered_pts, min_deg=60.0, max_deg=120.0):
        return False, 0.0, []

    # 5. Aspect ratio check
    top_w = float(np.linalg.norm(ordered_pts[1] - ordered_pts[0]))
    bot_w = float(np.linalg.norm(ordered_pts[2] - ordered_pts[3]))
    left_h = float(np.linalg.norm(ordered_pts[3] - ordered_pts[0]))
    right_h = float(np.linalg.norm(ordered_pts[2] - ordered_pts[1]))

    w = (top_w + bot_w) / 2.0
    h = (left_h + right_h) / 2.0

    measured_aspect = max(w, h) / max(min(w, h), 1e-5)
    aspect_error = abs(measured_aspect - target_aspect) / target_aspect

    # Allow up to 18% perspective distortion tolerance
    if aspect_error > 0.18:
        return False, 0.0, []

    # Score calculation combining aspect ratio match and angle perpendicularity
    aspect_score = max(0.1, min(1.0, 1.0 - (aspect_error / 0.18) * 0.5))

    angle_devs: list[float] = []
    for i in range(4):
        prev_pt = ordered_pts[(i - 1) % 4]
        curr_pt = ordered_pts[i]
        next_pt = ordered_pts[(i + 1) % 4]
        v1 = prev_pt - curr_pt
        v2 = next_pt - curr_pt
        n1 = float(np.linalg.norm(v1))
        n2 = float(np.linalg.norm(v2))
        if n1 > 1e-5 and n2 > 1e-5:
            cos_angle = max(-1.0, min(1.0, float(np.dot(v1, v2) / (n1 * n2))))
            angle_deg = float(np.degrees(np.arccos(cos_angle)))
            angle_devs.append(abs(angle_deg - 90.0))

    mean_dev = float(np.mean(angle_devs)) if angle_devs else 0.0
    angle_score = max(0.0, min(1.0, 1.0 - (mean_dev / 30.0)))
    confidence = max(0.1, min(1.0, 0.8 * aspect_score + 0.2 * angle_score))

    return True, confidence, ordered_pts.tolist()


def detect_paper_fiducial(
    image_bgr: np.ndarray,
    paper_standard: str | None = None,
) -> PaperCalibrationResult:
    """
    Detects standard Philippine fiducial paper sheets in the input image.

    Args:
        image_bgr: BGR or Grayscale image array from OpenCV.
        paper_standard: Chosen standard ('short' | 'a4' | 'long'), or None/'auto' for autonomous detection.

    Returns:
        PaperCalibrationResult with status ('detected' or 'manual_pin_required'),
        ordered corner pixel coordinates, metric scale (cm/px), and homography matrix.
    """
    standard_key = (paper_standard or "").lower().strip()
    if standard_key and standard_key not in VALID_PAPER_STANDARDS and standard_key not in AUTO_STANDARDS:
        return PaperCalibrationResult(
            status="manual_pin_required",
            paper_standard=paper_standard,
            detected_corners=None,
            scale_cm_per_px=None,
            confidence=0.0,
            homography_matrix=None,
        )

    preferred_standard = standard_key if standard_key in VALID_PAPER_STANDARDS else None

    # Defensive check on image validity
    if image_bgr is None or image_bgr.size == 0 or len(image_bgr.shape) < 2:
        return PaperCalibrationResult(
            status="manual_pin_required",
            paper_standard=preferred_standard,
            detected_corners=None,
            scale_cm_per_px=None,
            confidence=0.0,
            homography_matrix=None,
        )

    img_h, img_w = image_bgr.shape[:2]
    image_area = img_h * img_w
    if image_area <= 0:
        return PaperCalibrationResult(
            status="manual_pin_required",
            paper_standard=preferred_standard,
            detected_corners=None,
            scale_cm_per_px=None,
            confidence=0.0,
            homography_matrix=None,
        )

    # 1. Pre-Processing: Grayscale + Bilateral Filter (noise reduction preserving edges) + HSV White
    if len(image_bgr.shape) == 3:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
        # Stage 1: HSV white segmentation (low saturation S < 45, high value V > 180)
        white_mask = cv2.inRange(hsv, np.array([0, 0, 180]), np.array([180, 45, 255]))
    else:
        gray = image_bgr.copy()
        white_mask = None

    # Fast check for blank or solid images with near-zero intensity variance
    if float(np.std(gray)) < 1.0:
        return PaperCalibrationResult(
            status="manual_pin_required",
            paper_standard=preferred_standard,
            detected_corners=None,
            scale_cm_per_px=None,
            confidence=0.0,
            homography_matrix=None,
        )

    blurred = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)

    # 2. Multi-Thresholding:
    # Path A: Adaptive Gaussian Thresholding (illumination invariance)
    thresh_adapt = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        21,
        5,
    )
    thresh_adapt_inv = cv2.bitwise_not(thresh_adapt)

    # Path B: Canny Edge Detection with Otsu upper bound
    high_thresh, _ = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    low_thresh = 0.5 * max(high_thresh, 10.0)
    canny_edges = cv2.Canny(blurred, low_thresh, max(high_thresh, 20.0))

    # 3. Morphological Closing: reconnect broken edges (5x5 structuring element)
    morph_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    canny_closed = cv2.morphologyEx(canny_edges, cv2.MORPH_CLOSE, morph_kernel)

    # Standard Otsu binary masks
    _, thresh_otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thresh_otsu_inv = cv2.bitwise_not(thresh_otsu)

    candidate_masks = [
        canny_closed,
        thresh_adapt,
        thresh_adapt_inv,
        thresh_otsu,
        thresh_otsu_inv,
    ]

    if white_mask is not None:
        white_closed = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, morph_kernel)
        candidate_masks.extend([white_mask, white_closed])

    candidates: list[tuple[float, list[list[float]], str]] = []

    # 4. Contour Extraction & Polygon Approximation
    for mask in candidate_masks:
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            area_ratio = area / image_area
            # Quick bounding area pre-filter (0.05% to 15%)
            if not (0.0005 <= area_ratio <= 0.15):
                continue

            peri = cv2.arcLength(cnt, True)
            if peri < 20:
                continue

            # Stage 3: Adaptive Epsilon Quadrilateral Fitting (sweep across 0.015, 0.020, 0.025, 0.035)
            approx = None
            for eps_factor in (0.015, 0.020, 0.025, 0.035):
                poly = cv2.approxPolyDP(cnt, eps_factor * peri, True)
                if len(poly) == 4 and cv2.isContourConvex(poly):
                    approx = poly
                    break

            if approx is None:
                continue

            # Compute measured aspect ratio from candidate polygon
            pts = approx.reshape(4, 2).astype(np.float32)
            ordered_pts = _order_corners(pts)
            top_w = float(np.linalg.norm(ordered_pts[1] - ordered_pts[0]))
            bot_w = float(np.linalg.norm(ordered_pts[2] - ordered_pts[3]))
            left_h = float(np.linalg.norm(ordered_pts[3] - ordered_pts[0]))
            right_h = float(np.linalg.norm(ordered_pts[2] - ordered_pts[1]))
            avg_w = (top_w + bot_w) / 2.0
            avg_h = (left_h + right_h) / 2.0
            measured_aspect = max(avg_w, avg_h) / max(min(avg_w, avg_h), 1e-5)

            matched_std, _ = _match_best_paper_standard(measured_aspect, preferred_standard)
            target_aspect = _get_target_aspect(matched_std)

            is_valid, conf, ordered_corners = _evaluate_paper_candidate(
                approx,
                target_aspect,
                image_area,
            )

            if not is_valid:
                continue

            # Candidate deduplication: suppress near-identical centroid candidates
            c_center = np.mean(ordered_corners, axis=0)
            is_duplicate = False
            for prev_idx, (prev_conf, prev_corners, prev_std) in enumerate(candidates):
                prev_center = np.mean(prev_corners, axis=0)
                if float(np.linalg.norm(c_center - prev_center)) < 15.0:
                    is_duplicate = True
                    if conf > prev_conf:
                        candidates[prev_idx] = (conf, ordered_corners, matched_std)
                    break

            if not is_duplicate:
                candidates.append((conf, ordered_corners, matched_std))

    if not candidates:
        return PaperCalibrationResult(
            status="manual_pin_required",
            paper_standard=preferred_standard,
            detected_corners=None,
            scale_cm_per_px=None,
            confidence=0.0,
            homography_matrix=None,
        )

    # Sort candidates by confidence descending
    candidates.sort(key=lambda c: c[0], reverse=True)
    best_conf, best_corners, best_std = candidates[0]

    # Confidence check: >= 0.65 qualifies as high-confidence automatic detection
    if best_conf < 0.65:
        return PaperCalibrationResult(
            status="manual_pin_required",
            paper_standard=best_std,
            detected_corners=[[round(float(c[0]), 2), round(float(c[1]), 2)] for c in best_corners],
            scale_cm_per_px=None,
            confidence=0.0,
            homography_matrix=None,
        )

    # Stage 5: Sub-Pixel Corner Refinement
    refined_pts = _refine_subpixel_corners(gray, np.array(best_corners, dtype=np.float32))
    refined_ordered = _order_corners(refined_pts)

    # Stage 6: Homography and Metric Scale Derivation
    w_mm, h_mm = PAPER_DIMENSIONS_MM[best_std]
    top_w = float(np.linalg.norm(refined_ordered[1] - refined_ordered[0]))
    bot_w = float(np.linalg.norm(refined_ordered[2] - refined_ordered[3]))
    left_h = float(np.linalg.norm(refined_ordered[3] - refined_ordered[0]))
    right_h = float(np.linalg.norm(refined_ordered[2] - refined_ordered[1]))

    avg_w_px = float((top_w * bot_w) ** 0.5)
    avg_h_px = float((left_h * right_h) ** 0.5)

    # Determine orientation (landscape vs upright/portrait)
    if avg_w_px > avg_h_px:
        # Landscape orientation: paper taped sideways
        canon_w_cm = max(w_mm, h_mm) / 10.0
        canon_h_cm = min(w_mm, h_mm) / 10.0
    else:
        # Upright / portrait orientation
        canon_w_cm = min(w_mm, h_mm) / 10.0
        canon_h_cm = max(w_mm, h_mm) / 10.0

    dst_pts = np.array(
        [
            [0.0, 0.0],
            [canon_w_cm, 0.0],
            [canon_w_cm, canon_h_cm],
            [0.0, canon_h_cm],
        ],
        dtype=np.float32,
    )

    h_matrix = cv2.getPerspectiveTransform(refined_ordered, dst_pts)
    homography_list = [[round(float(v), 6) for v in row] for row in h_matrix.tolist()]

    scale_w = canon_w_cm / max(avg_w_px, 1e-5)
    scale_h = canon_h_cm / max(avg_h_px, 1e-5)
    scale_cm_per_px = round(float((scale_w + scale_h) / 2.0), 6)

    formatted_corners = [[round(float(c[0]), 2), round(float(c[1]), 2)] for c in refined_ordered]

    return PaperCalibrationResult(
        status="detected",
        paper_standard=best_std,
        detected_corners=formatted_corners,
        scale_cm_per_px=scale_cm_per_px,
        confidence=round(best_conf, 3),
        homography_matrix=homography_list,
    )
