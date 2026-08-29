import os
from dotenv import load_dotenv

load_dotenv()

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

JWT_SECRET = os.getenv("JWT_SECRET", "rhyme-local-demo-secret-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 1440))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0").lower() in {"1", "true", "yes"}
