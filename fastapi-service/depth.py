# fastapi-service/depth.py

import os
import cv2
import numpy as np

_depth_pipe = None


def get_depth_pipeline():
    """
    Loads and caches the Depth Anything V2 pipeline on first call.
    Model variant is controlled by the DEPTH_MODEL environment variable.

    Default: depth-anything/Depth-Anything-V2-Small-hf
    Alternatives:
      depth-anything/Depth-Anything-V2-Base-hf   (more accurate, ~400MB)
      depth-anything/Depth-Anything-V2-Large-hf  (most accurate, ~1.3GB)

    Small is recommended for CPU deployment on Railway/Render free tiers.
    Base is recommended if a paid tier with more RAM is available.
    """
    global _depth_pipe
    if _depth_pipe is None:
        from transformers import pipeline as hf_pipeline
        model_name = os.getenv(
            "DEPTH_MODEL",
            "depth-anything/Depth-Anything-V2-Small-hf"
        )
        _depth_pipe = hf_pipeline(
            task="depth-estimation",
            model=model_name
        )
    return _depth_pipe


def estimate_depth(image_bgr: np.ndarray, upload_id: str) -> dict:
    """
    Runs Depth Anything V2 on the uploaded image.

    Args:
        image_bgr:  The uploaded image as a BGR numpy array (from OpenCV).
        upload_id:  A unique identifier string used to name the output file.
                    Use the same base name as the YOLO mask files for this
                    upload so cleanup is consistent.

    Returns a dict with:
        depth_map_url:  Relative URL path to the saved depth map PNG.
                        Served by FastAPI from /masks/ like object masks.
        available:      True if depth estimation succeeded.
        mode:           "depth_anything_v2" or "unavailable".
        error:          Error string if available is False, else null.
    """
    try:
        from PIL import Image as PILImage

        pipe = get_depth_pipeline()

        # Depth Anything expects RGB. OpenCV loads as BGR.
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        pil_image = PILImage.fromarray(image_rgb)

        result = pipe(pil_image)

        # result["depth"] is a PIL Image in Depth Anything V2 HF pipeline output.
        # Convert to numpy float array.
        depth_pil = result["depth"]
        depth_array = np.array(depth_pil, dtype=np.float32)

        # Normalize to 0–255 uint8 for PNG storage.
        depth_min = float(depth_array.min())
        depth_max = float(depth_array.max())
        if depth_max - depth_min > 1e-6:
            normalized = (
                (depth_array - depth_min) / (depth_max - depth_min) * 255.0
            ).astype(np.uint8)
        else:
            normalized = np.zeros(depth_array.shape, dtype=np.uint8)

        # Resize depth map to match the original image pixel dimensions exactly.
        # This is important: the frontend samples the depth map using image-space
        # coordinates from YOLO bounding boxes. If the depth map is a different
        # size, the sample coordinates will be wrong.
        h, w = image_bgr.shape[:2]
        depth_resized = cv2.resize(
            normalized, (w, h), interpolation=cv2.INTER_LINEAR
        )

        # Save to the same generated/masks/ directory used by YOLO masks.
        depth_filename = f"{upload_id}_depth.png"
        masks_dir = os.path.join("generated", "masks")
        os.makedirs(masks_dir, exist_ok=True)
        depth_path = os.path.join(masks_dir, depth_filename)
        cv2.imwrite(depth_path, depth_resized)

        return {
            "depth_map_url": f"/masks/{depth_filename}",
            "available": True,
            "mode": "depth_anything_v2",
            "error": None,
            # Internal key — NOT forwarded to the API response.
            # Used by detect_scene_regions for the depth-plane fitting fallback.
            "_depth_array_normalized": depth_array / depth_array.max()
                if depth_array.max() > 0 else depth_array,
        }

    except Exception as e:
        return {
            "depth_map_url": None,
            "available": False,
            "mode": "unavailable",
            "error": str(e)
        }
