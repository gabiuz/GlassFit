from pathlib import Path
from typing import TypedDict

from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

register_heif_opener(thumbnails=False)


class ImagePreparationError(ValueError):
    pass


class ImageMetadata(TypedDict):
    width: int
    height: int
    format: str
    source_format: str


MAX_DECODED_PIXELS = 40_000_000
DECODER_ERRORS = (
    UnidentifiedImageError,
    OSError,
    ValueError,
    EOFError,
    SyntaxError,
    RuntimeError,
)


def save_oriented_upload(input_path: Path, output_path: Path) -> ImageMetadata:
    image, source_format = _open_oriented_rgb_image(input_path)
    target_format = output_path.suffix.lstrip(".").lower()
    width, height = image.size
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if target_format in {"jpg", "jpeg"}:
            image.save(output_path, "JPEG", quality=95, optimize=True)
        elif target_format == "webp":
            image.save(output_path, "WEBP", quality=95, method=4)
        elif target_format == "png":
            image.save(output_path, "PNG", optimize=True)
        else:
            raise ImagePreparationError("Unsupported normalized image format.")
    finally:
        image.close()

    return {
        "width": width,
        "height": height,
        "format": target_format,
        "source_format": source_format,
    }


def prepare_workspace_image(
    input_path: Path,
    output_path: Path,
    max_long_edge: int = 1920,
    quality: int = 90,
) -> ImageMetadata:
    image, source_format = _open_oriented_rgb_image(input_path)

    try:
        width, height = image.size
        longest_edge = max(width, height)
        if longest_edge > max_long_edge:
            scale = max_long_edge / longest_edge
            target_size = (round(width * scale), round(height * scale))
            resized = image.resize(target_size, Image.Resampling.LANCZOS)
            image.close()
            image = resized

        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, "WEBP", quality=quality, method=6)

        return {
            "width": image.width,
            "height": image.height,
            "format": "webp",
            "source_format": source_format,
        }
    finally:
        image.close()


def validate_image_file(input_path: Path) -> ImageMetadata:
    image, source_format = _open_oriented_rgb_image(input_path)
    try:
        return {
            "width": image.width,
            "height": image.height,
            "format": source_format,
            "source_format": source_format,
        }
    finally:
        image.close()


def _open_validated_image(input_path: Path) -> tuple[Image.Image, str]:
    image: Image.Image | None = None
    try:
        image = Image.open(input_path)
        source_format = (image.format or "").lower()
        _validate_dimensions(image.width, image.height)
        if getattr(image, "n_frames", 1) != 1 or getattr(image, "is_animated", False):
            raise ImagePreparationError("Animated or multi-frame images are not supported.")
        return image, source_format
    except ImagePreparationError:
        if image is not None:
            image.close()
        raise
    except Image.DecompressionBombError as exc:
        if image is not None:
            image.close()
        raise ImagePreparationError("Uploaded image is too large to process safely.") from exc
    except DECODER_ERRORS as exc:
        if image is not None:
            image.close()
        raise ImagePreparationError("Uploaded image could not be decoded.") from exc


def _open_oriented_rgb_image(input_path: Path) -> tuple[Image.Image, str]:
    source, source_format = _open_validated_image(input_path)
    try:
        oriented = source.copy() if source_format in {"heic", "heif"} else ImageOps.exif_transpose(source)
        try:
            rgb_image = oriented.convert("RGB") if oriented.mode != "RGB" else oriented.copy()
        finally:
            oriented.close()
    except DECODER_ERRORS as exc:
        raise ImagePreparationError("Uploaded image could not be decoded.") from exc
    finally:
        source.close()

    return rgb_image, source_format


def _validate_dimensions(width: int, height: int) -> None:
    if width <= 0 or height <= 0:
        raise ImagePreparationError("Uploaded image has invalid dimensions.")

    if width * height > MAX_DECODED_PIXELS:
        raise ImagePreparationError("Uploaded image is too large to process safely.")
