"""
Safe EXIF metadata extraction for camera intrinsics.

Extracts focal length and device model from uploaded JPEG EXIF tags
using Pillow (already a project dependency). Returns None for all
fields when EXIF data is absent or unreadable.

Traces to: PRD-F3, SDD-C2
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class ExifCameraInfo:
    """Camera intrinsics extracted from EXIF metadata."""
    focal_length_mm: float | None
    focal_length_35mm_equiv: float | None
    device_model: str | None
    image_width_exif: int | None
    image_height_exif: int | None


def extract_exif_camera_info(image_path: Path | str) -> ExifCameraInfo:
    """
    Extracts camera focal length and device model from JPEG EXIF metadata.

    Returns an ExifCameraInfo with all None fields if EXIF is absent,
    corrupt, or the image format does not support EXIF.

    This function never raises exceptions. All failures return empty results.
    """
    empty = ExifCameraInfo(
        focal_length_mm=None,
        focal_length_35mm_equiv=None,
        device_model=None,
        image_width_exif=None,
        image_height_exif=None,
    )

    try:
        from PIL import Image as PILImage
        from PIL.ExifTags import Base as ExifBase

        img = PILImage.open(str(image_path))
        exif_data = img.getexif()
        if not exif_data:
            return empty

        # Tag 37386: FocalLength (rational number, actual lens focal length in mm)
        focal_raw = exif_data.get(ExifBase.FocalLength)
        focal_length_mm = None
        if focal_raw is not None:
            try:
                focal_length_mm = float(focal_raw)
            except (TypeError, ValueError):
                pass

        # Tag 41989: FocalLengthIn35mmFilm (integer, 35mm equivalent)
        focal_35mm_raw = exif_data.get(ExifBase.FocalLengthIn35mmFilm)
        focal_length_35mm = None
        if focal_35mm_raw is not None:
            try:
                focal_length_35mm = float(focal_35mm_raw)
            except (TypeError, ValueError):
                pass

        # Tag 272: Model (device model string)
        device_model = None
        model_raw = exif_data.get(ExifBase.Model)
        if model_raw is not None:
            device_model = str(model_raw).strip() or None

        # Tag 40962 / 40963: PixelXDimension / PixelYDimension
        exif_width = None
        exif_height = None
        width_raw = exif_data.get(ExifBase.ExifImageWidth)
        height_raw = exif_data.get(ExifBase.ExifImageHeight)
        if width_raw is not None:
            try:
                exif_width = int(width_raw)
            except (TypeError, ValueError):
                pass
        if height_raw is not None:
            try:
                exif_height = int(height_raw)
            except (TypeError, ValueError):
                pass

        return ExifCameraInfo(
            focal_length_mm=focal_length_mm,
            focal_length_35mm_equiv=focal_length_35mm,
            device_model=device_model,
            image_width_exif=exif_width,
            image_height_exif=exif_height,
        )

    except Exception:
        return empty
