"""Coverage for remote media URL validation."""

from pathlib import Path
import sys
import unittest

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.input_security import validate_media_reference, validate_remote_media_reference


class InputSecurityTest(unittest.TestCase):
    def test_public_https_url_is_allowed(self):
        self.assertEqual(
            validate_remote_media_reference("https://cdn.example.com/lesson.png", field="图片地址"),
            "https://cdn.example.com/lesson.png",
        )

    def test_private_and_credentialed_urls_are_rejected(self):
        for value in ("http://127.0.0.1:8000/internal", "http://user:pass@example.com/a"):
            with self.assertRaises(HTTPException):
                validate_remote_media_reference(value)

    def test_data_uri_is_allowed_but_local_path_is_only_media_reference(self):
        self.assertTrue(validate_media_reference("data:image/png;base64,abc").startswith("data:"))
        self.assertEqual(validate_media_reference("/tmp/audio.wav"), "/tmp/audio.wav")


if __name__ == "__main__":
    unittest.main()

