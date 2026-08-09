"""万相视频生成 API — 微课短视频(异步任务模式)

POST /video 提交文生视频任务 → 返回 task_id;GET /video/{task_id} 轮询。
SUCCEEDED 时自动下载到本地 static/videos 并返回本地 URL(远端 URL 24h 过期)。
"""
import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm import submit_wan_video, query_wan_video, _download_to_static
from app.safety.garbage_detector import detect_garbage_input

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/media", tags=["media"])


class VideoRequest(BaseModel):
    user_id: int
    prompt: str
    size: str = "1280*720"
    duration: int = 5


@router.post("/video")
def create_video(req: VideoRequest):
    """提交文生视频任务"""
    prompt = req.prompt.strip()
    if len(prompt) < 5:
        raise HTTPException(400, "视频描述太短")
    if req.duration not in (3, 5, 8, 10):
        raise HTTPException(400, "时长仅支持 3/5/8/10 秒")
    garbage = detect_garbage_input(prompt, "")
    if garbage["suspicious"]:
        raise HTTPException(400, "请用正常的文字描述视频内容")

    task_id = submit_wan_video(prompt, size=req.size, duration=req.duration)
    if not task_id:
        raise HTTPException(500, "视频任务提交失败，请确认已配置千问 API Key")
    return {"task_id": task_id, "status": "PENDING", "prompt": prompt}


@router.get("/video/{task_id}")
def get_video(task_id: str):
    """轮询视频任务状态;SUCCEEDED 时下载并返回本地 URL"""
    result = query_wan_video(task_id)
    if result["status"] == "SUCCEEDED":
        video_url = result.get("video_url", "")
        if not video_url:
            return {"status": "FAILED", "message": "生成成功但未获取到视频地址"}
        local = _download_to_static(video_url, subdir="videos", prefix="wan", ext=".mp4")
        return {"status": "SUCCEEDED", "video_url": local or video_url, "local": bool(local)}
    return result
