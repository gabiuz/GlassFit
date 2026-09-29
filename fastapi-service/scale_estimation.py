"""
Scale estimation engine for GlassFit measurement improvement.

Uses YOLOv8-detected reference objects and Depth Anything V2 relative depth maps
to compute a physical scale factor (cm per pixel) for the uploaded space photo.

Traces to: PRD-F4, PRD-F10, SDD-C3, BRD-M1, BRD-M5, BRD-M6
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

# Reference object heights in centimeters.
# Sources: Philippine Statistics Authority (anthropometric), National Building Code
# of the Philippines (architectural fixtures), and manufacturer standards.
REFERENCE_OBJECT_HEIGHTS_CM: dict[str, tuple[float, float]] = {
    # label: (reference_height_cm, confidence_weight)
    "person":       (163.0, 0.90),
    "refrigerator": (165.0, 0.70),
    "toilet":       (40.0,  0.65),
    "table":        (75.0,  0.60),
    "dining table": (75.0,  0.60),
    "chair":        (90.0,  0.50),
    "sofa":         (85.0,  0.45),
    "couch":        (85.0,  0.45),
    "bed":          (55.0,  0.30),
    "television":   (65.0,  0.30),
    "tv":           (65.0,  0.30),
    "oven":         (85.0,  0.60),
    "microwave":    (30.0,  0.55),
}


@dataclass
class ScaleAnchor:
    """A single scale estimate derived from a detected reference object."""
    label: str
    bbox_height_px: float
    reference_height_cm: float
    scale_cm_per_px: float
    confidence: float
    depth_correction: float


@dataclass
class ScaleEstimationResult:
    """Aggregated scale estimation from all available signals."""
    anchors: list[dict[str, Any]]
    best_scale_cm_per_px: float | None
    confidence: float
    method: str
    exif_focal_length_mm: float | None
    exif_focal_length_35mm: float | None
    exif_device_model: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "anchors": self.anchors,
            "best_scale_cm_per_px": self.best_scale_cm_per_px,
            "confidence": self.confidence,
            "method": self.method,
            "exif_focal_length_mm": self.exif_focal_length_mm,
            "exif_focal_length_35mm": self.exif_focal_length_35mm,
            "exif_device_model": self.exif_device_model,
        }


def estimate_scale_from_objects(
    detected_objects: list[dict[str, Any]],
    depth_array_normalized: np.ndarray | None = None,
    image_height: int = 1,
    image_width: int = 1,
) -> ScaleEstimationResult:
    """
    Computes a physical scale factor (cm per pixel) from YOLO-detected
    reference objects, optionally corrected by relative depth ratios.

    Args:
        detected_objects:       The objects list from the YOLO segmentation result.
                                Each entry must have label (str) and bbox ([x1, y1, x2, y2]).
        depth_array_normalized: The 0.0-to-1.0 normalized depth map from Depth Anything V2.
                                When provided, enables depth-ratio cross-calibration.
        image_height:           Original image height in pixels.
        image_width:            Original image width in pixels.

    Returns:
        ScaleEstimationResult with computed anchors, best scale, and confidence.
    """
    anchors: list[ScaleAnchor] = []

    for obj in detected_objects:
        label = str(obj.get("label", "")).lower().strip()
        bbox = obj.get("bbox")

        if label not in REFERENCE_OBJECT_HEIGHTS_CM or bbox is None:
            continue

        x1, y1, x2, y2 = bbox
        bbox_height_px = float(y2 - y1)
        if bbox_height_px < 10:
            continue

        ref_height_cm, base_confidence = REFERENCE_OBJECT_HEIGHTS_CM[label]
        scale = ref_height_cm / bbox_height_px

        # Apply depth-ratio correction if depth map is available.
        depth_correction = 1.0
        if depth_array_normalized is not None:
            depth_correction = _compute_depth_correction(
                depth_array_normalized,
                bbox,
                image_height,
                image_width,
            )
            scale *= depth_correction

        # Weight by YOLO detection confidence if available.
        detection_confidence = float(obj.get("confidence", 0.5))
        combined_confidence = base_confidence * detection_confidence

        # Map display label to standardized name
        display_label = label
        if display_label == "couch":
            display_label = "sofa"
        elif display_label == "dining table":
            display_label = "table"
        elif display_label == "tv":
            display_label = "television"

        anchors.append(ScaleAnchor(
            label=display_label,
            bbox_height_px=bbox_height_px,
            reference_height_cm=ref_height_cm,
            scale_cm_per_px=scale,
            confidence=combined_confidence,
            depth_correction=depth_correction,
        ))

    if not anchors:
        return ScaleEstimationResult(
            anchors=[],
            best_scale_cm_per_px=None,
            confidence=0.0,
            method="none",
            exif_focal_length_mm=None,
            exif_focal_length_35mm=None,
            exif_device_model=None,
        )

    # Confidence-weighted average of all anchor scale estimates.
    total_weight = sum(a.confidence for a in anchors)
    if total_weight < 1e-6:
        best_scale = anchors[0].scale_cm_per_px
        overall_confidence = 0.1
    else:
        best_scale = sum(a.scale_cm_per_px * a.confidence for a in anchors) / total_weight
        overall_confidence = min(1.0, total_weight / len(anchors))

    return ScaleEstimationResult(
        anchors=[
            {
                "label": a.label,
                "bbox_height_px": round(a.bbox_height_px, 1),
                "reference_height_cm": a.reference_height_cm,
                "scale_cm_per_px": round(a.scale_cm_per_px, 6),
                "confidence": round(a.confidence, 3),
                "depth_correction": round(a.depth_correction, 4),
            }
            for a in anchors
        ],
        best_scale_cm_per_px=round(best_scale, 6),
        confidence=round(overall_confidence, 3),
        method="yolo_anchor" + ("_depth_corrected" if depth_array_normalized is not None else ""),
        exif_focal_length_mm=None,
        exif_focal_length_35mm=None,
        exif_device_model=None,
    )


def _compute_depth_correction(
    depth_array_normalized: np.ndarray,
    bbox: list[int | float],
    image_height: int,
    image_width: int,
) -> float:
    """
    Samples the relative depth at the center of a bounding box using a 5x5 patch average.

    The depth correction factor compensates for distance differences between
    the reference object and the target opening. Since the perspective quad
    is not yet known at this stage, this returns a raw depth sample that
    the client can use for correction when the quad is placed.

    Returns 1.0 if the depth map cannot be sampled.
    """
    try:
        h, w = depth_array_normalized.shape[:2]
        x1, y1, x2, y2 = bbox

        # Map bbox to depth map coordinates (depth map may differ from image size).
        cx = int(((x1 + x2) / 2) * w / max(image_width, 1))
        cy = int(((y1 + y2) / 2) * h / max(image_height, 1))

        # 5x5 patch average for noise reduction.
        patch_half = 2
        y_start = max(0, cy - patch_half)
        y_end = min(h, cy + patch_half + 1)
        x_start = max(0, cx - patch_half)
        x_end = min(w, cx + patch_half + 1)

        patch = depth_array_normalized[y_start:y_end, x_start:x_end]
        if patch.size == 0:
            return 1.0

        depth_value = float(np.mean(patch))
        if depth_value < 0.01:
            return 1.0

        return depth_value
    except Exception:
        return 1.0
