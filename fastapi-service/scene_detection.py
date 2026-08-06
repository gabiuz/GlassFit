# fastapi-service/scene_detection.py

import os
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


def _save_mask(mask_uint8: np.ndarray, upload_id: str, suffix: str) -> str:
    """
    Saves a binary mask PNG to the generated/masks directory.
    Returns the relative URL path for the frontend to fetch.
    """
    masks_dir = os.path.join("generated", "masks")
    os.makedirs(masks_dir, exist_ok=True)
    filename = f"{upload_id}_{suffix}.png"
    path = os.path.join(masks_dir, filename)
    cv2.imwrite(path, mask_uint8)
    return f"/masks/{filename}"


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

def detect_scene_segformer(image_bgr: np.ndarray, upload_id: str) -> dict:
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

        floor_top_y = _floor_boundary_from_mask(floor_mask)
        wall_bounds = _wall_bounds_from_mask(wall_mask)

        result = {
            "floor_top_y_normalized":  floor_top_y,
            "floor_coverage":          round(floor_coverage, 3),
            "wall_coverage":           round(wall_coverage,  3),
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
            result["floor_mask_url"] = _save_mask(floor_mask, upload_id, "floor")
        if wall_coverage > 0.02:
            result["wall_mask_url"]  = _save_mask(wall_mask,  upload_id, "wall")

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
) -> dict:
    """
    Primary entry point called from main.py.

    Tries SegFormer first. If SegFormer fails or is unavailable, falls back to
    depth-plane fitting when a depth map is provided. If both fail, returns an
    unavailable result.
    """
    result = detect_scene_segformer(image_bgr, upload_id)

    if not result["available"] and depth_array_normalized is not None:
        h, w = image_bgr.shape[:2]
        result = detect_scene_from_depth(depth_array_normalized, h, w)

    return result


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
