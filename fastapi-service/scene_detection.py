# fastapi-service/scene_detection.py

import os
from pathlib import Path
import cv2
import numpy as np

_scene_processor = None
_scene_model = None

# ADE20K class indices used by SegFormer finetuned on ADE20K-150
ADE20K_FLOOR   = 3
ADE20K_WALL    = 0
ADE20K_CEILING = 5
ADE20K_DOOR    = 14
ADE20K_WINDOW  = 8


def detect_geometric_opening(image_bgr: np.ndarray) -> bool:
    """Find a framed dark aperture surrounded by textured building material.

    FIX16 / PRD-F3, SDD-C3: SegFormer sometimes calls an entire brick facade
    "building", including a real opening. This bounded visual check supplies
    corroboration for that case, not a replacement for model readiness or the
    subject exclusion gate. Work on a small image to bound added CPU cost.
    """
    if not isinstance(image_bgr, np.ndarray) or image_bgr.ndim != 3:
        return False
    height, width = image_bgr.shape[:2]
    if height < 80 or width < 80:
        return False
    scale = min(1.0, 768 / max(height, width))
    if scale < 1.0:
        image_bgr = cv2.resize(image_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (max(3, width // 100), max(3, height // 100)),
    )
    for threshold in (50, 70):
        dark = (gray < threshold).astype(np.uint8) * 255
        dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            x, y, box_width, box_height = cv2.boundingRect(contour)
            box_area = box_width * box_height
            area_ratio = box_area / (width * height)
            if not (0.04 <= area_ratio <= 0.50 and 0.45 <= box_width / box_height <= 4.0):
                continue
            if (x < width * 0.03 or y < height * 0.03
                    or x + box_width > width * 0.97
                    or y + box_height > height * 0.97):
                continue
            if cv2.contourArea(contour) / box_area < 0.50:
                continue
            pad = max(4, round(max(box_width, box_height) * 0.12))
            x0, y0 = max(0, x - pad), max(0, y - pad)
            x1 = min(width, x + box_width + pad)
            y1 = min(height, y + box_height + pad)
            neighborhood = gray[y0:y1, x0:x1]
            surrounding = np.ones(neighborhood.shape, dtype=bool)
            surrounding[y - y0:y + box_height - y0,
                        x - x0:x + box_width - x0] = False
            if not surrounding.any():
                continue
            if (float(neighborhood[surrounding].mean())
                    - float(gray[y:y + box_height, x:x + box_width].mean()) < 35):
                continue
            # A flat poster can contain a dark rectangle. Require visible
            # texture or structural edges on the material around the aperture.
            edges = cv2.Canny(neighborhood, 60, 150)
            if (float(neighborhood[surrounding].std()) >= 12
                    and float((edges[surrounding] > 0).mean()) >= 0.04):
                return True
    return False


def get_scene_model():
    """
    Loads and caches the SegFormer scene segmentation model on first call.
    Model variant is controlled by the SCENE_MODEL environment variable.

    Default: nvidia/segformer-b0-finetuned-ade-512-512  (~14 MB, fast)
    Better:  nvidia/segformer-b2-finetuned-ade-512-512  (~84 MB, more accurate)

    b0 is the right default for Railway/Render free tiers.
    b2 is recommended on paid tiers with more RAM if accuracy needs improvement.
    """
    global _scene_processor, _scene_model
    if _scene_model is None:
        from transformers import (
            SegformerImageProcessor,
            SegformerForSemanticSegmentation,
        )
        model_name = os.getenv(
            "SCENE_MODEL",
            "nvidia/segformer-b0-finetuned-ade-512-512"
        )
        _scene_processor = SegformerImageProcessor.from_pretrained(model_name)
        _scene_model = SegformerForSemanticSegmentation.from_pretrained(model_name)
        _scene_model.eval()
    return _scene_processor, _scene_model


def _save_mask(
    mask_uint8: np.ndarray,
    upload_id: str,
    suffix: str,
    output_dir: Path | str | None = None,
    url_prefix: str = "/masks",
) -> str:
    """
    Saves a binary mask PNG to the generated/masks directory.
    Returns the relative URL path for the frontend to fetch.
    """
    masks_dir = Path(output_dir) if output_dir is not None else Path("generated") / "masks"
    masks_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{upload_id}_{suffix}.png"
    path = masks_dir / filename
    cv2.imwrite(str(path), mask_uint8)
    return f"{url_prefix.rstrip('/')}/{filename}"


def _floor_boundary_from_mask(floor_mask: np.ndarray) -> float | None:
    """
    Returns the normalized Y coordinate (0–1, top of image = 0) of the
    topmost row that contains floor pixels. This is the floor-wall junction
    line used for overlay snapping.

    Returns None if the floor mask is empty.
    """
    h = floor_mask.shape[0]
    floor_rows = np.where(floor_mask.any(axis=1))[0]
    if len(floor_rows) == 0:
        return None
    return float(floor_rows.min()) / h


def _wall_bounds_from_mask(wall_mask: np.ndarray) -> dict:
    """
    Returns the left_x and right_x normalized coordinates of the wall region,
    and the average normalized Y of the top wall boundary.
    Used for wall-mounted product snapping.
    """
    h, w = wall_mask.shape
    wall_cols = np.where(wall_mask.any(axis=0))[0]
    wall_rows = np.where(wall_mask.any(axis=1))[0]

    if len(wall_cols) == 0 or len(wall_rows) == 0:
        return {"left_x": None, "right_x": None, "top_y": None}

    return {
        "left_x":  float(wall_cols.min()) / w,
        "right_x": float(wall_cols.max()) / w,
        "top_y":   float(wall_rows.min()) / h,
    }


# ─── Option 2: SegFormer semantic segmentation ────────────────────────────────

def detect_scene_segformer(
    image_bgr: np.ndarray,
    upload_id: str,
    output_dir: Path | str | None = None,
    url_prefix: str = "/masks",
) -> dict:
    """
    Runs SegFormer on the uploaded image to produce pixel-level floor and wall
    masks. Returns structured scene region data including normalized boundary
    coordinates used by the frontend for overlay snapping.
    """
    try:
        import torch
        from PIL import Image as PILImage

        processor, model = get_scene_model()

        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        pil_image = PILImage.fromarray(image_rgb)
        h, w = image_bgr.shape[:2]

        inputs = processor(images=pil_image, return_tensors="pt")

        with torch.no_grad():
            outputs = model(**inputs)

        # Upsample logits to original image size
        upsampled = torch.nn.functional.interpolate(
            outputs.logits,
            size=(h, w),
            mode="bilinear",
            align_corners=False,
        )
        seg_map = upsampled.argmax(dim=1).squeeze().numpy().astype(np.int32)

        # Build binary masks for floor and wall
        floor_mask = (seg_map == ADE20K_FLOOR).astype(np.uint8) * 255
        wall_mask  = (seg_map == ADE20K_WALL).astype(np.uint8)  * 255

        floor_coverage = float((seg_map == ADE20K_FLOOR).mean())
        wall_coverage  = float((seg_map == ADE20K_WALL).mean())
        # FIX14: Keep independent structural classes for upload suitability.
        # A plain portrait backdrop can look like a wall to SegFormer.
        structural_ids = {ADE20K_FLOOR, ADE20K_CEILING, ADE20K_DOOR, ADE20K_WINDOW, 1, 6, 10, 11, 25}
        structural_coverage = float(np.isin(seg_map, list(structural_ids)).mean())
        opening_coverage = float(np.isin(seg_map, [ADE20K_DOOR, ADE20K_WINDOW]).mean())
        opening_mask = np.isin(seg_map, [ADE20K_DOOR, ADE20K_WINDOW])
        opening_rows = np.where(opening_mask.mean(axis=1) >= 0.03)[0]
        opening_vertical_span = (
            float((opening_rows.max() - opening_rows.min() + 1) / h)
            if opening_rows.size else 0.0
        )
        ceiling_coverage = float((seg_map == ADE20K_CEILING).mean())
        building_coverage = float((seg_map == 1).mean())
        context_coverage = float(np.isin(seg_map, [2, 6, 11]).mean())

        floor_top_y = _floor_boundary_from_mask(floor_mask)
        wall_bounds = _wall_bounds_from_mask(wall_mask)

        result = {
            # FIX16 / SDD-C3: retained only until the admission gate runs.
            "_semantic_map": seg_map,
            "_geometric_opening": (
                detect_geometric_opening(image_bgr) if building_coverage >= 0.80 else False
            ),
            "floor_top_y_normalized":  floor_top_y,
            "floor_coverage":          round(floor_coverage, 3),
            "wall_coverage":           round(wall_coverage,  3),
            "structural_coverage":     round(structural_coverage, 3),
            "opening_coverage":        round(opening_coverage, 3),
            "opening_vertical_span":   round(opening_vertical_span, 3),
            "ceiling_coverage":        round(ceiling_coverage, 3),
            "building_coverage":       round(building_coverage, 3),
            "exterior_context_coverage": round(context_coverage, 3),
            "wall_left_x_normalized":  wall_bounds["left_x"],
            "wall_right_x_normalized": wall_bounds["right_x"],
            "wall_top_y_normalized":   wall_bounds["top_y"],
            "floor_mask_url": None,
            "wall_mask_url":  None,
            "available": True,
            "method":    "segformer_ade20k",
            "error":     None,
        }

        # Save masks only when meaningful coverage is detected
        if floor_coverage > 0.02:
            result["floor_mask_url"] = _save_mask(floor_mask, upload_id, "floor", output_dir, url_prefix)
        if wall_coverage > 0.02:
            result["wall_mask_url"]  = _save_mask(wall_mask, upload_id, "wall", output_dir, url_prefix)

        return result

    except Exception as e:
        return _scene_unavailable(str(e))


# ─── Option 3: Depth-plane fitting fallback ───────────────────────────────────

def detect_scene_from_depth(
    depth_array_normalized: np.ndarray,
    image_height: int,
    image_width:  int,
) -> dict:
    """
    Estimates the floor boundary using the Depth Anything V2 depth map without
    any additional model. Used as the fallback when SegFormer is unavailable.

    The floor in an indoor photo tends to exhibit a consistent vertical depth
    gradient: pixels near the bottom of the image are closer (brighter in depth
    map) and depth decreases moving upward toward the floor-wall junction.
    The wall above the junction has a relatively flat depth profile.
    """
    try:
        h, w = depth_array_normalized.shape

        # Work on the bottom 65% of the image where the floor is most likely.
        search_start = int(h * 0.35)
        bottom_region = depth_array_normalized[search_start:, :]

        # Compute mean depth per row (averaged across image width)
        row_means = bottom_region.mean(axis=1)

        # Compute row-to-row gradient going upward (from bottom)
        gradients = np.diff(row_means[::-1])  # reversed: bottom-up

        FLOOR_GRADIENT_THRESHOLD = 0.004
        boundary_from_bottom = None

        for i in range(min(len(gradients), int(h * 0.5))):
            window = gradients[i : i + 5]
            if len(window) == 5 and window.mean() < FLOOR_GRADIENT_THRESHOLD:
                boundary_from_bottom = i
                break

        if boundary_from_bottom is not None:
            floor_top_row = h - (search_start + boundary_from_bottom)
            floor_top_y   = float(floor_top_row) / h
        else:
            floor_top_y = 0.60

        # Clamp to a reasonable range
        floor_top_y = float(np.clip(floor_top_y, 0.35, 0.85))

        return {
            "floor_top_y_normalized":  floor_top_y,
            "floor_coverage":          None,
            "wall_coverage":           None,
            "wall_left_x_normalized":  None,
            "wall_right_x_normalized": None,
            "wall_top_y_normalized":   None,
            "floor_mask_url": None,
            "wall_mask_url":  None,
            "available": True,
            "method":    "depth_plane_fitting",
            "error":     None,
        }

    except Exception as e:
        return _scene_unavailable(str(e))


# ─── Unified entry point ──────────────────────────────────────────────────────

def detect_scene_regions(
    image_bgr:               np.ndarray,
    upload_id:               str,
    depth_array_normalized:  "np.ndarray | None" = None,
    output_dir:              Path | str | None = None,
    url_prefix:              str = "/masks",
) -> dict:
    """
    Primary entry point called from main.py.

    Tries SegFormer first. If SegFormer fails or is unavailable, falls back to
    depth-plane fitting when a depth map is provided. If both fail, returns an
    unavailable result.
    """
    result = detect_scene_segformer(image_bgr, upload_id, output_dir, url_prefix)

    if not result["available"] and depth_array_normalized is not None:
        h, w = image_bgr.shape[:2]
        result = detect_scene_from_depth(depth_array_normalized, h, w)

    return result


def independent_scene_evidence(
    seg_map: np.ndarray, objects: list[dict], source_width: int, source_height: int,
) -> dict | None:
    """Measure architecture outside the union of dominant subject boxes.

    YOLO boxes use oriented source pixels while SegFormer uses workspace pixels.
    A 2% workspace margin covers uncertain object edges and screen bezels.
    Coverage remains relative to the full image, so a thin exterior strip
    cannot become strong evidence after excluding a large foreground object.
    """
    if (not isinstance(seg_map, np.ndarray) or seg_map.ndim != 2
            or not seg_map.size or source_width <= 0 or source_height <= 0):
        return None
    h, w = seg_map.shape
    excluded = np.zeros((h, w), dtype=bool)
    sx, sy = w / source_width, h / source_height
    margin_x, margin_y = max(1, round(w * 0.02)), max(1, round(h * 0.02))
    for obj in objects:
        label = obj.get("label")
        confidence = obj.get("confidence", 0)
        if not isinstance(confidence, (int, float)):
            return None
        if label == "person":
            threshold, dominance = 0.5, 0.28
        elif label in {"book", "television", "laptop", "cell phone"}:
            threshold, dominance = 0.55, 0.35
        else:
            continue
        if confidence < threshold:
            continue
        box = obj.get("bbox")
        if (not isinstance(box, list) or len(box) != 4
                or any(not isinstance(v, (int, float)) or not np.isfinite(v) for v in box)):
            return None
        x1, y1, x2, y2 = box
        if x1 >= x2 or y1 >= y2:
            return None
        x1, x2 = max(0, x1), min(source_width, x2)
        y1, y2 = max(0, y1), min(source_height, y2)
        if x1 >= x2 or y1 >= y2:
            return None
        if ((x2 - x1) * (y2 - y1) / (source_width * source_height)) < dominance:
            continue
        left = max(0, int(np.floor(x1 * sx)) - margin_x)
        right = min(w, int(np.ceil(x2 * sx)) + margin_x)
        top = max(0, int(np.floor(y1 * sy)) - margin_y)
        bottom = min(h, int(np.ceil(y2 * sy)) + margin_y)
        excluded[top:bottom, left:right] = True
    outside = ~excluded
    def coverage(ids: list[int]) -> float:
        return float(np.count_nonzero(outside & np.isin(seg_map, ids)) / seg_map.size)
    opening = outside & np.isin(seg_map, [ADE20K_DOOR, ADE20K_WINDOW])
    rows = np.where(opening.mean(axis=1) >= 0.03)[0]
    return {
        "wall_coverage": coverage([ADE20K_WALL]),
        "floor_coverage": coverage([ADE20K_FLOOR]),
        "ceiling_coverage": coverage([ADE20K_CEILING]),
        "opening_coverage": coverage([ADE20K_DOOR, ADE20K_WINDOW]),
        "opening_vertical_span": float((rows[-1] - rows[0] + 1) / h) if rows.size else 0.0,
        "building_coverage": coverage([1]),
        "exterior_context_coverage": coverage([2, 6, 11]),
    }


def _scene_unavailable(error: str = "") -> dict:
    return {
        "floor_top_y_normalized":  None,
        "floor_coverage":          None,
        "wall_coverage":           None,
        "wall_left_x_normalized":  None,
        "wall_right_x_normalized": None,
        "wall_top_y_normalized":   None,
        "floor_mask_url": None,
        "wall_mask_url":  None,
        "available": False,
        "method":    "unavailable",
        "error":     error,
    }
