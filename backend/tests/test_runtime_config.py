"""Runtime configuration guardrails for a public deployment."""

import importlib
import os
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class RuntimeConfigTest(unittest.TestCase):
    def setUp(self):
        self.original = {key: os.environ.get(key) for key in (
            "APP_ENV", "JWT_SECRET", "COOKIE_SECURE", "COOKIE_SAMESITE", "CORS_ORIGINS",
            "DB_BACKEND", "MYSQL_HOST", "MYSQL_USER", "MYSQL_DATABASE",
        )}

    def tearDown(self):
        for key, value in self.original.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        from app import config
        importlib.reload(config)

    def _reload(self):
        from app import config
        return importlib.reload(config)

    def test_development_defaults_remain_usable(self):
        os.environ["APP_ENV"] = "development"
        config = self._reload()
        config.validate_runtime_config()

    def test_production_rejects_demo_secret_and_insecure_cookie(self):
        os.environ["APP_ENV"] = "production"
        os.environ["JWT_SECRET"] = "rhyme-local-demo-secret-change-in-production"
        os.environ["COOKIE_SECURE"] = "0"
        config = self._reload()
        with self.assertRaises(RuntimeError) as error:
            config.validate_runtime_config()
        self.assertIn("JWT_SECRET", str(error.exception))
        self.assertIn("COOKIE_SECURE", str(error.exception))

    def test_production_accepts_explicit_cloudflare_cookie_and_origin(self):
        os.environ["APP_ENV"] = "production"
        os.environ["DB_BACKEND"] = "mysql"
        os.environ["MYSQL_HOST"] = "mysql.example"
        os.environ["MYSQL_USER"] = "rhyme"
        os.environ["MYSQL_DATABASE"] = "rhyme"
        os.environ["JWT_SECRET"] = "a" * 48
        os.environ["COOKIE_SECURE"] = "1"
        os.environ["COOKIE_SAMESITE"] = "none"
        os.environ["CORS_ORIGINS"] = "https://study.example.com"
        config = self._reload()
        config.validate_runtime_config()


if __name__ == "__main__":
    unittest.main()
