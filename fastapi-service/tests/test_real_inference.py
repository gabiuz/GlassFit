"""Opt-in real-model latency verification for QAD-VG2."""

from __future__ import annotations

import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pytest


@pytest.mark.performance
def test_warmed_real_inference_p95_is_within_qad_budget() -> None:
    service_url = os.getenv("CV_TEST_SERVICE_URL")
    image_path_value = os.getenv("CV_TEST_IMAGE")
    if not service_url or not image_path_value:
        pytest.skip("Set CV_TEST_SERVICE_URL and CV_TEST_IMAGE for the real CV test.")

    image_path = Path(image_path_value)
    if not image_path.is_file():
        pytest.fail(f"CV_TEST_IMAGE does not exist: {image_path}")

    image_bytes = image_path.read_bytes()
    content_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
    endpoint = f"{service_url.rstrip('/')}/analyze-image"

    def analyze_once() -> float:
        started = time.perf_counter()
        response = httpx.post(
            endpoint,
            files={"image": (image_path.name, image_bytes, content_type)},
            timeout=120,
        )
        response.raise_for_status()
        return time.perf_counter() - started

    analyze_once()
    with ThreadPoolExecutor(max_workers=20) as executor:
        durations = list(executor.map(lambda _index: analyze_once(), range(20)))

    ordered = sorted(durations)
    p95_index = math.ceil(0.95 * len(ordered)) - 1
    assert ordered[p95_index] < 2.5, f"p95 was {ordered[p95_index]:.3f}s"
