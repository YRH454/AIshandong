import os
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()
IS_PRODUCTION = APP_ENV in {"production", "prod"}

MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE")
DB_BACKEND = os.getenv("DB_BACKEND", "sqlite").lower()
SQLITE_PATH = os.getenv(
    "SQLITE_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "xuejing_demo.db"),
)

# Comma-separated browser origins. Keep local defaults for development and
# provide the deployed frontend origin through the environment in production.
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if origin.strip()
]

OSS_ENDPOINT = os.getenv("OSS_ENDPOINT")
OSS_BUCKET = os.getenv("OSS_BUCKET")
OSS_ACCESS_KEY_ID = os.getenv("OSS_ACCESS_KEY_ID")
OSS_ACCESS_KEY_SECRET = os.getenv("OSS_ACCESS_KEY_SECRET")

QWEN_API_KEY = os.getenv("QWEN_API_KEY")
QWEN_MODEL = os.getenv("QWEN_MODEL")
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL")

# ── 千问多模态(DashScope)──────────────────────────
# 视觉理解 / 图像生成 / 视频生成 / 语音,与 QWEN 共用同一个百炼 Key
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY") or QWEN_API_KEY
QWEN_VISION_MODEL = os.getenv("QWEN_VISION_MODEL", "qwen-vl-max")
WAN_IMAGE_MODEL = os.getenv("WAN_IMAGE_MODEL", "wan2.7-image-pro")
WAN_VIDEO_MODEL = os.getenv("WAN_VIDEO_MODEL", "wan2.7-t2v")
Qwen_TTS_MODEL = os.getenv("QWEN_TTS_MODEL", "qwen3-tts-flash")
QWEN_ASR_MODEL = os.getenv("QWEN_ASR_MODEL", "qwen3-asr-flash")
DASHSCOPE_API_URL = os.getenv("DASHSCOPE_API_URL", "https://dashscope.aliyuncs.com/api/v1")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL")

SEEDANCE_API_KEY = os.getenv("SEEDANCE_API_KEY")
SEEDANCE_MODEL = os.getenv("SEEDANCE_MODEL")
SEEDANCE_BASE_URL = os.getenv("SEEDANCE_BASE_URL")

MIMO_API_KEY = os.getenv("MIMO_API_KEY")
MIMO_MODEL = os.getenv("MIMO_MODEL", "mimo-v2.5")
MIMO_BASE_URL = os.getenv("MIMO_BASE_URL")

DEFAULT_JWT_SECRET = "rhyme-local-demo-secret-change-in-production"
JWT_SECRET = os.getenv("JWT_SECRET", DEFAULT_JWT_SECRET)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 1440))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0").lower() in {"1", "true", "yes"}
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()

# There is intentionally one bootstrap administrator for this deployment.
# Keeping the address in configuration makes the rule explicit and prevents a
# public registration request from choosing its own role.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "3539921167@qq.com").strip().lower()
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "EGOIST").strip() or "EGOIST"
ADMIN_BOOTSTRAP_PASSWORD = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "").strip()
PASSWORD_RESET_DEBUG = os.getenv(
    "PASSWORD_RESET_DEBUG", "0" if IS_PRODUCTION else "1"
).lower() in {"1", "true", "yes"}
AUTH_RATE_LIMIT = int(os.getenv("AUTH_RATE_LIMIT", "12"))
AUTH_RATE_WINDOW_SECONDS = int(os.getenv("AUTH_RATE_WINDOW_SECONDS", "300"))


def validate_runtime_config() -> None:
    """Fail fast for unsafe production settings.

    Local development intentionally keeps a simple SQLite/default-cookie setup.
    Once the service is marked as production, silently accepting a demo JWT
    secret or a non-secure cookie would be an easy deployment footgun, so the
    process stops with a readable configuration error instead.
    """
    errors: list[str] = []
    if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
        errors.append("COOKIE_SAMESITE 必须是 lax、strict 或 none")
    if COOKIE_SAMESITE == "none" and not COOKIE_SECURE:
        errors.append("COOKIE_SAMESITE=none 时必须同时启用 COOKIE_SECURE=1")
    if JWT_EXPIRE_MINUTES <= 0 or JWT_EXPIRE_MINUTES > 60 * 24 * 30:
        errors.append("JWT_EXPIRE_MINUTES 必须在 1 到 43200 分钟之间")
    if not ADMIN_EMAIL or "@" not in ADMIN_EMAIL or len(ADMIN_EMAIL) > 160:
        errors.append("ADMIN_EMAIL 必须是有效邮箱")
    if ADMIN_BOOTSTRAP_PASSWORD and not 8 <= len(ADMIN_BOOTSTRAP_PASSWORD) <= 128:
        errors.append("ADMIN_BOOTSTRAP_PASSWORD 必须在 8 到 128 位之间")
    if AUTH_RATE_LIMIT <= 0 or AUTH_RATE_LIMIT > 1000:
        errors.append("AUTH_RATE_LIMIT 必须在 1 到 1000 之间")
    if AUTH_RATE_WINDOW_SECONDS <= 0 or AUTH_RATE_WINDOW_SECONDS > 24 * 60 * 60:
        errors.append("AUTH_RATE_WINDOW_SECONDS 必须在 1 到 86400 秒之间")
    if DB_BACKEND not in {"sqlite", "mysql"}:
        errors.append("DB_BACKEND 只能是 sqlite 或 mysql")

    if IS_PRODUCTION:
        if len(JWT_SECRET) < 32 or JWT_SECRET == DEFAULT_JWT_SECRET:
            errors.append("生产环境必须设置至少 32 位且非示例值的 JWT_SECRET")
        if not COOKIE_SECURE:
            errors.append("生产环境必须启用 COOKIE_SECURE=1")
        if not CORS_ORIGINS or any(origin == "*" for origin in CORS_ORIGINS):
            errors.append("生产环境必须明确配置 CORS_ORIGINS，不能使用通配符 *")
        if DB_BACKEND == "sqlite":
            errors.append("生产环境不能使用 SQLite，请切换到持久化 MySQL")
        if DB_BACKEND == "mysql" and not all((MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE)):
            errors.append("生产 MySQL 必须完整配置 MYSQL_HOST、MYSQL_USER、MYSQL_DATABASE")

    if errors:
        raise RuntimeError("运行环境配置不安全或无效：" + "；".join(errors))
