from pathlib import Path
import sys

import pytest
from fastapi import HTTPException
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from image_preparation import (  # noqa: E402
    ImagePreparationError,
    MAX_DECODED_PIXELS,
    prepare_workspace_image,
    save_oriented_upload,
)
from main import _assert_decoded_format, _resolve_image_format  # noqa: E402


@pytest.mark.parametrize(
    ("content_type", "filename", "expected"),
    [
        ("image/jpeg", "room.jpg", (".jpg", "jpeg")),
        ("image/png", "room.png", (".png", "png")),
        ("image/webp", "room.webp", (".webp", "webp")),
        ("image/heic", "room.heic", (".heic", "heif")),
        ("image/heif", "room.heif", (".heif", "heif")),
        ("", "room.heic", (".heic", "heif")),
        ("application/octet-stream", "room.webp", (".webp", "webp")),
    ],
)
def test_resolve_image_format(content_type, filename, expected):
    assert _resolve_image_format(content_type, filename) == expected


@pytest.mark.parametrize(
    ("content_type", "filename", "message"),
    [
        ("image/png", "room.webp", "filename extension do not match"),
        ("image/gif", "room.gif", "Upload a JPG, PNG, WebP"),
        ("application/octet-stream", "room.pdf", "Upload a JPG, PNG, WebP"),
    ],
)
def test_resolve_image_format_rejects_invalid_contract(content_type, filename, message):
    with pytest.raises(HTTPException, match=message):
        _resolve_image_format(content_type, filename)


def test_assert_decoded_format_accepts_heif_family_and_rejects_mismatch():
    _assert_decoded_format("heif", "heif")
    _assert_decoded_format("heif", "heic")
    with pytest.raises(HTTPException, match="contents do not match"):
        _assert_decoded_format("heif", "jpeg")


@pytest.mark.parametrize(
    ("source_format", "suffix"),
    [("JPEG", ".jpg"), ("PNG", ".png"), ("WEBP", ".webp")],
)
def test_static_formats_are_decoded_and_preserved(tmp_path, source_format, suffix):
    raw_path = tmp_path / f"raw{suffix}"
    normalized_path = tmp_path / f"normalized{suffix}"
    Image.new("RGB", (64, 48), "cyan").save(raw_path, source_format)
    metadata = save_oriented_upload(raw_path, normalized_path)
    assert metadata["width"] == 64
    assert metadata["height"] == 48
    assert metadata["source_format"] == source_format.lower()
    with Image.open(normalized_path) as normalized:
        assert normalized.size == (64, 48)


def test_heif_is_normalized_to_opencv_compatible_jpeg(tmp_path):
    pillow_heif = pytest.importorskip("pillow_heif")
    raw_path = tmp_path / "raw.heic"
    normalized_path = tmp_path / "normalized.jpg"
    source = Image.new("RGB", (80, 120), "green")
    heif_file = pillow_heif.from_pillow(source)
    heif_file.save(raw_path, quality=90)
    metadata = save_oriented_upload(raw_path, normalized_path)
    assert metadata["source_format"] in {"heic", "heif"}
    assert metadata["format"] == "jpg"
    assert metadata["width"] == 80
    assert metadata["height"] == 120
    with Image.open(normalized_path) as normalized:
        assert normalized.format == "JPEG"
        assert normalized.size == (80, 120)


def test_animated_webp_is_rejected(tmp_path):
    raw_path = tmp_path / "animated.webp"
    frames = [Image.new("RGB", (16, 16), color) for color in ("red", "blue")]
    frames[0].save(raw_path, "WEBP", save_all=True, append_images=frames[1:], duration=50)
    with pytest.raises(ImagePreparationError, match="Animated or multi-frame"):
        save_oriented_upload(raw_path, tmp_path / "normalized.webp")


def test_corrupt_image_is_rejected(tmp_path):
    raw_path = tmp_path / "corrupt.webp"
    raw_path.write_bytes(b"not an image")
    with pytest.raises(ImagePreparationError, match="could not be decoded"):
        save_oriented_upload(raw_path, tmp_path / "normalized.webp")


def test_decoded_pixel_limit_is_checked_before_conversion(tmp_path, monkeypatch):
    raw_path = tmp_path / "oversized.png"
    raw_path.write_bytes(b"placeholder")

    class OversizedImage:
        format = "PNG"
        width = MAX_DECODED_PIXELS + 1
        height = 1
        n_frames = 1
        is_animated = False

        def close(self):
            return None

    monkeypatch.setattr("image_preparation.Image.open", lambda _path: OversizedImage())
    with pytest.raises(ImagePreparationError, match="too large to process safely"):
        save_oriented_upload(raw_path, tmp_path / "normalized.png")


def test_workspace_contract_remains_webp(tmp_path):
    source_path = tmp_path / "room.jpg"
    workspace_path = tmp_path / "workspace.webp"
    Image.new("RGB", (2400, 1200), "white").save(source_path, "JPEG")
    metadata = prepare_workspace_image(source_path, workspace_path)
    assert metadata["format"] == "webp"
    assert metadata["width"] == 1920
    assert metadata["height"] == 960
    assert workspace_path.is_file()
