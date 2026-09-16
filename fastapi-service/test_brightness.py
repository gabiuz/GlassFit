import numpy as np
import cv2
import pytest
from pathlib import Path
from brightness import (
    analyze_brightness,
    analyze_lighting,
    classify_brightness,
)


def test_classify_brightness():
    assert classify_brightness(50) == "dim"
    assert classify_brightness(120) == "normal"
    assert classify_brightness(200) == "bright"


def test_analyze_brightness_and_lighting(tmp_path: Path):
    # Generate synthetic image with controlled luminance
    h, w = 300, 400
    img = np.ones((h, w, 3), dtype=np.uint8) * 140
    # Add a warm color tint and a slight spatial gradient
    img[:, :, 2] = np.clip(img[:, :, 2] + 20, 0, 255)  # red channel in BGR is index 2
    img[:, :, 0] = np.clip(img[:, :, 0] - 15, 0, 255)  # blue channel in BGR is index 0

    # Add subtle random sensor noise
    noise = np.random.normal(0, 3.0, (h, w, 3)).astype(np.int16)
    noisy_img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    test_img_path = tmp_path / "test_room.png"
    cv2.imwrite(str(test_img_path), noisy_img)

    # 1. Brightness analysis
    brightness_res = analyze_brightness(test_img_path)
    assert "mean_pixel_intensity" in brightness_res
    assert brightness_res["category"] in ["dim", "normal", "bright"]

    # 2. Lighting analysis
    lighting_res = analyze_lighting(test_img_path)
    assert len(lighting_res["mean_rgb"]) == 3
    assert len(lighting_res["ambient_rgb"]) == 3
    assert lighting_res["ambient_hex"].startswith("#")
    assert 0.0 <= lighting_res["contrast"] <= 2.0
    assert 0.0 <= lighting_res["saturation"] <= 1.0
    assert -1.0 <= lighting_res["warmth"] <= 1.0
    assert -1.0 <= lighting_res["tint"] <= 1.0
    assert lighting_res["temperature"] in ["cool", "neutral", "warm"]
    assert 0.0 <= lighting_res["sharpness"] <= 1.50
    assert 0.0 <= lighting_res["noise"] <= 1.0

    # Check suggested model adjustments
    sugg = lighting_res["suggested"]
    assert 0.70 <= sugg["brightness"] <= 1.25
    assert 0.80 <= sugg["contrast"] <= 1.20
    assert 0.75 <= sugg["saturation"] <= 1.15
    assert 0.05 <= sugg["color_mix"] <= 0.30
    assert 0.00 <= sugg["blur_px"] <= 0.60
    assert 0.00 <= sugg["grain"] <= 0.18
    assert 0.10 <= sugg["shadow_opacity"] <= 0.45
    assert -0.30 <= sugg["exposure_bias"] <= 0.30
    assert sugg["ambient_tint_hex"].startswith("#")
    assert 0.80 <= sugg["directional_intensity"] <= 1.80
    assert 0.28 <= sugg["ambient_intensity"] <= 0.55


def test_health_endpoint():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

