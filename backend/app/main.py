"""RHYME — AI 学习 Agent API

精简后端:只保留 聊天答疑 / 资料生成 / 千问多模态 / 认证 四组能力。
"""
import os
from uuid import uuid4
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.auth import (
    cleanup_expired_sessions,
    ensure_primary_admin,
    mark_legacy_demo_accounts,
    router as auth_router,
)
from app.api.resources import router as resources_router
from app.api.tutor import router as tutor_router
from app.api.vision import router as vision_router
from app.api.media import router as media_router
from app.api.audio import router as audio_router
from app.api.artifacts import router as artifacts_router
from app.config import CORS_ORIGINS, validate_runtime_config

app = FastAPI(
    title="RHYME · Learning Agent",
    description="基于大模型的个性化学习 Agent — 聊天答疑 + 一键生成资料",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def operational_headers(request, call_next):
    """Attach a request id and conservative browser security headers."""
    request_id = request.headers.get("x-request-id") or uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), payment=()"
    if os.getenv("APP_ENV", "development").strip().lower() in {"production", "prod"}:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(auth_router)
app.include_router(resources_router)
app.include_router(tutor_router)
app.include_router(vision_router)
app.include_router(media_router)
app.include_router(audio_router)
app.include_router(artifacts_router)


@app.on_event("startup")
def startup():
    """应用启动时初始化数据库表（避免在 import 时执行）"""
    validate_runtime_config()
    from app.database import init_core_tables
    from app.migrations import run_migrations
    from app.services.resources_db import init_tables
    from app.services.artifact_db import init_tables as init_artifact_tables
    from app.services.map_db import init_tables as init_map_tables
    from app.services.practice_db import init_tables as init_practice_tables
    from app.services.learning_progress_db import init_tables as init_learning_progress_tables
    from app.services.generation_jobs import init_tables as init_generation_job_tables, recover_incomplete_jobs
    from app.services.media_db import prune_video_tasks
    init_core_tables()
    ensure_primary_admin()
    mark_legacy_demo_accounts()
    run_migrations()
    init_tables()
    init_artifact_tables()
    init_map_tables()
    init_practice_tables()
    init_learning_progress_tables()
    init_generation_job_tables()
    # Clean guest rows only after every feature table exists; otherwise an
    # expired session could be removed while its temporary feature data is
    # left behind in a table that had not been bootstrapped yet.
    cleanup_expired_sessions()
    recover_incomplete_jobs()
    prune_video_tasks()
    # 预热 RAG 知识库索引（后台线程，不阻塞启动；失败静默回退关键词检索）
    def _prewarm_rag():
        try:
            from app.services.rag_service import ensure_indexed
            ready = ensure_indexed()
            print(f"[RAG] 知识库索引{'就绪' if ready else '未就绪（将使用关键词检索）'}")
        except Exception:
            pass
    import threading
    threading.Thread(target=_prewarm_rag, daemon=True).start()


# 媒体静态文件（画像/音频/视频落地目录）
_static_root = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
for sub in ("profiles", "audio", "videos"):
    os.makedirs(os.path.join(_static_root, sub), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_root), name="static")


@app.get("/")
def root():
    return {"message": "RHYME · Learning Agent API", "version": "2.0.0"}


@app.get("/health")
def health():
    from app.database import query
    try:
        query("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}
