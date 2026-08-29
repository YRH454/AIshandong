"""视觉理解 API — 千问 Qwen-VL 图文问答 / OCR

学生上传图片(习题、报错截图、笔记),AI 理解图片并结合文本提问答疑。
"""
import base64
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.llm import chat_qwen_vision
from app.safety.content_filter import filter_content
from app.safety.garbage_detector import detect_garbage_input
from app.api.auth import enforce_registered_request

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/vision",
    tags=["vision"],
    dependencies=[Depends(enforce_registered_request)],
)

MAX_IMAGES = 3


class AnalyzeRequest(BaseModel):
    user_id: int
    message: str = ""
    images: list[str] = []  # base64 data URI 或 URL,最多3张
    mode: str = "qa"  # qa=图文问答 / ocr=文字提取


def _validate_images(images: list[str]) -> None:
    if not images:
        raise HTTPException(400, "请至少上传一张图片")
    if len(images) > MAX_IMAGES:
        raise HTTPException(400, f"一次最多上传 {MAX_IMAGES} 张图片")
    for img in images:
        if img.startswith("data:"):
            try:
                b64 = img.split(",", 1)[1]
                if len(b64) > 8 * 1024 * 1024 * 1.4:  # 原始图 ≤8MB
                    raise HTTPException(400, "图片过大，请压缩后上传")
                base64.b64decode(b64[:64] + "=" * ((4 - len(b64[:64]) % 4) % 4))
            except (ValueError, TypeError, IndexError) as e:
                raise HTTPException(400, f"图片数据格式错误: {e}")


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    """图文问答:图片 + 问题 → AI 理解并回答"""
    _validate_images(req.images)

    if req.message.strip():
        garbage = detect_garbage_input(req.message, "")
        if garbage["suspicious"]:
            raise HTTPException(400, "请用正常的文字描述你的问题")

    if req.mode == "ocr":
        prompt = "请提取图片中的全部文字内容，保持原有结构（表格、公式用文字描述），不要添加解释。"
    else:
        prompt = f"""你是一位耐心的大学课程助教。学生上传了图片并提问，请结合图片内容回答。
学生问题：{req.message or '请讲解这张图片的内容'}

要求：
1. 先简要描述图片中与你回答相关的关键信息（公式、代码、图表、文字）
2. 用通俗易懂的语言讲解，适合大学生理解
3. 如果是代码，指出问题所在并给出修正
4. 如果图片不清晰或无法理解，如实说明，不要编造"""

    try:
        images = [{"type": "image_url", "image_url": {"url": img}} for img in req.images]
        answer = chat_qwen_vision([{"role": "user", "content": prompt}], images, temperature=0.3, max_tokens=2048)

        # 安全过滤（防幻觉 + 敏感内容）
        filtered, audit = filter_content(
            answer, user_id=req.user_id, agent_name="vision",
            content_type="text", user_input=req.message,
        )
        return {"answer": filtered, "mode": req.mode, "filtered": filtered != answer}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"视觉理解失败: {e}")
        raise HTTPException(500, f"视觉理解服务暂时不可用: {e}")


@router.post("/ocr")
def ocr(req: AnalyzeRequest):
    """OCR:图片 → 文字提取"""
    req.mode = "ocr"
    return analyze(req)
