"""万相视频生成 API — 微课短视频(异步任务模式)

POST /video 提交文生视频任务 → 返回 task_id;GET /video/{task_id} 轮询。
SUCCEEDED 时自动下载到本地 static/videos 并返回本地 URL(远端 URL 24h 过期)。
"""
import logging
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.services.llm import submit_wan_video, query_wan_video, _download_to_static
from app.services.media_db import create_video_task, get_video_task, update_video_task
from app.safety.garbage_detector import detect_garbage_input
from app.api.auth import enforce_registered_request

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/media",
    tags=["media"],
    dependencies=[Depends(enforce_registered_request)],
)


class VideoRequest(BaseModel):
    user_id: int
    prompt: str = Field(min_length=5, max_length=2000)
    size: str = "1280*720"
    duration: int = 5


@router.post("/video")
def create_video(req: VideoRequest, user: dict = Depends(enforce_registered_request)):
    """提交文生视频任务"""
    prompt = req.prompt.strip()
    if len(prompt) < 5:
        raise HTTPException(400, "视频描述太短")
    if req.size not in {"1280*720", "720*1280", "1024*1024"}:
        raise HTTPException(400, "画面尺寸仅支持 1280*720、720*1280 或 1024*1024")
    if req.duration not in (3, 5, 8, 10):
        raise HTTPException(400, "时长仅支持 3/5/8/10 秒")
    garbage = detect_garbage_input(prompt, "")
    if garbage["suspicious"]:
        raise HTTPException(400, "请用正常的文字描述视频内容")

    if int(req.user_id) != int(user["id"]):
        raise HTTPException(status_code=403, detail="不能操作其他用户的数据")
    task_id = submit_wan_video(prompt, size=req.size, duration=req.duration)
    if not task_id:
        raise HTTPException(500, "视频任务提交失败，请确认已配置千问 API Key")
    # The provider task id is not a capability by itself: persist its owner so
    # a different authenticated account cannot poll or download it.
    create_video_task(req.user_id, task_id, prompt, req.size, req.duration)
    return {"task_id": task_id, "status": "PENDING", "prompt": prompt}


@router.get("/video/{task_id}")
def get_video(task_id: str, user: dict = Depends(enforce_registered_request)):
    """轮询视频任务状态;SUCCEEDED 时下载并返回本地 URL"""
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", task_id):
        raise HTTPException(status_code=400, detail="视频任务编号无效")
    task = get_video_task(task_id, int(user["id"]))
    if not task:
        # Do not reveal whether a task exists for another account.
        raise HTTPException(status_code=404, detail="视频任务不存在或已无权访问")
    if task.get("status") == "SUCCEEDED" and (task.get("local_url") or task.get("video_url")):
        return {
            "task_id": task_id,
            "status": "SUCCEEDED",
            "video_url": task.get("local_url") or task.get("video_url"),
            "local": bool(task.get("local_url")),
            "prompt": task.get("prompt", ""),
        }

    result = query_wan_video(task_id)
    if result["status"] == "SUCCEEDED":
        video_url = result.get("video_url", "")
        if not video_url:
            message = "生成成功但未获取到视频地址"
            update_video_task(task_id, int(user["id"]), status="FAILED", error=message)
            return {"task_id": task_id, "status": "FAILED", "message": message}
        local = _download_to_static(video_url, subdir="videos", prefix="wan", ext=".mp4")
        update_video_task(
            task_id,
            int(user["id"]),
            status="SUCCEEDED",
            video_url=video_url,
            local_url=local or "",
        )
        return {"task_id": task_id, "status": "SUCCEEDED", "video_url": local or video_url, "local": bool(local), "prompt": task.get("prompt", "")}
    if result["status"] == "FAILED":
        update_video_task(task_id, int(user["id"]), status="FAILED", error=result.get("message", "生成失败"))
    else:
        update_video_task(task_id, int(user["id"]), status=result["status"])
    return {"task_id": task_id, **result}
