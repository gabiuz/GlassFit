"""IMP-MS57 / QAD-TC72. Probe integration uses synthetic private temporary images."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image

SPEC = importlib.util.spec_from_file_location(
    "ms57_probe", Path(__file__).resolve().parents[2] / "scripts/ms57/detect.py"
)
PROBE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROBE)


class BenchmarkProbeTests(unittest.TestCase):
    def test_original_hash_and_orientation_are_separate_from_oriented_pixels(self):
        import hashlib
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "rotated.jpg"
            image = Image.new("RGB", (320, 240), (80, 80, 80))
            exif = Image.Exif()
            exif[274] = 6
            image.save(path, exif=exif)
            result = PROBE.probe(path)
            self.assertEqual(result["sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
            self.assertEqual((result["width"], result["height"]), (240, 320))
            self.assertEqual(result["originalOrientation"], 6)
            self.assertIsNone(result["result"]["detected_corners"])
            self.assertGreaterEqual(result["detectionMs"], 0)
            self.assertEqual(result["environment"]["maxCandidates"], 8)

    def test_missing_private_image_is_an_error_not_a_detection_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(FileNotFoundError):
                PROBE.probe(Path(folder) / "missing.png")


if __name__ == "__main__":
    unittest.main()
