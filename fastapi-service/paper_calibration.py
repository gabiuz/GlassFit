"""
OpenCV planar homography and metric scale estimation engine for standard
Philippine paper fiducials (Short, A4, Long). IMP-MS53 separates boundary
localization from customer-declared physical format and metric calibration.

Locates plausible sheet boundaries for explicit customer review. Metric geometry
is deliberately absent until physical format and placement have been confirmed.

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

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
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


CANONICAL_PAPER_RATIOS: dict[str, float] = {
    "short": 279.4 / 215.9,
    "a4": 297.0 / 210.0,
    "long": 330.2 / 215.9,
}
ASPECT_RATIO_TOLERANCE = 0.035


class SeedPoint(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    x: float = Field(ge=0.0, le=1.0, description="Normalized x coordinate in workspace image")
    y: float = Field(ge=0.0, le=1.0, description="Normalized y coordinate in workspace image")


class PaperCandidate(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    id: str
    corners: list[tuple[float, float]] = Field(min_length=4, max_length=4)
    score: float = Field(ge=0, le=1)
    score_components: dict[str, float]
    rejection_reasons: list[str] = Field(default_factory=list)


class PaperCalibrationResult(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    status: Literal["detected", "manual_pin_required", "not_requested"]
    paper_standard: Literal["short", "a4", "long"] | None
    detected_corners: list[tuple[float, float]] | None
    scale_cm_per_px: float | None
    confidence: float = Field(ge=0, le=1)
    homography_matrix: list[list[float]] | None
    detection_outcome: Literal["candidate_found", "ambiguous", "not_found"] = "not_found"
    candidates: list[PaperCandidate] = Field(default_factory=list, max_length=8)
    selected_candidate_id: str | None = None
    reference_source: Literal["auto_detected", "candidate_selected", "manual_corners", "click_guided"] | None = None
    paper_standard_confirmed: bool = False
    suggested_paper_standard: Literal["short", "a4", "long"] | None = None
    aspect_ratio_match_confidence: float = 0.0
    unwarped_aspect_ratio: float | None = None
    coordinate_space: Literal["oriented_source", "workspace"] = "oriented_source"
    geometry_contract_version: Literal["paper-plane-mm-v1"] = "paper-plane-mm-v1"
    coordinate_image_id: str | None = None
    oriented_source_to_workspace: tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]] | None = None
    image_width: int = 0
    image_height: int = 0
    rejection_reasons: list[str] = Field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 coordinates deterministically as:
    [top_left, top_right, bottom_right, bottom_left]

    Sort cyclically around the centroid, then rotate to the smallest x+y.
    """
    pts = pts.reshape(4, 2).astype(np.float32)
    center = pts.mean(axis=0)
    angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
    cyclic = pts[np.argsort(angles)]
    return np.roll(cyclic, -int(np.argmin(cyclic.sum(axis=1))), axis=0)


def _compute_unwarped_aspect_ratio(
    corners: list[tuple[float, float]] | np.ndarray,
    image_shape: tuple[int, int] = (1024, 1024),
    exif_f_px: float | None = None,
) -> tuple[float, str | None, float]:
    """
    Computes frontal-rectified unwarped aspect ratio and auto-suggests canonical Philippine paper standard (IMP-MS60).

    1. Map corners to normalized unit square Q = [[0, 0], [1, 0], [1, 1], [0, 1]].
    2. Invert homography to obtain H_rect mapping unit square to image plane.
    3. Recover camera focal length via orthogonality of column vectors or fallback to sensor dimension.
    4. Calculate physical aspect ratio in unwarped metric space.
    5. Compare against Philippine standards (Short: 1.2941, A4: 1.4143, Long: 1.5294) within tolerance.

    Returns:
        (unwarped_ratio, suggested_standard, confidence_match)
    """
    pts = np.asarray(corners, dtype=np.float32).reshape(4, 2)
    h_img, w_img = image_shape[:2]
    u0, v0 = float(w_img) * 0.5, float(h_img) * 0.5

    ordered = _order_corners(pts)

    top_w = float(np.linalg.norm(ordered[1] - ordered[0]))
    bot_w = float(np.linalg.norm(ordered[2] - ordered[3]))
    left_h = float(np.linalg.norm(ordered[3] - ordered[0]))
    right_h = float(np.linalg.norm(ordered[2] - ordered[1]))
    avg_w = (top_w + bot_w) / 2.0
    avg_h = (left_h + right_h) / 2.0
    ratio_2d = max(avg_w, avg_h) / max(min(avg_w, avg_h), 1e-6)

    w_diff = abs(top_w - bot_w) / max(top_w, bot_w, 1.0)
    h_diff = abs(left_h - right_h) / max(left_h, right_h, 1.0)

    ratio: float | None = None

    # Only run vanishing-point unwarping if perspective foreshortening is present
    if w_diff >= 0.06 or h_diff >= 0.06:
        q_norm = np.array([[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]], dtype=np.float32)
        try:
            h_norm = cv2.getPerspectiveTransform(ordered, q_norm)
            h_rect = np.linalg.inv(h_norm)
            if abs(float(h_rect[2, 2])) > 1e-9:
                h_rect = h_rect / float(h_rect[2, 2])
            else:
                h_rect = None
        except Exception:
            h_rect = None

        if h_rect is not None:
            h1 = h_rect[:, 0]
            h2 = h_rect[:, 1]
            num = (h1[0] - u0 * h1[2]) * (h2[0] - u0 * h2[2]) + (h1[1] - v0 * h1[2]) * (h2[1] - v0 * h2[2])
            den = h1[2] * h2[2]

            max_dim = float(max(w_img, h_img))
            f_sq = -num / den if abs(den) > 1e-9 else -1.0

            if f_sq > 0 and (0.4 * max_dim) ** 2 <= f_sq <= (4.0 * max_dim) ** 2:
                f = float(np.sqrt(f_sq))
            elif exif_f_px is not None and exif_f_px > 0:
                f = float(exif_f_px)
            else:
                f = max_dim

            k_mat = np.array([[f, 0.0, u0], [0.0, f, v0], [0.0, 0.0, 1.0]], dtype=np.float32)
            try:
                k_inv = np.linalg.inv(k_mat)
                v_w = k_inv @ h1
                v_h = k_inv @ h2
                nw = float(np.linalg.norm(v_w))
                nh = float(np.linalg.norm(v_h))
                if nw > 1e-6 and nh > 1e-6:
                    ratio = max(nw, nh) / min(nw, nh)
            except Exception:
                ratio = None

    if ratio is None or np.isnan(ratio) or np.isinf(ratio):
        ratio = ratio_2d

    best_std: str | None = None
    min_dev = 1.0
    for std, target in CANONICAL_PAPER_RATIOS.items():
        dev = abs(ratio - target) / target
        if dev < min_dev:
            min_dev = dev
            best_std = std

    tolerance = max(ASPECT_RATIO_TOLERANCE, 0.040)
    if min_dev <= tolerance:
        return float(round(ratio, 4)), best_std, float(round(1.0 - min_dev, 4))
    else:
        return float(round(ratio, 4)), None, 0.0


def _finalize_detected_result(
    result: PaperCalibrationResult,
    image_shape: tuple[int, int],
) -> PaperCalibrationResult:
    if result.detected_corners:
        unwarped_ratio, suggested_std, conf_match = _compute_unwarped_aspect_ratio(
            result.detected_corners, image_shape
        )
        result.unwarped_aspect_ratio = unwarped_ratio
        result.suggested_paper_standard = suggested_std
        result.aspect_ratio_match_confidence = conf_match
    return result



MAX_REFINEMENT_DRIFT = 12.0


def _fit_edge_lines_and_intersect(
    gray: np.ndarray,
    initial_corners: np.ndarray,
) -> np.ndarray:
    """
    Sub-Pixel Edge Line Intersection (IMP-MS59 / QAD-TC74).
    Fits straight line equations to the mid-80% of each of the 4 contour edges
    using Huber robust loss (cv2.DIST_HUBER), then determines true corner vertices
    as the mathematical intersections of adjacent edge lines.

    Eliminates corner rounding, chipped paper corners, and localized shadow blur artifacts.
    Rejects non-convex or severely distorted results with fallback to initial corners.
    """
    if gray is None or gray.size == 0 or len(initial_corners) != 4:
        return np.asarray(initial_corners, dtype=np.float32)

    ordered = _order_corners(np.asarray(initial_corners, dtype=np.float32)).astype(np.float64)
    h, w = gray.shape[:2]

    # Compute Sobel gradients
    gray_f = gray.astype(np.float32)
    gx = cv2.Sobel(gray_f, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_f, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.hypot(gx, gy)
    mean_mag = float(np.mean(mag))
    min_contrast_thresh = max(15.0, 0.5 * mean_mag)

    lines: list[tuple[float, float, float]] = []

    for i in range(4):
        a = ordered[i]
        b = ordered[(i + 1) % 4]
        v = b - a
        length = float(np.hypot(v[0], v[1]))

        if length < 5.0:
            # Degenerate edge; use initial segment equation
            t_unit = v / max(length, 1e-6)
            ai = -float(t_unit[1])
            bi = float(t_unit[0])
            norm = float(np.hypot(ai, bi))
            if norm > 1e-9:
                ai /= norm
                bi /= norm
            ci = -(ai * float(a[0]) + bi * float(a[1]))
            lines.append((ai, bi, ci))
            continue

        t_unit = v / length
        normal = np.array([-t_unit[1], t_unit[0]], dtype=np.float64)

        # Sample points along segment AB, excluding outer 10% near corners
        n_samples = int(np.clip(length * 0.5, 15, 60))
        t_vals = np.linspace(0.10, 0.90, n_samples)
        sample_pts = a[None, :] + t_vals[:, None] * v[None, :]

        search_radius = float(min(14.0, max(6.0, length * 0.06)))
        r_steps = np.linspace(-search_radius, search_radius, 35)

        edge_points: list[list[float]] = []

        for p in sample_pts:
            coords = p[None, :] + r_steps[:, None] * normal[None, :]
            cx_vals = np.clip(coords[:, 0], 0, w - 1)
            cy_vals = np.clip(coords[:, 1], 0, h - 1)
            x0 = np.floor(cx_vals).astype(int)
            x1 = np.clip(x0 + 1, 0, w - 1)
            y0 = np.floor(cy_vals).astype(int)
            y1 = np.clip(y0 + 1, 0, h - 1)
            wa = (x1 - cx_vals) * (y1 - cy_vals)
            wb = (x1 - cx_vals) * (cy_vals - y0)
            wc = (cx_vals - x0) * (y1 - cy_vals)
            wd = (cx_vals - x0) * (cy_vals - y0)
            magnitudes = wa * mag[y0, x0] + wb * mag[y1, x0] + wc * mag[y0, x1] + wd * mag[y1, x1]

            max_val = float(np.max(magnitudes))
            if max_val >= min_contrast_thresh:
                top_indices = np.where(magnitudes >= 0.95 * max_val)[0]
                if 0 < top_indices[0] and top_indices[-1] < len(r_steps) - 1:
                    r_peak = float(np.mean(r_steps[top_indices]))
                    edge_pt = p + r_peak * normal
                    edge_points.append([float(edge_pt[0]), float(edge_pt[1])])

        # Robust Line Fitting with Huber Loss
        if len(edge_points) >= 5:
            pts_array = np.array(edge_points, dtype=np.float32).reshape(-1, 1, 2)
            try:
                line_params = cv2.fitLine(pts_array, cv2.DIST_HUBER, 0, 0.01, 0.01)
                vx, vy, x0, y0 = [float(val) for val in line_params.flatten()]
                ai = -vy
                bi = vx
                norm = float(np.hypot(ai, bi))
                if norm > 1e-9:
                    ai /= norm
                    bi /= norm
                ci = -(ai * x0 + bi * y0)
                lines.append((ai, bi, ci))
            except Exception:
                ai = -float(t_unit[1])
                bi = float(t_unit[0])
                ci = -(ai * float((a[0] + b[0]) / 2.0) + bi * float((a[1] + b[1]) / 2.0))
                lines.append((ai, bi, ci))
        else:
            ai = -float(t_unit[1])
            bi = float(t_unit[0])
            norm = float(np.hypot(ai, bi))
            if norm > 1e-9:
                ai /= norm
                bi /= norm
            ci = -(ai * float((a[0] + b[0]) / 2.0) + bi * float((a[1] + b[1]) / 2.0))
            lines.append((ai, bi, ci))

    # Mathematical Line Intersections
    refined_corners: list[list[float]] = []
    for j in range(4):
        i = (j - 1) % 4
        k = j
        ai, bi, ci = lines[i]
        ak, bk, ck = lines[k]

        det = ai * bk - ak * bi
        if abs(det) < 1e-5:
            return ordered.astype(np.float32)

        x = (bi * ck - bk * ci) / det
        y = (ak * ci - ai * ck) / det
        refined_corners.append([float(x), float(y)])

    refined = np.array(refined_corners, dtype=np.float32)

    # Validation Checks
    if not np.all(np.isfinite(refined)):
        return ordered.astype(np.float32)
    if np.any(refined < -20.0) or np.any(refined[:, 0] > w + 20.0) or np.any(refined[:, 1] > h + 20.0):
        return ordered.astype(np.float32)

    # Strict convexity check
    if not cv2.isContourConvex(refined.reshape(-1, 1, 2).astype(np.float32)):
        return ordered.astype(np.float32)

    # Perspective angle check: [45 deg, 135 deg]
    for j in range(4):
        v_prev = refined[(j - 1) % 4] - refined[j]
        v_next = refined[(j + 1) % 4] - refined[j]
        len_prev = float(np.hypot(v_prev[0], v_prev[1]))
        len_next = float(np.hypot(v_next[0], v_next[1]))
        if len_prev < 1e-4 or len_next < 1e-4:
            return ordered.astype(np.float32)
        cos_theta = float(np.dot(v_prev, v_next) / (len_prev * len_next))
        angle_deg = float(np.degrees(np.arccos(np.clip(cos_theta, -1.0, 1.0))))
        if angle_deg < 45.0 or angle_deg > 135.0:
            return ordered.astype(np.float32)

    # Maximum refinement drift check
    max_drift = float(np.max(np.linalg.norm(refined - ordered, axis=1)))
    if max_drift > MAX_REFINEMENT_DRIFT:
        return ordered.astype(np.float32)

    return _order_corners(refined)


def _refine_subpixel_corners(
    gray: np.ndarray,
    ordered_corners: np.ndarray,
) -> np.ndarray:
    """
    Refines corner coordinates using straight edge line intersection (IMP-MS59)
    with cv2.cornerSubPix fallback.
    """
    line_refined = _fit_edge_lines_and_intersect(gray, ordered_corners)
    if (cv2.isContourConvex(line_refined.reshape(-1, 1, 2).astype(np.float32)) and
            float(np.max(np.linalg.norm(line_refined - ordered_corners, axis=1))) <= MAX_REFINEMENT_DRIFT):
        return line_refined

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


# IMP-MS53 / QAD-TC68: localization evidence, never physical size inference.
MAX_CANDIDATES = 8
MIN_BOUNDARY_SCORE = 0.72
MIN_SELECTION_MARGIN = 0.05
MIN_CLICK_GUIDED_SCORE = 0.68


def _same_boundary(a: np.ndarray, b: np.ndarray, diagonal: float) -> bool:
    intersection, _ = cv2.intersectConvexConvex(a, b)
    union = cv2.contourArea(a) + cv2.contourArea(b) - intersection
    proximity = min(float(np.max(np.linalg.norm(a - np.roll(b, k, axis=0), axis=1)))
                    for k in range(4))
    return intersection / max(union, 1) >= 0.85 and proximity / diagonal <= 0.008


def _is_same_object(cand_a: PaperCandidate, cand_b: PaperCandidate, diagonal: float) -> bool:
    """Checks whether two candidates represent the same physical sheet in the scene."""
    pts_a = np.array(cand_a.corners, dtype=np.float32)
    pts_b = np.array(cand_b.corners, dtype=np.float32)
    center_a = pts_a.mean(axis=0)
    center_b = pts_b.mean(axis=0)
    center_dist = float(np.hypot(center_a[0] - center_b[0], center_a[1] - center_b[1]))
    if center_dist < 0.08 * diagonal:
        return True
    try:
        intersection, _ = cv2.intersectConvexConvex(pts_a, pts_b)
        area_a = float(cv2.contourArea(pts_a))
        area_b = float(cv2.contourArea(pts_b))
        union = area_a + area_b - intersection
        if union > 0 and (intersection / union) > 0.35:
            return True
    except Exception:
        pass
    return False


def _is_seed_inside_or_near(poly: np.ndarray, seed_px: tuple[float, float], diagonal: float) -> bool:
    """Checks whether seed_px lies inside poly or within 1.5% image diagonal tolerance."""
    pt = (float(seed_px[0]), float(seed_px[1]))
    dist = cv2.pointPolygonTest(poly.astype(np.float32), pt, measureDist=True)
    if dist >= 0:
        return True
    tol = max(12.0, 0.015 * diagonal)
    return abs(dist) <= tol


def _score_candidate_geometry(
    source: np.ndarray,
    distance: np.ndarray,
    points: np.ndarray,
    paths_count: int,
    width: int,
    height: int,
    tolerance: float,
    is_click_guided: bool = False,
    image_bgr: np.ndarray | None = None,
) -> tuple[float, dict[str, float], list[str]]:
    reasons: list[str] = []
    if (np.any(points[:, 0] <= tolerance * 2) or np.any(points[:, 0] >= width - tolerance * 2)
            or np.any(points[:, 1] <= tolerance * 2) or np.any(points[:, 1] >= height - tolerance * 2)):
        reasons.append("cropped_boundary")
    supports, contrasts = [], []
    for i in range(4):
        a, b = points[i], points[(i + 1) % 4]
        samples = a + np.linspace(0.05, 0.95, 80)[:, None] * (b - a)
        normal = np.array([-(b-a)[1], (b-a)[0]]) / max(float(np.linalg.norm(b-a)), 1)
        def sample(img: np.ndarray, coords: np.ndarray) -> np.ndarray:
            return img[np.clip(coords[:, 1].astype(int), 0, height-1),
                       np.clip(coords[:, 0].astype(int), 0, width-1)]
        supports.append(float(np.mean(sample(distance, samples) <= tolerance * 1.5)))
        inside = sample(source, samples + normal * tolerance * 3).astype(float)
        outside = sample(source, samples - normal * tolerance * 3).astype(float)
        contrasts.append(float(np.median(np.abs(inside-outside))))
    interior_mask = np.zeros(source.shape, np.uint8)
    cv2.fillConvexPoly(interior_mask, points.astype(np.int32), 255)
    interior_mask = cv2.erode(interior_mask, np.ones((5, 5), np.uint8))
    values = source[interior_mask > 0]
    consistency = max(0.0, 1 - float(np.std(values)) / 64) if values.size else 0
    boundary = float(np.mean(supports))
    min_boundary = float(min(supports)) if supports else 0.0
    contrast = min(1.0, min(contrasts) / 25)
    stability = min(1.0, paths_count / 3)

    # Aspect ratio match to canonical Philippine bond paper
    top_w = float(np.linalg.norm(points[1] - points[0]))
    bot_w = float(np.linalg.norm(points[2] - points[3]))
    left_h = float(np.linalg.norm(points[3] - points[0]))
    right_h = float(np.linalg.norm(points[2] - points[1]))
    avg_w = (top_w + bot_w) / 2.0
    avg_h = (left_h + right_h) / 2.0
    cand_ratio = max(avg_w, avg_h) / max(min(avg_w, avg_h), 1e-6)
    best_ratio_dev = min(abs(cand_ratio - target) / target for target in CANONICAL_PAPER_RATIOS.values())
    ratio_score = max(0.0, 1.0 - best_ratio_dev / 0.15)

    # Scale plausibility score: paper fiducial typically occupies 0.3% to 15% of space image
    quad_area = float(cv2.contourArea(points))
    img_area = float(width * height)
    area_pct = quad_area / max(img_area, 1.0)
    if 0.0035 <= area_pct <= 0.15:
        area_score = 1.0
    elif 0.0012 <= area_pct <= 0.25:
        area_score = 0.65
    else:
        area_score = 0.25

    # Whiteness / low saturation score
    sat_score = 0.8
    if image_bgr is not None and values.size:
        try:
            hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
            sat_vals = hsv[:, :, 1][interior_mask > 0]
            sat_score = max(0.0, 1.0 - float(np.mean(sat_vals)) / 75.0)
        except Exception:
            sat_score = 0.8

    score = (
        0.25 * boundary +
        0.20 * ratio_score +
        0.20 * sat_score +
        0.15 * consistency +
        0.10 * area_score +
        0.10 * contrast
    )

    if boundary < 0.60 or min_boundary < 0.30:
        reasons.append("incomplete_boundary")
    if stability < 0.33 and not is_click_guided and boundary < 0.85:
        reasons.append("unstable_boundary")
    min_score = MIN_CLICK_GUIDED_SCORE if is_click_guided else MIN_BOUNDARY_SCORE
    if score < min_score:
        reasons.append("weak_evidence")
    return score, {
        "boundary_support": boundary,
        "local_contrast": contrast,
        "interior_consistency": consistency,
        "stability": stability,
        "aspect_ratio_match": ratio_score,
        "saturation_neutrality": sat_score,
    }, reasons


def _extract_local_roi_candidate(
    source: np.ndarray,
    seed_px: tuple[float, float],
    distance: np.ndarray,
    tolerance: float,
    image_bgr: np.ndarray | None = None,
    source_edges: np.ndarray | None = None,
) -> PaperCandidate | None:
    height, width = source.shape[:2]
    diagonal = float(np.hypot(width, height))
    roi_w = int(np.clip(0.35 * width, 160, 0.65 * width))
    roi_h = int(np.clip(0.35 * height, 160, 0.65 * height))
    roi_w = min(roi_w, width)
    roi_h = min(roi_h, height)

    x1 = int(np.clip(seed_px[0] - roi_w // 2, 0, width - roi_w))
    y1 = int(np.clip(seed_px[1] - roi_h // 2, 0, height - roi_h))
    x2 = x1 + roi_w
    y2 = y1 + roi_h

    roi = source[y1:y2, x1:x2].copy()
    seed_x_roi = float(np.clip(seed_px[0] - x1, 0, roi_w - 1))
    seed_y_roi = float(np.clip(seed_px[1] - y1, 0, roi_h - 1))

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(roi)
    smoothed = cv2.bilateralFilter(enhanced, d=7, sigmaColor=50, sigmaSpace=50)

    _, local_otsu = cv2.threshold(smoothed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    local_adaptive = cv2.adaptiveThreshold(
        smoothed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 4
    )
    local_canny = cv2.Canny(smoothed, 20, 70)
    canny_sensitive = cv2.Canny(smoothed, 10, 30)
    clahe_canny = cv2.Canny(enhanced, 15, 45)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    k5 = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    k7 = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    morph_grad = cv2.morphologyEx(smoothed, cv2.MORPH_GRADIENT, kernel)
    canny_closed = cv2.morphologyEx(local_canny, cv2.MORPH_CLOSE, kernel)
    canny_closed5 = cv2.morphologyEx(canny_sensitive, cv2.MORPH_CLOSE, k5)
    canny_closed7 = cv2.morphologyEx(canny_sensitive, cv2.MORPH_CLOSE, k7)
    clahe_canny_closed5 = cv2.morphologyEx(clahe_canny, cv2.MORPH_CLOSE, k5)
    clahe_canny_closed7 = cv2.morphologyEx(clahe_canny, cv2.MORPH_CLOSE, k7)
    adaptive_low = cv2.adaptiveThreshold(
        smoothed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    adaptive_low_closed = cv2.morphologyEx(adaptive_low, cv2.MORPH_CLOSE, k5)

    flood_mask = np.zeros((roi_h + 2, roi_w + 2), np.uint8)
    flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
    cv2.floodFill(
        smoothed.copy(),
        flood_mask,
        (int(seed_x_roi), int(seed_y_roi)),
        255,
        loDiff=12,
        upDiff=12,
        flags=flags,
    )
    filled = flood_mask[1:-1, 1:-1]

    masks = [
        filled,
        local_otsu,
        cv2.bitwise_not(local_otsu),
        local_adaptive,
        cv2.bitwise_not(local_adaptive),
        local_canny,
        canny_closed,
        canny_closed5,
        canny_closed7,
        clahe_canny_closed5,
        clahe_canny_closed7,
        adaptive_low_closed,
        morph_grad,
    ]
    if source_edges is not None:
        roi_se = source_edges[y1:y2, x1:x2]
        masks.append(cv2.morphologyEx(roi_se, cv2.MORPH_CLOSE, k5))
        masks.append(cv2.morphologyEx(roi_se, cv2.MORPH_CLOSE, k7))

    best_candidate: PaperCandidate | None = None
    best_score = -1.0
    roi_diag = float(np.hypot(roi_w, roi_h))
    roi_area = float(roi_w * roi_h)

    for mask in masks:
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:32]
        for contour in contours:
            c_area = cv2.contourArea(contour)
            if c_area / roi_area < 0.005 or c_area / roi_area > 0.98:
                continue
            perimeter = cv2.arcLength(contour, True)
            hull = cv2.convexHull(contour)
            hull_peri = cv2.arcLength(hull, True)

            quads_to_test = []
            for epsilon in (0.015, 0.025, 0.035, 0.045, 0.06):
                poly1 = cv2.approxPolyDP(contour, epsilon * perimeter, True)
                if len(poly1) == 4 and cv2.isContourConvex(poly1):
                    quads_to_test.append(poly1)
                poly2 = cv2.approxPolyDP(hull, epsilon * hull_peri, True)
                if len(poly2) == 4 and cv2.isContourConvex(poly2):
                    quads_to_test.append(poly2)

            if len(hull) >= 4:
                rect = cv2.minAreaRect(contour)
                rect_area = rect[1][0] * rect[1][1]
                if rect_area > 0 and c_area / rect_area >= 0.55:
                    rw, rh = rect[1]
                    if rw > 10 and rh > 10:
                        r_ratio = max(rw, rh) / max(min(rw, rh), 1e-5)
                        if 1.05 <= r_ratio <= 2.2:
                            box = cv2.boxPoints(rect).astype(np.float32)
                            quads_to_test.append(box.reshape(4, 1, 2))

            for poly in quads_to_test:
                if cv2.contourArea(poly) <= 1:
                    continue
                flat_poly = poly.reshape(4, 2)
                pw1 = float(np.linalg.norm(flat_poly[1] - flat_poly[0]))
                ph1 = float(np.linalg.norm(flat_poly[3] - flat_poly[0]))
                if pw1 > 0 and ph1 > 0:
                    pr = max(pw1, ph1) / max(min(pw1, ph1), 1e-5)
                    if pr < 1.05 or pr > 2.5:
                        continue
                if not _is_seed_inside_or_near(poly, (seed_x_roi, seed_y_roi), roi_diag):
                    continue

                pts = poly.reshape(4, 2).astype(np.float32) + np.array([x1, y1], dtype=np.float32)
                ordered = _order_corners(pts)
                if len(np.unique(ordered, axis=0)) != 4:
                    continue

                refined = _refine_subpixel_corners(source, ordered)
                if (cv2.isContourConvex(refined) and
                        float(np.max(np.linalg.norm(refined - ordered, axis=1))) <= tolerance * 2):
                    ordered = refined

                if not _is_seed_inside_or_near(ordered, seed_px, diagonal):
                    continue

                score, components, reasons = _score_candidate_geometry(
                    source=source,
                    distance=distance,
                    points=ordered,
                    paths_count=2,
                    width=width,
                    height=height,
                    tolerance=tolerance,
                    is_click_guided=True,
                    image_bgr=image_bgr,
                )

                if "cropped_boundary" in reasons:
                    continue

                if score >= MIN_CLICK_GUIDED_SCORE and score > best_score:
                    best_score = score
                    clean_reasons = [r for r in reasons if r not in {"weak_evidence", "unstable_boundary"}]
                    best_candidate = PaperCandidate(
                        id="candidate-click-guided",
                        corners=ordered.round(2).tolist(),
                        score=round(score, 4),
                        score_components=components,
                        rejection_reasons=clean_reasons,
                    )
    return best_candidate


def detect_paper_fiducial(
    image_bgr: np.ndarray,
    paper_standard: str | None = None,
    seed_point: tuple[float, float] | SeedPoint | None = None,
) -> PaperCalibrationResult:
    """Locate bounded reference candidates. Review and declaration precede metrics.

    Scores describe visible boundary evidence, not paper identity or accuracy.
    Input is the already orientation-normalized source image from main.py.
    When seed_point is provided, executes single-click guided candidate selection (IMP-MS58).
    """
    standard = (paper_standard or "").lower().strip()
    declared = standard if standard in VALID_PAPER_STANDARDS else None
    result = PaperCalibrationResult(
        status="manual_pin_required", paper_standard=declared,
        detected_corners=None, scale_cm_per_px=None, confidence=0,
        homography_matrix=None, paper_standard_confirmed=declared is not None,
    )
    if image_bgr is None or image_bgr.size == 0 or len(image_bgr.shape) < 2:
        return result
    height, width = image_bgr.shape[:2]
    result.image_width, result.image_height = width, height
    if standard and standard not in VALID_PAPER_STANDARDS | AUTO_STANDARDS:
        return result
    if min(height, width) < 24:
        return result
    source = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY) if image_bgr.ndim == 3 else image_bgr
    if float(np.std(source)) < 1:
        return result

    # Resolve optional seed point coordinate (supports normalized [0.0, 1.0] or pixel coords)
    seed_px: tuple[float, float] | None = None
    if seed_point is not None:
        if isinstance(seed_point, SeedPoint):
            sx, sy = seed_point.x, seed_point.y
        elif isinstance(seed_point, dict):
            sx, sy = float(seed_point.get("x", 0)), float(seed_point.get("y", 0))
        else:
            sx, sy = float(seed_point[0]), float(seed_point[1])
        import math
        if math.isfinite(sx) and math.isfinite(sy):
            if sx <= 1.0 and sy <= 1.0 and not (sx == 0 and sy == 0 and width <= 1):
                seed_px = (sx * width, sy * height)
            else:
                seed_px = (sx, sy)

    factor = min(1.0, 1024 / max(width, height))
    gray = cv2.resize(source, None, fx=factor, fy=factor) if factor < 1 else source
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    enhanced = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
    smoothed = cv2.bilateralFilter(enhanced, d=5, sigmaColor=40, sigmaSpace=40)

    # Multi-threshold detection masks
    edges1 = cv2.Canny(smoothed, 15, 50)
    edges2 = cv2.Canny(smoothed, 30, 80)
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed_edges1 = cv2.morphologyEx(edges1, cv2.MORPH_CLOSE, k_close)
    closed_edges2 = cv2.morphologyEx(edges2, cv2.MORPH_CLOSE, k_close)

    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adaptive25 = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                      cv2.THRESH_BINARY, 25, 4)
    adaptive45 = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                      cv2.THRESH_BINARY, 45, 4)
    adaptive65 = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                      cv2.THRESH_BINARY, 65, 4)

    masks = [
        edges1,
        closed_edges1,
        closed_edges2,
        otsu,
        cv2.bitwise_not(otsu),
        adaptive25,
        cv2.bitwise_not(adaptive25),
        adaptive45,
        adaptive65,
    ]
    k_close7 = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    closed_edges_cl = cv2.morphologyEx(cv2.Canny(enhanced, 15, 45), cv2.MORPH_CLOSE, k_close7)
    masks.append(closed_edges_cl)

    # Add white color mask if color image is available
    if image_bgr.ndim == 3:
        try:
            work_color = cv2.resize(image_bgr, None, fx=factor, fy=factor) if factor < 1 else image_bgr
            hsv = cv2.cvtColor(work_color, cv2.COLOR_BGR2HSV)
            white_mask = cv2.inRange(hsv, (0, 0, 130), (180, 60, 255))
            white_clean = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, k_close)
            masks.append(white_clean)
        except Exception:
            pass

    proposals: list[tuple[np.ndarray, set[int]]] = []
    diagonal = float(np.hypot(*gray.shape))
    area = gray.size

    for path, mask in enumerate(masks):
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        valid_contours = [c for c in contours if 0.0010 <= cv2.contourArea(c) / area <= 0.30]
        valid_contours = sorted(valid_contours, key=cv2.contourArea, reverse=True)[:128]
        for contour in valid_contours:
            perimeter = cv2.arcLength(contour, True)
            hull = cv2.convexHull(contour)
            hull_peri = cv2.arcLength(hull, True)

            quads_to_test = []
            for epsilon in (0.015, 0.025, 0.035, 0.045, 0.06):
                p1 = cv2.approxPolyDP(contour, epsilon * perimeter, True)
                if len(p1) == 4 and cv2.isContourConvex(p1):
                    quads_to_test.append(p1)
                p2 = cv2.approxPolyDP(hull, epsilon * hull_peri, True)
                if len(p2) == 4 and cv2.isContourConvex(p2):
                    quads_to_test.append(p2)

            if len(hull) >= 4:
                rect = cv2.minAreaRect(contour)
                rect_area = rect[1][0] * rect[1][1]
                if rect_area > 0 and cv2.contourArea(contour) / rect_area >= 0.55:
                    rw, rh = rect[1]
                    if rw > 15 and rh > 15:
                        r_ratio = max(rw, rh) / max(min(rw, rh), 1e-5)
                        if 1.05 <= r_ratio <= 2.2:
                            box = cv2.boxPoints(rect).astype(np.float32)
                            quads_to_test.append(box.reshape(4, 1, 2))

            for poly in quads_to_test:
                points = _order_corners(poly)
                if len(np.unique(points, axis=0)) != 4 or cv2.contourArea(points) <= 1:
                    continue

                w1 = np.linalg.norm(points[1] - points[0])
                w2 = np.linalg.norm(points[2] - points[3])
                h1 = np.linalg.norm(points[3] - points[0])
                h2 = np.linalg.norm(points[2] - points[1])
                aw = (w1 + w2) / 2.0
                ah = (h1 + h2) / 2.0
                if aw < 15 or ah < 15:
                    continue
                r = max(aw, ah) / max(min(aw, ah), 1e-5)
                if r > 3.0:
                    continue

                duplicate = next((i for i, (p, _) in enumerate(proposals)
                                  if _same_boundary(points, p, diagonal)), None)
                if duplicate is None:
                    if len(proposals) < 128:
                        proposals.append((points, {path}))
                else:
                    proposals[duplicate][1].add(path)
                break

    # Score at source resolution after bounded refinement with multi-scale edge support
    se1 = cv2.Canny(source, 20, 60)
    se2 = cv2.Canny(source, 10, 30)
    clahe_full = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(source)
    se3 = cv2.Canny(clahe_full, 15, 45)
    source_edges = cv2.bitwise_or(se1, cv2.bitwise_or(se2, se3))
    distance = cv2.distanceTransform(255 - source_edges, cv2.DIST_L2, 3)
    tolerance = max(1.5, np.hypot(width, height) * 0.0015)
    ranked: list[PaperCandidate] = []
    for points, paths in proposals:
        points = points / factor
        refined = _refine_subpixel_corners(source, points)
        if (cv2.isContourConvex(refined) and
                float(np.max(np.linalg.norm(refined - points, axis=1))) <= tolerance * 2):
            points = refined

        score, components, reasons = _score_candidate_geometry(
            source=source,
            distance=distance,
            points=points,
            paths_count=len(paths),
            width=width,
            height=height,
            tolerance=tolerance,
            is_click_guided=False,
            image_bgr=image_bgr if image_bgr.ndim == 3 else None,
        )

        ranked.append(PaperCandidate(
            id="pending", corners=points.round(2).tolist(), score=round(score, 4),
            score_components=components,
            rejection_reasons=reasons,
        ))

    ranked.sort(key=lambda c: (-c.score, c.corners))

    # Click-guided localization branch (IMP-MS58)
    if seed_px is not None:
        source_diagonal = float(np.hypot(width, height))
        # Tier 1: Fast Proposal Spatial Query
        enclosing_proposals = [
            c for c in ranked
            if _is_seed_inside_or_near(np.array(c.corners), seed_px, source_diagonal)
            and "cropped_boundary" not in c.rejection_reasons
        ]
        tier1_eligible = [
            c for c in enclosing_proposals
            if c.score >= MIN_CLICK_GUIDED_SCORE
        ]
        if tier1_eligible:
            tier1_eligible.sort(key=lambda c: -c.score)
            best = tier1_eligible[0]
            best.rejection_reasons = [r for r in best.rejection_reasons if r not in {"weak_evidence", "unstable_boundary"}]
            for c in ranked:
                if c.id != best.id and not _is_seed_inside_or_near(np.array(c.corners), seed_px, source_diagonal):
                    if "seed_point_outside_valid_boundary" not in c.rejection_reasons:
                        c.rejection_reasons.append("seed_point_outside_valid_boundary")
            ordered_candidates = [best] + [c for c in ranked if c.id != best.id]
            result.candidates = ordered_candidates[:MAX_CANDIDATES]
            for i, cand in enumerate(result.candidates):
                cand.id = f"candidate-{i+1}"
            result.status = "detected"
            result.detection_outcome = "candidate_found"
            result.selected_candidate_id = "candidate-1"
            result.reference_source = "click_guided"
            result.detected_corners = result.candidates[0].corners
            result.confidence = result.candidates[0].score
            return _finalize_detected_result(result, (height, width))

        # Tier 2: Localized Seed-Based Adaptive Segmentation
        tier2_candidate = _extract_local_roi_candidate(
            source=source,
            seed_px=seed_px,
            distance=distance,
            tolerance=tolerance,
            image_bgr=image_bgr if image_bgr.ndim == 3 else None,
            source_edges=source_edges,
        )
        if tier2_candidate is not None:
            tier2_candidate.id = "candidate-1"
            for c in ranked:
                if "seed_point_outside_valid_boundary" not in c.rejection_reasons:
                    c.rejection_reasons.append("seed_point_outside_valid_boundary")
            ordered_candidates = [tier2_candidate] + ranked
            result.candidates = ordered_candidates[:MAX_CANDIDATES]
            for i, cand in enumerate(result.candidates):
                cand.id = f"candidate-{i+1}"
            result.status = "detected"
            result.detection_outcome = "candidate_found"
            result.selected_candidate_id = "candidate-1"
            result.reference_source = "click_guided"
            result.detected_corners = result.candidates[0].corners
            result.confidence = result.candidates[0].score
            return _finalize_detected_result(result, (height, width))

        # Deterministic Fallback: Explicit Abstention
        for c in ranked:
            if "seed_point_outside_valid_boundary" not in c.rejection_reasons:
                c.rejection_reasons.append("seed_point_outside_valid_boundary")
        result.candidates = ranked[:MAX_CANDIDATES]
        for i, cand in enumerate(result.candidates):
            cand.id = f"candidate-{i+1}"
        result.status = "manual_pin_required"
        result.detection_outcome = "not_found"
        result.selected_candidate_id = None
        result.detected_corners = None
        result.confidence = 0.0
        result.reference_source = None
        result.rejection_reasons = ["seed_point_outside_valid_boundary"]
        return result

    # Default autonomous detection path
    result.candidates = ranked[:MAX_CANDIDATES]
    for i, candidate in enumerate(result.candidates):
        candidate.id = f"candidate-{i+1}"
    eligible = [c for c in result.candidates if not c.rejection_reasons]
    if not eligible:
        return result
    best = eligible[0]

    # Only distinct objects cause ambiguous outcomes
    source_diagonal = float(np.hypot(width, height))
    distinct_competitors = [
        c for c in ranked
        if c.id != best.id
        and "cropped_boundary" not in c.rejection_reasons
        and not _is_same_object(best, c, source_diagonal)
    ]
    if distinct_competitors and (best.score - distinct_competitors[0].score) < MIN_SELECTION_MARGIN:
        result.detection_outcome = "ambiguous"
        return result

    result.status = "detected"
    result.detection_outcome = "candidate_found"
    result.selected_candidate_id = best.id
    result.reference_source = "auto_detected"
    result.detected_corners = best.corners
    result.confidence = best.score
    return _finalize_detected_result(result, (height, width))

