from pathlib import Path
from typing import TypedDict

from PIL import Image, ImageOps, UnidentifiedImageError


class ImagePreparationError(ValueError):
    pass


class ImageMetadata(TypedDict):
    width: int
    height: int
    format: str


MAX_DECODED_PIXELS = 40_000_000


def save_oriented_upload(input_path: Path, output_path: Path) -> ImageMetadata:
    image = _open_oriented_rgb_image(input_path)
    _validate_dimensions(image.width, image.height)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, quality=95)
    return {
        "width": image.width,
        "height": image.height,
        "format": output_path.suffix.lstrip(".").lower(),
    }


def prepare_workspace_image(
    input_path: Path,
    output_path: Path,
    max_long_edge: int = 1920,
    quality: int = 90,
) -> ImageMetadata:
    image = _open_oriented_rgb_image(input_path)
    _validate_dimensions(image.width, image.height)

    width, height = image.size
    longest_edge = max(width, height)
    if longest_edge > max_long_edge:
        scale = max_long_edge / longest_edge
        target_size = (round(width * scale), round(height * scale))
        image = image.resize(target_size, Image.Resampling.LANCZOS)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, "WEBP", quality=quality, method=6)

    return {
        "width": image.width,
        "height": image.height,
        "format": "webp",
    }


def validate_image_file(input_path: Path) -> ImageMetadata:
    image = _open_oriented_rgb_image(input_path)
    _validate_dimensions(image.width, image.height)
    return {
        "width": image.width,
        "height": image.height,
        "format": (image.format or "").lower(),
    }


def _open_oriented_rgb_image(input_path: Path) -> Image.Image:
    try:
        with Image.open(input_path) as image:
            oriented = ImageOps.exif_transpose(image)
            if oriented.mode not in {"RGB", "L"}:
                oriented = oriented.convert("RGB")
            elif oriented.mode == "L":
                oriented = oriented.convert("RGB")
            else:
                oriented = oriented.copy()
            return oriented
    except UnidentifiedImageError as exc:
        raise ImagePreparationError("Uploaded image could not be decoded.") from exc
    except OSError as exc:
        raise ImagePreparationError("Uploaded image could not be decoded.") from exc


def _validate_dimensions(width: int, height: int) -> None:
    if width <= 0 or height <= 0:
        raise ImagePreparationError("Uploaded image has invalid dimensions.")

    if width * height > MAX_DECODED_PIXELS:
        raise ImagePreparationError("Uploaded image is too large to process safely.")
