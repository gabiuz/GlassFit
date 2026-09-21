import io
from pathlib import Path
import numpy as np
import pytest
from PIL import Image
from PIL.ExifTags import Base as ExifBase

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from exif_extraction import extract_exif_camera_info, ExifCameraInfo
from scale_estimation import (
    REFERENCE_OBJECT_HEIGHTS_CM,
    estimate_scale_from_objects,
    _compute_depth_correction,
)


def test_reference_object_heights_coverage():
    expected_labels = {
        "person", "refrigerator", "toilet", "table", "chair",
        "sofa", "bed", "television", "oven", "microwave"
    }
    for label in expected_labels:
        assert label in REFERENCE_OBJECT_HEIGHTS_CM
        height, weight = REFERENCE_OBJECT_HEIGHTS_CM[label]
        assert height > 0
        assert 0 < weight <= 1.0


def test_unknown_labels_excluded():
    objects = [
        {"label": "unsupported_label_xyz", "bbox": [10, 10, 100, 200], "confidence": 0.9},
        {"label": "book", "bbox": [5, 5, 20, 50], "confidence": 0.8},
    ]
    res = estimate_scale_from_objects(objects, None, 1000, 1000)
    assert res.best_scale_cm_per_px is None
    assert res.confidence == 0.0
    assert res.method == "none"
    assert len(res.anchors) == 0


def test_bbox_height_under_10px_excluded():
    objects = [
        {"label": "person", "bbox": [10, 10, 50, 18], "confidence": 0.9},  # height = 8px (< 10)
    ]
    res = estimate_scale_from_objects(objects, None, 1000, 1000)
    assert res.best_scale_cm_per_px is None
    assert len(res.anchors) == 0


def test_single_person_scale_factor():
    # 163 cm / 400 px = 0.4075 cm/px
    objects = [
        {"label": "person", "bbox": [100, 100, 200, 500], "confidence": 1.0},
    ]
    res = estimate_scale_from_objects(objects, None, 1000, 1000)
    assert res.best_scale_cm_per_px == pytest.approx(0.4075, rel=1e-4)
    assert len(res.anchors) == 1
    assert res.anchors[0]["label"] == "person"
    assert res.anchors[0]["scale_cm_per_px"] == pytest.approx(0.4075, rel=1e-4)
    assert res.confidence > 0
    assert res.method == "yolo_anchor"


def test_depth_correction_sampling():
    # Uniform depth map with value 0.75
    depth_map = np.full((100, 100), 0.75, dtype=np.float32)
    bbox = [20, 20, 40, 40]
    corr = _compute_depth_correction(depth_map, bbox, 100, 100)
    assert corr == pytest.approx(0.75, rel=1e-3)


def test_depth_correction_out_of_bounds():
    depth_map = np.ones((50, 50), dtype=np.float32)
    bbox = [1000, 1000, 1100, 1100]
    corr = _compute_depth_correction(depth_map, bbox, 100, 100)
    # Should safely return 1.0 or valid patch average without crashing
    assert isinstance(corr, float)


def test_multiple_reference_objects_weighted_average():
    # person: height 163, bbox 400 -> scale 0.4075, base_weight 0.9
    # chair: height 90, bbox 200 -> scale 0.45, base_weight 0.5
    objects = [
        {"label": "person", "bbox": [0, 0, 100, 400], "confidence": 1.0},
        {"label": "chair", "bbox": [150, 0, 250, 200], "confidence": 1.0},
    ]
    res = estimate_scale_from_objects(objects, None, 1000, 1000)
    assert len(res.anchors) == 2
    expected_weight = 0.90 + 0.50
    expected_scale = (0.4075 * 0.90 + 0.45 * 0.50) / expected_weight
    assert res.best_scale_cm_per_px == pytest.approx(expected_scale, rel=1e-3)


def test_empty_objects_returns_none():
    res = estimate_scale_from_objects([], None, 1000, 1000)
    assert res.best_scale_cm_per_px is None
    assert res.confidence == 0.0
    assert res.method == "none"
    assert res.anchors == []


def test_exif_extraction_from_jpeg_with_focal_length(tmp_path):
    img_path = tmp_path / "test_exif.jpg"
    img = Image.new("RGB", (200, 200), color="white")
    
    exif = img.getexif()
    exif[ExifBase.FocalLength] = 4.25
    exif[ExifBase.FocalLengthIn35mmFilm] = 26
    exif[ExifBase.Model] = "Samsung SM-A546B"
    img.save(img_path, "JPEG", exif=exif)

    info = extract_exif_camera_info(img_path)
    assert info.focal_length_mm == pytest.approx(4.25, rel=1e-2)
    assert info.focal_length_35mm_equiv == 26
    assert info.device_model == "Samsung SM-A546B"


def test_exif_extraction_png_no_exif(tmp_path):
    img_path = tmp_path / "test.png"
    img = Image.new("RGB", (100, 100), color="red")
    img.save(img_path, "PNG")

    info = extract_exif_camera_info(img_path)
    assert info.focal_length_mm is None
    assert info.focal_length_35mm_equiv is None
    assert info.device_model is None


def test_exif_extraction_corrupt_file(tmp_path):
    corrupt_path = tmp_path / "corrupt.jpg"
    corrupt_path.write_bytes(b"invalid corrupt data not an image")

    info = extract_exif_camera_info(corrupt_path)
    assert info.focal_length_mm is None
    assert info.device_model is None


def test_exif_privacy_safeguards():
    # ExifCameraInfo must only contain non-PII fields
    allowed_fields = {
        "focal_length_mm",
        "focal_length_35mm_equiv",
        "device_model",
        "image_width_exif",
        "image_height_exif",
    }
    field_names = set(ExifCameraInfo.__dataclass_fields__.keys())
    assert field_names == allowed_fields
