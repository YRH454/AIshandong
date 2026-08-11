"""RHYME — AI 学习 Agent API

精简后端:只保留 聊天答疑 / 资料生成 / 千问多模态 / 认证 四组能力。
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.auth import router as auth_router
from app.api.resources import router as resources_router
from app.api.tutor import router as tutor_router
from app.api.vision import router as vision_router
from app.api.media import router as media_router
from app.api.audio import router as audio_router
from app.api.artifacts import router as artifacts_router

app = FastAPI(
    title="RHYME · Learning Agent",
    description="基于大模型的个性化学习 Agent — 聊天答疑 + 一键生成资料",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    from app.database import init_core_tables
    from app.services.resources_db import init_tables
    from app.services.artifact_db import init_tables as init_artifact_tables
    from app.services.map_db import init_tables as init_map_tables
    from app.services.practice_db import init_tables as init_practice_tables
    from app.services.learning_progress_db import init_tables as init_learning_progress_tables
    init_core_tables()
    init_tables()
    init_artifact_tables()
    init_map_tables()
    init_practice_tables()
    init_learning_progress_tables()
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
